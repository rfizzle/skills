---
name: golang-performance
description: "Go performance optimization patterns: if a given bottleneck, then apply a given fix. Covers allocation reduction, CPU efficiency, memory layout, GC tuning, pooling, caching, and hot-path optimization. Use when profiling or benchmarks have identified a bottleneck, or when reviewing code for performance wins. Not for measurement methodology (see golang-benchmark) or debugging workflow (see golang-troubleshooting)."
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

**Modes:**

- **Review mode (architecture)** — broad scan of a package or service for structural
  anti-patterns. Partition independent concerns only when the current client supports
  parallel work and the audit is broad enough to benefit.
- **Review mode (hot path)** — focused analysis of a single function or measured loop.
  Work sequentially.
- **Optimize mode** — a bottleneck has been identified by profiling. Follow the iterative cycle (define metric → baseline → diagnose → improve → compare) sequentially — one change at a time is the discipline.

# Go Performance Optimization

## Core Philosophy

1. **Profile before optimizing** — use representative benchmarks and profiles to find
   actual hot spots (→ See `golang-troubleshooting`).
2. **Follow the measured signal** — allocation reduction often helps GC-sensitive paths,
   but CPU, I/O, locks, queries, and algorithms may dominate elsewhere.
3. **Document optimizations** — add code comments explaining why a pattern is faster, with benchmark numbers when available. Future readers need context to avoid reverting an "unnecessary" optimization

## Rule Out External Bottlenecks First

Before optimizing Go code, verify the bottleneck is in your process — if 90% of latency is a slow DB query or API call, reducing allocations won't help.

**Diagnose:** 1- `fgprof` — captures on-CPU and off-CPU (I/O wait) time; if off-CPU dominates, the bottleneck is external 2- `go tool pprof` (goroutine profile) — many goroutines blocked in network or pgxpool frames indicate external wait 3- Distributed tracing (OpenTelemetry) — span breakdown shows which upstream is slow

**When external:** optimize that component instead — query tuning, caching, connection pools, circuit breakers).

## Iterative Optimization Methodology

Run any repository-required generation step before benchmarks or tests. Use optional
profiling and comparison tools only when they are installed or their installation is
approved.

### The cycle: Define Goals → Benchmark → Diagnose → Improve → Benchmark

1. **Define your metric** — latency, throughput, memory, or CPU? Without a target, optimizations are random
2. **Write an atomic benchmark** — isolate one function per benchmark to avoid result contamination (→ See `golang-benchmark` skill)
3. **Measure baseline** — `go test -bench=BenchmarkMyFunc -benchmem -count=6 ./... | tee ./bench/report-1.txt`
4. **Diagnose** — use the **Diagnose** lines in each deep-dive section to pick the right tool
5. **Improve** — apply ONE optimization at a time with an explanatory comment
6. **Compare** — `benchstat ./bench/report-1.txt ./bench/report-2.txt` to confirm statistical significance
7. **Commit** — paste the benchstat output in the commit body so reviewers and future readers see the exact improvement; follow the `perf(scope): summary` commit type
8. **Repeat** — preserve durable results in the change/issue; temporary `./bench/` reports
   may be removed after the evidence is recorded

Refer to official library documentation for known patterns before inventing custom
solutions. Record durable benchmark evidence in the change, issue, or review.

## Decision Tree: Where Is Time Spent?

| Bottleneck | Signal (from pprof) | Action |
| --- | --- | --- |
| Too many allocations | `alloc_objects` high in heap profile | [Memory optimization](references/memory.md) |
| CPU-bound hot loop | function dominates CPU profile | [CPU optimization](references/cpu.md) |
| GC pauses / OOM | high GC%, container limits | [Runtime tuning](references/runtime.md) |
| Network / I/O latency | goroutines blocked on I/O | [I/O & networking](references/io-networking.md) |
| Repeated expensive work | same computation/fetch multiple times | [Caching patterns](references/caching.md) |
| Wrong algorithm | O(n²) where O(n) exists | [Algorithmic complexity](references/caching.md#algorithmic-complexity) |
| Lock contention | mutex/block profile hot | → See `golang-concurrency` skill |
| Slow queries | DB time dominates traces | tune the query and the pool before the Go code |

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Optimizing without profiling | Profile with pprof first — intuition is wrong ~80% of the time |
| Default `http.Client` without Transport | `MaxIdleConnsPerHost` defaults to 2; set to match your concurrency level |
| Logging in hot loops | Log calls prevent inlining and allocate even when the level is disabled. Use `slog.LogAttrs` |
| `panic`/`recover` as control flow | panic allocates a stack trace and unwinds the stack; use error returns |
| `unsafe` without benchmark proof | Only justified when profiling shows >10% improvement in a verified hot path |
| No GC tuning in containers | Set `GOMEMLIMIT` to 80-90% of container memory to prevent OOM kills |
| `reflect.DeepEqual` in production | 50-200x slower than typed comparison; use `slices.Equal`, `maps.Equal`, `bytes.Equal` |

## Deep Dives

- [Memory Optimization](references/memory.md) — allocation patterns, backing array leaks, sync.Pool, struct alignment
- [CPU Optimization](references/cpu.md) — inlining, cache locality, false sharing, ILP, reflection avoidance
- [I/O & Networking](references/io-networking.md) — HTTP transport config, streaming, JSON performance, cgo, batch operations
- [Runtime Tuning](references/runtime.md) — GOGC, GOMEMLIMIT, GC diagnostics, GOMAXPROCS, PGO
- [Caching Patterns](references/caching.md) — algorithmic complexity, compiled patterns, singleflight, work avoidance
- [Production Observability](references/observability.md) — Prometheus metrics, PromQL queries, continuous profiling, alerting rules

When adding Prometheus performance alerts, adapt
[the example alert rules](assets/prometheus-alerts.yml) to the service's metric names,
labels, and error-budget policy; do not copy thresholds without validating them against a
measured baseline.

## CI Regression Detection

Automate benchmark comparison in CI to catch regressions before they reach production. → See `golang-benchmark` skill for `benchdiff` and `cob` setup.

## Cross-References

- → See `golang-benchmark` skill for benchmarking methodology, `benchstat`, and `b.Loop()` (Go 1.24+)
- → See `golang-troubleshooting` skill for pprof workflow, escape analysis diagnostics, and performance debugging
- → See the memory and CPU references in this skill for preallocation and `strings.Builder`
- → See `golang-concurrency` skill for worker pools, `sync.Pool` API, goroutine lifecycle, and lock contention
- → See `golang-observability` skill for continuous profiling in production
