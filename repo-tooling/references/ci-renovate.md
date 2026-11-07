# CI and Renovate

## Contents

- CI jobs
- Frontend jobs
- Workflow conventions
- renovate.json
- The skills bump

## CI jobs

The shape, independent of the CI system. Every job installs tools with
`make tools` and the Go version from `go.mod`.

| Job | Runs | Fails on |
|---|---|---|
| verify | `make ci` | any target failing |
| secrets | `gitleaks git --redact` over the full history | any finding not in `.gitleaksignore` |
| integration (when applicable) | `make test-integration` with a PostgreSQL service container | any test failing |
| vuln | `go tool govulncheck ./...` | a called vulnerable symbol |
| image (when applicable) | `make image-check` (`container-image`) | an unsigned base, a fixable high or critical finding, an expired exception, a failed healthcheck |
| api-compat (when applicable) | `make proto-breaking` (`buf breaking --against '.git#tag=<last-tag>'`, checkout with `fetch-depth: 0`); for OpenAPI, `oasdiff breaking <last-tag spec> api/openapi.yaml --fail-on ERR` | any breaking change in an existing version |
| web (when applicable) | `make web-lint web-test web-budget` | a type or lint error, a failing test, a bundle over budget |
| storybook (when applicable) | `make storybook-build`, then upload the static build | the build failing |
| e2e (when applicable) | `make e2e` (`browser-e2e`) | any browser test failing |

For OpenAPI, the last-tag spec is `git show $(git describe --tags --abbrev=0):api/openapi.yaml`.
With no tag yet, the job passes and says so. The secrets job checks out
with `fetch-depth: 0` so gitleaks sees every commit.

## Frontend jobs

- **Playwright browsers are cached**, keyed on the Playwright version in
  `pnpm-lock.yaml`: restore `~/.cache/ms-playwright`; on a miss run
  `pnpm --dir e2e exec playwright install --with-deps chromium`, on a hit
  only `playwright install-deps chromium` (system packages are not in the
  cache). The `web` package's vitest browser mode reads the same cache, so
  the two pin the same Playwright version. An uncached install costs a minute or more per job.
- **Storybook is built and uploaded** on every pull request that touches
  the frontend: `make storybook-build` writes `web/storybook-static`, and
  `actions/upload-artifact` keeps it for 14 days so the owner can review
  the stories without a checkout.
- **Path filters decide which jobs run**, from a `changes` job, not from
  `on.paths`: a workflow skipped by `on.paths` leaves its required checks
  pending forever, while a job skipped by `if:` counts as passed.

  ```yaml
  changes:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: read
    outputs:
      go: ${{ steps.filter.outputs.go }}
      web: ${{ steps.filter.outputs.web }}
    steps:
      - uses: actions/checkout@<sha> # v<x.y.z>
      - id: filter
        uses: dorny/paths-filter@<sha> # v<x.y.z>
        with:
          filters: |
            go: ['**/*.go', 'go.mod', 'go.sum', 'build/**', 'compose.yaml']
            web: ['web/**']
  web:
    needs: changes
    if: needs.changes.outputs.web == 'true'
    # ...
  e2e:
    needs: changes
    # e2e runs against the real binary, so a Go-only change runs it too.
    if: needs.changes.outputs.go == 'true' || needs.changes.outputs.web == 'true'
    # ...
  ```

  A docs-only change matches neither filter and skips `web`, `storybook`
  and `e2e`; `verify` always runs.
- **Bundle budget**: `make web-budget` builds the frontend and fails when
  the gzip size of the entry chunk, any route chunk or the total passes the
  limits in `web/bundle-budget.json`. Raising a limit is a reviewed change
  with the reason in the commit.

## Workflow conventions

```yaml
permissions:
  contents: read          # top level; a job asks for more itself
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha> # v<x.y.z>
      - uses: actions/setup-go@<sha> # v<x.y.z>
        with:
          go-version-file: go.mod
      - uses: actions/setup-node@<sha> # v<x.y.z>
        with:
          node-version-file: .nvmrc
      - run: make tools
      - run: make ci
```

- Resolve an action's SHA with
  `gh api repos/<owner>/<action>/commits/<tag> --jq .sha` (or
  `git ls-remote https://github.com/<owner>/<action> refs/tags/<tag>`); the
  comment carries the tag so Renovate and a reader know the version.
- Only the publish job (`container-image`) gets `packages: write`,
  `id-token: write` and `attestations: write`.
- `secrets.GITHUB_TOKEN` goes only to a step that needs it (registry login,
  a release upload); never into a workflow-level `env`.

## renovate.json

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    "docker:pinDigests",
    "helpers:pinGitHubActionDigests",
    ":semanticCommits"
  ],
  "timezone": "UTC",
  "platformAutomerge": true,
  "postUpdateOptions": ["gomodTidy", "gomodUpdateImportPaths", "pnpmDedupe"],
  "packageRules": [
    {
      "description": "Digests and patches merge themselves once CI is green",
      "matchUpdateTypes": ["digest", "pinDigest", "patch"],
      "automerge": true
    },
    {
      "description": "Minors arrive as one weekly group; image streams stay separate",
      "matchUpdateTypes": ["minor"],
      "matchPackageNames": ["!ghcr.io/rfizzle/**"],
      "groupName": "weekly minor updates",
      "schedule": ["* 7-11 * * 1"]
    },
    {
      "description": "Base image digests after the Monday 06:00 UTC rebuild, one PR per base",
      "matchDatasources": ["docker"],
      "matchPackageNames": ["ghcr.io/rfizzle/go"],
      "matchUpdateTypes": ["digest", "pinDigest"],
      "groupName": "rfizzle go image",
      "schedule": ["* 7-11 * * 1"]
    },
    {
      "matchDatasources": ["docker"],
      "matchPackageNames": ["ghcr.io/rfizzle/node"],
      "matchUpdateTypes": ["digest", "pinDigest"],
      "groupName": "rfizzle node image",
      "schedule": ["* 7-11 * * 1"]
    },
    {
      "matchDatasources": ["docker"],
      "matchPackageNames": ["ghcr.io/rfizzle/static"],
      "matchUpdateTypes": ["digest", "pinDigest"],
      "groupName": "rfizzle static image",
      "schedule": ["* 7-11 * * 1"]
    },
    {
      "matchDatasources": ["docker"],
      "matchPackageNames": ["ghcr.io/rfizzle/postgres"],
      "matchUpdateTypes": ["digest", "pinDigest"],
      "groupName": "rfizzle postgres image",
      "schedule": ["* 7-11 * * 1"]
    },
    {
      "description": "Go toolchain: a new 1.N is a major for this purpose",
      "matchManagers": ["gomod"],
      "matchDepTypes": ["toolchain", "golang"],
      "matchUpdateTypes": ["major", "minor"],
      "groupName": "go toolchain",
      "automerge": false,
      "dependencyDashboardApproval": true
    },
    {
      "description": "Image stream changes (go 1.27 to 1.28, postgres 17 to 18) wait for a human",
      "matchDatasources": ["docker"],
      "matchPackageNames": ["ghcr.io/rfizzle/**"],
      "matchUpdateTypes": ["major", "minor"],
      "automerge": false,
      "dependencyDashboardApproval": true
    },
    {
      "description": "Majors for Node, Tailwind and Svelte wait for a human",
      "matchPackageNames": ["node", "tailwindcss", "@tailwindcss/**", "svelte", "@sveltejs/**"],
      "matchUpdateTypes": ["major"],
      "automerge": false,
      "dependencyDashboardApproval": true
    }
  ]
}
```

- Later rules win, so the holds sit last. One base-image group per
  `rfizzle` image the project uses; add or delete those rules to match.
- Auto-merge waits on the checks branch protection marks required; with
  none required, "CI is green" means nothing. Make `verify`, `image` and
  `e2e` required.
- The schedule starts after the bases rebuild (Monday 06:00 UTC); a window
  before it bumps to last week's digest.
- `gomodTidy` runs `go mod tidy` after every Go update, so `go.sum` is
  always current. Renovate updates the pnpm lockfile itself.
- A self-hosted Renovate that must run a repository command (a generator,
  a lockfile Renovate does not know) uses `postUpgradeTasks` with the
  command on the instance's `allowedCommands` list:

  ```json
  "postUpgradeTasks": {
    "commands": ["make generate"],
    "fileFilters": ["**/*"],
    "executionMode": "branch"
  }
  ```

- When tidy fails in a Renovate branch, the bot could not fetch a module:
  add `hostRules` for the private host and set `GOPRIVATE` in the bot's
  environment, or move the importing file out of the main module.

## The skills bump

Renovate cannot bump the vendored skills: `shared.sum` carries a content
hash per path, so changing the tag alone fails `skills-check`. A small
workflow does the whole move instead, weekly after the images, and on
demand:

```yaml
# .github/workflows/skills-bump.yml
name: skills-bump
on:
  schedule:
    - cron: "0 8 * * 1"
  workflow_dispatch:
permissions:
  contents: read
jobs:
  bump:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha> # v<x.y.z>
        with:
          token: ${{ secrets.SKILLS_BUMP_TOKEN }}
      - uses: actions/checkout@<sha> # v<x.y.z>
        with:
          repository: <owner>/skills
          path: .skills-source
          fetch-depth: 0
      - uses: actions/setup-go@<sha> # v<x.y.z>
        with:
          go-version-file: go.mod
      - name: Vendor the newest release when it is newer than the lock
        env:
          GH_TOKEN: ${{ secrets.SKILLS_BUMP_TOKEN }}
        run: |
          latest="$(git -C .skills-source tag --sort=-v:refname | head -1)"
          current="$(awk '!/^#/ && NF { print $2; exit }' .agents/skills/shared.sum)"
          [ "$latest" != "$current" ] || { echo "at $current"; exit 0; }
          git ls-remote --exit-code origin "refs/heads/skills/$latest" >/dev/null \
            && { echo "skills/$latest is already open"; exit 0; }
          make skills-sync SKILLS_REF="$latest" SKILLS_SOURCE=.skills-source
          make skills-check
          git config user.name  "skills-bump"
          git config user.email "skills-bump@users.noreply.github.com"
          git checkout -b "skills/$latest"
          git add .agents/skills scripts/skillscheck
          [ ! -d scripts/docscheck ] || git add scripts/docscheck
          git commit -m "build(skills): vendor shared skills $latest" \
            -m "Changelog: https://github.com/<owner>/skills/blob/$latest/CHANGELOG.md"
          git push -u origin "skills/$latest"
          gh pr create --fill
```

- `SKILLS_BUMP_TOKEN` is a fine-grained token with contents and pull
  requests write on this repository only. The default `GITHUB_TOKEN` cannot
  be used: a push made with it starts no other workflow, so the pull request
  would have no checks to go green.
- `.skills-source` is the checkout the sync reads from; it is never
  committed (`git add` names its paths) and the job's clone is discarded.
- The commit type is `build`, the type `git-workflow` gives a vendored
  dependency; older `chore(skills)` commits in a project predate that rule.
- The pull request merges like any other: `verify` runs `skills-check`
  against the new lock, and the owner reads the linked changelog. A skill
  that changed a rule a project relies on is a review, not a rubber stamp.
- Cutting a release (`release`) is what makes this fire; a project that
  wants a bump today runs the workflow by hand or `make skills-sync
  SKILLS_REF=<tag>` locally and commits the result with the same message.
