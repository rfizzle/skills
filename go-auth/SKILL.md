---
name: go-auth
description: Use this skill when adding or reviewing authentication or authorization in a Go service with a browser frontend - sign-in, sign-out, sessions and their cookie, CSRF, password hashing, lockout, password reset, TOTP and recovery codes, API keys, OIDC or single sign-on, Cloudflare Access, roles and permissions, tenant isolation, or the current user - including the frontend's protected routes and expired-session handling. Triggers include "add login", "who is the current user", "only the owner may edit this", "users can see each other's data", "add an API token", "should we use JWT", "add Google sign-in", "lock the account after failed attempts", "add 2FA", "the session expired and the form was lost" and "is this endpoint protected". Not for cryptographic primitives and general vulnerability review (golang-security), the middleware chain and rate limiter mechanics (go-http-server), query and migration mechanics (golang-database), or the generated frontend client (frontend-api-client).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Go auth

`golang-security` used to offer five authentication patterns with no
default, so each service chose its own, and an agent left to choose reaches
for a JWT in `localStorage` that cannot be revoked, with permission checks
scattered through handlers. This is the one default for a Go service with an SPA,
browser side included. A project's `AGENTS.md` or a decision record may
override any row.

## The default

| Concern | Default |
|---|---|
| Session | opaque, server-side, a row in the project database (PostgreSQL or SQLite) |
| Session id | 32 bytes from `crypto/rand`, base64url in the cookie, SHA-256 at rest |
| Cookie | `__Host-session`; `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`; `Max-Age` = remaining absolute lifetime |
| Lifetimes | idle 24 h, absolute 14 days, both config; `last_seen` written at most once a minute |
| Rotation | new id, old row deleted in the same transaction, on sign-in, password change, TOTP enrol or removal |
| CSRF | `SameSite=Lax` + `http.CrossOriginProtection` (`Sec-Fetch-Site`, `Origin`) + a required custom header; no double-submit token |
| Machine clients | API keys (below) |
| JWT | only for third-party API clients, only with a decision record |
| OIDC | an identity source that ends in the same session; never the session itself |
| Cloudflare Access | an outer guard; the app still requires its own session |

The required header is `Connect-Protocol-Version`, which Connect-ES always
sends (handlers may also enforce it with
`connecthttp.WithRequireConnectProtocolHeader()`); an OpenAPI service requires a
fixed header its generated client always sets (`X-Requested-With: fetch`).
A cross-origin form cannot send either, and a cross-origin `fetch` that
does needs a preflight the server refuses. The role is read from the users
table on every request, so a role change applies at once without rotation.

## Where it lives

- `internal/modules/auth`: credentials, sessions, API keys, the middleware.
- `internal/domain`: `Principal`, `Role`, `Permission`, `CurrentUser(ctx)`,
  `ErrUnauthenticated`, `ErrForbidden`.
- Each business module: its own `Can<Verb><Noun>` functions.
- `internal/app` puts the auth middleware in `go-http-server`'s chain slot
  (after CORS, before the rate limiter).

## The middleware

1. `http.CrossOriginProtection.Check` on every request; refuse with 403.
   It also stops login CSRF, so it runs before any credential is read.
2. `Authorization: Bearer <key>` present: authenticate by API key only, and
   ignore cookies. An invalid key is 401.
3. Otherwise the cookie: hash, load the row with the user's tenant and
   role, check idle and absolute expiry, touch `last_seen`. An unknown or
   expired id clears the cookie and continues anonymous.
4. A cookie-authenticated unsafe method without the required header: 403.
5. Put the principal in the context, anonymous included. The middleware
   never rejects an anonymous caller; the module decides.

## Credentials

- **Passwords**: argon2id, t=3, m=64 MiB, p=4, 16-byte salt, 32-byte key
  (RFC 9106's second recommended option), stored as a PHC string so the
  parameters travel with the hash; rehash on sign-in when they are below
  current. A semaphore bounds concurrent hashes (memory is m × the bound).
  Primitives: `golang-security/references/cryptography.md`.
- **Unknown account**: verify against a dummy hash anyway, so timing and
  the message ("Email or password is incorrect") are identical.
- **Limits**: per IP through `go-http-server`'s limiter on the sign-in
  route; per account, 10 failures in 15 minutes locks for 15 minutes, keyed
  by the normalised identifier even when no account exists. Never a
  permanent lock (a stranger could lock out any user). Answer 429 with
  `Retry-After`.
- **Reset**: 32-byte token, SHA-256 at rest, 30 minutes, single use
  (consumed in the password-change transaction), sent in the URL fragment
  so it never reaches logs or `Referer`. The request answers the same
  whether or not the account exists. Success deletes every session.
- **TOTP**: RFC 6238 (SHA-1, 6 digits, 30 s), one step of drift, the last
  accepted step stored to refuse replay, the secret encrypted at rest (it
  must be read back, so it cannot be hashed). Enabled only after a valid
  code; 10 recovery codes of 80 bits, SHA-256 at rest, single use, shown
  once.
- **API keys**: `<prefix>_<id>_<secret>`: a product prefix the secret
  scanner has a rule for, a public id for lookup, a 32-byte secret stored
  as SHA-256 and compared in constant time. Shown once; name, scopes,
  `last_used_at` (at most once a minute), optional expiry, revocation that
  applies on the next request. Scopes narrow the owner's role, never widen.
- **Bootstrap**: on first start with no account, the binary creates the
  administrator from `APP_BOOTSTRAP_ADMIN_EMAIL` and
  `APP_BOOTSTRAP_ADMIN_PASSWORD`, logs that it did, and ignores them
  afterwards; `.env.e2e` sets them for the e2e run (`browser-e2e`).

## Principal and authorization

- `CurrentUser(ctx)` returns a `Principal` value. Its zero value is the
  anonymous principal, so a request that skipped the middleware is denied,
  never admitted, and no caller nil-checks. The key is an unexported type
  (`golang-context`).
- Roles are a small enum with `RoleNone` at zero; permissions are a table
  in code (`map[Role]Permission`). No policy engine or ABAC framework.
- One function per operation, in the module that owns the resource:
  `CanEditProject(ctx, projectID)`. Every exported module method that acts
  on the resource calls it first. The controller maps errors; it never
  decides.
- Repositories take the tenant id as a parameter and every query filters on
  it (`golang-database`). Another tenant's row is not found, so a missing
  check fails closed and a 404 leaks nothing a 403 would.
- `ErrUnauthenticated` maps to 401 (`Unauthenticated`), `ErrForbidden` to
  403 (`PermissionDenied`), another tenant's resource to 404 (`NotFound`).

## The browser side

- The `(app)` route group's layout redirects an anonymous visitor to
  `/sign-in?return=<path>`; `return` is followed only when it is a
  same-origin path (`frontend-api-client`'s `safeReturn`).
- The client's 401 hook forgets the user at once; when a form holds unsaved
  input it opens a sign-in dialog over the page instead of navigating, so
  the draft survives, and the person saves again after signing in.
- Sign-out calls the server, which deletes the row and expires the cookie;
  then the client clears its caches and goes to `/sign-in`.
- The sign-in screen is a `Screens/Sign in` story (`storybook-layout`) with
  its error, locked and TOTP states. Client code: `frontend-api-client`,
  `svelte-frontend`.

## Audit log

One `slog` event per auth event, through the request's logger so the
request id rides along: `auth.sign_in`, `auth.sign_in_failed` (with a
reason code), `auth.locked`, `auth.sign_out`, `auth.reset_requested`,
`auth.reset_completed`, `auth.totp_enrolled`, `auth.api_key_created`,
`auth.api_key_revoked`. Never a password, token, cookie, reset link, TOTP
code or key secret (`golang-security/references/logging.md`).

## Required tests

Every auth module and every module with a `Can...` function proves:
unauthenticated is refused; another tenant's id is not found; an idle- and
an absolute-expired session are refused; the pre-rotation id is refused
after sign-in; the per-account limit answers 429; an unsafe request without
the required header, or with `Sec-Fetch-Site: cross-site`, is 403.

## Gotchas

- The session id stored as-is turns a database read into account takeover;
  store only the hash and look up by it.
- `SameSite=Strict` drops the cookie on the first request from an external
  link (an email, a chat), so the user looks signed out. Lax is the default.
- Read the user from `CurrentUser(ctx)`, never from a header, a request
  field or a client-sent id.
- An authorization check in the handler beside an unchecked exported module
  method is no check: the next caller skips it. The check lives in the
  module.
- Forgetting rotation on sign-in is session fixation.
- `Secure` off is allowed only when a dev flag is set and both the listener
  and the configured public origin are loopback; startup fails otherwise.
  The cookie then drops the `__Host-` prefix, which requires `Secure`.
- A trusted origin added for a split-origin SPA goes to
  `CrossOriginProtection.AddTrustedOrigin` and to CORS together.

## Definition of done

- The defaults table holds, or a decision record says which row differs.
- Every exported module method that touches a resource calls its `Can...`
  function, and every query filters by tenant.
- The required tests pass; the audit events are emitted and carry no secret.

## References

- `references/sessions.md`: schema, token, cookie, middleware, rotation,
  sign-out, the dev flag. Open when building or changing sessions.
- `references/credentials.md`: argon2id, lockout, reset, TOTP, recovery
  codes, API keys. Open for any credential flow.
- `references/authorization.md`: `Principal`, roles and permissions, a
  `Can...` function, the tenant-filtered repository, the tests.
- `references/browser.md`: the server contract the client relies on, the
  guard, re-authentication in place, sign-out, the reset page, stories.
- `references/external-identity.md`: OIDC, Cloudflare Access, and JWT for
  third-party clients. Open only when one of those is in play.
