# Sessions

## Contents

- [Schema](#schema)
- [Token and cookie](#token-and-cookie)
- [Resolving a request](#resolving-a-request)
- [The middleware](#the-middleware)
- [Start, rotate, end](#start-rotate-end)
- [Development over http](#development-over-http)

## Schema

PostgreSQL (`golang-database` owns the migration rules):

```sql
CREATE TABLE sessions (
    id_hash      bytea       PRIMARY KEY,           -- SHA-256 of the cookie value
    user_id      bigint      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL
);
CREATE INDEX sessions_user_id ON sessions (user_id);
```

SQLite: the same columns as `BLOB`, `INTEGER` and Unix seconds. Nothing
else goes in the row: no user agent or IP unless the project shows a
"your devices" page, and then they are PII under the logging rules.

A periodic job (`go-background-jobs`) deletes rows past either lifetime:

```sql
DELETE FROM sessions
WHERE last_seen_at < now() - $1::interval   -- idle
   OR created_at   < now() - $2::interval;  -- absolute
```

The lookup joins the user, so a disabled user or a changed role takes
effect on the next request:

```sql
SELECT s.user_id, u.tenant_id, u.role, s.created_at, s.last_seen_at
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.id_hash = $1 AND u.disabled_at IS NULL;
```

## Token and cookie

```go
// newToken returns the cookie value and the hash that is stored.
func newToken() (token string, hash []byte) {
	b := make([]byte, 32)
	_, _ = rand.Read(b) // crypto/rand.Read never fails
	token = base64.RawURLEncoding.EncodeToString(b)
	return token, hashToken(token)
}

// A fast hash is right here: the input has 256 bits of entropy, so there
// is nothing to brute-force, and lookups stay one index probe.
func hashToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}

type Cookies struct {
	Name   string // "__Host-session"; "session" only under the dev flag
	Secure bool
}

func (s *Sessions) setCookie(w http.ResponseWriter, token string, created time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     s.cookies.Name,
		Value:    token,
		Path:     "/",
		MaxAge:   int(created.Add(s.absolute).Sub(s.now()).Seconds()),
		HttpOnly: true,
		Secure:   s.cookies.Secure,
		SameSite: http.SameSiteLaxMode,
	})
}

func (s *Sessions) clearCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name: s.cookies.Name, Value: "", Path: "/", MaxAge: -1,
		HttpOnly: true, Secure: s.cookies.Secure, SameSite: http.SameSiteLaxMode,
	})
}
```

`__Host-` makes the browser refuse the cookie unless it is `Secure`, has
`Path=/` and no `Domain`, so a sibling subdomain cannot set or shadow it.

## Resolving a request

```go
// Resolve turns the cookie into a principal; anonymous when absent, unknown
// or expired.
func (s *Sessions) Resolve(w http.ResponseWriter, r *http.Request) domain.Principal {
	c, err := r.Cookie(s.cookies.Name)
	if err != nil || c.Value == "" {
		return domain.Principal{}
	}
	hash := hashToken(c.Value)
	sess, err := s.store.ByHash(r.Context(), hash)
	if err == nil && s.expired(sess) {
		_ = s.store.Delete(r.Context(), hash) // best effort; the sweep job also removes it
		err = errExpired
	}
	if err != nil {
		if !errors.Is(err, errExpired) && !errors.Is(err, domain.ErrNotFound) {
			s.logger.ErrorContext(r.Context(), "session lookup failed", "error", err)
		}
		s.clearCookie(w)
		return domain.Principal{}
	}
	if now := s.now(); now.Sub(sess.LastSeen) > time.Minute {
		if err := s.store.Touch(r.Context(), hash, now); err != nil {
			s.logger.WarnContext(r.Context(), "session touch failed", "error", err)
		}
	}
	return domain.Principal{Via: domain.AuthSession, UserID: sess.UserID, TenantID: sess.TenantID, Role: sess.Role}
}

func (s *Sessions) expired(sess Session) bool {
	now := s.now()
	return now.Sub(sess.LastSeen) > s.idle || now.Sub(sess.CreatedAt) > s.absolute
}
```

A database error resolves to anonymous, so the request fails closed with
401; the client's re-auth dialog then appears, which is acceptable for a
rare outage and never admits anyone.

## The middleware

```go
// Middleware fills the auth slot in go-http-server's chain.
func Middleware(s *Sessions, keys *APIKeys, csrf *http.CrossOriginProtection, header string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if err := csrf.Check(r); err != nil {
				http.Error(w, "cross-origin request refused", http.StatusForbidden)
				return
			}
			var p domain.Principal
			if r.Header.Get("Authorization") != "" {
				var err error
				if p, err = keys.Resolve(r); err != nil { // cookies are ignored
					http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
					return
				}
			} else {
				p = s.Resolve(w, r)
				if p.Authenticated() && unsafeMethod(r.Method) && r.Header.Get(header) == "" {
					http.Error(w, "missing required header", http.StatusForbidden)
					return
				}
			}
			next.ServeHTTP(w, r.WithContext(domain.WithPrincipal(r.Context(), p)))
		})
	}
}

func unsafeMethod(method string) bool {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return false
	}
	return true
}
```

`csrf := http.NewCrossOriginProtection()` once in `internal/app`; call
`AddTrustedOrigin` only for a split-origin SPA, with the same origin the
CORS allowlist holds. `CrossOriginProtection` lets GET, HEAD and OPTIONS
through, so no handler changes state on them (Connect GET is only for
procedures marked `NO_SIDE_EFFECTS`). `header` is
`Connect-Protocol-Version` for a Connect service and `X-Requested-With` for
an OpenAPI one. Problem or Connect error bodies replace `http.Error` per
the contract.

## Start, rotate, end

```go
// Start signs the user in: a new id, and any id the browser already held is
// deleted in the same transaction (fixation).
func (s *Sessions) Start(ctx context.Context, w http.ResponseWriter, r *http.Request, user domain.UserID) error {
	token, hash := newToken()
	now := s.now()
	err := s.tx.WithinTx(ctx, func(q sessionQueries) error {
		if c, err := r.Cookie(s.cookies.Name); err == nil && c.Value != "" {
			if err := q.Delete(ctx, hashToken(c.Value)); err != nil {
				return fmt.Errorf("deleting previous session: %w", err)
			}
		}
		return q.Insert(ctx, hash, user, now)
	})
	if err != nil {
		return fmt.Errorf("starting session: %w", err)
	}
	s.setCookie(w, token, now)
	return nil
}
```

| Event | Sessions |
|---|---|
| Sign-in (after TOTP when enrolled) | `Start` |
| Password change | delete every session of the user, then `Start` for this browser |
| Password reset completed | delete every session of the user; no new session |
| TOTP enrolled or removed | `Start` (rotate this one); other sessions are deleted |
| Sign-out | delete this row, `clearCookie`, audit event |
| "Sign out everywhere" | delete every row of the user, `clearCookie` |
| User disabled | the lookup's join refuses at once; the sweep removes the rows |

A sign-in that needs TOTP does not create a session after the password
step. It returns a short-lived (5 minutes), single-use challenge id, hashed
at rest like a session id, that only the TOTP step accepts.

## Development over http

`Secure` cookies are refused over plain http in some browsers, and
`__Host-` requires `Secure`. A typed config flag (`APP_DEV_INSECURE_COOKIES`)
turns both off, and config validation accepts it only when the listen
address and the configured public origin are both loopback:

```go
func cookieConfig(cfg config.HTTP) (Cookies, error) {
	if !cfg.DevInsecureCookies {
		return Cookies{Name: "__Host-session", Secure: true}, nil
	}
	if !loopbackAddr(cfg.Addr) || !loopbackOrigin(cfg.PublicOrigin) {
		return Cookies{}, errors.New("APP_DEV_INSECURE_COOKIES needs a loopback listener and public origin")
	}
	return Cookies{Name: "session", Secure: false}, nil
}

func loopbackAddr(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return false
	}
	ip, err := netip.ParseAddr(host)
	return host == "localhost" || (err == nil && ip.IsLoopback())
}

func loopbackOrigin(origin string) bool {
	u, err := url.Parse(origin)
	if err != nil || u.Scheme != "http" {
		return false
	}
	ip, err := netip.ParseAddr(u.Hostname())
	return u.Hostname() == "localhost" || (err == nil && ip.IsLoopback())
}
```

Behind Cloudflare Tunnel the browser sees https, so production keeps
`Secure` even though the app's own listener speaks http.
