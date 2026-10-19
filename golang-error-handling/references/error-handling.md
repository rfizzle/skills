# Error Handling and Logging

## Contents

- [Handle once](#handle-once)
- [Boundary translation](#boundary-translation)
- [Structured logging](#structured-logging)
- [Panic recovery](#panic-recovery)
- [Cleanup](#cleanup)

## Handle once

Return an error with context until a layer owns the outcome. Logging and returning the
same error creates duplicates and unclear ownership.

Exceptions require an explicit reason, such as recording a compensating action while
returning the original failure.

## Boundary translation

Translate internal errors at HTTP, worker, and CLI boundaries:

- not found → domain/HTTP not-found outcome
- validation → client-safe validation detail
- conflict/constraint → conflict outcome
- cancellation → stop work without noisy error logging
- unexpected infrastructure failure → generic client response plus structured server log

Preserve the internal chain until translation so `errors.Is` and `errors.As` work.

## Structured logging

Use `slog` context methods and stable messages:

```go
logger.ErrorContext(
    ctx,
    "request failed",
    "error", err,
    "operation", operation,
    "request_id", requestID,
)
```

Do not log credentials, authorization headers, raw session recordings, or unnecessary
private user data.

## Panic recovery

Recover at a boundary that can keep the process valid, such as HTTP recovery middleware
or the top of an independently supervised goroutine. Log the panic and stack according to
the repository's recovery policy. Do not recover inside ordinary business functions.

## Cleanup

Use `errors.Join` when both the primary operation and cleanup fail:

```go
func writeFile(path string) (err error) {
    f, err := os.Create(path)
    if err != nil {
        return fmt.Errorf("creating output: %w", err)
    }
    defer func() { err = errors.Join(err, f.Close()) }()

    if _, err := f.WriteString("data"); err != nil {
        return fmt.Errorf("writing output: %w", err)
    }
    return nil
}
```
