---
name: golang-design-patterns
description: "Idiomatic in-package Go design: constructors and functional options, init() and package globals, enums and zero values, error flow, resource cleanup and lifecycle, timeouts, limits and retries, and streaming large data. Use when choosing between these patterns, designing a constructor API, reviewing code for hidden global state, unbounded resources or missing timeouts, or when someone proposes a Clean or Hexagonal architecture. Not for where packages and interfaces live (go-project-layout), error wrapping (golang-error-handling), goroutine lifecycle (golang-concurrency), or speculative abstraction."
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Go design patterns

The in-package choices. Where a package, port or constructor call goes is
`go-project-layout`; follow it where the two meet. In design work, match the
repository's established pattern and pick the smallest one that fits; in
review, report `init()` use, globals, unbounded resources and missing
timeouts before suggesting refactors.

## Constructors

- `New<Type>(required deps...)` takes every required dependency as an
  explicit parameter and returns the concrete type. Never hide a required
  dependency in an option.
- Functional options only for optional settings with useful defaults:
  `type Option func(*T)`, or `func(*T) error` when applying one can fail.
  Defaults are set before the options run.
- A builder only when staged construction materially improves validation.
- Validate in the constructor and return an error; a constructed value is
  usable. `Must<Type>` wrappers only for package-level values built from
  constants.
- Prove a type satisfies a consumer's interface with
  `var _ reader = (*Store)(nil)` in the consumer's test, not beside the type.

## No `init()`, no mutable globals

`init()` cannot return an error, runs before tests in file-name order, and
hides dependencies. Package-level state is limited to constants, compiled
regular expressions (`regexp.MustCompile` once, never per call), `//go:embed`
values and sentinel errors. A connection, client, logger or config is
constructed in the composition root and passed in.

## Values and types

- Enums start with an `Unknown`/invalid member at zero, so an unset field is
  never silently the first real value.
- Make illegal states unrepresentable: a validating constructor and
  unexported fields beat a doc comment saying "must be positive".
- Domain values are data with validating constructors, not self-mutating
  models (`go-project-layout`).
- Time is stored and compared in UTC; a `time.Location` comes from user
  data at the edge, only to display or to interpret a user's input.
- Money is integer minor units with its currency beside it, never a float.
- Durations are `time.Duration`, never bare ints; config and wire formats
  parse into one at the edge (`30s`, not `30`).
- Choosing among `string`, `[]byte` and `[]rune`, and streaming large result
  sets with iterators: [data-handling.md](references/data-handling.md).

## Error flow

- Handle the error first and return early; the happy path stays at the left
  margin.
- Return errors for anything a caller can act on; panic only for a broken
  invariant that means a bug.
- Close errors on anything written (files, transactions, gzip writers,
  `bufio.Writer.Flush`) are returned; a best-effort close on a read path is
  commented as such.

Wrapping, sentinels and the handle-once rule: `golang-error-handling`.

## Resources and lifecycle

- `defer x.Close()` on the line after the error check that opened it.
- Bound everything: pool sizes, queue depths, buffers, request bodies,
  result-set sizes, concurrent work. An unbounded resource is a crash
  waiting for load.
- `runtime.AddCleanup`, never `runtime.SetFinalizer`, for the rare
  non-memory resource tied to object lifetime.
- Startup builds dependencies in order; shutdown reverses it, under a
  deadline, from a context cancelled by `signal.NotifyContext`. The
  composition root owns this, not `main`.

Pools and the shutdown sequence:
[resource-management.md](references/resource-management.md).

## Resilience

- Every outbound call has a deadline, from the caller's context or a
  `context.WithTimeout` at the call site (`golang-context`).
- Retries are bounded, back off, and stop when `ctx.Done()` fires; only
  retry an operation that is safe to repeat.
- A long loop checks `ctx.Err()`.

## Dependencies

A little copying beats a big dependency. Each module added is attack surface
and upgrade work; prefer the standard library and the modules already in
`go.mod`.

## Architecture: why not Clean or Hexagonal

Do not introduce Clean Architecture or Hexagonal (ports and adapters)
scaffolds, their folders (`entity/`, `usecase/`, `port/`, `adapter/`) or
their vocabulary as a reason to restructure. The layout in
`go-project-layout` already inverts dependencies more cheaply:

- A port is a small unexported interface declared by its consumer, for the
  one to three methods it calls. There is no shared `port` package of
  repository-shaped interfaces listing every method of a store.
- The only shared interfaces are small vocabulary types like `io.Reader`,
  owned by the leaf package that defines the concept and proven by a
  conformance suite (`go-conformance-suite`).
- Concretes are built once in `internal/app` and injected by hand. No DI
  container, no use-case object per operation; a service exists only to
  orchestrate several repositories or ports.

If someone proposes one of these architectures, answer with the above and
point to `go-project-layout`; changing the layout is a decision record.

## Cross-references

- `golang-concurrency`: goroutine ownership, errgroup, worker pools.
- `golang-performance`: data layout after profiling shows a bottleneck.
- `golang-security`: `crypto/rand` for keys and tokens.
