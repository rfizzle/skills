---
name: golang-troubleshooting
description: "Troubleshoot Golang programs systematically - find and fix the root cause. Use when encountering bugs, crashes, deadlocks, or unexpected behavior in Go code. Covers debugging methodology, common Go pitfalls, test-driven debugging, Delve debugger, race detection, GODEBUG tracing, and production debugging. Start here for any 'something is wrong' situation. Not for interpreting profiles, benchmarking, pprof capture or applying optimization patterns (see golang-performance skill), or exposing pprof or production metrics (see golang-observability skill)."
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

**Modes:**

- **Single-issue debug** (default): read the error, reproduce, and test one hypothesis at a
  time.
- **Codebase bug hunt** (explicit audit of a large codebase): partition independent bug
  categories only when the current client supports parallel work and the user requested a
  broad sweep. Keep a single reported issue sequential.

# Go Troubleshooting Guide

Run any repository-required generation step before tests. Prefer repository test targets
that preserve race, coverage, and integration settings.

**NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.** Symptom fixes create new bugs and waste time. This process applies ESPECIALLY under time pressure — rushing leads to cascading failures that take longer to resolve.

When the user reports a bug, crash, performance problem, or unexpected behavior in Go
code, diagnose it. Implement a fix only when the request includes fixing it.

1. **Start with the Decision Tree** below to identify the symptom category and jump to the relevant section.
2. **Follow the rules below**: reproduce before proposing a fix, test one hypothesis at a
   time, and find the root cause.
3. **Work through the General Debugging Methodology** step by step. Do not skip steps.
4. **Watch for Red Flags** in your own reasoning. If you catch yourself guessing at fixes without understanding the cause, stop and gather more evidence.
5. **Escalate tools incrementally.** Start with the simplest diagnostic (`fmt.Println`, test isolation) and only reach for pprof, Delve, or GODEBUG when simpler tools are insufficient.
6. **Never propose a fix you cannot explain.** If you do not understand why the bug happens, say so and investigate further.

## Quick Decision Tree

```
WHAT ARE YOU SEEING?

"Build won't compile"
  → run the repository's generation step → build → run the repository's lint target
  → See [compilation.md](./references/compilation.md)

"Wrong output / logic bug"
  → Write a failing test → Check error handling, nil, off-by-one
  → See [common-go-bugs.md](./references/common-go-bugs.md), [testing-debug.md](./references/testing-debug.md)

"Random crashes / panics"
  → capture the actual binary's traceback → run the repository's generation step → the repository's test target
  → See [common-go-bugs.md](./references/common-go-bugs.md), [diagnostic-tools.md](./references/diagnostic-tools.md)

"Sometimes works, sometimes fails"
  → run the repository's generation step → the repository's test target
  → See [concurrency-debug.md](./references/concurrency-debug.md), [testing-debug.md](./references/testing-debug.md)

"Program hangs / frozen"
  → curl localhost:6060/debug/pprof/goroutine?debug=2
  → See [concurrency-debug.md](./references/concurrency-debug.md)

"High CPU usage"
  → CPU profile; reading it and fixing the bottleneck are `golang-performance`

"Memory growing over time"
  → heap profile (`golang-performance`); goroutine leaks: [concurrency-debug.md](./references/concurrency-debug.md)

"Slow / high latency / p99 spikes"
  → CPU + mutex + block profiles (`golang-performance`)
  → See [diagnostic-tools.md](./references/diagnostic-tools.md)

"Simple bug, easy to reproduce"
  → Write a test, add fmt.Println / log.Debug
  → See [testing-debug.md](./references/testing-debug.md)
```

Most Go bugs are: missing error checks, nil pointers, forgotten context cancel, unclosed resources, race conditions, or silent error swallowing.

## Rules that matter in Go

- **Reproduce first**: a failing, deterministic test of the minimal case; `git bisect run`
  when a reliable good/bad command exists.
- **Measure, do not reason**: race detector for concurrency, pprof for performance
  (`golang-performance`), benchmarks over assumptions.
- **One hypothesis at a time.** Change one thing, measure, confirm.
- **Root cause, no band-aids**: trace the data flow backwards from the symptom; keep asking
  why until you reach the cause.
- **Research the codebase, not just the diff.** Before flagging a bug, trace every caller,
  upstream validation, and middleware or init code that may make it unreachable. When
  context lowers severity without removing the issue, report it at the adjusted priority and
  name the upstream guarantee. Do not edit code merely to record a review observation.
- **Start simple**: `fmt.Println` is fine locally; escalate to pprof, Delve or GODEBUG only
  when simpler tools fail. In production use `slog`, never `fmt.Println`.

## Red Flags: You're Debugging Wrong

If any of these are happening, stop and return to Step 1:

- **"Quick fix for now, investigate later"** — There is no "later". Find the root cause.
- **Multiple simultaneous changes** — One hypothesis at a time.
- **Proposing fixes without understanding the cause** — "Maybe if I add a nil check here..." is guessing, not debugging.
- **Each fix reveals a new problem** — You're treating symptoms. The real bug is elsewhere.
- **3+ fix attempts on the same issue** — You have the wrong mental model. Re-read the code, trace the data flow from scratch.
- **"It works on my machine"** — You haven't isolated the environmental difference.
- **Blaming the framework/stdlib/compiler** — It's almost never a Go bug. Verify your code first.

## Reference Files

- **[General Debugging Methodology](./references/methodology.md)** — The systematic 10-step process: define symptoms, isolate reproduction, form one hypothesis, test it, verify the root cause, and defend against regressions. Escalation guide: when to escalate from `fmt.Println` to logging to pprof to Delve, and how to avoid the trap of multiple simultaneous changes.

- **[Common Go Bugs](./references/common-go-bugs.md)** — The bugs that crash Go code: nil pointer dereferences, interface nil gotcha (typed nil ≠ nil), variable shadowing, slice/map/defer/error/context pitfalls, race conditions, JSON unmarshaling surprises, unclosed resources. Each with reproduction patterns and fixes.

- **[Test-Driven Debugging](./references/testing-debug.md)** — Why writing a failing test is the first step of debugging. Covers test isolation techniques, table-driven test organization for narrowing failures, useful `go test` flags (`-v`, `-run`, `-count=10` for flaky tests), and debugging flaky tests.

- **[Concurrency Debugging](./references/concurrency-debug.md)** — Race conditions,
  deadlocks, goroutine leaks, race-detector output, explicit shutdown tests, and stack dumps.

- **[Diagnostic Tools](./references/diagnostic-tools.md)** — Auxiliary tools for specific symptoms. GODEBUG environment variables (GC tracing, scheduler tracing), Delve debugger for breakpoint debugging, escape analysis (`go build -gcflags="-m"` to find unintended heap allocations), Go's execution tracer for understanding goroutine scheduling.

- **[Production Debugging](./references/production-debug.md)** — Debugging live production systems without stopping them. Production checklist, structuring logs for searchability, capturing profiles from running services, network debugging (tcpdump, netstat), and HTTP request/response inspection.

- **[Compilation Issues](./references/compilation.md)** — Build failures: module version conflicts, CGO linking problems, version mismatch between `go.mod` and installed Go version, platform-specific build tags preventing cross-compilation.

- **[Code Review Red Flags](./references/code-review-flags.md)** — Patterns to watch during code review that signal potential bugs: unchecked errors, missing nil checks, concurrent map access, goroutines without clear exit, resource leaks from defer in loops.

## Not for

- Reading profiles, pprof capture, traces, benchstat, applying a fix for a known bottleneck: `golang-performance`.
- Exposing pprof safely, metrics, alerts, continuous profiling: `golang-observability`.
- `golang-concurrency` and `golang-error-handling` hold the patterns behind the fixes.
