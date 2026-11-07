---
name: browser-e2e
description: Use this skill when writing, running, reviewing or fixing browser end-to-end tests, or when a feature plan reaches its end-to-end story - deciding whether a flow earns an end-to-end test at all, setting up Playwright, the Compose e2e profile behind make e2e, signing in once and seeding data through the API, waiting on page markers, parallel isolation per tenant, the e2e CI job and its browser cache, quarantining a flaky test, or whether to add visual snapshots. Triggers include "add an e2e test", "test the whole flow in a real browser", "Playwright", "passes locally but fails in CI", "flaky test", "waitForTimeout", "the tests depend on each other", "the e2e job is slow", "test sign-in", and "should this be an e2e test or a story". Framework-neutral. Not for component and story tests (ui-component-contract), Go HTTP or integration tests (golang-testing), the Makefile and Compose layout in general (repo-tooling), what each screen state looks like (ui-patterns), or the session mechanics under test (go-auth).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Browser end-to-end tests

The tier that proves the built binary, the browser and the database work
together. It is the most expensive and the least precise test there is, so
it carries only what nothing cheaper can prove. A suite that passed
against `vite dev` for a month while the shipped binary answered 404 to
every reloaded deep link (the SPA fallback was never embedded) is the
reason it runs against the real image; a suite that grew to a test per
validation message and flaked weekly is the reason it is capped.

## What earns an end-to-end test

| Earns one | Stays in stories or Go tests |
|---|---|
| The feature's golden path: the one task it exists for, start to visible result | each validation message, each async state, each variant |
| That result's deep link: load the URL cold, see the same thing | permission matrices and business rules (Go tests) |
| Sign in with return path, sign out, an expired session (once per app) | layout, colour, spacing (Storybook and tokens) |
| Anything only the three tiers together can break: the session cookie, the CSRF header, a server stream, a migration the screen reads | keyboard flows of a single unit (play tests) |

**Cap: three tests per feature** (golden path, deep link, and at most one
cross-tier check). A fourth needs a reason in the feature brief. Plan step
6 (`plan-feature`) is this skill's story.

## The run

- `make e2e` builds the image, starts the Compose `e2e` profile (the app
  from the production Dockerfile, a fresh database) under its own Compose
  project, runs Playwright, and tears it down with its volumes. Never
  against `vite dev` or `go run`.
- The setup project waits for `/readyz` to answer 200 (`service-operations`),
  then every navigation waits for `[data-page="<slug>"][data-loaded="true"]`
  (`ui-patterns`). Nothing sleeps.
- Config defaults: Chromium only; `baseURL` `http://localhost:8080`;
  `trace: 'on-first-retry'`; video and screenshot retained on failure;
  retries 0 locally, 1 in CI, never more; `fullyParallel` with one tenant
  per worker; test 30 s, expect 5 s, action 10 s, navigation 15 s; fixed
  `locale` and `timezoneId`; reduced motion.
- A feature behind a flag has the flag on in `.env.e2e` from its
  end-to-end story onward.

## Layout

`e2e/` at the repository root, because it tests the binary, not the web
package. It is its own pnpm package:

```text
e2e/
  package.json  pnpm-lock.yaml  tsconfig.json  playwright.config.ts
  fixtures.ts          test, expect, per-worker storage state, seed, open
  support/pages.ts     expectLoaded(page, slug)
  support/seed.ts      Seed: typed calls to the API
  tests/auth.setup.ts  readiness, one account per worker, storage state
  tests/<feature>.spec.ts
  .auth/               gitignored
```

## Test shape

- Find things by role and accessible name (`getByRole`, `getByLabel`). No
  CSS, XPath or `getByText` to find a control, no test ids; the page
  markers are the only attribute selectors. A control a role query cannot
  find is an accessibility defect: fix the markup.
- Never `waitForTimeout`, never `waitForLoadState('networkidle')`. Wait for
  the URL, then the destination's page marker, then assert with
  auto-retrying `expect(locator)` assertions.
- Seed through the API with the `seed` fixture, never by clicking through
  other screens. Only the first administrator, which the API cannot
  create, comes from the binary's bootstrap configured in `.env.e2e`.
- Each test creates the records it needs with unique names and asserts
  only on them; no test reads another's data, counts all rows, or depends
  on order.
- Assert what the user sees after the action: the row in the list, the
  heading on the detail page after a reload. Not request payloads, not
  internal state.
- Authentication runs once: the setup project signs in one account per
  worker through the API and writes `.auth/worker-<n>.json`; tests pick
  theirs by `parallelIndex`. The sign-in test itself starts from an empty
  storage state and uses the UI.

Config, fixtures, seed and sample specs:
[references/playwright.md](references/playwright.md).

## CI

- One `e2e` job runs `make e2e` on every change except documentation; a
  Go-only change runs it, because it tests the binary. Filter at the job
  (a changes job), not with workflow `paths-ignore`, so a required check
  is skipped rather than left pending.
- Browsers are cached by Playwright version; system dependencies install
  on every run. On failure the HTML report, traces and videos upload as
  artifacts.
- **Flaky means quarantined the same day**: tag it `@quarantine` with an
  issue annotation; the main run excludes the tag and a non-blocking job
  runs it. It is fixed or deleted before the next release. Retries stay at
  1; raising them hides the next flake.

Workflow and quarantine details: [references/ci.md](references/ci.md).

## Visual snapshots

None by default: tokens and Storybook own appearance, and full-page
screenshots of live data churn. A project that adds them puts them in the
stories-as-tests run (vitest browser mode's screenshot assertion on a
story), baselines generated on CI's Linux image and committed beside the
story, never in this suite.

## Procedure: a feature's end-to-end story

1. List the flows; keep the golden path, its deep link and at most one
   cross-tier check.
2. Add a `seed` method for each record the tests start from.
3. Write the specs with the fixtures; turn the feature's flag on in `.env.e2e`.
4. Run the new specs repeated: `make e2e E2E_ARGS="--project=chromium --repeat-each=3 tests/<feature>.spec.ts"`.
   Three green runs, then the full `make e2e`.

## Gotchas

- Green against the dev server, red against the image: SPA fallback for
  deep links, embedded assets, CSP, `Secure` cookies and the base path only
  exist in the binary. The base URL is the Compose app, always.
- A `Secure` or `__Host-` session cookie is dropped on plain HTTP except
  on `localhost`. Use `http://localhost:8080`, not a container hostname or
  LAN address.
- A test that signs out, changes a password or revokes sessions kills its
  worker's stored session for every later test on that worker. Such tests
  start from an empty storage state and sign in themselves.
- Toasts animate and dismiss themselves. Assert the durable outcome; if
  the toast is the only one, `expect(page.getByRole('status')).toContainText(...)`,
  never a `textContent()` snapshot.
- After a click that navigates, waiting for `[data-loaded="true"]` alone
  matches the page you are leaving. Wait for the URL, then the
  destination's slug.
- Playwright here and vitest browser mode in `web/` each pin Playwright;
  different versions want different browser builds, and a cache keyed on
  one lockfile misses the other. Pin one version in both (Renovate groups
  them) and install browsers from each package.
- `make e2e` and `make dev-up` bind the same database host port; stop the
  dev stack first.

## Definition of done

- Each feature has its golden path and deep link (at most three tests),
  each starting from its own seeded data.
- No `waitForTimeout`, `networkidle`, CSS or text locator for structure,
  or UI seeding; every navigation waits on the destination marker.
- `make e2e` passes against the built image with a fresh database, three
  times in a row for new specs.
- CI runs it on code changes, uploads artifacts on failure, and no
  quarantined test outlives a release.

## References

- [references/playwright.md](references/playwright.md): open when setting
  up `e2e/` or writing a spec: config, Make target, fixtures, setup
  project, seed helper, sample specs.
- [references/ci.md](references/ci.md): open when adding or changing the CI
  job, its path filter, browser cache, artifacts or the quarantine run.
