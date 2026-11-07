---
name: connect-rpc
description: Use this skill when adding or changing a protobuf/Connect API in a Go service, the default contract for new services - a .proto file under proto/, a service, RPC, message, field or enum, buf.yaml or buf.gen.yaml, regenerating the Go and TypeScript code, a buf lint or buf breaking failure, deciding whether a change needs a v2 package, deprecating an RPC, mapping domain errors to Connect codes, field errors a form shows, protovalidate rules, interceptors, server streaming, or wiring the Connect handlers. Triggers include "add an endpoint" or "add an API call" in a service with a proto/ directory, "the generated code drifted", "buf breaking fails", "the browser call is rejected", "stream live updates", "is this change breaking", and reviewing a proto diff before the owner's contract gate. Not for an OpenAPI/REST service (api-contract), the HTTP server and middleware around the handlers (go-http-server), sessions and login (go-auth), or calling the API from the frontend (frontend-api-client).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Connect RPC

The `.proto` files under `proto/` are the contract. One handler serves gRPC,
gRPC-Web and the Connect protocol (JSON over HTTP/1.1, the browser's); Go
and TypeScript are generated from it and never edited. The failure this
prevents: a field renamed "safely" (same number, binary gRPC unharmed)
breaks every browser client, which reads JSON names.

The default for new services; OpenAPI with ogen stays for a public REST API
or an existing OpenAPI service (`api-contract`), and a project's `AGENTS.md`
may override either. Code is connect-go v2 (`connectrpc.com/connect/v2`); a
service on connect-go v1 keeps these rules and moves with
`connect-go-v2-migrate` as a change of its own.

## Who owns what

| Path | Owns |
|---|---|
| `proto/<org>/<service>/v1/*.proto` | services, RPCs, messages, enums, validation rules, doc comments |
| `buf.yaml`, `buf.lock` | module root `proto`, the protovalidate dependency, lint `STANDARD`, breaking `FILE` |
| `buf.gen.yaml`, `buf.gen.errors.yaml` | local pinned plugins and output directories |
| `internal/api/gen/`, `web/src/lib/api/gen/` | Go and TypeScript output; never edited (`go-project-layout`) |
| `internal/controller/` | implements the generated handler; the one error mapping |
| `internal/platform/http/rpc/` | the validation, logging and Sunset interceptors |
| `internal/app/` | builds the `connect.Server`, registers services, mounts it |

## Change the contract

1. Classify the change (Versioning). Breaking means a new package.
2. Edit the `.proto`, with a doc comment on every service, RPC, message and field.
3. `make proto-lint`, `make generate`, and read the generated delta. If more
   changed than the proto explains, stop: a plugin version moved.
4. `make proto-breaking` against the last release tag; CI runs the same.
5. **Owner gate.** Present in plain English the proto diff, the `buf
   breaking` output, any change to the error mapping and the golden JSON
   diff. Stop until the owner accepts.
6. Commit the proto and everything generated from it alone, as the contract
   story (`feat(api): add order cancellation`). It builds alone: the
   controller embeds `Unimplemented<Service>Handler`, so a new RPC answers
   `unimplemented` until the backend story lands.
7. Backend story: the controller, handler tests, no generate diff, `make ci`.

## Design rules

buf lint `STANDARD` enforces the naming; these it cannot see.

- **One service per bounded module** (`OrderService` for `modules/orders`, `contract-spec`).
- **Every RPC has its own request and response**, never shared, never a bare
  entity or `Empty`. Resource messages (`Order`) are shared; wrappers not.
- **Field numbers are forever.** Never renumber or reuse; a removed field
  leaves `reserved 6; reserved "note";`.
- No `Any` or `Struct` for domain data; `Timestamp` (`*_time`) and
  `Duration` for time. **IDs are opaque strings**, even over integer keys.
- **Enum zero is `<ENUM>_UNSPECIFIED`** and means "not set"; requests reject
  it (`defined_only`, `not_in: [0]`).
- **Pagination**: `page_size` (declared default and maximum) and
  `page_token` in; items and `next_page_token` (empty on the last page) out.
- **Idempotency**: a create takes `string idempotency_key` (a client UUID);
  same key and request return the first result, same key with another
  request is `invalid_argument`. Reads set `option idempotency_level =
  NO_SIDE_EFFECTS;`, generating `connect.IdempotencyNoSideEffects`; with
  `connecthttp.WithHTTPGet()` on the server and `useHttpGet` in the browser
  client (`frontend-api-client`) they travel as cacheable GETs.
- **Validation is protovalidate rules in the proto**, not controller code.
- **Live data is a server stream.** No client or bidi streams for the
  browser; Connect-ES cannot send them from `fetch`.

## Versioning

The proto package is the API version: `acme.orders.v1` in `proto/acme/orders/v1/`.

| Change | Ships in |
|---|---|
| New service, RPC, message, request field, response field, enum value clients may ignore | v1 |
| Remove, rename or renumber a field; change a type, a `json_name` or a meaning; move a message to another file; remove an RPC or enum value; tighten a rule | new package `v2`, affected service only |

For a break: register `proto/acme/orders/v2/` on the same server beside v1,
which keeps working. Mark v1 `option deprecated = true;` with `Deprecated:
use acme.orders.v2.OrderService. Sunset: YYYY-MM-DD.` in its comment and a
`Sunset` response header; removing v1 after the date is the MAJOR release
(`release`). CI's `buf breaking --against '.git#tag=<last-tag>'` passes a
deliberate break only in a new package.

## Errors

One function in `internal/controller/` maps domain errors
(`golang-error-handling`); never a module, never inline in a handler.

| Domain error | Code |
|---|---|
| not found, or hidden from this caller | `not_found` |
| unique key taken | `already_exists` |
| input the schema could not catch | `invalid_argument` with field violations |
| state forbids it, stale version | `failed_precondition` |
| caller lacks the permission | `permission_denied` |
| no principal in the context (`go-auth`) | `unauthenticated` |
| rate limit or quota | `resource_exhausted` |
| `context.Canceled`, `context.DeadlineExceeded` | returned unchanged |
| anything else | `internal`, message `internal error`, `WithCause(err)` |

- Messages are fixed and user-safe, never `err.Error()`. The cause rides in
  `WithCause`, never sent; the logging interceptor logs it once.
- Field errors are a `google.rpc.BadRequest` detail on `invalid_argument`,
  one violation per field: `field` the path protovalidate prints
  (`items[0].sku`), `description` user-safe. A form maps them as it maps
  Problem Details `errors: [{pointer, detail}]` (`frontend-api-client`).

## Server wiring

- Each service mounts at the root of the `go-http-server` mux
  (`/acme.orders.v1.OrderService/`), so gRPC clients need no prefix.
- Order: the mux chain recovers panics, sets the request id and runs the
  `go-auth` middleware, which puts the principal in the context; then the
  interceptors, outermost first: `otelconnect`, the failure logger,
  protovalidate. A Connect recover is not added.
- `WithRequireConnectProtocolHeader()`: a POST without
  `Connect-Protocol-Version: 1` is rejected. A cross-site form cannot set it;
  with SameSite cookies it is the CSRF defence. GETs are reads only.
- `WithReadMaxBytes` equal to the route's body limit in `go-http-server`,
  raised per procedure only; `WithCompressMinBytes(1024)`; unencrypted
  HTTP/2 only when the listener is reachable from the proxy alone and a
  gRPC client needs it; `grpcreflect` outside production only.

## Testing

- Handler tests: `connect.NewClient` over `httptest.NewServer` around the
  mount function production calls, so options and interceptors are real.
  Assert `connect.CodeOf` and field paths, not message text. One test
  proves a POST without the header gets 400.
- A golden JSON test per service puts one response's wire shape in review;
  the breaking-change test is the CI `buf breaking` job.

## Gotchas

- `buf breaking` against `main` misses a break already merged but not
  released; compare with the last tag. CI must fetch tags (`fetch-depth: 0`).
- A plugin outside the pins (a global `protoc-gen-go`, a remote BSR plugin)
  changes version headers and fails the generate check; an edit in `gen/`
  is lost on the next run. Change the proto, then `make generate`.
- A response returning the whole entity when the caller needs three fields
  makes every entity field, including future ones, part of that RPC. Get,
  List, Create and Update return the resource; actions return what changed.
- A rename keeps the binary wire and breaks JSON. Do not patch it with
  `json_name`: TypeScript follows the proto name, JSON follows `json_name`,
  and they drift. Never set `json_name`.
- An enum zero with a meaning (`STATUS_ACTIVE = 0`) makes every unset field active.
- curl, a hand-written `fetch` or an e2e helper without
  `Connect-Protocol-Version` gets `invalid_argument: missing required
  header`. Use the generated client or `buf curl`.
- A stream dies at the server's `WriteTimeout` and the proxy's idle
  cut-off. `go-http-server` sets `WriteTimeout` 0 and gives the stream a
  lifetime; the handler sends at least every 25 seconds and returns `nil`
  when `ctx` ends, so the client reconnects.
- protovalidate imports need `include_imports: true` on the TypeScript
  plugin, or `_pb.ts` imports a file that does not exist.

## Definition of done

- The proto changed first, its Go and TypeScript output in the same commit;
  no generate diff; `make proto-lint` and `make ci` pass.
- `buf breaking` is clean against the last tag, or the break is in a new
  package with v1 deprecated and dated.
- Each new domain error has a mapping row and a handler test.
- The owner accepted the proto diff before the controller change.

## References

- [references/buf-setup.md](references/buf-setup.md): open when creating the
  layout or touching buf files, pins, Make targets or CI (`repo-tooling`).
- [references/proto-style.md](references/proto-style.md): open when writing
  or reviewing a `.proto`, or adding a v2 beside v1.
- [references/server.md](references/server.md): open when wiring the server,
  writing an interceptor, the error mapping, a stream, or handler and golden tests.
