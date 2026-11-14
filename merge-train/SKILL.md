---
name: merge-train
description: Use this skill when many implementer agents build in parallel and a full gate per item is too expensive (the host runs short of CPU, memory, disk or build cache, gates collide on shared locks, or the owner wants the most done in a fixed window), and when the user says "merge train", "integration branch", "stack the branches", "one gate for the batch", "merge queue", "batched gate", "run more agents in parallel" or "skip the gate per story", or asks why parallel work keeps colliding on migrations, generated code or shared files. Holds the split between builders (narrow checks on their own packages) and one integrator that stacks finished branches on a train branch with one full gate per small batch; the register of shared resources assigned before launch; semantic conflicts; the holistic review of each train; and the stop point for a hard deadline. Not for the default recipe with a gate per item (backlog-batches), the push gate and a red CI run (ci-green), or rebase mechanics (git-workflow).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Merge train

One session ran four implementers, each running the project's full gate on its
own worktree. The shared build cache grew past 100 GB, two linters collided on
a machine-wide lock, and the host crashed with four gates, two reviewers' test
runs and a container test suite at once. The next session gave builders narrow
checks and one integrator a train branch: about twenty stories were built in
35 minutes with eight builders. It then failed in new places: two branches
took the same migration number, a strict lint the commit hook skips failed the
first train, two branches rewrote one SQL line in opposite directions, and
fourteen finished branches on fourteen different bases queued for serial
rebases. This skill keeps the speed and closes those holes.

Use `backlog-batches` for the run sheet, item sizing, tiers and the source
adapters; this skill replaces only its verification and landing steps.

## Roles and terms

- **Builder**: one item, its own worktree, narrow checks only (section 3).
- **Integrator**: the orchestrator, or one agent it runs; the only one who
  rebases onto the train, runs the full gate and moves the default branch.
- **Train**: one branch in its own worktree, always the default branch plus
  finished items not yet landed. Green train: the default branch
  fast-forwards to it.
- **Wave**: the builders launched from one train tip.
- **Register**: the table of shared resources, owned by the integrator.

## 1. Before the first wave

1. Measure the host: free memory, cores, the real free disk (on a VM or WSL,
   the host drive, not the guest's view), and the build cache's size. Start a
   cache trimmer (delete entries older than an hour). Cap builders at what
   one full gate plus N narrow checks fits in; heavy test suites (containers,
   browsers) run only at the integrator, never beside more than one builder.
2. Write the register in the ledger before launch, and each builder's brief
   quotes its rows: the next migration or schema number each item takes, and
   every shared list an item appends to (route or method tables, service
   lists, the agent-instructions map, a changelog, a generated index). A
   number chosen by a builder collides; a store that refuses gaps (most
   migration runners) makes every branch fail alone until its predecessors
   land.
3. Make generation work in a worktree: if a generator needs installed
   dependencies (a frontend's package directory), link them in or give
   builders the direct generator commands. Put the pinned tool directory
   first on PATH in every brief: a commit hook that cannot find its tools
   fails at the last step, after all the work.
4. Find what the commit hook checks and what only the full gate checks
   (stricter size limits, race detection, generated-code drift). Each gap
   becomes a line in the builder check set or a guaranteed red train.

## 2. Waves and bases

- Every builder in a wave branches from the same train tip, not from the
  default branch as it was when each happened to start. Items finished on
  different bases rebase serially at the train and conflict with each other.
- A slot that frees mid-wave starts from the current train tip.
- Group a wave so no two items rewrite the same function or query. Eight
  builders suit independent items; items in one epic touching one area get
  three or four builders and a faster train.
- Size items to land whole: an item over about 400 changed lines finishes
  partway at a deadline. Split it before launch.

## 3. The builder check set

Builders run no full gate. They run, on the packages they touched and the
packages that import them:

- build of the whole module; static analysis; tests with the race detector;
- the strict lint and size limits the full gate applies (function
  complexity, file length, exports), on their own packages;
- the generators, when a schema, contract or query changed, and a check
  that the tree is clean after;
- the docs check when documents changed, and the secret scan on their
  commits.

They commit each finished part as it passes, so a stop keeps the work, and
report what is committed and what is left. A builder that cannot satisfy a
commit hook stops and reports; it never bypasses it.

## 4. The train

1. When a builder reports, the integrator rebases its branch onto the train
   tip at once (the train's own worktree, a short temporary directory: Unix
   socket paths fail past about 108 characters), renumbers its register rows
   if the order changed, regenerates, builds, and fast-forwards the train.
2. Run the full gate on one to three stacked items, never a long batch. A
   red gate names packages; the package names the item. Drop that item from
   the train (reset to the previous green tip), send its builder the
   failure, and land the rest.
3. Mechanical findings (size limits, formatting) may be fixed on the train
   by one agent, one commit per package. A behaviour failure goes back to
   the item's builder.
4. Green: fast-forward the default branch to the train. Record the hash and
   the items in the ledger.

## 5. Semantic conflicts and the holistic review

A clean textual rebase can still be wrong: two items changing one rule in
opposite directions resolve to whichever side the integrator keeps. When a
conflict lands in a line both items changed, read both intents and keep
both, with a test that asserts each. Then, before each green train lands,
run one review of the train as a whole (an independent reviewer at the
strongest tier the run allows): what the narrow checks could miss (races,
order-dependent tests, generated drift, migration order), cross-item
conflicts in meaning, seams added only for tests, and the project's
invariants. It costs minutes and found the most serious defect of the run
that taught this.

## 6. A hard deadline

Before a fixed stop (a quota, a shutdown), write a stop point in the ledger
and keep it current: the default branch's hash, the train and its gate
state, each branch with its commits and what is left, the register, and the
decisions waiting on the owner. Stop launching about ten minutes before the
deadline; let running builders finish and commit; never leave a half-rebased
train.

## Gotchas

- Clearing the build cache before a compaction makes the next gates cold;
  plan the first train for it.
- Two linters on one host share a lock in the temporary directory; give the
  train its own temporary directory, short enough for sockets.
- A builder that branches its next item from its last finished branch hides
  a dependency; name the base in its brief and in the register.
- A partial item is still a branch: list it in the stop point with what is
  left, or it is redone from scratch.
- Builders told to reshape code to pass a duplicate-code gate make it worse;
  the brief says to share the matching code or leave it and report.
