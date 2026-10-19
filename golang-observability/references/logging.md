# Structured Logging with `slog`

## Contents

- [Composition](#composition)
- [Levels and messages](#levels-and-messages)
- [Context and request attributes](#context-and-request-attributes)
- [Error ownership](#error-ownership)
- [Privacy and cardinality](#privacy-and-cardinality)
- [Migration](#migration)
- [Multiple destinations](#multiple-destinations)

Use the standard library's `log/slog` API. See `golang-error-handling` for wrapping,
inspection, and the single-handling rule.

## Composition

Construct the logger at the application composition root and inject it where a package
needs an explicit logger. Production commonly emits JSON to stdout so the runtime's log
collector owns transport and retry behavior.

```go
handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    Level: slog.LevelInfo,
})
logger := slog.New(handler)
slog.SetDefault(logger)
```

Text output can be useful for local development. Choose levels from configuration; do
not hard-code a verbose production level merely for hypothetical debugging.

## Levels and messages

- `Debug`: detailed diagnostic events, normally disabled in production.
- `Info`: expected lifecycle and business events worth retaining.
- `Warn`: the operation succeeded with degradation or needs attention.
- `Error`: the operation failed at the boundary that owns reporting it.

Keep messages stable and put variable data in attributes:

```go
logger.InfoContext(ctx, "order created",
    "order_id", order.ID,
    "item_count", len(order.Items),
)
```

Do not promise a universal volume or cost multiplier. Measure event rate, serialized
size, retention, and backend pricing for the deployed service. Sampling is a product and
operations decision; use an existing approved handler or implement a small tested policy
at the composition root.

## Context and request attributes

Use the `Context` variants when request cancellation or configured instrumentation needs
the context. Context alone does not add trace IDs; correlation requires an explicit
handler or middleware integration.

```go
logger.ErrorContext(ctx, "database query failed", "error", err)
```

Request middleware may derive a child logger with approved attributes such as request ID,
method, route template, and trace ID. Prefer a route template over a raw path so logs do
not contain user data or create unbounded dimensions.

## Error ownership

Lower layers normally wrap and return errors. Log once at the boundary that decides the
operation's outcome:

```go
if err := service.Run(ctx); err != nil {
    logger.ErrorContext(ctx, "request failed", "error", err)
    writeError(w, err)
    return
}
```

Avoid logging and returning the same error at every layer. Retries may log attempts when
those events are operationally useful, but the final failure still needs one clear owner.

## Privacy and cardinality

Never log secrets, credentials, session tokens, raw request bodies, or sensitive private
data. Treat emails, IP addresses, object keys, and free-form input as policy-controlled
data rather than safe defaults. Prefer stable identifiers only when project policy permits
them, and keep metric-style labels out of log-message text.

## Migration

For an established zap, logrus, or zerolog codebase:

1. Define the target `slog` construction and field policy at the composition root.
2. If necessary, add a narrow adapter or an already-approved bridge so output remains
   consistent during migration.
3. Replace call sites package by package and verify field names and levels.
4. Remove the adapter and old dependency after all callers migrate.

Do not add a bridge package solely because this reference names a migration pattern.
Inspect the existing dependency set and official documentation first.

## Multiple destinations

`slog.Handler` is pluggable, but fan-out affects failure handling, ordering, filtering,
and duplication. Prefer stdout as the durable application boundary when the platform can
route logs. If direct destinations are required, use an existing approved integration or
a small composed handler with tests covering:

- level filtering and error-only routes;
- `WithAttrs` and `WithGroup` propagation;
- one destination failing or blocking;
- duplicate delivery and shutdown behavior.

Adding Sentry, Datadog, or another remote sink is an architectural and dependency choice,
not an automatic consequence of adopting `slog`.
