---
name: backlog-batches
description: Use this skill when the user asks to implement several backlog items, stories, tickets or issues in parallel, "in batches", "work the queue", "run the backlog", or "in their own worktrees", whatever the tracker is (a markdown backlog file such as .plan/BACKLOG.md or .backlog.md, GitHub Issues, GitLab issues, Jira, Linear, or a list pasted in the prompt). It is the orchestrator recipe: resolve the work source, size each item, run at most three `backlog-implementer` sub-agents (Sonnet for small and medium items, Opus for large) in their own git worktrees, review by measured size, land by fast-forward, rebase survivors, and file follow-ups instead of widening items. Not for a single item (use the plan and implement workflows) and not for tracker administration on its own.
metadata:
  author: copierson
  standard: agentskills.io
  supersedes: ~/.pcc/skills/backlog-batches (2026-09-13 version, markdown-only)
---

# Backlog batches

A recipe for landing many independent work items with sub-agents without the
orchestrator resolving merge conflicts by hand. The tracker is a parameter:
this file never assumes where items live. At kickoff the orchestrator fills a
**run sheet** (`references/run-sheet.md`) that names the source and every
project-specific command, and every agent prompt quotes from that sheet.

## Terms

- **Source**: where items live and how they are read and marked. One of the
  adapters in `references/sources.md`, or a new one described the same way.
- **Item**: one unit of work with an id, acceptance criteria, the non-test
  files it touches, its overlaps and its dependencies. A source that lacks
  touches or overlaps gets them from the orchestrator's reading before the
  queue is built.
- **Run sheet**: the per-project, per-run settings block. Written once,
  quoted in every prompt, updated when the user changes a rule mid-run.
- **Orchestrator**: this session. **Implementer**: a sub-agent that owns one
  item. **Reviewer**: a sub-agent an implementer spawns for a large item.

## 1. Resolve the source and define done

1. Ask, or read from the project's agent instructions, which source holds
   the items. Pick the adapter in `references/sources.md`; note whether the
   source is visible inside a git worktree (a gitignored file is not; an
   issue tracker is).
2. Agree the finish line for the run before anything launches: a release, a
   milestone, a named set of items. Filing every follow-up and filling
   every free slot never converges. Follow-ups are filed as items only when
   they change results or fix a correctness bug; the rest go to a parked or
   "later" list, and parked items are never launched without asking.
3. Fill the run sheet. Everything an agent needs that is not in the
   repository's own instructions goes there: source, read and mark
   commands, gate command and forbidden commands, default branch, commit
   rules, attribution trailers, models by size, shared conflict files.

## 2. Before launching anything

1. `git status --short` on the main checkout must be clean, or every dirty
   file accounted for (the user may commit from another session).
   `git log --oneline -5` and `git worktree list`: note the head and any
   stale worktrees. Do not remove worktrees; tell the user which are merged.
2. Read the project's verification rule and put the narrowest declared gate
   in the run sheet (a `make` target the project calls its gate, a quality
   suite). Never let agents run the full CI pipeline, evaluations that cost
   requests, or integration tiers that need a listener or a real sandbox.
   Check the gate's tools exist on this host before the first launch.
3. Groom: an item with every criterion ticked but a non-done status is done
   or was ticked early. Re-read every queued criterion against any rule the
   user added since it was filed; rewrite the criterion in the source with
   a dated reconciliation note and tell the agent which text is binding.
4. Build the queue. For each item, list its non-test source files and its
   declared overlaps. Group into batches so that no two items running at
   once share a non-test source file. Order by value: items that make the
   output tell the truth first, then reach and hygiene, then design debt.
   A repository-wide sweep runs first and alone; run beside short items it
   becomes the long-lived branch that rebases on every landing.
5. Size each item (section 3) and write the size in its addendum so agents
   do not re-decide it.
6. Note every file that all landings conflict on (a changelog's unreleased
   section, a spec, a pinned struct-field count in a test, a generated table,
   golden files) and how each is resolved: regenerate, keep both, or bump.

## 3. Sizing and the review level

The review level follows the size, and the orchestrator makes the call.
Measured on two repositories over 2026-09: reviewer sub-agents on large
items found a real defect in 9 of 11 and never a false one; inline review
on medium items was enough; small items needed none.

| Size | Signs | Review |
| --- | --- | --- |
| small | one package, no new exported API, no spec or schema change, under about a hundred lines | none |
| medium | one or two packages, or one spec section, no new config field or concurrency | the implementer reviews its own diff inline before committing |
| large | three or more packages, a new config field or schema, new gate or state-machine semantics, concurrency, a performance-sensitive path, or a measurement whose numbers ship | the implementer spawns a `diff-reviewer` sub-agent (pinned Sonnet) with the diff and the criteria only, and fixes what it finds before committing |

A reviewer reports only evidenced defects with a failure scenario. It does
not restyle. Windfalls it notices go in the implementer's report as
follow-ups, not into the change.

## 4. Model routing

The session default is Opus. Fable is reached only through the `architect`
agent and never orchestrates a run. Models are fixed by item size, not
relative to the orchestrator:

| Size | Implementer | Reviewer |
| --- | --- | --- |
| small | `backlog-implementer`, `model: "sonnet"` | none |
| medium | `backlog-implementer`, `model: "sonnet"` | inline self-review, no agent |
| large | `backlog-implementer`, `model: "opus"` | `diff-reviewer`, pinned Sonnet |

Set `subagent_type: "backlog-implementer"`, `isolation: "worktree"` and
`model` on every implementer launch; the reviewer's pin is in its
definition. Never pass a `model` to a fork. When an item needs a design
decision before it can be implemented, write a brief and send it to
`architect` first; the returned plan goes in the item's addendum.

## 5. Slots and the queue

- At most three implementers at once, one item each. An implementer never
  starts a second item.
- Every implementer runs with `isolation: "worktree"`. The source file,
  when gitignored, is absent there (section 6).
- When a slot frees, fill it with the earliest queued item whose
  dependencies have landed and whose files do not overlap the agents still
  running. With nothing eligible, leave the slot empty rather than launch a
  parked item.

## 6. The per-agent prompt

`references/agent-prompt.md` holds the fixed prompt and the addendum
paragraphs. Fill the placeholders from the run sheet; do not paraphrase the
fixed prompt. The `backlog-implementer` definition already carries the
worktree, no-stash, rebase, refusal, one-item and report rules, so the
addendum supplies only the per-run facts: SIZE, THE SOURCE, VERIFICATION,
GOLDENS AND GENERATED FILES, SIBLINGS, COMMIT, DEFAULT BRANCH AND GRANTS,
and any project-specific paragraph (a driven capture, a spec that only the
orchestrator edits, a constant to bump). Restate context
rather than assuming shared memory: the agent has only its prompt, the
repository, and the source.

## 7. Landing protocol, per finished agent

1. `git status --short` on the main checkout. A dirty file outside the
   source is almost certainly a sub-agent that wrote to the main checkout
   (`cd` to the main path is the usual cause): have that agent diff the
   main tree to a patch, apply it in its worktree, and restore the main file
   from the branch. If the dirty file is the user's and overlaps the
   incoming commit, leave the branch unlanded and say so.
2. `git merge --ff-only <hash>` on the default branch. If it refuses, resume
   the agent with the rebase instruction; never rebase for it, unless the
   harness denies the agent's rebase, in which case cherry-pick onto the
   default branch, run the gate there, and land.
3. Mark the item done in the source per the adapter, from the agent's
   report; for a gitignored source the tick is never part of a commit.
4. Send every still-running agent a "head moved" message: the new head,
   what the landed item changed near their files (renamed or added symbols,
   a changed rule they must re-read), and the current value of every
   shared constant. They rebase, re-run the gate, and report the new hash.
5. Fill the freed slot (section 5).
6. Triage the agent's follow-ups (section 1.2) and file the ones that
   qualify in the source's own format; never widen a running item.
7. Never amend a landed commit after telling a running agent the head.

## 8. Reporting

- After every five landings, or when the user asks: landed, remaining,
  decisions waiting on the user, follow-ups filed and parked, backlog growth
  since kickoff.
- Push only when the user asks, and ask in the first report whether to push
  per batch.
- At the end of a batch: a table of item, commit hash, files changed, review
  level, follow-ups; then the next batch's first three. Run the final
  repository-wide check on a `git archive` export if any check walks the
  worktree directory. Cleanup of merged worktrees is the user's call: list
  them with the commands (`git worktree unlock`, `git worktree remove`,
  `git branch -D`, `git worktree prune`).

## Gotchas

- The permission classifier may refuse an agent's edit to a shared file
  outside its worktree (the source file, a spec), a plain gate run, or a
  rebase, and it treats `git worktree remove` and `git branch -D` as
  destructive. Tell agents: when refused, put the exact text of the edit at
  the end of the report and stop; the orchestrator applies it. Never let an
  agent work around a refusal.
- Agents often finish before a "head moved" message arrives and commit on a
  stale parent. The fast-forward refuses; resume the agent to rebase.
- An agent resumed by message can linger in the task list after completing;
  stop it explicitly.
- Insert new items into a markdown source anchored on a stable line of the
  previous item (its overlaps line), never on free text, and bound edits to
  the item's block: the file grows under you during a run.
- The stash is shared across worktrees; forbid it. Worktrees are sometimes
  cut stale; the first command is a fast-forward merge of the default branch.
- Gate steps that walk the tree (`gofmt -l .`, a docs check) pick up sibling
  worktrees under `.claude/worktrees/`; the gate should list tracked files
  or run on an export.

- Check `free -h` and `nproc` before the first launch. Three agents each
  running a gate with race-instrumented tests, a linter and a build at once
  took down a 6 GiB VM twice on 2026-09-29. On a small host, put the gate
  behind a shared lock (`flock /tmp/<project>-gate.lock make check`) in
  every VERIFICATION paragraph, tell agents to iterate with targeted
  packages, `-p 2` and no `-race`, and run any whole-corpus measurement
  once and alone.

## References

- `references/sources.md`: adapters for markdown backlog files (tracked or
  gitignored), GitHub Issues, GitLab issues, Jira or Linear, and a list in
  the prompt; each says how to read, mark and file, and whether it is
  visible in a worktree.
- `references/agent-prompt.md`: the fixed prompt and addendum template.
- `references/run-sheet.md`: the run sheet template with a filled example.
