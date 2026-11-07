# External identity: OIDC, Cloudflare Access, JWT

Each of these is opt-in through a decision record. None replaces the
session in `sessions.md`.

## OIDC as an identity source

The provider proves who the person is; the app then starts its own
session, exactly as after a password sign-in.

- Libraries: `golang.org/x/oauth2` for the code flow and
  `github.com/coreos/go-oidc/v3` to verify the ID token. Authorization code
  flow with PKCE (`oauth2.GenerateVerifier`, `oauth2.S256ChallengeOption`),
  `state` and `nonce` from `crypto/rand`, kept in a short-lived `__Host-`
  cookie (`SameSite=Lax`, so it survives the provider's redirect back) and
  checked on the callback.
- Verify the ID token's signature, issuer, audience (the client id), expiry
  and nonce. Link the local user by the pair (`iss`, `sub`), never by email
  alone: an email can be reassigned or unverified at another provider.
- First sign-in: create or link the user only under the project's rule
  (invite-only, allowed domain with `email_verified` true, or admin
  approval). Then `Start` the session and audit `auth.sign_in` with
  `method=oidc`.
- Do not keep the provider's access or refresh token unless the app calls
  the provider's API; then store it encrypted, never in a cookie.
- The callback path is the only new public route; the return URL follows
  the same `safeReturn` rule as the sign-in page (`frontend-api-client`).

## Cloudflare Access as an outer guard

Access in front of the tunnel keeps strangers away from the sign-in page.
The app still requires its own session, because Access protects one path
into the app, not the app itself: a misrouted tunnel, a second hostname or
a local port bypasses it.

- Never trust `Cf-Access-Authenticated-User-Email` or any other identity
  header by itself; anything that reaches the origin another way can set it.
- To refuse requests that bypassed Access, verify `Cf-Access-Jwt-Assertion`
  in a middleware before auth: signature against the team's certs
  (`https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`), the
  application's AUD tag, issuer and expiry. `/healthz`, `/readyz` and
  `/metrics` are exempt when the probe and the scraper do not pass through
  Access. A failure is 403 and an audit event.
- The verified Access identity may pre-fill the sign-in form; it never
  signs anyone in.

## JWT for third-party API clients

Only when a third party cannot use an API key (it federates with its own
identity provider, or a gateway demands JWTs), and only with a decision
record.

- Pin the algorithm (one asymmetric algorithm, EdDSA or ES256), and
  require `iss`, `aud`, `exp` and a lifetime of 15 minutes or less.
  Signing keys come from a JWKS with `kid`, cached with a refresh on an
  unknown `kid`.
- The token resolves to a `Principal` with `Via` set to a third value
  (`AuthJWT`) and scopes, then everything downstream is unchanged.
- No JWT in a browser: the SPA always uses the session cookie. No refresh
  tokens issued by this app; a client that needs longer access uses an API
  key.
- Revocation is the reason JWT is not the default: a stolen token works
  until `exp`. Keep the lifetime short enough that this is acceptable, and
  record the trade in the decision.
