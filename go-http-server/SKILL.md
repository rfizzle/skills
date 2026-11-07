---
name: go-http-server
description: Use this skill when building, wiring or reviewing the HTTP layer of a Go service (internal/platform/http) that serves a Connect or OpenAPI API and an embedded single-page frontend; when choosing a router, ordering middleware, setting http.Server timeouts, serving the built frontend with SPA fallback and cache headers, streaming live data (Connect server streams, SSE), building an outbound http.Client, adding rate limiting or security headers, or draining the listener on shutdown. Triggers include "add a router", "which order do the middlewares go in", "deep links 404 after refresh", "users see the old build after deploy", "the stream drops after a minute", "add CORS", "get the real client IP", "call an external API", "429", "CSP blocks the app" and "ServeMux panics: pattern conflicts". Not for the API contract (api-contract, connect-rpc), sessions, CSRF and permissions (go-auth), health checks, log fields and shutdown order (service-operations), or vulnerability review (golang-security).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Go HTTP server

The one shape of `internal/platform/http/` for a service that serves an API
and an embedded SPA. Left open, every service picks its own router,
middleware order and cache headers, and the failures are quiet: a `GET /`
SPA route beside Connect's method-less paths panics at registration, a
year-cached `index.html` pins users to a deleted build, a `WriteTimeout`
cuts every live stream at the same age.

## Routing

Stdlib `http.ServeMux` with Go 1.22 method and wildcard patterns; no router
dependency. Connect handlers and the ogen server mount on it directly. A
project adds a router only with a decision record (`project-docs`) naming
what ServeMux cannot do; the router then sits inside the same chain.

| Pattern | Serves |
|---|---|
| `GET /healthz`, `GET /readyz`, `GET /metrics` | `service-operations` |
| `/<package>.<Service>/` | each Connect service, as `connect-rpc` mounts it |
| `/api/v1/` | the ogen server, when the contract is OpenAPI (`api-contract`) |
| `/api/` | a 404 Problem, so an unknown API path never reaches the SPA |
| `/` | the SPA handler, registered **without a method** |

Register every handler through one helper that wraps it with `Route`, which
copies `r.Pattern` into a holder the access log reads: the mux sets the
pattern on the request it was given, which middleware outside it never sees.

## The server

| Field | Value | Why |
|---|---|---|
| `ReadHeaderTimeout` | 5 s | slow-header clients hold a connection otherwise |
| `ReadTimeout` | 30 s | whole request; an upload row extends it per request |
| `WriteTimeout` | 60 s; **0 when any route streams** | a connection deadline from the header read: it cuts every stream at that age. Unary routes then get a write deadline from the route table |
| `IdleTimeout` | 120 s | keep-alive connections are reclaimed |
| `MaxHeaderBytes` | 64 KiB | the 1 MiB default is far beyond any real header |
| `BaseContext` | the app's base context | never cancelled when shutdown starts, or the drain aborts in-flight requests |
| `ErrorLog` | `slog.NewLogLogger(h, slog.LevelWarn)` | the server's own errors are JSON like every other line |

Shutdown follows `service-operations`: `/readyz` turns 503, then `Run`
calls `Shutdown` under a drain deadline and `Close` if it expires. A stream
is never idle, so `Shutdown` would wait for it: the shutdown signal also
ends every stream through the route table.

## Middleware order

Outermost first. The order is fixed; each row says why it sits there.

| # | Middleware | Why here |
|---|---|---|
| 1 | Recover | catches a panic anywhere below, middleware included; re-panics `http.ErrAbortHandler` |
| 2 | Request ID | every later log line carries it (`service-operations` rules) |
| 3 | Client IP | from `X-Forwarded-For` or `CF-Connecting-IP` only when the peer is in the trusted-proxy list; the log and limiter key on it |
| 4 | Access log, metrics, span | sees every outcome below it: 413, 401, 404, 429 |
| 5 | Body limit | `http.MaxBytesReader` (per-route `MaxBytesHandler`) before anything reads the body |
| 6 | Route deadline | unary: context deadline plus write deadline; stream: lifetime bound to shutdown |
| 7 | Security headers | before any handler writes; CSP, `nosniff`, `frame-ancestors 'none'`, HSTS when the public origin is https |
| 8 | CORS | only when the SPA's origin differs; before auth because a preflight carries no credentials |
| 9 | Auth | `go-auth`: resolves the principal and checks CSRF; never rejects an anonymous caller itself |
| 10 | Rate limit | keyed per client, so after auth |

Then the mux. Validation is not a layer: schema validation belongs to the
generated transport (`api-contract`, `connect-rpc`), business validation to
the module, and the controller adds nothing between them.

**The route table** sets rows 5 and 6 from one list keyed by path prefix,
first match wins, the last row `/` is the default (1 MiB, 30 s). Streams and
uploads get their own rows. An inner `MaxBytesHandler` can only lower the
limit, so a larger one is a table row. Never `http.TimeoutHandler`: it
buffers the response and drops `Flush`.

## The embedded frontend

- `web/embed.go` holds `//go:embed all:build`; `all:` is required because
  SvelteKit writes `_app/` and embed skips `_`-prefixed paths without it.
  `internal/app` passes `fs.Sub(web.Build, "build")` to the server.
- Only content-hashed files are immutable: `_app/immutable/` (SvelteKit) or
  `assets/` (plain Vite) get `Cache-Control: public, max-age=31536000,
  immutable`. Everything else, `index.html` and `_app/version.json`
  included, gets `no-cache` (revalidate) with an ETag.
- Fallback: a GET or HEAD for a path with no file extension serves
  `index.html`; a missing path with an extension is 404, so a missing chunk
  fails loudly instead of returning HTML. Other methods get 405.
- Serve through `http.ServeContent` (HEAD and ranges handled), never
  `http.FileServer` or `ServeFileFS`: they list directories and redirect
  `/index.html`.
- Serve a `.br` or `.gz` sibling when the build emits one
  (`adapter-static` `precompress: true`) and the client accepts it, with
  `Vary: Accept-Encoding`.
- The CSP is built at startup by hashing the inline bootstrap script in
  `index.html`, so `script-src` never needs `'unsafe-inline'`.

## Long-lived responses

Connect server streaming is the default for live data; SSE for an endpoint
outside Connect; WebSocket only with a decision record. Every stream: has a
route-table row with a lifetime (minutes, after which the client reconnects
and resumes from its last ID); flushes after every message; sends a heartbeat
every 25 s, under the shortest proxy idle timeout (Cloudflare cuts at 100 s);
ends when `r.Context()` ends (client gone, lifetime, shutdown); releases its
subscription on return; holds no transaction or pooled connection; and
counts toward a per-principal cap.

## Outbound calls

- Never `http.DefaultClient` (no timeout). One constructor: a cloned
  transport with connection limits and `ResponseHeaderTimeout`, a client
  `Timeout`, a per-call deadline (`golang-context`), redirects off unless a
  fixed upstream needs them. Bodies go through `io.LimitReader`, always closed.
- A user-supplied URL uses a second constructor: no redirects, and a dialer
  that refuses private, loopback and link-local addresses after DNS
  resolution (SSRF, `golang-security` injection reference).
- Retry only idempotent calls (or a POST with an idempotency key): three
  attempts, jittered backoff, `Retry-After` honoured, a retry budget per
  upstream, stop on `ctx.Done()`.

## Rate limiting

Per client, never one global limiter (one noisy client starves everyone).
Key: the user, else the API key, else the client IP (IPv6 by /64);
`internal/app` supplies the key function, since only the auth module knows
the principal. In memory per replica, idle keys swept; a shared store is a
decision record. Over the limit: 429, `Retry-After`, a Problem body.
Per-account sign-in limits are `go-auth`'s.

## Tests

`NewHandler(deps)` builds the mux and the chain; production and tests call
it alike, so tests drive the real chain with `httptest` and an
`fstest.MapFS` build. Required: a routing table (deep link, HEAD, hashed
asset, missing chunk, `version.json`, unknown `/api/` path, Connect path,
health, wrong method) asserting status and `Cache-Control`, and that no
`/api/` path is answered with HTML; a panic becomes a 500 with a request ID;
a stream heartbeats and ends when its context is cancelled.

## Gotchas

- `GET /` for the SPA conflicts with every method-less subtree (`/api/`,
  Connect paths) and ServeMux panics at startup. Register `/` and check the
  method in the handler.
- A response-writer wrapper must implement `Flush` (connect-go asserts
  `http.Flusher` for server streams) and `Unwrap` (`http.ResponseController`
  reaches deadlines through it). Without them streams fail or buffer.
- `X-Forwarded-For` from an untrusted peer is attacker input. Walk it right
  to left and stop at the first address not in the trusted list.
- `MaxBytesReader` wrapped after a middleware already read the body limits
  nothing; the body limit sits above every reader.
- `index.html` with a long cache, or `immutable` on the whole `_app/`,
  keeps users on an old build that requests deleted chunks.
- The recover middleware cannot see a panic in a goroutine the handler
  started; that goroutine recovers itself (`golang-concurrency`).
- CORS on a same-origin SPA only widens access; in development Vite's proxy
  keeps the API same-origin. A real second origin gets an exact allowlist.

## Definition of done

- The mux, chain and route table match the tables above, built by one
  `NewHandler` the tests call; every server field is set; shutdown drains
  and ends streams.
- No `http.DefaultClient`, `http.FileServer`, `http.TimeoutHandler` or
  global limiter in the service.
- The routing table test passes, including the `/api/` shadowing case.

## References

- `references/server.md`: `NewServer`, `Run`, every middleware, the route
  table and the rate limiter. Open when writing or changing the chain.
- `references/frontend.md`: the embed, the SPA handler, precompressed
  assets and the CSP builder. Open when serving or caching the frontend.
- `references/streaming-and-clients.md`: the SSE handler, Connect stream
  rules, the outbound clients and the retry budget.
- `references/testing.md`: the routing table test and the stream test.
