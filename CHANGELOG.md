# Changelog

All notable changes to this repository. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.8.0] - 2026-11-08

### Added

- `api-topology`: the one picture every API and schema gate shows the owner: a JSON model of only the roots, endpoints, schemas and tables the story touches, each change marked and referenced unchanged nodes as names alone, rendered by dependency-free scripts into an interactive page (lanes ordered under what points at them, dotted connectors, an inspector with fields, generated JSON and usage, change highlighting with "was", an "only changes" filter, light and dark) and into the ASCII tree pasted in the conversation; `check.mjs` refuses dangling references and unmarked changes; the map lives under `.agents/topology/`, excluded locally, and is never committed.

- `flow-map`: the same treatment for a business flow: participants as swimlanes, ordered steps with decision branches, asynchronous and external steps, a failure path with a recovery on every step that can fail, entity state transitions with an owner, and the guarantees only the whole path makes, each naming its steps; rendered as an interactive page and as the numbered text sequence; steps carry the endpoint and screen ids so the three references line up; the flow document under `docs/flows/` is written from the accepted map.
- `ui-sketch`: the exploration round outside the codebase for a unit that does not exist yet: static HTML fragments on the project's tokens with real copy, one page with direction tabs, desktop and phone widths, the five async states and both themes, the round table and the recommendation, narrowing to one kept direction that becomes the brief for `ui-component-contract`; the check refuses lettered names, lorem ipsum, two kept directions and a round of one, and warns on literal colours, scripts and network loads.
- `groom`: the story lifecycle (`drafted`, `groomed`, `running`, `done`, `parked`), the reference each layer needs before a story is groomed, the order (flow, then shape, then look), the `Reference` section that puts the text form and the acceptance line into the story so an implementer in a worktree builds from it, and the rule that only groomed stories launch.

### Changed

- `plan-feature` files stories `drafted` and hands them to `groom`; its story template carries a `Status` line; `backlog-batches` launches only groomed items; `ui-exploration` keeps the Storybook round for redesigns and sends new units to `ui-sketch`; `ui-component-contract` takes the kept sketch as its brief; `contract-spec` presents a flow's gate as its flow map; `iterate` gates cross-module changes on it.
- `plan-feature` puts the map beside a plan with a schema or API story and names it as what the owner sees for those layers; `iterate` gates schema and API contract rows on it; `connect-rpc` and `api-contract` draw their step-5 gate from the real diff on it; `golang-database` makes the storage lane the schema gate; `contract-spec` links the API gate's map.

## [0.7.0] - 2026-11-08

### Added

- `checkpoint`: the one report shape for "what's the status", "now what" and "what do you need from me" (needs you first, then landed, running, blocked, next three), the state note the next context needs before a summary or the end of a session, and the rule that "did you do X" is answered with evidence gathered now.
- `guided-ops`: directing the owner through a console, dashboard or device the agent cannot drive: blocks of at most three numbered steps with what the owner should see, physical actions in a message of their own, the agent does everything it can reach itself and asks for missing access once with the reason, secrets never cross the chat, every item in a UI decision gets an answer, and a device record in the runbooks.
- `cloudflare-edge`: the one way a service is exposed: a tunnel with an Access policy per hostname, never a port forward, vendor relay or public SSH port; the new-hostname procedure, the dashboard map by product area, the host side of a tunnel, and a quarterly audit.
- `credential-rotation`: after an incident or exposure: contain, back up and prove the restore, rebuild, then rotate one credential at a time with an old-refused and new-accepted probe; never a vault master key, disk key or recovery set without a fresh verified export; revoke what is not needed again; the record added to the incident postmortem.

### Changed

- `repo-tooling`: a `skills-sync` target (`SKILLS_REF=<tag>`) and a weekly skills-bump workflow that re-vendors the newest release and opens the pull request, since Renovate cannot regenerate the lock file's hashes.
- `backlog-batches` reports in the `checkpoint` shape and copies its run sheet beside the state note before a session may end; `project-docs` names the device record's home under runbooks.
- `backlog-batches` gains the backlog artifact source: a document the harness hosts, read and marked by the orchestrator, so the backlog travels without a commit; a pasted list becomes one. A markdown file is only ever one the project names, with no example path the agent could adopt. The run sheet example is an artifact-backed run with no attribution trailer. `.plan/` is no longer named anywhere: `checkpoint` keeps the state note at `.agents/state.md`, excluded through `.git/info/exclude` rather than a project's `.gitignore`.

## [0.6.0] - 2026-11-08

### Added

- `ui-exploration`: the round that puts the choice before the polish for a new or redesigned UI unit: one question, three or four directions that disagree on a named axis, each a complete on-token unit shown at true size under an `Explorations` Storybook root, a hand-over with a recommendation, then narrowing on the owner's "closest, and what is still off" until one direction is kept and promoted through `ui-component-contract`; the exploration directory is gitignored and deleted at promotion.

### Changed

- `ui-component-contract` gains the exploration step between the draft card and the a11y spec pass; `iterate` and `plan-feature` send a look with more than one plausible answer to it; `storybook-layout` adds the `Explorations` root and `svelte-frontend` the `explorations` row of the import table.

## [0.5.0] - 2026-11-08

### Added

- `git-workflow`: the commit discipline in one place: stage named paths (never `-A`, `.` or `-a`) and read the cached diff, Conventional Commits with a body that says why and no tracker ids, one change per commit, amend and rebase only what has not left the machine, fast-forward landing, worktrees beside the repository, and the push as the owner's decision through `ci-green`'s gate. `plan-feature` and the AGENTS.md template point to it.
- `ci-green`: the push discipline after a day of red runs nobody saw: the push gate is the CI target, not the fast gate; a push is watched and a red run is fixed forward before anything else lands; a flaky check is a bug; a check that encodes a product fact names it; and a pre-push hook that refuses a push onto a red or still-running default branch unless the push carries a `Fixes-CI:` trailer or a revert, then runs the CI-only fast checks on the pushed head.

### Changed

- `repo-tooling` names the pre-push hook beside pre-commit; `plan-feature` and the AGENTS.md template state the push rule once, as `git-workflow`'s.
- `backlog-batches`: the run sheet names a landing gate (the CI target) beside the per-item gate, and the orchestrator runs it once on a batch's final head before reporting the head ready to push (`ci-green`).

## [0.4.0] - 2026-11-07

### Added

- `svelte-frontend`: the framework skill the UI skills defer to: Svelte 5 runes, bits-ui as the primitive library, the `web/src` layout with an import-direction check, Svelte CSF stories, the vitest, Storybook and Playwright test stack, lint and format, and the embedded SvelteKit build.
- `frontend-api-client`: one typed path from the contract to a screen, for Connect-ES (default) and OpenAPI clients: generated code, one transport, error normalisation with field errors, data layer rules, and fake transports in tests.
- `browser-e2e`: the Playwright tier: what earns an end-to-end test, the run against the built image, role locators and page markers, seeding through the API, per-worker auth state, CI caching and the flaky-test quarantine.
- `connect-rpc`: the default API contract: buf layout and generation, proto style, versioning by package with `buf breaking` against the last tag, the error code mapping with field violations, server wiring and tests. OpenAPI-first with ogen stays the alternative in `api-contract`.
- `go-http-server`: the shape of `internal/platform/http`: stdlib mux, `http.Server` timeouts, the fixed middleware order, serving the embedded SPA without shadowing the API, streaming, the outbound client and per-client rate limiting.
- `go-auth`: the default authentication and authorization shape: opaque server sessions in a `__Host-` cookie, CSRF through SameSite and the required header, argon2id and TOTP, hashed API keys, the principal in context, one authorization function per operation, the tenant filter in every query, and the browser side.
- `go-background-jobs`: durable jobs on the project database with no broker: the jobs table, claim and lease, bounded workers, retry and dead state, schedules, the outbox for email and webhooks, outbound integrations, metrics and tests.
- `go-library`: the library case: exported API minimalism, no globals, `Example` tests, module versioning and compatibility checks.
- `container-image`: the image policy: one static binary on `ghcr.io/rfizzle/static`, no distro base or package install in any stage, digest pinning with the weekly base rebuild, base signature verification, keyless signing with provenance and SBOM, scanning with dated exceptions, and the hardened runtime shape.
- `deploy`: from a release tag to a running service: the image under systemd through Podman Quadlet with Cloudflare Tunnel in front, environments, the migrate-then-restart sequence, rollback by digest, secrets, host baseline and the deploy runbook.

### Changed

- Connect RPC is the default contract; `api-contract`, `go-project-layout`, `release`, `iterate`, `plan-feature`, `contract-spec` and `repo-tooling` name it beside OpenAPI. `api-contract` names ogen once and defines the Problem Details field-error shape.
- `ui-patterns`, `ui-component-contract`, `storybook-layout` and `plan-feature` share one five-layer model (components, compositions, features, layouts, screens), the contract's state story names, and the `<Unit>/Flows` file for play tests.
- `repo-tooling` points at `container-image` for the image, and gains a local loop (`make dev`, `make seed`), a supply-chain section (SHA-pinned actions, least-privilege tokens, gitleaks, `go mod verify`), proto targets, Renovate auto-merge and hold rules, and the frontend CI rows. The library's own CI pins actions by SHA and reads Node from `.nvmrc`.
- `service-operations` adds the after-incident procedure and postmortem page, states the two alert severities as one rule with `golang-observability`, and names the rollback command; `release` and the runbook template no longer carry deploy placeholders; `project-docs` lists `docs/incidents/`.
- `golang-security` defers to `go-auth` for sessions and credentials, keys the rate limiter per client, points secrets loading at `repo-tooling`'s typed config, and checks the dialled address for SSRF.
- `golang-testing` examples use the standard library only and the review checklist has a flaky-test policy; `golang-design-patterns` states the time, money and duration rules; `golang-database` matches the jobs table's claim query and requires `migrate up` to succeed on a schema already ahead of the binary.
- `design-tokens` adds the utility-discipline rules (class sorting, no `@apply` in units, `@utility` for three or more uses).

## [0.3.0] - 2026-11-07

### Added

- `storybook-layout`: the one Storybook sidebar shape: fixed roots in a fixed order, one entry per unit by its code name with `Default` first, extra files only as `Flows`, `Examples` or a named part, and every screen under `Screens`.

## [0.2.1] - 2026-11-05

### Fixed

- docscheck follows `include`, `-include` and `sinclude` lines, so `make` targets defined in a vendored `mk/gates.mk` count as the project's own.
- CI names the Node test files, which Node 22 needs.

## [0.2.0] - 2026-11-05

### Added

- `skillscheck -sum <file>` verifies a lock file other than `shared.sum`, and hashing accepts a single file, so a project can vendor go-scaffold's gate kit and check it the same way. Existing sums are unchanged.

### Changed

- PostgreSQL, OpenAPI-first HTTP, a container image and the `internal/modules` layout are defaults a project's `AGENTS.md` may override, not rules. `golang-database` allows SQLite through `database/sql`; `repo-tooling` and `release` cover GoReleaser/systemd packaging and `buf breaking`; `go-project-layout` and `contract-spec` accept a flat `internal/`.

## [0.1.1] - 2026-11-05

### Changed

- `backlog-batches` run-sheet example, `project-docs` sources and docscheck test strings no longer name local paths or other repositories.

## [0.1.0] - 2026-11-05

First tagged release.

### Added

- `plan-feature`: one plain-English plan the owner accepts (outcome, decisions with recommendations, per-layer stories in landing order: schema, API contract, backend, components, view, end-to-end) before anything is filed.
- `contract-spec`: draft a module or cross-module flow contract, get it accepted as a summary, then move the contract into code and cut the module spec to its purpose.
- `iterate`: the small path for changing existing code; no new spec, a gate only when a contract moves.
- `api-contract`: spec-first OpenAPI, additive changes in `/api/v1`, breaking changes in a new version with `Sunset`, `oasdiff` in CI, RFC 9457 errors.
- `golang-database`: pgx/v5 repositories, transactions and queue claims, reversible migrations with expand/contract.
- `go-project-layout`: `cmd/`, `internal/app` composition root, `domain` and `platform` leaves, modules, consumer-side interfaces.
- `repo-tooling`: Makefile targets, pinned toolchain, multi-stage Dockerfile on rfizzle/images, Compose, CI and Renovate.
- `release`, `service-operations`: SemVer releases and changelogs; health, logs, metrics, flags, runbooks and restore drills.
- `ui-patterns`, `ui-component-contract`, `design-tokens`, `a11y-review`: framework-neutral UI development and UX patterns.
- `scripts/sync -r <tag>` vendors a release tag instead of the working tree.
- `scripts/validate-skills.mjs`, a Makefile with `make check`, and CI.

### Changed

- `project-docs` is reorganised around contracts living in code; it absorbs the former `repo-align` as `references/align.md` and uses date-slug decision ids.
- `golang-spf13-cobra`, `golang-spf13-viper` and `golang-design-patterns` are cut to the rules a model would not follow unprompted.
- `golang-testing` names tests for the behaviour they prove.
- `create-skill` says when a skill is worth writing and how to keep it small.

### Removed

- `repo-align` (now part of `project-docs`).
