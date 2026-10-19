# Distributed Tracing with OpenTelemetry

Use tracing at meaningful latency and causality boundaries. Propagate the caller's
`context.Context`; do not add a span to every function or duplicate spans already emitted
by HTTP, pgx, or messaging instrumentation.

Verify current OpenTelemetry APIs against official documentation and the versions pinned
in `go.mod` before implementation.

## Provider lifecycle

Construct the provider at the application composition root and return an error-producing
shutdown function so teardown failures are not discarded.

```go
func initTracer(ctx context.Context) (func(context.Context) error, error) {
    exporter, err := otlptracegrpc.New(ctx)
    if err != nil {
        return nil, fmt.Errorf("creating OTLP exporter: %w", err)
    }

    provider := sdktrace.NewTracerProvider(sdktrace.WithBatcher(exporter))
    otel.SetTracerProvider(provider)
    return provider.Shutdown, nil
}
```

Register shutdown with the application's stop stack and call it with a bounded shutdown
context.

## Span boundaries

Good custom span candidates include:

- an incoming request or message when framework instrumentation does not already own it;
- an outgoing network/storage call without existing instrumentation;
- a queue publish/consume handoff;
- a long-running analysis phase whose latency is operationally meaningful;
- a cross-module workflow step where the trace needs an explicit causal boundary.

Avoid span-per-function, span-per-repository-method, and wrappers around already
instrumented queries. Extra spans increase cost and obscure the useful path.

```go
func (w *Worker) Analyze(ctx context.Context, job Job) error {
    ctx, span := w.tracer.Start(ctx, "analysis.run")
    defer span.End()

    if err := w.run(ctx, job); err != nil {
        span.RecordError(err)
        span.SetStatus(codes.Error, "analysis failed")
        return fmt.Errorf("running analysis: %w", err)
    }
    return nil
}
```

## Attributes and errors

Use stable, low-cardinality, non-sensitive attributes: operation, protocol, stable error
category, or bounded job type. Do not record secrets, request/response bodies, raw SQL,
free-form errors as attributes, or user-controlled identifiers unless policy explicitly
permits them.

Record an error and set status at the span boundary that owns the failed operation. Keep
the standard error chain with `fmt.Errorf("context: %w", err)`. Do not record/log the same
error at every internal layer.

## Propagation

- Pass `ctx` through module and platform ports.
- Use `otelhttp.NewTransport` or equivalent approved instrumentation for outgoing HTTP.
- Pass `ctx` to pgx `Query`, `QueryRow`, and `Exec`; context propagation alone does not
  create query spans unless pgx instrumentation is configured.
- Inject/extract trace context at queue boundaries using the configured propagator.

See `golang-context` for cancellation and `golang-error-handling` for error ownership.
