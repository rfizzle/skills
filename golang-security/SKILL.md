---
name: golang-security
description: "Security best practices and vulnerability prevention for Go: injection (SQL, command, XSS), cryptography, filesystem safety, network security, cookies, secrets management, memory safety, logging, and security tooling. Use when writing, reviewing, or auditing Go code that touches crypto, I/O, secrets, user input, or authentication. Not for general code style, performance tuning, or non-Go security work."
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

**Modes:**

- **Review mode** — reviewing a PR for security issues. Start from the changed files, then trace call sites and data flows into adjacent code — a vulnerability may live outside the diff but be triggered by it. Sequential.
- **Audit mode** — for an explicitly requested full-codebase audit, partition independent
  vulnerability domains only when the current client supports parallel work. Aggregate
  evidence and rank findings by likelihood and impact.
- **Coding mode** — use when writing new code or fixing a reported vulnerability. Follow
  the skill's sequential guidance and keep any broader audit explicitly user-scoped.

# Go Security

## Overview

Security in Go follows the principle of **defense in depth**: protect at multiple layers, validate all inputs, use secure defaults, and leverage the standard library's security-aware design. Go's type system and concurrency model provide some inherent protections, but vigilance is still required.

## Security Thinking Model

Before writing or reviewing code, ask three questions:

1. **What are the trust boundaries?** — Where does untrusted data enter the system? (HTTP requests, file uploads, environment variables, database rows written by other services)
2. **What can an attacker control?** — Which inputs flow into sensitive operations? (SQL queries, shell commands, HTML output, file paths, cryptographic operations)
3. **What is the blast radius?** — If this defense fails, what's the worst outcome? (Data leak, RCE, privilege escalation, denial of service)

## Severity Levels

| Level | Meaning |
| --- | --- |
| Critical | Practical path to RCE, broad credential compromise, or catastrophic data exposure |
| High | Auth bypass, privilege escalation, or significant confidential-data exposure |
| Medium | Exploitable weakness with meaningful prerequisites or limited impact |
| Low | Defense-in-depth gap or minor exposure with constrained impact |

Document exploit prerequisites, affected trust boundaries, impact, and confidence. Use a
formal CVSS or organization-specific scheme only when the project requires it.

## Research Before Reporting

Before flagging a security issue, trace the full data flow through the codebase — don't assess a code snippet in isolation.

1. **Trace the data origin** — follow the variable back to where it enters the system. Is it user input, a hardcoded constant, or an internal-only value?
2. **Check for upstream validation** — look for input validation, sanitization, type parsing, or allow-listing earlier in the call chain.
3. **Examine the trust boundary** — if the data never crosses a trust boundary (e.g., internal service-to-service with mTLS), the risk profile is different.
4. **Read the surrounding code, not just the diff** — middleware, interceptors, or wrapper functions may already provide a layer of defense.

**Severity adjustment, not dismissal:** upstream protection can make a vulnerable sink
unreachable or reduce exploitability. Trace and document that evidence rather than
requiring duplicate validation at every layer. Still flag dangerous sinks when the
upstream guarantee is fragile or outside the same trust boundary.

**When downgrading or skipping a finding:** record the evidence in the review. Add an
inline rationale only when the user also authorized code changes and the guarantee would
otherwise be non-obvious to future reviewers.

## Threat Modeling (STRIDE)

Apply STRIDE to relevant trust boundaries and data flows: **S**poofing,
**T**ampering, **R**epudiation, **I**nformation Disclosure, **D**enial of Service, and
**E**levation of Privilege. Prioritize using the project's likelihood/impact rubric and
record assumptions rather than manufacturing precise numbers from incomplete evidence.

For the full methodology with Go examples, data-flow trust boundaries, and OWASP mapping,
see **[Threat Modeling Guide](./references/threat-modeling.md)**.

## Quick Reference

| Severity | Vulnerability | Defense | Standard Library Solution |
| --- | --- | --- | --- |
| Critical | SQL Injection | Parameterized queries separate data from code | Driver placeholders (`$N` for PostgreSQL) |
| Critical | Command Injection | Pass args separately, never via shell concatenation | `exec.Command` with separate args |
| High | XSS | Context-aware escaping renders user data safely | `html/template` (`text/template` does not HTML-escape) |
| High | Path Traversal | Scope file access to a root, prevent `../` escapes | `os.Root` (Go 1.24+), `filepath.Clean` |
| Medium | Timing Attacks | Constant-time comparison avoids byte-by-byte leaks | `crypto/subtle.ConstantTimeCompare` |
| High | Crypto Issues | Use vetted algorithms; never roll your own | `crypto/aes`, `crypto/rand` |
| Medium | HTTP Security | TLS + security headers prevent downgrade attacks | `net/http`, configure TLSConfig |
| Low | Missing Headers | HSTS, CSP, X-Frame-Options prevent browser attacks | Security headers middleware |
| Medium | Rate Limiting | Rate limits prevent brute-force and resource exhaustion | `golang.org/x/time/rate`, server timeouts |
| High | Race Conditions | Protect shared state to prevent data corruption | `sync.Mutex`, channels, avoid shared state |

## Detailed Categories

For complete examples, code snippets, and CWE mappings, see:

- **[Cryptography](./references/cryptography.md)** — Algorithms, key derivation, TLS configuration.
- **[Injection Vulnerabilities](./references/injection.md)** — SQL, command, template injection, XSS, SSRF.
- **[Filesystem Security](./references/filesystem.md)** — Path traversal, zip bombs, file permissions, symlinks.
- **[Network/Web Security](./references/network.md)** — SSRF, open redirects, HTTP headers, timing attacks, session fixation.
- **[Cookie Security](./references/cookies.md)** — Secure, HttpOnly, SameSite flags.
- **[Third-Party Data Leaks](./references/third-party.md)** — Analytics privacy risks, GDPR/CCPA compliance.
- **[Memory Safety](./references/memory-safety.md)** — Integer overflow, memory aliasing, `unsafe` usage.
- **[Secrets Management](./references/secrets.md)** — Hardcoded credentials, env vars, secret managers.
- **[Logging Security](./references/logging.md)** — PII in logs, log injection, sanitization.
- **[Threat Modeling Guide](./references/threat-modeling.md)** — STRIDE, severity approaches, trust boundaries, OWASP Top 10.
- **[Security Architecture](./references/architecture.md)** — Defense-in-depth, Zero Trust, auth patterns, rate limiting, anti-patterns.

## Code Review Checklist

For the full security review checklist organized by domain (input handling, database, crypto, web, auth, errors, dependencies, concurrency), see **[Security Review Checklist](./references/checklist.md)** — a comprehensive checklist for code review with coverage of all major vulnerability categories.

## Tooling & Verification

### Static Analysis & Linting

Use the repository's configured `gosec`, `govet`, `staticcheck`, `errcheck`, and related
linters through the repository's lint target.

For deeper security-specific analysis:

```bash
# Run the repository's generation step and lint target first.
# Run when the repository/toolchain already provides it or installation is approved.
govulncheck ./...
```

### Security Testing

```bash
# Race detector
go test -race ./...

# Fuzz testing
go test -fuzz=Fuzz
```

## Common Mistakes

| Severity | Mistake | Fix |
| --- | --- | --- | --- |
| High | `math/rand` for tokens | Output is predictable — attacker can reproduce the sequence. Use `crypto/rand` |
| Critical | SQL string concatenation | Attacker can modify query logic. Parameterized queries keep data and code separate |
| Critical | `exec.Command("bash -c")` | Shell interprets metacharacters (`;`, ` | `, `` ` ``). Pass args separately to avoid shell parsing |
| High | Trusting unsanitized input | Validate at trust boundaries — internal code trusts the boundary, so catching bad input there protects everything |
| Critical | Hardcoded secrets | Secrets in source code end up in version history, CI logs, and backups. Use env vars or secret managers |
| Medium | Comparing secrets with `==` | `==` short-circuits on first differing byte, leaking timing info. Use `crypto/subtle.ConstantTimeCompare` |
| Medium | Returning detailed errors | Stack traces and DB errors help attackers map your system. Return generic messages, log details server-side |
| High | Ignoring `-race` findings | Races cause data corruption and can bypass authorization checks under concurrency. Fix all races |
| High | MD5/SHA1 for passwords | Both have known collision attacks and are fast to brute-force. Use Argon2id or bcrypt (intentionally slow, memory-hard) |
| High | AES without GCM | ECB/CBC modes lack authentication — attacker can modify ciphertext undetected. GCM provides encrypt+authenticate |
| Context-dependent | Binding to 0.0.0.0 | Normal inside containers; evaluate published ports, network policy, TLS, and authentication rather than flagging the bind address alone |

## Security Anti-Patterns

| Severity | Anti-Pattern | Why It Fails | Fix |
| --- | --- | --- | --- |
| High | Security through obscurity | Hidden URLs are discoverable via fuzzing, logs, or source | Authentication + authorization on all endpoints |
| High | Trusting client headers | `X-Forwarded-For`, `X-Is-Admin` are trivially forged | Server-side identity verification |
| High | Client-side authorization | JavaScript checks are bypassed by any HTTP client | Server-side permission checks on every handler |
| High | Shared secrets across envs | Staging breach compromises production | Per-environment secrets via secret manager |
| Critical | Ignoring crypto errors | `_, _ = encrypt(data)` silently proceeds unencrypted | Always check errors — fail closed, never open |
| Critical | Rolling your own crypto | Custom encryption hasn't been analyzed by cryptographers | Use `crypto/aes` GCM, `golang.org/x/crypto/argon2` |

See **[Security Architecture](./references/architecture.md)** for detailed anti-patterns with Go code examples.

## Cross-References

See `golang-observability`. Use the repository's CI
target for the automated security and quality checks.

## Additional Resources

- [Go Security Best Practices](https://go.dev/doc/security/best-practices)
- [gosec Security Linter](https://github.com/securego/gosec)
- [govulncheck](https://pkg.go.dev/golang.org/x/vuln/cmd/govulncheck)
- [OWASP Go Secure Coding Practices](https://owasp.org/www-project-go-secure-coding-practices-guide/)
