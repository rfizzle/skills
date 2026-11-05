---
name: api-contract
description: Use this skill when adding or changing an HTTP API operation, path, schema, field, status code, error shape, header or security scheme in a spec-first Go service; when editing api/openapi.yaml or regenerating the transport code; when the controller no longer satisfies the generated interface or generated code drifts; when deciding whether a change is breaking and needs /api/v2; when deprecating or sunsetting an endpoint; or when designing errors (RFC 9457 Problem Details), pagination, IDs, timestamps or idempotency keys. Also use it to review an OpenAPI diff before the owner's contract gate. Not for package placement (go-project-layout), persistence (golang-database), or business logic inside a module.
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# API contract

`api/openapi.yaml` (OpenAPI 3.1) is the contract. The transport under
`internal/api/<gen>/` is generated from it and never edited. A change starts
in the YAML, is regenerated, is reviewed by the owner as a diff, then mapped
at the edge.

## Who owns what

| Path | Owns |
|---|---|
| `api/openapi.yaml` | paths, operations, schemas, status codes, Problem types, security |
| `internal/api/<gen>/` | generator output; never edited |
| `internal/controller/` | generated request to domain call to generated response |
| `internal/app/` | building the concretes and assembling the generated server |
| `internal/platform/http/` | mounting, middleware, `/healthz` `/readyz` `/metrics` |

## Change the contract

1. Classify the change (below). Breaking means a new version.
2. Edit `api/openapi.yaml`.
3. `make generate`, which also regenerates any frontend client; read the
   generated delta (`git diff`). If more changed than the YAML explains,
   stop: a generator version moved.
4. `oasdiff breaking` against the last release tag (CI runs the same).
5. **Owner gate.** Present the OpenAPI diff and the oasdiff output and stop.
   The owner approves before the controller is written.
6. Commit the YAML and everything generated from it alone, as the contract
   story: `feat(api): add order cancellation`. It must build
   on its own: the controller embeds the generator's unimplemented handler
   (ogen's `UnimplementedHandler`), so a new operation answers 501 until the
   backend story lands.
7. Backend story: map it in `internal/controller/`, controller and HTTP
   tests, `make generate` leaves no diff, `make ci`.

## Versioning

Everything is under `/api/v1`. `/healthz`, `/readyz` and `/metrics` sit
outside versioning.

| Change | Ships in |
|---|---|
| New operation, new optional request field, new response field, new enum value the docs allow clients to ignore, new Problem `type` on a new operation | v1 |
| Remove or rename a field, change a type or meaning, optional to required, change a status code or Problem `type`, remove an operation or enum value, tighten validation | `/api/v2` for the affected resources only |

For a breaking change: add the v2 operations beside v1; keep v1 working;
mark the v1 operations `deprecated: true`; v1 responses carry a `Sunset`
header (RFC 8594) with the removal date and a `Link: <...>; rel="deprecation"`
to the successor. Removal is its own later change, after the date.

`oasdiff breaking --fail-on ERR <last-tag-spec> api/openapi.yaml` runs in CI;
a deliberate break passes only because it is in a new version.

## Conventions

- **Errors**: RFC 9457 Problem Details, `application/problem+json`, every
  non-2xx. `type` is a stable absolute URI per error kind
  (`https://<host>/problems/<kebab-name>`), never changed once shipped;
  `title` fixed per type; `detail` human, safe, never a raw error or SQL;
  extension members for machine fields (`errors` for field validation).
  Each operation declares the Problem types it can return.
- **JSON**: camelCase names. Timestamps RFC 3339 in UTC (`2026-01-02T15:04:05Z`).
  IDs are opaque strings; clients never parse them.
- **Pagination**: cursor-based. Request `cursor` and `limit` (with a declared
  default and maximum); response `items` and `nextCursor` (absent at the end).
  The cursor is opaque. No offset pagination on unbounded collections.
- **Idempotency**: a POST a client may retry accepts `Idempotency-Key`; the
  same key and body returns the first result, a different body returns 422.
- **Tolerant readers**: clients ignore unknown fields and enum values; the
  server ignores nothing silently in requests it validates.
- Let the generator validate request schemas; do not re-validate in the
  controller.

## Mapping rules

- Generated types stay in `controller`, `app` and the HTTP server
  (`go-project-layout`).
- The controller declares small ports for the module behaviour it calls; it
  never imports a concrete module.
- Expected business errors map to the declared status and Problem `type`;
  unexpected errors return so the server's error path logs them once and
  answers a generic 500 Problem.
- `var _ api.Handler = (*Controller)(nil)` pins the generated interface.

## Test

Do not test generated code. Test mapping, error-to-Problem translation,
status and headers, security, and the `Sunset` header on deprecated
operations. See `golang-testing` for HTTP test patterns.

## When generation surprises you

- The controller no longer compiles: read the generated handler interface,
  implement the new or changed methods, run `go test ./internal/controller/...`.
- Drift after `make generate`: regenerate from the source; never patch a
  generated file. Pin the generator in `go.mod` (tool directive), never a
  separately installed binary.

## Definition of done

- The YAML changed first; generated code and the frontend client are in the
  same commit and regenerate cleanly.
- `oasdiff breaking` is clean against the last tag, or the break is in a new
  version with v1 deprecated and sunset.
- Every new error is a declared Problem type; every list is cursor-paginated.
- Owner approval of the diff is recorded before the controller change.
- `make ci` passes.
