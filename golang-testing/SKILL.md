---
name: golang-testing
description: "Design, write, review, and debug Go tests, including table-driven unit tests, HTTP tests, integration tests, race detection, fuzzing, deterministic concurrency tests with testing/synctest, benchmarks, fixtures, and coverage. Use for any Go test change or test-strategy decision. Not for database fakes (see the database skill) or benchmark measurement methodology (see golang-benchmark)."
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Go Testing

Treat tests as executable contracts. Prefer the standard library and dependencies already
present in the repository; do not add a mocking, assertion, clock, snapshot, or leak
library solely because an example uses one.

## Required preflight

Run the repository's generation step before every test command.

Prefer the repository's test target, integration-test target, and lint target over ad hoc
commands.

Use a focused `go test` command only after the preflight and retain `-race` when relevant.

## Test structure

- Name tests for observable behavior: `TestType_Method` or `TestFunction`.
- Use descriptive lowercase subtest names.
- Use table-driven tests when cases share setup and assertion shape; do not force a table
  around a single behavior with unique setup.
- Keep tests independent of execution order and wall-clock timing.
- Use `t.Helper`, `t.Cleanup`, `t.TempDir`, and `t.Setenv` for lifecycle and isolation.
- Use `t.Parallel()` only when the test and all fixtures are concurrency-safe and do not
  share process-global state, ports, database rows, or environment variables.
- Test public behavior and documented package invariants rather than private call order.

```go
func TestParseStatus(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        want    Status
        wantErr bool
    }{
        {name: "valid active status", input: "active", want: StatusActive},
        {name: "unknown status", input: "wat", wantErr: true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := ParseStatus(tt.input)
            if (err != nil) != tt.wantErr {
                t.Fatalf("ParseStatus() error = %v, wantErr %v", err, tt.wantErr)
            }
            if got != tt.want {
                t.Errorf("ParseStatus() = %v, want %v", got, tt.want)
            }
        })
    }
}
```

## Repository and integration tests

A database fake belongs in the database skill.

- Use `//go:build integration` for tests requiring PostgreSQL, object storage, or other
  containerized services.
- Use unique IDs and cleanup so integration tests can run repeatedly and concurrently.
- Test real PostgreSQL behavior for constraints, migrations, locking, and query semantics.

Read [integration testing](references/integration-testing.md) and the database skill's
testing reference when those tests are in scope.

## HTTP tests

Use `httptest.NewRequest`, `httptest.NewRecorder`, or `httptest.NewServer`. Assert status,
headers, body contract, authentication/authorization outcomes, and error mapping. Avoid
calling handler internals directly when the HTTP boundary is the behavior under test.

Read [HTTP testing](references/http-testing.md) for detailed patterns.

## Deterministic concurrency tests

In Go 1.25+, `testing/synctest` is stable. Use `synctest.Test`, not the removed
experimental `synctest.Run` API:

```go
func TestTimeout(t *testing.T) {
    synctest.Test(t, func(t *testing.T) {
        ctx, cancel := context.WithTimeout(t.Context(), time.Second)
        defer cancel()

        time.Sleep(time.Second)
        synctest.Wait()
        if !errors.Is(ctx.Err(), context.DeadlineExceeded) {
            t.Fatalf("ctx.Err() = %v, want deadline exceeded", ctx.Err())
        }
    })
}
```

Keep the bubble self-contained: avoid real network I/O, external processes, and goroutines
created outside it. Use the race detector for shared-memory behavior. Add a leak detector
only if the project deliberately adopts and maintains that dependency.

## Fuzzing and benchmarks

- Seed fuzz tests with valid, empty, boundary, and previously failing inputs.
- Assert invariants rather than duplicating implementation logic.
- Use `b.Loop()` on Go 1.24+ and keep setup before the loop.
- Use the `golang-benchmark` skill for statistically meaningful comparisons.

## Review checklist

- New behavior, errors, and documented invariants are covered.
- Assertions fail with enough context to diagnose the case.
- Tests do not depend on timeouts, order, or shared mutable globals.
- Mocks model consumer interfaces, not implementation internals.
- Integration boundaries use the integration build tag and real services intentionally.
- Race-sensitive code is exercised under `-race`.
- No new test dependency was added without clear value and approval.

Read [helpers](references/helpers.md) and [mocking](references/mocking.md) only when the
task needs those deeper patterns.
