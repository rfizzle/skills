# Lenses and their evidence

Each lens lists what its gathering agent collects. Every row is a fact
with a source; the judgement comes later, from the session.

## Conformance (plan against build)

- The accepted plan, epics or stories for the finish line, by id.
- For each planned capability: where it is implemented (`file:line` of the
  entry point), the test that proves it (name and what it asserts), and
  how a user reaches it (route, command, screen). "Not found" is a row.
- Built things with no planned capability behind them.
- Decisions recorded since the plan that changed it, with their dates.
- For a UI capability: whether it is configurable where the owner expects
  (a screen, not only a command line or a config file).

## Tests

- Counts by kind (unit, integration, story or component, end to end) and
  the time each kind takes in the gate.
- A sample per package, read for: an assertion that holds before the
  action; a test that asserts a mock's own return; several tests that
  differ only in input and could be one table; a test named for an
  implementation detail; a sleep or an elapsed bound
  (`deterministic-tests`).
- Mutation by hand on three to five core behaviours: break the code, run
  the package's tests, record which failed. A behaviour whose break fails
  nothing is the strongest evidence in this lens.
- Behaviours in the contract or card with no test, by name.
- What the peers test at each level, from their repositories.

## Gates and CI

- The fast gate and the CI target: every step, its duration (from the
  last five runs, not one), and whether it has failed in the last fifty
  runs.
- What runs only in CI, and what runs twice (in the gate and again in a
  release or deploy workflow on the same commit).
- Cache hits and what is rebuilt or downloaded each run.
- Red runs in the period: the cause of each, and whether the local gate
  could have caught it.
- Minutes per run against the plan's allowance; the peers' run times from
  their public pipelines.

## Structure

- Packages or modules by size, imports in and out, and exported symbols
  with no caller outside their package.
- Interfaces with one implementation and no test double; options and
  configuration keys nothing sets; generic helpers with one call site.
- Layers a request passes through, counted on two real paths.
- Duplicated blocks the project's own tool reports, and whether each pair
  changes together in `git log`.
- What the project's size and complexity gates blocked in the period, and
  what was done to pass them (a real split, or a workaround).

## Parity (against a named product)

- The peer's capabilities from its documentation and, where it can be
  run, from use; each with a source.
- For each: present here (where), planned (which item), or absent.
- Which absent ones the finish line needs, decided by the owner's stated
  use, not by the peer's feature list.
- What this project does that the peer does not, for the same table.

## Process (how the work is being done)

- From the record, not memory: what the owner had to ask for more than
  once; instructions repeated across sessions; work redone; waits (on a
  gate, on the owner, on a stalled agent) and their length.
- Failed commands by kind across the sessions and their sub-agents.
- Host limits hit: disk, memory, cache size, with dates.
- Time from "start" to "landed" per item size, and the spread.

## Library (does this codebase teach the skills anything)

- Patterns here that differ from the shared skills: each with the skill
  and line it differs from, and which is better supported by use.
- Patterns here the skills do not cover, each with whether it was seen to
  prevent or cause a failure.
- Rules the skills state that this codebase breaks, with the cost
  observed, if any.
