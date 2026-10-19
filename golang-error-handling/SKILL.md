---
name: golang-error-handling
description: "Create, wrap, inspect, join, translate, and log Go errors using the standard library and structured slog. Use when defining sentinel or typed errors, preserving chains with %w, applying errors.Is/As, mapping database or HTTP errors, handling cleanup failures, recovering panics at boundaries, or reviewing swallowed and duplicate error handling. Not for introducing an error framework or for context cancellation design (use golang-context)."
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Go Error Handling

Use the standard `error`, `errors`, and `fmt` packages plus the repository's existing
sentinels and `slog` setup. Do not add an error framework merely to attach a stack or
attributes.

## Core rules

1. Check every returned error unless the API explicitly documents that it is safe to
   ignore and the repository's lint configuration permits it.
2. Add stable operation context with `fmt.Errorf("operation: %w", err)`.
3. Use lowercase error text without trailing punctuation.
4. Inspect chains with `errors.Is` and `errors.As`; do not compare wrapped errors with
   `==` or use a direct type assertion.
5. Use sentinels for stable conditions and typed errors when callers need structured data.
6. Use `errors.Join` for independent failures that must all be preserved.
7. Handle an error once: lower layers usually return context; the boundary that owns the
   request/job logs or translates it.
8. Do not expose internal error details to API clients.
9. Reserve panic for programmer invariants and `Must*` setup APIs. Recover only at a
   process, request, or goroutine boundary that can restore a valid state.

## Context and cardinality

Keep the operation phrase stable, but include values in errors when callers or humans need
them to understand the failure. At the final log boundary, put identifiers, tenant/user
context, paths, and counts in structured `slog` attributes rather than duplicating them in
the message.

```go
session, err := repo.GetByID(ctx, id)
if err != nil {
    return fmt.Errorf("loading session: %w", err)
}
```

At the boundary:

```go
if err := worker.Run(ctx); err != nil {
    logger.ErrorContext(ctx, "analysis worker failed", "error", err, "job_id", jobID)
}
```

## Cleanup errors

Decide whether a cleanup error can change the outcome:

- For read-only resources, a deferred close may be best-effort if the API and lint policy
  allow it.
- For writers, transactions, flushers, and response bodies whose close can surface an
  integrity failure, preserve the error, often with a named return and `errors.Join`.
- Never overwrite the primary failure with a cleanup failure.

## Review checklist

- No swallowed errors or log-and-return duplication.
- `%w` is used where callers need the chain; `%v` is used only to intentionally stop it.
- Sentinel/typed error identity survives wrapping.
- Context cancellation and deadline errors remain recognizable.
- Boundary translation does not leak secrets, SQL, paths, or stack traces.
- Cleanup and rollback errors receive an explicit policy.

Read [error creation](references/error-creation.md), [wrapping and inspection](references/error-wrapping.md),
and [handling and logging](references/error-handling.md) only when the task needs those
details.
