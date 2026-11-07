# buf setup, pins and targets

Module path, org and service names are examples. Generated Go goes where
`go-project-layout` quarantines it (`internal/api/gen`); TypeScript goes
where `frontend-api-client` reads it (`web/src/lib/api/gen`).

## Layout

```text
buf.yaml
buf.lock                       committed; `buf dep update` bumps it
buf.gen.yaml                   our protos -> Go and TypeScript
buf.gen.errors.yaml            google.rpc error details -> TypeScript only
proto/acme/orders/v1/orders.proto
internal/api/gen/acme/orders/v1/orders.pb.go
internal/api/gen/acme/orders/v1/ordersv1connect/orders.connect.go
web/src/lib/api/gen/acme/orders/v1/orders_pb.ts
web/src/lib/api/gen/buf/validate/validate_pb.ts
web/src/lib/api/gen/google/rpc/error_details_pb.ts
```

The directory under `proto/` matches the package (`acme.orders.v1`); buf
lint `STANDARD` enforces it.

## buf.yaml

```yaml
# The API contract. proto/ is the module root, so a file's path below it
# matches its package. make proto-lint and make proto-breaking read this.
version: v2
modules:
  - path: proto
deps:
  - buf.build/bufbuild/protovalidate
lint:
  use:
    - STANDARD
breaking:
  use:
    - FILE
```

## buf.gen.yaml

```yaml
# Every plugin is local and pinned in this repository: the Go plugins are
# go.mod tool directives, so they match the runtime modules; protoc-gen-es is
# a web devDependency. No remote plugin.
version: v2
clean: true
managed:
  enabled: true
  disable:
    # protovalidate's Go package is its published SDK; keep it.
    - file_option: go_package
      module: buf.build/bufbuild/protovalidate
  override:
    - file_option: go_package_prefix
      value: example.com/acme/orders/internal/api/gen
plugins:
  - local: [go, tool, protoc-gen-go]
    out: internal/api/gen
    opt: paths=source_relative
  - local: [go, tool, protoc-gen-connect-go]
    out: internal/api/gen
    opt: paths=source_relative
  # Connect-ES v2 builds clients from the service descriptors in these _pb
  # files; protoc-gen-connect-es is v1 only and is not used.
  - local: web/node_modules/.bin/protoc-gen-es
    out: web/src/lib/api/gen
    opt: [target=ts, json_types=true]
    include_imports: true # buf/validate/validate_pb.ts, which our _pb.ts imports
```

## buf.gen.errors.yaml

The browser decodes `google.rpc.BadRequest` with a generated schema. None of
our protos import it, so it gets its own template, TypeScript only (Go uses
`google.golang.org/genproto/googleapis/rpc/errdetails`).

```yaml
version: v2
inputs:
  - module: buf.build/googleapis/googleapis:<commit>
    paths:
      - google/rpc/error_details.proto
plugins:
  - local: web/node_modules/.bin/protoc-gen-es
    out: web/src/lib/api/gen
    opt: [target=ts, json_types=true]
```

It runs after `buf.gen.yaml`, whose `clean: true` empties the output
directories first. Pin the commit; a moving input fails the generate check.

## Pins

`go.mod`:

```text
tool (
	connectrpc.com/connect/v2/cmd/protoc-gen-connect-go
	google.golang.org/protobuf/cmd/protoc-gen-go
)
```

Each plugin comes from the same module as its runtime, so one bump moves
both together.

`scripts/tool-versions.env`, because buf's module graph would otherwise join
the service's `go.mod` and raise its dependencies:

```sh
BUF_MODULE=github.com/bufbuild/buf/cmd/buf
BUF_VERSION=v<x.y.z>
```

`web/package.json`: `@bufbuild/protoc-gen-es` (dev) and `@bufbuild/protobuf`
at the same exact version, plus `@connectrpc/connect` and
`@connectrpc/connect-web`. Renovate groups them so they move together:

```json
{ "matchPackageNames": ["@bufbuild/**", "@connectrpc/**"], "groupName": "protobuf and connect" }
```

## Make targets

Names follow `repo-tooling`. `proto-lint` joins `ci`; `proto-breaking` is the
CI api-compat job and runs locally too.

```make
BUF       ?= buf
LAST_TAG   = $(shell git describe --tags --abbrev=0 2>/dev/null)
GENERATED := internal/api/gen web/src/lib/api/gen

generate: ## Run every code generator
	@$(BUF) generate
	@$(BUF) generate --template buf.gen.errors.yaml
	@$(GO) generate ./...

generate-check: generate ## Fail when generation changes the tree
	@git diff --exit-code -- $(GENERATED)
	@test -z "$$(git ls-files --others --exclude-standard -- $(GENERATED))"

proto-lint: ## Lint the protobuf contract and check its formatting
	@$(BUF) lint
	@$(BUF) format --diff --exit-code

proto-breaking: ## Fail on a breaking proto change against the last release tag
	@if [ -z "$(LAST_TAG)" ]; then echo "No release tag yet: nothing to compare."; \
	elif ! git cat-file -e "$(LAST_TAG):proto" 2>/dev/null; then echo "$(LAST_TAG) has no proto/: nothing to compare."; \
	else $(BUF) breaking --against '.git#tag=$(LAST_TAG)'; fi
```

`make tools` installs `web/node_modules` before `generate` can find
`protoc-gen-es`; `make env` compares `buf --version` with `BUF_VERSION`.

## CI

| Job | Runs | Fails on |
|---|---|---|
| verify | `make ci`, which includes `generate-check` and `proto-lint` | drift, lint or format |
| api-compat | `make proto-breaking` after a checkout with `fetch-depth: 0` | a breaking change in an existing package |

The ignore lists of eslint, prettier and golangci-lint carry both generated
directories.
