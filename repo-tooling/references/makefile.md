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
Delete the targets for layers the project lacks.

```make
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

.PHONY: help tools env hooks generate generate-check test test-integration \
        lint architecture-check docs-check skills-check skills-sync web-lint \
        web-test web-budget storybook-build e2e docker-build image-check dev dev-up \
        dev-down dev-reset seed proto-lint proto-breaking ci

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

tools: ## Install the pinned development tools
	@./scripts/bootstrap-tools.bash
	@pnpm --dir web install --frozen-lockfile
	@pnpm --dir e2e install --frozen-lockfile
	@pnpm --dir e2e exec playwright install chromium

env: ## Fail when an installed tool differs from its pin
	@./scripts/check-env.bash

hooks: ## Enable the repository's git hooks
	@git config core.hooksPath .githooks

generate: ## Run every code generator
	@$(BUF) generate
	@$(BUF) generate --template buf.gen.errors.yaml
	@$(GO) generate ./...
	@pnpm --dir web run generate:api   # OpenAPI projects only

generate-check: generate ## Fail when generation changes the tree
	@git diff --exit-code -- $(GENERATED)
	@test -z "$$(git ls-files --others --exclude-standard -- $(GENERATED))"

test: ## Unit tests with race detector and coverage floor
	@$(GO) test -race -covermode=atomic -coverprofile=$(COVER_OUT) $(PACKAGES)
	@./scripts/check-coverage.bash $(COVER_OUT)

test-integration: ## Tests against disposable PostgreSQL
	@$(GO) test -race -count=1 -tags=integration $(PACKAGES)

lint: ## go vet, golangci-lint, format checks and module checksums
	@$(GO) mod verify
	@$(GO) vet $(PACKAGES)
	@golangci-lint run

architecture-check: ## Fail on imports that cross layer boundaries
	@./scripts/check-architecture.bash

docs-check: ## Verify documentation links, paths, commands and ids
	@$(GO) run ./scripts/docscheck

skills-check: ## Fail if a vendored shared skill was edited in place
	@$(GO) run ./scripts/skillscheck

skills-sync: ## Re-vendor the shared skills from a release tag: make skills-sync SKILLS_REF=<tag>
	@test -n "$(SKILLS_REF)" || { echo "set SKILLS_REF=<tag> (git -C $(SKILLS_SOURCE) tag --sort=-v:refname | head -1)"; exit 1; }
	@$(SKILLS_SOURCE)/scripts/sync -C . -r $(SKILLS_REF)

web-lint: ## Frontend type checks and lint
	@pnpm --dir web run check
	@pnpm --dir web run lint
	@pnpm --dir e2e run check

web-test: ## Frontend unit tests and stories as tests
	@pnpm --dir web run test

web-budget: ## Build the frontend and fail when a bundle passes its budget
	@pnpm --dir web run build
	@pnpm --dir web run check:budget

storybook-build: ## Build the static Storybook for review
	@pnpm --dir web run build-storybook --output-dir storybook-static

e2e: ## Browser tests against the built image and a fresh database
	@$(COMPOSE) -p $(E2E_PROJECT) --profile e2e up --build --detach --wait
	@set -a; . ./.env.e2e; set +a; \
		pnpm --dir e2e exec playwright test $(E2E_ARGS); status=$$?; \
		$(COMPOSE) -p $(E2E_PROJECT) --profile e2e down --volumes; exit $$status

docker-build: ## Build the production image
	@docker build -f build/Dockerfile -t $(IMAGE):dev \
		--build-arg VERSION=$$(git describe --tags --always --dirty) \
		--build-arg REVISION=$$(git rev-parse HEAD) .

dev: dev-up ## Go server with reload and the Vite dev server, as one command
	@trap 'kill 0' INT TERM EXIT; \
	 $(GO) tool air & \
	 pnpm --dir web run dev & \
	 wait

seed: dev-up ## Load idempotent local seed data (never production data)
	@$(COMPOSE) exec -T postgres psql -U app -d app -v ON_ERROR_STOP=1 < testdata/seed/seed.sql

dev-up: ## Start local PostgreSQL and wait until healthy
	@$(COMPOSE) up --detach --wait postgres

dev-down: ## Stop local services, keep data
	@$(COMPOSE) down --remove-orphans

dev-reset: ## Delete local PostgreSQL data and start fresh
	@echo "Deleting the local PostgreSQL volume"
	@$(COMPOSE) down --volumes --remove-orphans
	@$(COMPOSE) up --detach --wait postgres

proto-lint: ## Lint the protobuf contract and check its formatting (connect-rpc)
	@$(BUF) lint
	@$(BUF) format --diff --exit-code

proto-breaking: ## Fail on a breaking proto change against the last release tag
	@if [ -z "$(LAST_TAG)" ]; then echo "No release tag yet: nothing to compare."; \
	else $(BUF) breaking --against '.git#tag=$(LAST_TAG)'; fi

# web-budget runs before lint and test: the embedded frontend package does
# not compile until web/build exists.
ci: env generate-check web-budget proto-lint lint architecture-check docs-check skills-check test web-lint web-test ## Everything the CI verify job runs
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
