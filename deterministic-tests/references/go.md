# Deterministic tests in Go

`golang-testing` owns test structure and fixtures. This file owns
`testing/synctest`, flakiness and wall-clock: what to write instead of a
sleep, a poll or an elapsed bound.

## Replacements

Each row is a change one service made to pass its wall-clock gate.

| The test did | Write instead |
| --- | --- |
| slept, then checked a fake was called | the fake signals on a channel (or closes one) when called; the test receives with the test context's deadline as the ceiling |
| polled with a sleep until a state was reached | the code under test already logs or emits at that transition: wait on the line, the event or the recorded call, and ask again at each one |
| slept to show "nothing happened" (a stream stayed open, no second call) | assert the positive fact that proves it: the watch is still registered once the renewal is recorded; the call count after the next known event |
| asserted `elapsed >= d` after a backoff or a grace period | drop the bound; under `synctest`, assert the fake clock advanced by `d`, or assert the order of events |
| slept in a fake runner to simulate slow work | block the fake on a channel the test releases, or `runtime.Gosched()` when only a yield is needed |
| slept until a child process had written | read from a named pipe or the process's stdout until the expected line |
| waited for a database lock to clear with a sleep | wait on the holder's release (the transaction's done channel), then read |
| used `time.Now()` to build expected values | inject `Now` and pass a fixed instant off the round boundary (`...:00.400Z`) |

## The fake clock

- Code that sleeps, sets a timer or a deadline is tested inside
  `synctest.Test` (stable in Go 1.25+; the experimental `synctest.Run` is
  removed; use `t.Context()` inside): time advances only when every goroutine in the bubble
  is blocked, so a one-hour backoff costs nothing and cannot race.
- The bubble cannot contain real network I/O, a child process or a
  goroutine started outside it. Code that mixes a timer with a socket gets
  an injected clock interface (`Now`, `NewTimer`, `After`) with a fake the
  test advances; the smallest interface the package needs, defined by the
  consumer.
- `synctest.Wait()` after the action is the "wait on state" for a bubble:
  it returns when everything the action started has blocked or finished.
- Use `-race` for shared-memory behaviour. Add a goroutine-leak detector only
  if the project deliberately adopts and maintains that dependency.
- Quarantine (SKILL.md, "A failure only in CI") is a `flaky` build tag or a
  `t.Skip` naming its linked issue; never a CI retry.

## The check

`scripts/test-time-check.bash [root]` in this skill. Wire it as its own
target and put it in the fast gate:

```makefile
.PHONY: test-time-check
test-time-check: ## Fail on a test's unexplained wall-clock call
	@scripts/test-time-check.bash
```

- It flags `time.Sleep(`, `time.Since(` and `time.Until(` in `_test.go`
  files. `time.Now()` alone is not flagged: it is harmless until it is
  compared, and the comparison is `Since` or `Until`.
- A package whose tests call `synctest.Test(` anywhere is skipped whole.
- A file with `//go:build integration` is skipped: its subject is real.
- An allowed line reads `time.Sleep(d) // wall-clock: <why real time is
  the subject here>`. The reason is checked by review, not by the script.
- It needs GNU `find` and `awk`; run it in the CI image on other systems.
- A linter's forbidden-call rule cannot do this: such linters are usually
  switched off for test files, and they cannot see that a package runs
  under `synctest`.

## Stress

```sh
taskset -c 0-1 go test -race -count=20 -shuffle=on -cpu 1,2 ./internal/<package>
```

- `-cpu 1,2` runs each test with one and with two scheduler threads; a
  test that needs parallelism to pass, or fails with it, shows here.
- `-shuffle=on` prints its seed; rerun a failure with `-shuffle=<seed>`.
- Integration-tagged tests are stressed at the integrator only, never
  beside builders (`merge-train`): they contend for the runtime, not CPU.
- Keep the build cache out of the measurement: build once, then run.
