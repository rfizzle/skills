---
name: golang-testing
description: "Design, write, review, and debug Go tests, including table-driven unit tests, HTTP tests, integration tests, race detection, fuzzing, benchmarks, fixtures, and coverage. Use for any Go test change or test-strategy decision. Not for timing, flaky tests or testing/synctest (deterministic-tests), database fakes and pgxmock (golang-database) or benchmark measurement (see golang-performance)."
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Go Testing

Treat tests as executable contracts. Prefer the standard library and dependencies already
present in the repository; do not add a mocking, assertion, clock, snapshot, or leak
library solely because an example uses one.

## Required preflight

Run the repository's generation step (`make generate`) before every test command:
tests compiled against stale generated code pass or fail for the wrong reason.

Prefer the repository's test target, integration-test target, and lint target over ad hoc
commands.

Use a focused `go test` command only after the preflight and retain `-race` when relevant.

## Test structure

- Name tests for observable behavior: `TestType_Method` or `TestFunction`.
- A documented invariant gets its own test named for the behaviour, not the method:
  `TestLease_ExpiredLeaseIsReclaimable`. The name is the contract a reader greps for;
  `contract-spec` turns each approved invariant into one such test.
- An invariant test must fail when the behaviour breaks; check by breaking it once.
- A runnable `Example` with `// Output:` documents the main entry point
  (`project-docs`); an interface with two or more implementations gets a conformance
  suite (`go-conformance-suite`).
- Table-driven only when cases share setup and assertion shape.
- Keep tests independent of execution order; timing is `deterministic-tests`.
- Use `t.Parallel()` only when the test and all fixtures are concurrency-safe and do not
  share process-global state, ports, database rows, or environment variables.
- Test public behavior and documented package invariants rather than private call order.

## Repository and integration tests

Database fakes and pgxmock belong in `golang-database`.

- Use `//go:build integration` for tests requiring PostgreSQL, object storage, or other
  containerized services, never `testing.Short()`. Lint and vet see tagged files only
  when run with the tag; make the integration target and the architecture check pass
  `-tags integration`.
- A missing container runtime skips the test locally; CI sets the harness's
  require-containers variable so the skip becomes a failure.
- Use unique IDs and cleanup so integration tests can run repeatedly and concurrently.
- Test real PostgreSQL behavior for constraints, migrations, locking, and query semantics.

Read [integration testing](references/integration-testing.md) and the database skill's
testing reference when those tests are in scope.

## HTTP tests

Assert through the HTTP boundary: status, headers, body contract, auth outcomes and error
mapping.

Read [HTTP testing](references/http-testing.md) for detailed patterns.

Timing, flakiness, wall-clock checks, quarantine and `testing/synctest`: `deterministic-tests`.

## Fuzzing and benchmarks

- Seed fuzz tests with valid, empty, boundary, and previously failing inputs.
- Assert invariants rather than duplicating implementation logic.
- Use `b.Loop()` on Go 1.24+ and keep setup before the loop.
- Use the `golang-performance` skill for statistically meaningful comparisons.

## Review checklist

- New behavior, errors, and documented invariants are covered; each invariant has a
  test named for its behaviour.
- Assertions fail with enough context to diagnose the case.
- Tests do not depend on order or shared mutable globals; sleeps, polls, timeouts and
  elapsed bounds follow `deterministic-tests`.
- Mocks model consumer interfaces, not implementation internals.
- Integration boundaries use the integration build tag and real services intentionally.
- Race-sensitive code is exercised under `-race`.
- No new test dependency was added without clear value and approval.
- Flaky tests: `deterministic-tests` (no CI retries; quarantine rules there).

Read [helpers](references/helpers.md) and [mocking](references/mocking.md) only when the
task needs those deeper patterns.
