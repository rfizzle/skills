# Makefile, pins and gates

## Makefile skeleton

Paths and generator commands are placeholders; keep the target names.

```make
GO          ?= go
PACKAGES    ?= ./...
GENERATED   := internal/api/gen web/src/lib/api
COVER_OUT   := coverage.out

.PHONY: help tools env hooks generate generate-check test test-integration \
        lint architecture-check docs-check skills-check web-lint web-test \
        e2e docker-build dev-up dev-down dev-reset ci

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

tools: ## Install the pinned development tools
	@./scripts/bootstrap-tools.bash
	@pnpm --dir web install --frozen-lockfile

env: ## Fail when an installed tool differs from its pin
	@./scripts/check-env.bash

hooks: ## Enable the repository's git hooks
	@git config core.hooksPath .githooks

generate: ## Run every code generator
	@$(GO) generate ./...
	@pnpm --dir web run generate:api

generate-check: generate ## Fail when generation changes the tree
	@git diff --exit-code -- $(GENERATED)
	@test -z "$$(git ls-files --others --exclude-standard -- $(GENERATED))"

test: ## Unit tests with race detector and coverage floor
	@$(GO) test -race -covermode=atomic -coverprofile=$(COVER_OUT) $(PACKAGES)
	@./scripts/check-coverage.bash $(COVER_OUT)

test-integration: ## Tests against disposable PostgreSQL
	@$(GO) test -race -count=1 -tags=integration $(PACKAGES)

lint: ## go vet, golangci-lint and format checks
	@$(GO) vet $(PACKAGES)
	@golangci-lint run

architecture-check: ## Fail on imports that cross layer boundaries
	@./scripts/check-architecture.bash

docs-check: ## Verify documentation links, paths, commands and ids
	@$(GO) run ./scripts/docscheck

skills-check: ## Fail if a vendored shared skill was edited in place
	@$(GO) run ./scripts/skillscheck

web-lint: ## Frontend type checks and lint
	@pnpm --dir web run check
	@pnpm --dir web run lint

web-test: ## Frontend unit tests and stories as tests
	@pnpm --dir web run test

e2e: ## Browser tests against the Compose stack
	@docker compose --profile e2e up --detach --wait
	@pnpm --dir web run e2e; status=$$?; docker compose --profile e2e down; exit $$status

docker-build: ## Build the production image
	@docker build -f build/Dockerfile -t $(IMAGE):dev \
		--build-arg VERSION=$$(git describe --tags --always --dirty) \
		--build-arg REVISION=$$(git rev-parse HEAD) .

dev-up: ## Start local PostgreSQL and wait until healthy
	@docker compose up --detach --wait postgres

dev-down: ## Stop local services, keep data
	@docker compose down --remove-orphans

dev-reset: ## Delete local PostgreSQL data and start fresh
	@echo "Deleting the local PostgreSQL volume"
	@docker compose down --volumes --remove-orphans
	@docker compose up --detach --wait postgres

ci: env generate-check lint architecture-check docs-check skills-check test web-lint web-test ## Everything the CI verify job runs
```

## Pins

`go.mod`:

```text
go 1.N.0

toolchain go1.N.P

tool (
	github.com/ogen-go/ogen/cmd/ogen
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
```

`package.json` (frontend):

```json
{
  "packageManager": "pnpm@<x.y.z>",
  "engines": { "node": ">=<major>.<minor>", "pnpm": "<x.y.z>" }
}
```

`.nvmrc`: one line, the Node version.

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
