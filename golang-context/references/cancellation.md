# Cancellation, Timeouts & Deadlines

## Cancellation

```go
func processItems(ctx context.Context, items []Item) error {
    ctx, cancel := context.WithCancel(ctx)
    defer cancel() // always defer cancel to free resources

    errCh := make(chan error, len(items))
    for _, item := range items {
        go func(item Item) {
            errCh <- processOne(ctx, item)
        }(item)
    }

    for range items {
        if err := <-errCh; err != nil {
            cancel() // cancel remaining goroutines on first error
            return fmt.Errorf("processing items: %w", err)
        }
    }
    return nil
}
```

### Why `defer cancel()` matters

Every `WithCancel`, `WithTimeout`, and `WithDeadline` allocates internal resources (timers, goroutines). cancel() MUST be called (via defer) to prevent resource leaks. Even if the context will expire on its own, always defer cancel.

```go
// ✗ Bad — cancel is never called, resources leak
func fetch(ctx context.Context) error {
    ctx, _ = context.WithTimeout(ctx, 5*time.Second)
    return doWork(ctx)
}

// ✓ Good — defer cancel immediately
func fetch(ctx context.Context) error {
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()
    return doWork(ctx)
}
```

## Timeouts and Deadlines

### Nested timeouts take the shorter deadline

If a parent context has a 5s timeout and you create a child with 10s, the child still expires at 5s. The shorter deadline always wins.

```go
// Parent has 2s timeout — child's 10s is effectively ignored
parentCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
defer cancel()

childCtx, childCancel := context.WithTimeout(parentCtx, 10*time.Second)
defer childCancel()
// childCtx expires after 2s, not 10s
```

## Listening for Cancellation

### The `select` pattern

Use `ctx.Done()` in a `select` statement to react to cancellation alongside other work:

```go
func poll(ctx context.Context, interval time.Duration) error {
    ticker := time.NewTicker(interval)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return ctx.Err() // context.Canceled or context.DeadlineExceeded
        case <-ticker.C:
            if err := doWork(ctx); err != nil {
                return fmt.Errorf("polling: %w", err)
            }
        }
    }
}
```

### Checking cancellation in loops

For CPU-bound work, periodically check `ctx.Err()`:

```go
func processLargeDataset(ctx context.Context, items []Item) error {
    for i, item := range items {
        if ctx.Err() != nil {
            return fmt.Errorf("processing interrupted after %d/%d items: %w", i, len(items), ctx.Err())
        }
        process(item)
    }
    return nil
}
```

## `context.WithoutCancel` (Go 1.21+)

Creates a child context that is not cancelled when the parent is. It also removes the
parent deadline. Use it only when an application-owned background runner takes lifecycle
ownership and a new timeout/cancel bound is installed.

```go
func (h *Handler) CreateOrder(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    order, err := h.orderService.Create(ctx, req)
    if err != nil {
        // handle error
        return
    }

    // The app-owned runner is drained during shutdown; this task also has its own bound.
    auditCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 2*time.Second)
    if err := h.background.Submit(func() {
        defer cancel()
        _ = h.auditService.LogOrderCreated(auditCtx, order)
    }); err != nil {
        cancel()
        // report or persist the enqueue failure according to the audit contract
    }

    w.WriteHeader(http.StatusCreated)
}
```

`WithoutCancel` preserves values but transfers cancellation responsibility. Never pair it
with an untracked goroutine or an unbounded operation.
