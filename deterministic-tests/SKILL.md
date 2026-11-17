---
name: deterministic-tests
description: Use this skill when a test is called flaky, fails only in CI or only under load, or passes on rerun; when a test sleeps, polls, asserts an elapsed time, or reads the wall clock; when a timeout is about to be raised or a retry added to make a test pass; when someone asks "why does load affect tests", "should timing tests be in CI" or "are these tests able to fail"; when writing a test for a timer, a schedule, a retry, a debounce, focus, a keyboard flow or anything concurrent; and before landing such a test. Holds the rules (wait on state, never on time; time only under a fake clock or when time is the behaviour; assert the specific expected value; break it on purpose once), the checks that enforce them, the stress run, and the procedure for a failure seen only in CI. Not for what to test or test structure in Go (golang-testing), end-to-end flow selection (browser-e2e), what a UI unit's stories must cover (ui-component-contract), or what a red run means for a push (ci-green).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Deterministic tests

Two repositories asked the same question in the same week: why do tests
pass here and fail in CI. A Go service polled with sleeps for a node to
become reachable and asserted that an operation took "at least" some time;
a UI kit's keyboard tests sent the next key before the widget had handled
the last. Both passed on a fast machine. In the UI kit, a stress run then
found 17 shared tests that could not fail at all: they asserted something
already true before the action. The owner asked for a rule in both and each
repository wrote its own. This is the shared one.

## Why load changes the result

A test that depends on timing has two things racing: the test's next step
and the work the last step started (a goroutine, a timer, a frame, a
microtask, a layout pass). On an idle workstation the work always wins.
On a CI runner with two cores and four test processes, or beside eight
other agents' gates, the gap stretches and the test's step wins sometimes.
Nothing is random: the order was never guaranteed, only likely. So:

- a failure that appears under load is a real race in the test or the
  code, at any load;
- a test that takes the wall clock as an input cannot be made reliable by
  a longer timeout, only less likely to fail.

## The rules

1. **Wait on state, never on time.** After every action, wait for the
   state it causes: a channel receive, a log line, a recorded call, an
   attribute, focus. No sleep, no poll loop with a sleep, no fixed delay
   "to let it settle".
2. **Time only under a fake clock, or when time is the behaviour.** A
   timeout, a schedule, a retry or a debounce is tested with a clock the
   test owns. Real time is allowed only where the subject is real (a
   socket, a process, a browser animation): then the line says why, and
   the test asserts the system's own marker before and after the hold
   rather than a duration.
3. **No elapsed-time assertions.** "Took at least 100 ms" and "finished
   within 2 s" assert the scheduler. Assert the event that the time was
   standing in for. A timeout in a test is a ceiling that fails a hung
   test, never a budget the test is tuned to.
4. **Assert the specific expected value**, computed before the action from
   the fixture. Never "changed", "truthy", "not empty" or whatever is
   there afterwards: those pass when the wrong thing happened.
5. **An assertion must be able to fail.** Break the unit once, where the
   input enters as well as in the logic, and watch the test fail; say what
   was broken in the commit body. A value that already holds before the
   action is not an assertion of the action.
6. **No shared state between tests**: a package global, a module store, a
   port, a temp path, an environment variable, test order. Each test makes
   its own and restores what it changes.
7. **Never raise a timeout, add a retry or add a sleep to make a test
   pass**, and never rerun until green (`ci-green`).

Language detail: [references/go.md](references/go.md) for Go,
[references/browser.md](references/browser.md) for story, component and
browser tests. Read the one for the test in hand.

## Make it a check

A rule a machine can hold is a gate in the project, with an opt-out that
carries a reason on the line. A valid finding is fixed, never allowed; an
allow that says "flaky" or "TODO" is a hidden failure.

- **Go**: `scripts/test-time-check.bash` (in this skill; copy it to the
  project's `scripts/` and add it to the fast gate). It fails on
  `time.Sleep`, `time.Since` or `time.Until` in a test file unless the
  line carries `// wall-clock: <reason>`, the package's tests run under
  `synctest`, or the file is tagged `integration`. `--self-test` proves
  the check itself.
- **Browser**: a lint over play and test bodies with the rules listed in
  the browser reference (no sleep, a wait that asserts, a key not followed
  directly by a key, no truthy state, no count-only callback), and a
  guard in the runner that fails a test which made no assertion.

## Stress before landing

A new or changed test of a timer, a schedule, concurrency, focus, a
keyboard or pointer flow, or measured layout lands after a clean run at
less than CI's share of a core:

- Go: `go test -race -count=20 -shuffle=on -cpu 1,2 ./<package>`, pinned
  (`taskset -c 0-1`) so the run is starved whatever else the host does.
- Browser: the changed test files repeated 20 times on two pinned cores
  with the page's main thread throttled 4 times (the browser reference
  has the command shape).

Stress the tests the change added or touched, not the suite. A timeout
seen only while unpinned work shares the cores is load: rerun that file
alone. An assertion failure is a race at any load. Before calling a slow
test a regression, run it on the default branch at the same severity.

## A failure only in CI

1. Read the first failing assertion from the job's log, not the summary.
2. Reproduce it in CI's conditions before changing anything: the job's
   image at the runner's CPU and memory, repeated (`ci-green`, "Spending
   CI runs"; `repo-tooling` has `ci-local`). Then the stress run for a
   quicker loop on one file.
3. Classify it by the rules above (acted before the state, a wait that
   was already true, real time, an ambiguous query, shared state) and fix
   the test, or the code when a user could hit the same race.
4. The fix is done when the repeat that failed passes, and the stress run
   is clean.
5. If it cannot be fixed the same day, quarantine that one test: skip it
   with the dated reason and the way to restore it written where the
   project tracks decisions, and fix it the next day. A quarantine with no
   date is a deleted test.

## Gotchas

- A test that never failed in CI is not proven sound: the 17 that could
  not fail never failed either. Rule 5 is the only evidence.
- Splitting a slow test to dodge a timeout multiplies its setup; shrink
  the fixture to what shows the behaviour first.
- Timing tests do not belong in the CI gate. A measured duration is a
  benchmark, run on a quiet machine and compared statistically
  (`golang-benchmark`); in the gate it is rule 3.
- A fake clock does not cover a real socket, a child process or the
  kernel. Those tests are the integration tier, tagged, and wait on the
  peer's own signal (a line it logs, a byte on a pipe).

## Checklist

- [ ] Every action is followed by a wait on its own state; no sleep or
      elapsed bound, or a reasoned allow on the line.
- [ ] Time-dependent behaviour runs under a clock the test owns.
- [ ] Each assertion names the expected value, read before the action.
- [ ] Broken on purpose once, and it failed; the commit says how.
- [ ] The project's check is clean with no unexplained allow.
- [ ] The stress run is clean for the tests this change touched.
