# Secrets Management Security Rules

Hardcoded secrets, credentials, and sensitive data in source code is a major security vulnerability.

**Rules:**

1. Secrets come in through the typed configuration `repo-tooling` defines:
   environment variables with one `APP_` prefix, parsed once at startup into
   a typed struct, each secret a distinct type whose `String`, `GoString`
   and slog `LogValue` print `***`. No `os.Getenv` elsewhere in the code.
2. NEVER commit secrets to VCS.
3. `.gitignore` MUST exclude secret files (`.env`, `*.key`, `*.pem`).

---

## Hardcoded Secrets and Credentials — Critical

**Bad:**

```go
const (
    AWS_ACCESS_KEY    = "AKIAIOSFODNN7EXAMPLE"  // DON'T
    AWS_SECRET_KEY    = "wJalrXUtnFEMI/K7MDENG"  // DON'T
    DATABASE_PASSWORD = "SuperSecret123!"         // DON'T
    JWT_SECRET        = "my-super-secret-jwt-key" // DON'T
)

var config = Config{
    APIKey:  "abc123-xyz789-secret-key", // DON'T
    Secret:  "my-super-secret-value",    // DON'T
    DatabaseURL: "user:passw0rd!@localhost:5432/db", // DON'T
}
```

**Good:** a `Secret` field in the one config struct, filled from
`APP_DB_PASSWORD` by the startup parser, and revealed only where it is used:

```go
// Secret holds a credential from config. Every printing path shows ***, and
// encoding/json sees no exported field.
type Secret struct{ v string }

func NewSecret(v string) Secret     { return Secret{v: v} }
func (s Secret) Reveal() string     { return s.v }
func (Secret) String() string       { return "***" }
func (Secret) GoString() string     { return "***" }
func (Secret) LogValue() slog.Value { return slog.StringValue("***") }
```

Keep `Secret` fields exported in the config struct: `fmt` cannot call
methods on an unexported field, so `%+v` of the struct prints its value.

---

## Hardcoded Database Passwords — Critical

**Bad:**

```go
// MySQL
dsn := "user:Password123!@tcp(localhost:3306)/dbname" // DON'T

// PostgreSQL
dsn := "user=postgres password=P@ssw0rd! dbname=mydb host=localhost" // DON'T
```

**Good:** the DSN, or its password, is a `Secret` in the typed config;
`internal/app` builds the pool config from it (`golang-database`), and a
startup error names the key, never the value.

---

## Secrets Storage Best Practices

### Secret managers

A vault, a cloud secrets manager, Podman secrets or systemd credentials
deliver the secret to the process as an environment variable or a file the
config parser reads at startup (`APP_DB_PASSWORD_FILE`); the code still sees
only the typed config. Calling a manager's API at runtime (to rotate
without a restart) is a decision record, and the fetched value is still a
`Secret`. Secrets are per environment: staging never holds a production
secret.

### .gitignore Patterns

```
# Secrets
.env
.env.local
.env.*.local
*.key
*.pem
*.p12
*.pfx
secrets/
credentials/
```

---

## Secret Detection Patterns

| Pattern         | Example                         |
| --------------- | ------------------------------- |
| API Keys        | `Key = "sk_live_..."`           |
| Passwords       | `password = "..."`              |
| Tokens          | `token = "..."`                 |
| Private Keys    | `BEGIN PRIVATE KEY`             |
| AWS Credentials | `AWS_ACCESS_KEY_ID = "AKIA..."` |
| JWT Secrets     | `jwtSecret = "..."`             |

---

## CWE References

- **CWE-798**: Use of Hard-coded Credentials
- **CWE-312**: Cleartext Storage of Sensitive Information
- **CWE-532**: Insertion of Sensitive Information into Log File
- **CWE-359**: Exposure of Private Personal Information to an Unauthorized Actor
