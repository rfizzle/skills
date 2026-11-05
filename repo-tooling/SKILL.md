---
name: repo-tooling
description: Use this skill when setting up or auditing the build and tooling of a Go + PostgreSQL service with a Tailwind frontend, or when touching its Makefile, go.mod toolchain or tool directives, Node or pnpm pins, Dockerfile, compose.yaml, environment configuration, CI pipeline, Renovate config, linter limits, pre-commit hook or coverage floor. Triggers include "add a make target", "pin this tool", "write the Dockerfile", "the image uses Alpine", "add a local Postgres", "add a config variable", "CI should check X", "Renovate MRs fail go mod tidy", and "what does make ci run". Not for release tagging and changelogs (use release), runtime health, metrics and runbooks (use service-operations), or the content of docs-check and skills-check (project-docs and the skills README own those).
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

| Target | Does |
|---|---|
| `tools` | installs every pinned tool at its exact version |
| `env` | fails when an installed tool differs from its pin |
| `generate` | runs every generator (OpenAPI transport, SQL, frontend client) |
| `test` | unit tests with the race detector and coverage, no external services |
| `test-integration` | tests against disposable PostgreSQL (build tag `integration`) |
| `lint` | `go vet`, golangci-lint, formatting checks |
| `architecture-check` | fails on an import that crosses a layer boundary |
| `docs-check` | the documentation checker (`project-docs`) |
| `skills-check` | vendored shared skills match their lock file |
| `web-lint` | type checks and lint for the frontend |
| `web-test` | frontend unit tests and stories as tests |
| `e2e` | browser tests against the Compose stack |
| `docker-build` | builds the production image |
| `ci` | everything CI's verify job runs, in one target |

Rules:

- Every target has a `## description` and appears in `make help`.
- `ci` depends on the read-only targets: `env`, a generate check (generate,
  then fail on any diff or untracked file), `lint`, `architecture-check`,
  `docs-check`, `skills-check`, `test`, `web-lint`, `web-test`. It never
  writes to the tree, pushes or deploys.
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

- One multi-stage `Dockerfile`: a frontend build stage, a Go build stage,
  and a runtime stage. The Go binary embeds the built frontend; the image
  holds one binary.
- Images come from `rfizzle/images` (Wolfi, apko-built, signed, SBOM):
  build stages use the `-dev` variants (`ghcr.io/rfizzle/go:<stream>-dev`,
  `ghcr.io/rfizzle/node:<stream>-dev`), the runtime is
  `ghcr.io/rfizzle/static:latest`, Compose uses `ghcr.io/rfizzle/postgres`
  and `ghcr.io/rfizzle/valkey`. An image that repo lacks is added there,
  not pulled from elsewhere; until it exists, `cgr.dev/chainguard/*` is the
  fallback. **Never Alpine**, in any stage, in
  Compose, or in CI jobs.
- Every `FROM` and every Compose `image:` is pinned by digest:
  `name:tag@sha256:<digest>`. Renovate updates the digest.
- `CGO_ENABLED=0`, `-trimpath`, version stamped with `-ldflags -X`.
- Runs as non-root (`USER nonroot:nonroot` or a numeric UID), no shell in
  the runtime image, OCI labels for source, revision, version.
- A `.dockerignore` excludes `.git`, `node_modules`, build outputs and
  `.env`.

## Local stack

- `compose.yaml` runs PostgreSQL (`ghcr.io/rfizzle/postgres`, digest-pinned) with a
  healthcheck and a named volume, bound to `127.0.0.1`. The app service
  builds from the same `Dockerfile` as production.
- A Compose profile (`e2e`) starts the app plus its dependencies for
  `make e2e`; tests wait on the health and the page markers, never on
  sleeps.
- Targets: `dev-up` (wait for healthy), `dev-down` (keep data),
  `dev-reset` (drop the volume, says so before it does).
- The Compose file works with Docker Compose and Podman's compose provider;
  a target never hard-codes one engine where the other would do.

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

- The verify job runs `make ci`. Separate jobs build the image
  (`make docker-build`), run `govulncheck ./...`, scan the image
  (Trivy or Grype; fail on fixable high and critical), and run `oasdiff
  breaking` against the OpenAPI file at the last release tag.
- CI uses the same pins: Go from `go.mod`, Node from `.nvmrc`, tools from
  `make tools`. CI images follow the container rules.
- Renovate manages Go modules, `tool` directives, npm, Dockerfile and
  Compose digests, and CI images. It runs `go mod tidy` and refreshes the
  pnpm lockfile on every update. A tidy that fails in Renovate usually
  means a module the bot cannot fetch; give it `hostRules` and `GOPRIVATE`,
  or move the import out of the main module.

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
- Every `FROM` and Compose image is digest-pinned and none is Alpine; the
  runtime image runs as non-root and holds one binary.
- Configuration is one prefix into one typed struct; no secret prints.
- CI runs `make ci`, the image build, govulncheck, the image scan and
  oasdiff; Renovate runs tidy and lockfile updates.

## References

- `references/makefile.md`: Makefile skeleton, tool pins, hook and coverage
  floor.
- `references/dockerfile.md`: multi-stage Dockerfile and `compose.yaml`.
- `references/ci-renovate.md`: CI job outline and `renovate.json`.
