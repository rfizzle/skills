# Credentials

## Contents

- [Passwords](#passwords)
- [Sign-in flow and lockout](#sign-in-flow-and-lockout)
- [Password reset](#password-reset)
- [TOTP and recovery codes](#totp-and-recovery-codes)
- [API keys](#api-keys)

Primitive choices (why argon2id, why AES-GCM, `crypto/rand`) are in
`golang-security/references/cryptography.md`; this file is how they are put
together.

## Passwords

```go
// RFC 9106 second recommended option. Raise, never lower; older hashes are
// replaced at the next successful sign-in.
type Params struct {
	Time    uint32 // iterations
	Memory  uint32 // KiB
	Threads uint8
}

var Current = Params{Time: 3, Memory: 64 * 1024, Threads: 4}

const saltLen, keyLen = 16, 32

type Hasher struct {
	sem   chan struct{} // bounds memory: Memory × cap(sem)
	dummy string        // verified when the account does not exist
}

func NewHasher(concurrent int) (*Hasher, error) {
	h := &Hasher{sem: make(chan struct{}, concurrent)}
	d, err := h.Hash(context.Background(), rand.Text())
	if err != nil {
		return nil, err
	}
	h.dummy = d
	return h, nil
}

func (h *Hasher) Hash(ctx context.Context, password string) (string, error) {
	salt := make([]byte, saltLen)
	_, _ = rand.Read(salt)
	key, err := h.derive(ctx, password, salt, Current)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s", argon2.Version,
		Current.Memory, Current.Time, Current.Threads,
		base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(key)), nil
}

// Verify reports whether password matches encoded and whether the stored
// hash should be replaced. An empty encoded (no such account) is checked
// against the dummy so both paths cost the same; it never matches.
func (h *Hasher) Verify(ctx context.Context, password, encoded string) (ok, rehash bool, err error) {
	known := encoded != ""
	if !known {
		encoded = h.dummy
	}
	p, salt, want, err := decode(encoded)
	if err != nil {
		return false, false, err
	}
	got, err := h.derive(ctx, password, salt, p)
	if err != nil {
		return false, false, err
	}
	ok = subtle.ConstantTimeCompare(got, want) == 1 && known
	return ok, ok && p != Current, nil
}

func (h *Hasher) derive(ctx context.Context, password string, salt []byte, p Params) ([]byte, error) {
	select {
	case h.sem <- struct{}{}:
		defer func() { <-h.sem }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	return argon2.IDKey([]byte(password), salt, p.Time, p.Memory, p.Threads, keyLen), nil
}

func decode(encoded string) (Params, []byte, []byte, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return Params{}, nil, nil, errors.New("not an argon2id hash")
	}
	var v int
	var p Params
	if _, err := fmt.Sscanf(parts[2], "v=%d", &v); err != nil || v != argon2.Version {
		return Params{}, nil, nil, errors.New("unsupported argon2 version")
	}
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &p.Memory, &p.Time, &p.Threads); err != nil {
		return Params{}, nil, nil, fmt.Errorf("argon2 params: %w", err)
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return Params{}, nil, nil, fmt.Errorf("argon2 salt: %w", err)
	}
	key, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return Params{}, nil, nil, fmt.Errorf("argon2 key: %w", err)
	}
	return p, salt, key, nil
}
```

Size the semaphore from the container's memory budget: 4 concurrent hashes
at 64 MiB is 256 MiB. A sign-in that waits on the semaphore past its
context deadline fails like any other overload. Tests lower `Current` to
a few MiB so they run in milliseconds. Password rules: at least 12
characters, no composition rules, no maximum below 64; check against a
breached-password list only if the project already has one.

## Sign-in flow and lockout

1. IP limit (the `go-http-server` limiter, a stricter row on the sign-in
   route): over it, 429.
2. Normalise the identifier (trim, lower-case the email) and hash it with
   SHA-256 for the attempts table, so unknown emails are not stored in
   clear.
3. Locked (`locked_until > now`): 429 with `Retry-After`, without hashing.
4. Load the user by identifier; `Verify` with the stored hash, or `""`
   when there is none.
5. Failure: record it (below), audit `auth.sign_in_failed`, answer the one
   generic message.
6. Success: delete the attempts row, rehash if asked, then TOTP when
   enrolled, else `Start` the session (sessions.md).

```sql
CREATE TABLE sign_in_attempts (
    key_hash     bytea       PRIMARY KEY,   -- SHA-256 of the normalised identifier
    failures     int         NOT NULL,
    window_start timestamptz NOT NULL,
    locked_until timestamptz
);

-- one failure; one statement holds the invariant ($2 window, $3 limit)
INSERT INTO sign_in_attempts AS a (key_hash, failures, window_start)
VALUES ($1, 1, now())
ON CONFLICT (key_hash) DO UPDATE SET
    failures     = CASE WHEN a.window_start < now() - $2::interval THEN 1 ELSE a.failures + 1 END,
    window_start = CASE WHEN a.window_start < now() - $2::interval THEN now() ELSE a.window_start END,
    locked_until = CASE WHEN a.window_start >= now() - $2::interval AND a.failures + 1 >= $3
                        THEN now() + $2::interval ELSE a.locked_until END
RETURNING locked_until;
```

Defaults: window 15 minutes, limit 10. The sweep job deletes rows whose
window and lock have both passed.

## Password reset

1. Request: always answer "If an account exists for that address, we sent
   a link", in the same time (enqueue the email as a job; never send
   inline). Rate limited per IP and per identifier like sign-in.
2. Token: 32 bytes from `crypto/rand`, base64url; store SHA-256, the user,
   and `expires_at = now + 30 minutes`. A new request deletes older tokens
   of the user.
3. Link: `https://<origin>/reset#token=<token>`. The fragment never reaches
   the server, its logs or a `Referer`; the page reads `location.hash`,
   clears it with `history.replaceState`, and posts the token.
4. Complete: in one transaction, `DELETE FROM password_resets WHERE
   token_hash = $1 AND expires_at > now() RETURNING user_id`, set the new
   hash, delete every session of the user. No row: one generic "this link
   has expired" answer. Then audit `auth.reset_completed`.

## TOTP and recovery codes

```go
// totp is RFC 6238 with HMAC-SHA1, 6 digits, 30 s steps: what authenticator
// apps implement. HMAC-SHA1 is not the collision-sensitive use the
// cryptography reference forbids. Test it with RFC 6238 Appendix B.
func totp(secret []byte, step int64) string {
	var msg [8]byte
	binary.BigEndian.PutUint64(msg[:], uint64(step))
	mac := hmac.New(sha1.New, secret)
	mac.Write(msg[:])
	sum := mac.Sum(nil)
	off := sum[len(sum)-1] & 0x0f
	code := binary.BigEndian.Uint32(sum[off:off+4]) & 0x7fffffff
	return fmt.Sprintf("%06d", code%1_000_000)
}

// verifyTOTP accepts the current step or one either side, newer than the
// last accepted step. The caller stores the returned step with
// UPDATE ... WHERE totp_last_step < $2, so a concurrent replay loses.
func verifyTOTP(secret []byte, code string, now time.Time, last int64) (int64, bool) {
	cur := now.Unix() / 30
	for _, s := range []int64{cur - 1, cur, cur + 1} {
		if s > last && subtle.ConstantTimeCompare([]byte(totp(secret, s)), []byte(code)) == 1 {
			return s, true
		}
	}
	return last, false
}
```

Enrolment: generate a 20-byte secret, show it as a QR of the
`otpauth://totp/<issuer>:<account>?secret=<base32>&issuer=<issuer>` URI
and as text, store it encrypted (AES-GCM with a key from typed config,
`cryptography.md`) but not enabled; enable only when the user submits a
valid code. Then rotate the session and show the recovery codes once.

```go
// recoveryCode is 80 bits: too many to brute-force against a SHA-256 hash.
func recoveryCode() string {
	b := make([]byte, 10)
	_, _ = rand.Read(b)
	s := base32.StdEncoding.EncodeToString(b) // 16 characters, no padding
	return s[0:4] + "-" + s[4:8] + "-" + s[8:12] + "-" + s[12:16]
}
```

Store SHA-256 of the code with dashes removed and upper-cased; use one with
`DELETE ... WHERE user_id = $1 AND code_hash = $2 RETURNING 1`. Using a
recovery code signs in and prompts the user to re-enrol or generate new
codes. Regenerating replaces all ten.

## API keys

```go
const keyPrefix = "app" // the product's prefix; the secret scanner has a rule for it

type NewKey struct {
	Display string // shown once, never stored
	ID      string // public lookup key
	Hash    []byte // SHA-256 of the secret, stored
}

func GenerateKey() NewKey {
	id := strings.ToLower(rand.Text()[:10])
	secret := make([]byte, 32)
	_, _ = rand.Read(secret)
	s := base64.RawURLEncoding.EncodeToString(secret)
	sum := sha256.Sum256([]byte(s))
	return NewKey{Display: keyPrefix + "_" + id + "_" + s, ID: id, Hash: sum[:]}
}

// ParseKey splits a presented key. The caller loads the row by id (not
// revoked, not expired) and compares hashes with subtle.ConstantTimeCompare.
func ParseKey(presented string) (id string, hash []byte, ok bool) {
	prefix, rest, ok1 := strings.Cut(presented, "_")
	id, secret, ok2 := strings.Cut(rest, "_")
	if !ok1 || !ok2 || prefix != keyPrefix || len(id) != 10 || secret == "" {
		return "", nil, false
	}
	sum := sha256.Sum256([]byte(secret))
	return id, sum[:], true
}
```

```sql
CREATE TABLE api_keys (
    id           text        PRIMARY KEY,
    user_id      bigint      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name         text        NOT NULL,
    secret_hash  bytea       NOT NULL,
    scopes       bigint      NOT NULL,   -- the Permission bitset
    created_at   timestamptz NOT NULL,
    last_used_at timestamptz,
    expires_at   timestamptz,
    revoked_at   timestamptz
);
```

The principal from a key has `Via: AuthAPIKey`, the owner's user and
tenant, and `Scopes`; `Has` intersects scopes with the owner's role, so a
key never does more than its owner can. Add a gitleaks rule for
`app_[a-z2-7]{10}_[A-Za-z0-9_-]{43}` in the project's config. Creating and
revoking keys are audited; the list page shows name, prefix and id,
scopes, created and last-used times, never the secret.
