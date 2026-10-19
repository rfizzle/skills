---
name: golang-concurrency
description: "Go concurrency patterns. Use when writing or reviewing concurrent Go code involving goroutines, channels, select, locks, sync primitives, errgroup, singleflight, worker pools, or fan-out/fan-in pipelines, or when detecting goroutine leaks, race conditions, channel ownership issues, or choosing between channels and mutexes. Not for context cancellation design (use golang-context) or single-threaded code."
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

**Modes:**

- **Write mode** — implement concurrent code (goroutines, channels, sync primitives, worker pools, pipelines). Follow the sequential instructions below.
- **Review mode** — reviewing a PR's concurrent code changes. Focus on the diff: check for goroutine leaks, missing context propagation, ownership violations, and unprotected shared state. Sequential.
- **Audit mode** — audit independent concurrency concerns in parallel only when the
  current client supports it and the user requested a broad codebase sweep.

# Go Concurrency Best Practices

Go's concurrency model is built on goroutines and channels. Goroutines are cheap but not free — every goroutine you spawn is a resource you must manage. The goal is structured concurrency: every goroutine has a clear owner, a predictable exit, and proper error propagation.

Run any repository-required generation step before concurrency tests. Prefer the
repository's test target when it configures race detection, coverage, or integration
settings.

## Core Principles

1. **Every goroutine must have a clear exit** — without a shutdown mechanism (context, done channel, WaitGroup), they leak and accumulate until the process crashes
2. **Share memory by communicating** — channels transfer ownership explicitly; mutexes protect shared state but make ownership implicit
3. **Send copies, not pointers** on channels — sending pointers creates invisible shared memory, defeating the purpose of channels
4. **Only the sender closes a channel** — closing from the receiver side panics if the sender writes after close
5. **Specify channel direction** (`chan<-`, `<-chan`) — the compiler prevents misuse at build time
6. **Default to unbuffered channels** — larger buffers mask backpressure; use them only with measured justification
7. **Always include `ctx.Done()` in select** — without it, goroutines leak after caller cancellation
8. **Choose timers deliberately** — on Go 1.23+, abandoned timers can be collected and
   `Reset` has stale-value guarantees. `time.After` is correct for simple waits; reuse a
   `time.Timer` in a hot loop when allocation measurements or reset semantics justify it.
9. **Exercise shutdown paths in tests** and wait for every goroutine. Use a leak-detection
   library only when the project has deliberately adopted one.

For detailed channel/select code examples, see [Channels and Select Patterns](references/channels-and-select.md).

## Channel vs Mutex vs Atomic

| Scenario | Use | Why |
| --- | --- | --- |
| Passing data between goroutines | Channel | Communicates ownership transfer |
| Coordinating goroutine lifecycle | Channel + context | Clean shutdown with select |
| Protecting shared struct fields | `sync.Mutex` / `sync.RWMutex` | Simple critical sections |
| Simple counters, flags | `sync/atomic` | Lock-free, lower overhead |
| Specialized concurrent map access | `sync.Map` | Use for write-once/read-many keys or disjoint-key workloads; otherwise prefer a typed map plus mutex |
| Caching expensive computations | `sync.Once` / `singleflight` | Execute once or deduplicate |

## WaitGroup vs errgroup

| Need | Use | Why |
| --- | --- | --- |
| Wait for goroutines, errors not needed | `sync.WaitGroup` | Structured completion without error collection |
| Wait + collect first error | `errgroup.Group` | Error propagation |
| Wait + cancel siblings on first error | `errgroup.WithContext` | Context cancellation on error |
| Wait + limit concurrency | `errgroup.SetLimit(n)` | Built-in worker pool |

## Sync Primitives Quick Reference

| Primitive | Use case | Key notes |
| --- | --- | --- |
| `sync.Mutex` | Protect shared state | Keep critical sections short; never hold across I/O |
| `sync.RWMutex` | Many readers, few writers | Never upgrade RLock to Lock (deadlock) |
| `sync/atomic` | Simple counters, flags | Prefer typed atomics (Go 1.19+): `atomic.Int64`, `atomic.Bool` |
| `sync.Map` | Specialized concurrent map | Prefer a typed map plus mutex unless `sync.Map`'s documented workload fits |
| `sync.Pool` | Reuse temporary objects | Always `Reset()` before `Put()`; reduces GC pressure |
| `sync.Once` | One-time initialization | Go 1.21+: `OnceFunc`, `OnceValue`, `OnceValues` |
| `sync.WaitGroup` | Wait for goroutine completion | Go 1.25+: prefer `wg.Go()` when the task cannot panic |
| `x/sync/singleflight` | Deduplicate concurrent calls | Cache stampede prevention |
| `x/sync/errgroup` | Goroutine group + errors | `SetLimit(n)` replaces hand-rolled worker pools |

For detailed examples and anti-patterns, see [Sync Primitives Deep Dive](references/sync-primitives.md).

## Concurrency Checklist

Before spawning a goroutine, answer:

- [ ] **How will it exit?** — context cancellation, channel close, or explicit signal
- [ ] **Can I signal it to stop?** — pass `context.Context` or done channel
- [ ] **Can I wait for it?** — `sync.WaitGroup` or `errgroup`
- [ ] **Who owns the channels?** — creator/sender owns and closes
- [ ] **Should this be synchronous instead?** — don't add concurrency without measured need

## Pipelines and Worker Pools

For pipeline patterns (fan-out/fan-in, bounded workers, generator chains, and Go 1.23+
iterators), see [Pipelines and Worker Pools](references/pipelines.md).

## Parallelizing Concurrency Audits

For an explicitly requested broad audit, partition these independent concerns when the
current client supports parallel work:

1. Find all goroutine spawns (`go func`, `go method`) and verify shutdown mechanisms
2. Search for mutable globals and shared state without synchronization
3. Audit channel usage — ownership, direction, closure, buffer sizes
4. Review timer churn, missing `ctx.Done()` in select, and unbounded spawning
5. Check mutex usage, `sync.Map`, atomics, and thread-safety documentation

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Fire-and-forget goroutine | Provide stop mechanism (context, done channel) |
| Closing channel from receiver | Only the sender closes |
| Measured timer allocation churn in a hot loop | Reuse `time.NewTimer` + `Reset` on Go 1.23+ |
| Missing `ctx.Done()` in select | Always select on context to allow cancellation |
| Unbounded goroutine spawning | Use `errgroup.SetLimit(n)` or semaphore |
| Sharing pointer via channel | Send copies or immutable values |
| `wg.Add` inside goroutine | Call `Add` before `go` — `Wait` may return early otherwise |
| Forgetting `-race` in CI | Always run `go test -race ./...` |
| Mutex held across I/O | Keep critical sections short |

## Cross-References

- -> See `golang-performance` skill for false sharing, cache-line padding, `sync.Pool` hot-path patterns
- -> See `golang-context` skill for cancellation propagation and timeout patterns
- -> See `golang-troubleshooting` skill for debugging goroutine leaks and deadlocks
- -> See `golang-design-patterns` skill for graceful shutdown patterns
- -> Use the repository's CI configuration when reviewing automated checks

## References

- [Go Concurrency Patterns: Pipelines](https://go.dev/blog/pipelines)
- [Effective Go: Concurrency](https://go.dev/doc/effective_go#concurrency)
