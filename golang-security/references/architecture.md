# Security Architecture Patterns

## Contents

- [Defense-in-Depth Layers](#defense-in-depth-layers)
- [Zero Trust Principles](#zero-trust-principles)
- [Authentication and Authorization](#authentication-and-authorization)
- [HTTP Security Headers](#http-security-headers)
- [Security Anti-Patterns](#security-anti-patterns)


Defense-in-depth, Zero Trust, and where authentication lives for Go services.

## Defense-in-Depth Layers

Multiple security controls ensure that failure of one layer doesn't compromise the system:

```
Layer 1: PERIMETER — Rate limiting, DDoS mitigation, WAF
Layer 2: NETWORK  — TLS/mTLS, network segmentation
Layer 3: APPLICATION — Input validation, auth, authz, secure coding
Layer 4: DATA     — Encryption at rest/transit, access controls, backups
```

### Go Implementation by Layer

**Layer 1 — Rate Limiting:** one limiter per client, keyed by the user,
else the API key, else the client IP, in middleware after authentication,
answering 429 with `Retry-After`. Never a single global `rate.NewLimiter`:
one abuser exhausts it and every other client is refused. The middleware,
its key function and the sweep of idle keys are in `go-http-server`
(`references/server.md`); per-account sign-in limits are in `go-auth`.

**Layer 2 — mTLS for Service-to-Service:**

```go
func mTLSConfig(caCertFile, clientCertFile, clientKeyFile string) (*tls.Config, error) {
    caCertPool := x509.NewCertPool()
    caCert, err := os.ReadFile(caCertFile)
    if err != nil { return nil, err }
    caCertPool.AppendCertsFromPEM(caCert)

    cert, err := tls.LoadX509KeyPair(clientCertFile, clientKeyFile)
    if err != nil { return nil, err }

    return &tls.Config{
        Certificates: []tls.Certificate{cert},
        RootCAs:      caCertPool,
        MinVersion:   tls.VersionTLS12,
    }, nil
}
```

**Layer 3 — Request Body Size Limiting:**

```go
func MaxBodySize(maxBytes int64) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
            next.ServeHTTP(w, r)
        })
    }
}
```

The per-route body limits and where they sit in the chain: `go-http-server`.

**Layer 4 — Encryption at Rest (AES-GCM):**

Use `crypto/aes` with GCM mode for authenticated encryption. See [Cryptography Security](./cryptography.md) for full `EncryptAESGCM`/`DecryptAESGCM` implementations, algorithm selection guide, and envelope encryption for key rotation.

---

## Zero Trust Principles

| Principle | Implementation |
| --- | --- |
| Verify explicitly | Authenticate and authorize every request — no implicit trust from network location |
| Least privilege | Grant minimum permissions; sessions and keys expire and can be revoked server-side |
| Assume breach | Segment services, encrypt all communication, log all access for anomaly detection |

In a Go service this is the auth middleware resolving the principal on
every request and each module checking the permission for each operation,
with the tenant in every query; see `go-auth`.

---

## Authentication and Authorization

The default for a Go service with a browser frontend (server-side opaque
sessions, argon2id, TOTP, API keys for machines, CSRF defence, per-operation
authorization, the browser side) is `go-auth`, including when JWT and OIDC
are acceptable. Review against it. What it does not cover:

| Case | Pattern | Go implementation |
| --- | --- | --- |
| Service-to-service inside one trust domain | mTLS with certificate rotation (Layer 2 above) | `crypto/tls` |
| Phishing-resistant sign-in, when the owner asks for it | FIDO2/WebAuthn passkeys, feeding the same session | `github.com/go-webauthn/webauthn` |

Password hashing parameters live in `go-auth`; algorithm choice in
[Cryptography Security](./cryptography.md).

---

## HTTP Security Headers

Set on every response via middleware. A service that serves an embedded SPA
builds its CSP from the build and uses `frame-ancestors` (`go-http-server`);
the generic version:

```go
func SecurityHeadersMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'")
        w.Header().Set("X-Frame-Options", "DENY")
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
        w.Header().Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
        next.ServeHTTP(w, r)
    })
}
```

| Header | Purpose | Recommended Value |
| --- | --- | --- |
| Content-Security-Policy | Prevents XSS by restricting resource sources | `default-src 'self'; script-src 'self'` |
| X-Frame-Options | Prevents clickjacking via framing | `DENY` |
| X-Content-Type-Options | Prevents MIME-type sniffing | `nosniff` |
| Strict-Transport-Security | Forces HTTPS, prevents protocol downgrade | `max-age=31536000; includeSubDomains` |
| Referrer-Policy | Controls referrer header leakage | `strict-origin-when-cross-origin` |
| Permissions-Policy | Restricts browser features (camera, mic, geolocation) | `geolocation=(), microphone=(), camera=()` |

---

## Security Anti-Patterns

| Anti-Pattern | Why It Fails | Go Fix |
| --- | --- | --- |
| Security through obscurity | Hidden admin URLs are discoverable via fuzzing, logs, or source code | Authentication + authorization on all endpoints |
| Trusting client headers | `X-Forwarded-For`, `X-Is-Admin` — clients forge any header | Server-side identity verification; trust proxy headers only from known load balancers |
| Client-side authorization | JavaScript checks are trivially bypassed by any HTTP client | Server-side check in the module for every operation (`go-auth`) |
| Shared secrets across environments | Staging breach → production compromise | Per-environment secrets via secret manager |
| Catching and ignoring crypto errors | `_, _ = encrypt(data)` silently proceeds with unencrypted data | Always check error returns — fail closed, never open |
| Rolling your own crypto | Custom encryption hasn't been analyzed by cryptographers | Use `crypto/aes` GCM, `golang.org/x/crypto/argon2` |
| Verbose error responses | Stack traces and DB errors reveal internals to attackers | Generic errors to clients (`http.Error(w, "Internal error", 500)`), detailed logs server-side |

```go
// Anti-pattern: trusting client-provided identity
func badHandler(w http.ResponseWriter, r *http.Request) {
    if r.Header.Get("X-Is-Admin") == "true" { // attacker sets this header
        adminPanel(w, r)
    }
}

// Correct: the identity comes from the server-side session, and the module
// that owns the operation decides (go-auth)
func (s *Service) ResetUserPassword(ctx context.Context, id domain.UserID) error {
    p := domain.CurrentUser(ctx)
    if !p.Has(domain.PermMembersManage) {
        return domain.ErrForbidden
    }
    // ...
}
```
