# Test Helpers

Prefer the standard library and keep helpers smaller than the behavior they support.
Every helper that can fail should accept `*testing.T`, call `t.Helper()`, and register
cleanup with `t.Cleanup`.

## Timeouts

Use the test binary's built-in timeout as the final deadlock guard:

```sh
go test -timeout=2m ./...
```

For an operation that accepts context, use a short test-scoped deadline and assert the
returned error. Do not start a watchdog goroutine that panics from outside the test
goroutine.

```go
func testContext(t *testing.T) context.Context {
    t.Helper()

    ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
    t.Cleanup(cancel)
    return ctx
}
```

When testing time-dependent behavior, prefer an injected `Now` function, a minimal local
clock interface, or `testing/synctest` where its execution model fits. Avoid real sleeps
used only to advance application time.

## Cleanup

Return values from setup helpers and register cleanup immediately:

```go
func openFixture(t *testing.T) *Fixture {
    t.Helper()

    fixture := newFixture(t)
    t.Cleanup(func() {
        if err := fixture.Close(); err != nil {
            t.Errorf("close fixture: %v", err)
        }
    })
    return fixture
}
```
