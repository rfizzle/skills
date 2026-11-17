# Makefile, pins and gates

## Contents

- Makefile skeleton
- Pins
- Local loop
- Complexity limits
- Pre-commit hook
- Coverage floor

## Makefile skeleton

Paths and generator commands are placeholders; keep the target names.
Delete the targets for layers the project lacks. The layout rules (preamble,
`mk/` fragments, gate groups, help) are in `makefile-structure.md`; a
project with CI slices builds `ci` from gate groups as shown there.

```make
SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
MAKEFLAGS += --no-builtin-rules
.DELETE_ON_ERROR:
.DEFAULT_GOAL := help

GO          ?= go
BUF         ?= buf
LAST_TAG     = $(shell git describe --tags --abbrev=0 2>/dev/null)
PACKAGES    ?= ./...
GENERATED   := internal/api/gen web/src/lib/api/gen
COVER_OUT   := coverage.out
IMAGE       ?= ghcr.io/<owner>/<app>
COMPOSE     ?= docker compose
E2E_PROJECT ?= $(notdir $(CURDIR))-e2e
E2E_ARGS    ?= --project=chromium
SKILLS_SOURCE ?= ../skills
SKILLS_REF    ?=

.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*## "} \
		/^## .*:$$/ {row[++n] = "h" substr($$0, 4); next} \
		/^[a-zA-Z0-9_-]+:.*## / {row[++n] = "t" $$1; desc[n] = $$2; if (length($$1) > w) w = length($$1)} \
		END {for (i = 1; i <= n; i++) { \
			if (substr(row[i], 1, 1) == "h") printf "%s\n", substr(row[i], 2); \
			else printf "  %-" w "s  %s\n", substr(row[i], 2), desc[i]}}' $(MAKEFILE_LIST)

.PHONY: tools
tools: ## Install the pinned development tools
	@./scripts/bootstrap-tools.bash
	@pnpm --dir web install --frozen-lockfile
	@pnpm --dir e2e install --frozen-lockfile
	@pnpm --dir e2e exec playwright install chromium

.PHONY: env
env: ## Fail when an installed tool differs from its pin
	@./scripts/check-env.bash

.PHONY: hooks
hooks: ## Enable the repository's git hooks
	@git config core.hooksPath .githooks

.PHONY: generate
generate: ## Run every code generator
	@$(BUF) generate
	@$(BUF) generate --template buf.gen.errors.yaml
	@$(GO) generate ./...
	@pnpm --dir web run generate:api   # OpenAPI projects only

.PHONY: generate-check
generate-check: generate ## Fail when generation changes the tree
	@git diff --exit-code -- $(GENERATED)
	@test -z "$$(git ls-files --others --exclude-standard -- $(GENERATED))"

.PHONY: test
test: ## Unit tests with race detector and coverage floor
	@$(GO) test -race -covermode=atomic -coverprofile=$(COVER_OUT) $(PACKAGES)
	@./scripts/check-coverage.bash $(COVER_OUT)

.PHONY: test-integration
test-integration: ## Tests against disposable PostgreSQL
	@$(GO) test -race -count=1 -tags=integration $(PACKAGES)

.PHONY: lint
lint: ## go vet, golangci-lint, format checks and module checksums
	@$(GO) mod verify
	@$(GO) vet $(PACKAGES)
	@golangci-lint run

.PHONY: architecture-check
architecture-check: ## Fail on imports that cross layer boundaries
	@./scripts/check-architecture.bash

.PHONY: docs-check
docs-check: ## Verify documentation links, paths, commands and ids
	@$(GO) run ./scripts/docscheck

.PHONY: skills-check
skills-check: ## Fail if a vendored shared skill was edited in place
	@$(GO) run ./scripts/skillscheck

.PHONY: skills-sync
skills-sync: ## Re-vendor the shared skills from a release tag: make skills-sync SKILLS_REF=<tag>
	@test -n "$(SKILLS_REF)" || { echo "set SKILLS_REF=<tag> (git -C $(SKILLS_SOURCE) tag --sort=-v:refname | head -1)"; exit 1; }
	@$(SKILLS_SOURCE)/scripts/sync -C . -r $(SKILLS_REF)

.PHONY: web-lint
web-lint: ## Frontend type checks and lint
	@pnpm --dir web run check
	@pnpm --dir web run lint
	@pnpm --dir e2e run check

.PHONY: web-test
web-test: ## Frontend unit tests and stories as tests
	@pnpm --dir web run test

.PHONY: web-budget
web-budget: ## Build the frontend and fail when a bundle passes its budget
	@pnpm --dir web run build
	@pnpm --dir web run check:budget

.PHONY: storybook-build
storybook-build: ## Build the static Storybook for review
	@pnpm --dir web run build-storybook --output-dir storybook-static

.PHONY: e2e
e2e: ## Browser tests against the built image and a fresh database
	@COMPOSE="$(COMPOSE)" E2E_PROJECT="$(E2E_PROJECT)" ./scripts/e2e.bash $(E2E_ARGS)

.PHONY: docker-build
docker-build: ## Build the production image
	@docker build -f build/Dockerfile -t $(IMAGE):dev \
		--build-arg VERSION=$$(git describe --tags --always --dirty) \
		--build-arg REVISION=$$(git rev-parse HEAD) .

.PHONY: dev
dev: dev-up ## Go server with reload and the Vite dev server, as one command
	@GO="$(GO)" ./scripts/dev.bash

.PHONY: seed
seed: dev-up ## Load idempotent local seed data (never production data)
	@$(COMPOSE) exec -T postgres psql -U app -d app -v ON_ERROR_STOP=1 < testdata/seed/seed.sql

.PHONY: dev-up
dev-up: ## Start local PostgreSQL and wait until healthy
	@$(COMPOSE) up --detach --wait postgres

.PHONY: dev-down
dev-down: ## Stop local services, keep data
	@$(COMPOSE) down --remove-orphans

.PHONY: dev-reset
dev-reset: ## Delete local PostgreSQL data and start fresh
	@echo "Deleting the local PostgreSQL volume"
	@$(COMPOSE) down --volumes --remove-orphans
	@$(COMPOSE) up --detach --wait postgres

.PHONY: proto-lint
proto-lint: ## Lint the protobuf contract and check its formatting (connect-rpc)
	@$(BUF) lint
	@$(BUF) format --diff --exit-code

.PHONY: proto-breaking
proto-breaking: ## Fail on a breaking proto change against the last release tag
	@if [ -z "$(LAST_TAG)" ]; then echo "No release tag yet: nothing to compare."; \
	else $(BUF) breaking --against '.git#tag=$(LAST_TAG)'; fi

# web-budget runs before lint and test: the embedded frontend package does
# not compile until web/build exists.
.PHONY: ci
ci: env generate-check web-budget proto-lint lint architecture-check docs-check skills-check test web-lint web-test ## Everything the CI verify job runs
```

The two recipes that need a trap are scripts (`makefile-structure.md`:
a recipe is at most three commands):

```bash
#!/usr/bin/env bash
# scripts/e2e.bash: the e2e stack up, the browser tests, the stack down.
set -euo pipefail
read -ra compose <<<"${COMPOSE:-docker compose}"
project="${E2E_PROJECT:?}"
trap '"${compose[@]}" -p "$project" --profile e2e down --volumes' EXIT
"${compose[@]}" -p "$project" --profile e2e up --build --detach --wait
set -a; . ./.env.e2e; set +a
pnpm --dir e2e exec playwright test "$@"
```

```bash
#!/usr/bin/env bash
# scripts/dev.bash: the Go server under air beside the Vite dev server.
set -euo pipefail
trap 'kill 0' INT TERM EXIT
"${GO:-go}" tool air &
pnpm --dir web run dev &
wait
```

## Pins

`go.mod`:

```text
go 1.N.0

toolchain go1.N.P

tool (
	github.com/air-verse/air
	connectrpc.com/connect/v2/cmd/protoc-gen-connect-go
	google.golang.org/protobuf/cmd/protoc-gen-go
	github.com/ogen-go/ogen/cmd/ogen // OpenAPI projects only
	github.com/pressly/goose/v3/cmd/goose
	golang.org/x/vuln/cmd/govulncheck
)
```

Add or bump one with `go get -tool <module>@<version>`; run it with
`go tool <name>`.

`scripts/tool-versions.env`, for tools kept out of `go.mod`:

```sh
# Module path beside the version so the installer never falls back to @latest.
GOLANGCI_LINT_MODULE=github.com/golangci/golangci-lint/v2/cmd/golangci-lint
GOLANGCI_LINT_VERSION=v<x.y.z>
GITLEAKS_MODULE=github.com/zricethezav/gitleaks/v8
GITLEAKS_VERSION=v<x.y.z>
BUF_MODULE=github.com/bufbuild/buf/cmd/buf
BUF_VERSION=v<x.y.z>
```

`package.json` (frontend):

```json
{
  "packageManager": "pnpm@<x.y.z>",
  "engines": { "node": ">=<major>.<minor>", "pnpm": "<x.y.z>" }
}
```

`.nvmrc`: one line, the Node version.

## Local loop

`make dev` runs `air` (a `tool` directive; `.air.toml` builds `./cmd/<name>`
and runs `serve`) beside `vite dev`. The Vite proxy sends API calls to the Go
port, so the browser sees one origin and cookies behave as in production:

```ts
// web/vite.config.ts (excerpt)
server: {
  proxy: {
    '/api': 'http://127.0.0.1:8080',
    // Connect RPC: one entry per service path prefix.
    '/<package>.v1.<Service>': 'http://127.0.0.1:8080',
  },
},
```

`testdata/seed/seed.sql` writes with `INSERT ... ON CONFLICT DO NOTHING`
(or `DO UPDATE`), so a second `make seed` changes nothing. A seeder written
in Go lives in `internal/seed` and runs through `go run`; it is never a
subcommand of the shipped binary.

Pins reach the shell from the files CI reads. Go selects the `go.mod`
toolchain itself (`GOTOOLCHAIN=auto`); `mise` activates Node from `.nvmrc`
with this in the repository's `mise.toml`:

```toml
[settings]
idiomatic_version_file_enable_tools = ["node"]
```

## Complexity limits

```yaml
# .golangci.yml (excerpt)
linters:
  enable: [gocyclo, gocognit, nestif, funlen, maintidx, dupl]
  settings:
    gocyclo: { min-complexity: 15 }
    gocognit: { min-complexity: 20 }
    nestif: { min-complexity: 4 }
    funlen: { lines: 80, statements: 50, ignore-comments: true }
    maintidx: { under: 20 }
    dupl: { threshold: 120 }
  exclusions:
    rules:
      - path: _test\.go
        linters: [funlen, maintidx]
```

## Pre-commit hook

```sh
#!/bin/sh
# .githooks/pre-commit. Enable once per clone: make hooks.
# Fast checks only; CI runs everything and cannot be bypassed.
set -eu
git rev-parse --verify --quiet HEAD >/dev/null || exit 0
gitleaks git --pre-commit --staged --redact --no-banner >&2
make --no-print-directory lint architecture-check >&2
```

A maintainability ratchet, if adopted, runs here on the staged change and
in CI against the merge-base with the default branch.

## Coverage floor

```sh
# scripts/coverage-baseline.env
# Raise as coverage grows; lowering it needs a reviewed reason.
COVERAGE_MIN=<percent>
```

`scripts/check-coverage.bash` reads the profile, drops generated packages,
computes the total with `go tool cover -func`, and fails below
`COVERAGE_MIN`.
