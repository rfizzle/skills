---
name: repo-tooling
description: Use this skill when setting up or auditing the build and tooling of a Go service or tool (PostgreSQL and a frontend when it has them), or when touching its Makefile, go.mod toolchain or tool directives, Node or pnpm pins, compose.yaml, the local dev loop, seed data, environment configuration, CI workflows, action pinning and permissions, Renovate config, linter limits, pre-commit hook or coverage floor. Triggers include "add a make target", "pin this tool", "make dev should start everything", "add seed data", "add a local Postgres", "add a config variable", "CI should check X", "pin the actions", "add gitleaks", "skip the web jobs on docs changes", "Renovate opens too many PRs", "Renovate MRs fail go mod tidy", and "what does make ci run". Not for the Dockerfile, base images and image scanning or signing (use container-image), release tagging (use release), runtime health and runbooks (use service-operations), or the content of docs-check and skills-check (project-docs and the skills README own those).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Repository tooling

The Makefile is the only command interface. People, agents, hooks and CI
run `make <target>`; nothing documents a raw command a target already
wraps. Every tool version is pinned in a file the repository owns, and
`make env` proves the host matches.

## Standard targets

Targets whose layer the project lacks (no image, no frontend, no external
database) are omitted, not stubbed.

| Target | Does |
|---|---|
| `tools` | installs every pinned tool at its exact version |
| `env` | fails when an installed tool differs from its pin |
| `generate` | runs every generator (buf for the proto contract or the OpenAPI transport, SQL, frontend client) |
| `test` | unit tests with the race detector and coverage, no external services |
| `test-integration` | tests against disposable PostgreSQL (build tag `integration`) |
| `lint` | `go mod verify`, `go vet`, golangci-lint, formatting checks |
| `architecture-check` | fails on an import that crosses a layer boundary |
| `docs-check` | the documentation checker (`project-docs`) |
| `skills-check` | vendored shared skills match their lock file |
| `web-lint` | type checks and lint for the frontend |
| `web-test` | frontend unit tests and stories as tests |
| `web-budget` | builds the frontend and fails on a bundle over budget |
| `storybook-build` | the static Storybook, uploaded by CI for review |
| `e2e` | browser tests against the Compose stack |
| `docker-build` | builds the production image for the host architecture |
| `image-check` | verifies, scans and smoke-runs the image (`container-image`) |
| `dev` | the Go server with reload and the Vite dev server, one command |
| `seed` | loads idempotent local seed data |
| `proto-lint` | buf lint and format check (`connect-rpc`) |
| `proto-breaking` | buf breaking against the last release tag |
| `ci` | everything CI's verify job runs, in one target |

Rules:

- Every target has a `## description` and appears in `make help`.
- `ci` depends on the read-only targets, in this order: `env`, a generate
  check (generate, then fail on any diff or untracked file), `web-budget`
  (the embedded frontend must exist before Go compiles), `proto-lint`,
  `lint`, `architecture-check`, `docs-check`, `skills-check`, `test`,
  `web-lint`, `web-test`. It never writes to the tree, pushes or deploys.
- A target that needs a tool checks for it and says `run: make tools`.
- No target reads secrets from the repository; they come from the
  environment or an untracked `.env`.

## Pins

- **Go**: `go.mod` carries `go 1.N.0` and `toolchain go1.N.P`. Go-built
  tools are `tool` directives (`go get -tool <module>@<version>`) and run as
  `go tool <name>`; `make tools` needs nothing more for them.
- **Tools whose upstream advises against `go tool`** (golangci-lint) or
  that are not Go modules are pinned in `scripts/tool-versions.env`, module
  path beside version, and installed by `make tools`. Never `@latest`.
- **Node and pnpm**: `.nvmrc` (or `.node-version`) holds the Node version;
  `package.json` has `"packageManager": "pnpm@<version>"` and matching
  `engines`. `pnpm-lock.yaml` is committed; CI installs with
  `--frozen-lockfile`.
- `make env` compares each installed version to its pin and prints the one
  that differs.

## Containers

When the project ships an image, `container-image` owns the Dockerfile, the
base images, scanning, signing and publishing; follow it.

## Local stack

When it needs a local service:

- `compose.yaml` runs PostgreSQL (`ghcr.io/rfizzle/postgres`, digest-pinned) with a
  healthcheck and a named volume, bound to `127.0.0.1`. The app service
  builds from the same `Dockerfile` as production and runs read-only with
  capabilities dropped, as the deploy does.
- A Compose profile (`e2e`) starts the app plus its dependencies for
  `make e2e`; tests wait on the health and the page markers, never on
  sleeps.
- Targets: `dev-up` (wait for healthy), `dev-down` (keep data),
  `dev-reset` (drop the volume, says so before it does).
- The Compose file works with Docker Compose and Podman's compose provider;
  a target never hard-codes one engine where the other would do.

## Local loop

`make dev` starts the database, the Go server under a file watcher (`air`)
and the Vite dev server, whose proxy sends API paths to the Go port; Ctrl-C
stops all of them. `make seed` loads idempotent seed data from
`testdata/seed` or a `go run` seeder in `internal/seed`, never production
data. Pins reach the shell from the files CI reads: Go picks the `go.mod`
toolchain itself, and `mise` (or `direnv`) activates Node from `.nvmrc`.

## Configuration and secrets

- All configuration comes from environment variables with one prefix
  (`APP_`). It is parsed once at startup into a typed struct, validated,
  and the process exits with a message naming the bad key on failure.
- Secrets are a distinct type whose `String`, `GoString` and slog
  `LogValue` print a fixed placeholder (`***`). They never appear in logs, errors,
  fixtures, Compose files or examples.
- `.env.example` lists every key with a safe value or empty for secrets;
  `.env` is gitignored. Configuration keys are documented on the struct
  fields, and a reference page, if any, is generated from them.
- Secret handling beyond this is `golang-security`.

## CI and dependencies

- The verify job runs `make ci`. Separate jobs run gitleaks,
  `govulncheck ./...`, `make image-check` when there is an image, and the
  API breaking check against the last release tag (`buf breaking` for the proto
  contract, the default; `oasdiff breaking` for OpenAPI).
- CI uses the same pins: Go from `go.mod`, Node from `.nvmrc` through
  `node-version-file`, tools from `make tools`. A job that runs in a
  container uses an `rfizzle` image (`container-image`).
- Frontend jobs cache Playwright browsers, upload the Storybook build for
  review, check the bundle budget, and run behind path filters: a
  docs-only change skips them, a Go-only change still runs e2e.
- A binary shipped outside an image (systemd package, CLI archive) is
  released by GoReleaser with checksums, SBOM and signature, built with
  `CGO_ENABLED=0`, `-trimpath` and version stamping.
- Renovate manages Go modules, `tool` directives, npm, Dockerfile and
  Compose digests, CI images and action SHAs. It runs `go mod tidy` and
  refreshes the pnpm lockfile on every update. Digests and patches
  auto-merge on green CI, minors come as one weekly group, and majors of
  Go, Node, Tailwind, Svelte and image streams wait for a human. A tidy
  that fails in Renovate usually means a module the bot cannot fetch; give
  it `hostRules` and `GOPRIVATE`, or move the import out of the main module.

## Supply chain

The repository's own; the image's is `container-image`.

- Actions are pinned by commit SHA with the version in a comment
  (`actions/checkout@<sha> # v4.4.0`); a tag can move, a SHA cannot.
  Renovate's `helpers:pinGitHubActionDigests` pins and bumps them.
- `permissions: contents: read` at the top of every workflow; a job that
  needs more asks for it itself. `packages: write`, `id-token: write` and
  `attestations: write` belong to the publish job only.
- `GITHUB_TOKEN` and other secrets go only to a step that needs them (a
  registry login), never to a third-party action that does not, and never
  into a workflow-level `env`.
- gitleaks runs in the pre-commit hook on the staged change and as a CI job
  over the full history.
- Lockfiles are committed and installs frozen (Pins); `make lint` runs
  `go mod verify`.
- One update bot: Renovate, or Dependabot where a project chose it, never
  both; two bots open duplicate pull requests and fight over lockfiles.

## Recommended quality gates

Adopt these where the repository can hold them; each is a target in
`make ci` once adopted.

- **Complexity limits** in `.golangci.yml`: gocyclo 15, gocognit 20,
  nestif 4, funlen 80 lines or 50 statements, maintidx under 20, dupl 120.
  Tests may be exempt from funlen and maintidx only.
- **Maintainability ratchet**: a per-package check against the base branch
  (duplication, untested exports, globals, package size) that may only get
  better, with exemptions that carry a reason and an expiry.
- **Pre-commit hook** in `.githooks/pre-commit`, enabled by `make hooks`
  (`git config core.hooksPath .githooks`). It runs the fast checks only;
  CI is the gate that cannot be bypassed.
- **Coverage floor** in `scripts/coverage-baseline.env`, checked by the
  coverage step of `make test`. It is raised as coverage grows; lowering it
  needs a reviewed reason.

## Definition of done

- `make help` lists every standard target that applies; `make ci` passes on
  a clean clone after `make tools`.
- `make env` passes, and no tool is installed at an unpinned version.
- `make dev` starts the whole local loop in one command; `make seed` is
  idempotent and holds no production data.
- Where there is an image, `container-image`'s definition of done holds.
- Configuration is one prefix into one typed struct; no secret prints.
- CI runs the jobs above, frontend jobs behind path filters; every action
  is SHA-pinned, every workflow starts at `contents: read`, and only the
  publish job escalates.
- Renovate runs tidy and lockfile updates with the auto-merge and hold
  rules.

## References

- `references/makefile.md`: when changing the Makefile: skeleton, pins,
  the local loop (`air`, Vite proxy, seed, `mise`), hook, coverage floor.
- `references/compose.md`: when adding a local service or the e2e stack.
- `references/ci-renovate.md`: when writing a workflow or `renovate.json`:
  jobs, path filters, workflow conventions, package rules.
- The Dockerfile and image CI are in `container-image`.
