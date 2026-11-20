# Pattern 2, three-way: funding scenarios

Reference scenario: **the same three years under three budgets.** Style: flat.
Read `COMMON-exec.md` (and through it `COMMON.md`) first. The two-outcome mechanism is described
in `02-two-outcomes.md`; this is its executive form with three runs, and you may read
`../02-two-outcomes--blast-radius.iso.html` for how runs, the rewind and the scoreboard were
done there, but your starting file is the flat one named in `COMMON-exec.md`.

## What the pattern is

A decision between options. The same period is played once per option on the same board, each
run is kept as a small copy, and the scene ends with the options side by side and the difference
between them stated as numbers.

## Mechanism to build

- **Board**: a grid of capabilities grouped by domain (4 domains x 3 capabilities), and beside it
  the top risks as a short list with open/closed state. A capability tile is empty, in progress
  or delivered. Each capability lists which risks it closes; a risk closes when all the
  capabilities it needs are delivered.
- **Runs** from data: `runs: [{ id, label, cost, delivers: { year1: [...], year2: [...], year3: [...] } }]`.
- **Year ticker**: Year 1, Year 2, Year 3 advancing on the master timeline; tiles fill as their
  year arrives.
- **Dock**: at the end of a run the board shrinks to a labelled thumbnail at the side (it is the
  same drawing scaled down, still showing its final state), and the main board resets with a
  short visible rewind. Three thumbnails accumulate.
- **Side by side**: the last steps enlarge the three thumbnails into three equal boards across
  the stage, each with its headline figures under it: capabilities delivered (N of 12), top
  risks still open (N of 5), relative cost.
- **Difference callouts** in the final step: what the recommended option buys over the minimum,
  and what the accelerated option adds over the recommended, each as one short line with a count.

## Scenario

Runs: "Minimum" (keeps existing commitments: a few capabilities, most risks stay open),
"Recommended" (most capabilities by year 3, one or two risks open), "Accelerated" (everything,
and a year sooner). Relative costs as multipliers of today's budget (illustrative).

Steps: `question` (the empty board, 12 capabilities, 5 risks: what do three years buy?),
`minimum`, `recommended`, `accelerated`, `compare`, `ask` (the recommendation, with the
difference callouts). Phases: The question, Three options, The decision.
