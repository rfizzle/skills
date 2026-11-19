---
name: golang-performance
description: "Measure and optimize Go performance: write, run and compare benchmarks (b.Loop, benchstat), profile with pprof and execution traces, set up CI benchmark regression detection, investigate production runtime metrics, then apply the fix for the bottleneck found (allocations, CPU, GC tuning, pooling, caching, I/O). Use when benchmarking, profiling, or optimizing a hot path, or reviewing code for performance wins. Not for debugging a crash or wrong behaviour (golang-troubleshooting), exposing pprof in production, continuous profiling or alerts (golang-observability), or test timing and flakiness (deterministic-tests)."
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

**Modes:**

- **Review (architecture)**: broad scan of a package or service for structural anti-patterns;
  partition independent concerns only when the client supports parallel work.
- **Review (hot path)**: one function or measured loop, sequentially.
- **Optimize**: a bottleneck is identified. Define the metric, baseline, diagnose, change ONE
  thing, compare.

# Go Performance: Measure, Then Fix

Profile before optimizing; follow the measured signal (CPU, I/O, locks, queries and
algorithms can dominate instead of allocations); comment why an optimization is faster, with
numbers, so nobody reverts it.

## Rule Out External Bottlenecks First

If 90% of latency is a slow query or API call, reducing allocations will not help. Check with
`fgprof` (on-CPU plus off-CPU time; off-CPU dominating means external), the goroutine profile
(many goroutines blocked in network or pool frames), and trace span breakdown. When external,
fix that component: query tuning, caching, pools, circuit breakers.

## Measure

Run the repository's generation step first; use `benchstat` only if available or approved.

- Use `b.Loop()` (Go 1.24+): it stops the compiler eliminating the call and excludes setup
  before the loop from timing. Migrate `for range b.N` loops (they need `b.ResetTimer()` and a
  sink variable). `b.ReportAllocs()` or `-benchmem`; `b.ReportMetric` for custom units.
- One function per benchmark; sub-benchmarks with `b.Run` for sizes.
- Baseline and compare: `go test -bench=BenchmarkX -benchmem -count=10 ./pkg | tee old.txt`,
  change, rerun to `new.txt`, then `benchstat old.txt new.txt`. Only claim a result benchstat
  marks significant (never one shown as `~`).
- Profiles straight from a benchmark, no server: `-cpuprofile=cpu.prof`,
  `-memprofile=mem.prof` (`go tool pprof -alloc_objects mem.prof` for GC churn,
  `-inuse_space` for leaks), `-trace=trace.out` (`go tool trace`).
- Output: `BenchmarkEncode/size=64-8  5000000  230.5 ns/op  128 B/op  2 allocs/op`; `-8` is
  GOMAXPROCS.
- Commit a performance change as `perf(scope): summary` with the benchstat rows of the
  affected benchmarks only, plus the `goos/goarch/cpu` line, in the body. Keep durable
  evidence in the change or issue, not a `./bench/` directory.

```
perf(parser): reduce Parse allocations 50% with sync.Pool

goos: linux / goarch: amd64 / cpu: AMD Ryzen 9 5950X
          │   old    │            new             │
          │  B/op    │  B/op     vs base          │
Parse-32   1.024Ki ± 0%  0.512Ki ± 0%  -50.00% (p=0.000 n=10)
```

Load when needed:

- [pprof](references/pprof.md): profile types, enabling mutex/block profiles, CLI commands, comparing profiles, reading output.
- [trace](references/trace.md): execution tracer, when pprof's "where" is not enough.
- [benchstat](references/benchstat.md): output, filtering, comparisons, regression detection.
- [compiler analysis](references/compiler-analysis.md): escape analysis, inlining, SSA, assembly; when allocations are unexpected.
- [tools](references/tools.md): fieldalignment, GODEBUG, fgprof, race detector, expvar.
- [CI regression](references/ci-regression.md): benchdiff, cob, gobenchdata, noisy-neighbour and runner tuning.
- [investigation session](references/investigation-session.md): production metrics workflow, PromQL queries, cost warnings.
- [Prometheus Go metrics](references/prometheus-go-metrics.md): every Go runtime metric `client_golang` exposes.

## CI Regression Detection

Compare benchmarks in CI so regressions are caught before production; tool choice and runner
tuning are in the CI regression reference.

## Decision Tree: Where Is Time Spent?

| Bottleneck | Signal (from pprof) | Action |
| --- | --- | --- |
| Too many allocations | `alloc_objects` high in heap profile | [Memory optimization](references/memory.md) |
| CPU-bound hot loop | function dominates CPU profile | [CPU optimization](references/cpu.md) |
| GC pauses / OOM | high GC%, container limits | [Runtime tuning](references/runtime.md) |
| Network / I/O latency | goroutines blocked on I/O | [I/O & networking](references/io-networking.md) |
| Repeated expensive work | same computation/fetch multiple times | [Caching patterns](references/caching.md) |
| Wrong algorithm | O(n²) where O(n) exists | [Algorithmic complexity](references/caching.md#algorithmic-complexity) |
| Lock contention | mutex/block profile hot | Shrink the critical section, shard locks, `atomic` for counters, `RWMutex` when reads dominate; → See `golang-concurrency` skill |
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

## Not for

- Why something is broken, crashes, deadlocks: `golang-troubleshooting`.
- Exposing pprof, runtime metrics, alerts, continuous profiling in production: `golang-observability`.
- Worker pools, `sync.Pool` API, lock contention: `golang-concurrency`.
