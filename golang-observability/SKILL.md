---
name: golang-observability
description: "Instrument and review Go services with structured slog logging, Prometheus metrics, OpenTelemetry traces, secured profiling, dashboards, alerts, and privacy-safe product telemetry. Use when adding production signals, correlating logs and traces, defining metric labels or buckets, adding spans, exposing pprof, creating alerts, or auditing whether a feature can be operated safely. Not for benchmarking or reading profiles (use golang-performance) or non-Go services."
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Go Observability

Add the smallest set of signals that answers operational questions. Do not require every
signal for every function, and do not introduce a vendor SDK when the repository's
Prometheus, OpenTelemetry, or `slog` facilities already cover the need.

## Workflow

1. Identify the operator question: failure, throughput, latency, saturation, dependency
   behavior, or business outcome.
2. Inspect existing metric names, log attributes, tracer setup, and middleware.
3. Add one owned signal with bounded dimensions and a documented consumer.
4. Propagate `context.Context` so cancellation and trace context reach downstream calls.
5. Verify privacy, cardinality, sampling, storage cost, and endpoint security.
6. Add or update the alert/dashboard only when an actionable threshold or SLO exists.

## Logging

- Use the repository's structured `slog.Logger` and context-aware methods.
- Use stable messages and consistent attribute names.
- Return errors through lower layers and log once at the request, job, or process boundary.
- Do not log credentials, authorization headers, raw user content, or unnecessary private
  data.

## Metrics

- Counter: cumulative events.
- Gauge: current state or saturation.
- Histogram: aggregatable latency or size distributions.
- Keep labels bounded. Never label with user/session IDs, raw paths, hostnames controlled
  by users, error strings, or arbitrary query values.
- Use route templates rather than raw URLs.
- Choose buckets from observed ranges and the decisions the metric must support.

## Tracing

- Instrument meaningful boundaries: inbound requests, queue work, external calls, and
  expensive orchestration—not every tiny helper.
- End every span, record unexpected errors, and set a bounded status description.
- Put non-sensitive, bounded attributes on spans and retain error identity with `%w`.
- Follow the OpenTelemetry semantic conventions already used by the repository.

## Profiling

Expose pprof only behind explicit configuration and network/authentication controls
([profiling](references/profiling.md) has the handler setup). Reading profiles is
`golang-performance`. Use temporary profiling for investigations and continuous profiling only after its overhead,
retention, and access controls are accepted.

## Product telemetry and RUM

Product analytics and RUM are optional product decisions, not a default backend
definition-of-done item. Add them only with an approved purpose, consent/legal basis,
retention policy, deletion path, and data minimization. A product that handles sensitive user
data should be especially conservative about session replay and identity data. Use the
internal immutable `user_id` as the analytics identity key, never an email; pass the frontend
session ID in a header and set it as a span attribute to correlate a RUM session with its
backend trace.

## Gate

- Each signal has an owner and a concrete operational question.
- Metric labels and trace attributes are bounded and privacy-safe.
- Logs use stable structure and errors are handled once.
- Profiling and telemetry endpoints are access-controlled.
- Alerts are actionable and avoid flapping.
- Instrumentation cost is proportionate to the feature risk.

Read the focused references only when needed:

- [logging](references/logging.md)
- [metrics](references/metrics.md)
- [tracing](references/tracing.md)
- [profiling](references/profiling.md)
- [alerting](references/alerting.md)
- [dashboards](references/dashboards.md)

Use `golang-performance` for temporary performance measurement and
`golang-troubleshooting` for incident diagnosis.
