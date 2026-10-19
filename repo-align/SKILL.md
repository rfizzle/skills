---
name: repo-align
description: Assess a repository against the project-docs standard and reconcile it, in that order. Use when asked to "assess", "audit", "align", "reconcile" or "bring up to standard" a repository's documentation, AGENTS.md, README, docs/, skills or comments; when asked whether a repo "follows the standard" or "is aligned"; when adopting the shared skills (make skills-sync) in a repo for the first time; or when several sibling repositories have drifted and the user wants the gap measured before it is closed. Produces a scored assessment first and makes changes only in the reconcile phase, each step its own commit. Not for writing the standard itself (project-docs), building a skill (create-skill), or a routine doc update that rides with a code change.
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Repository alignment

Two phases, never merged. **Assess** reads and measures; it changes nothing
and ends with a report the person can act on. **Reconcile** makes the
changes, one commit per step, in an order that keeps `make ci` green
throughout. The standard being measured against is the `project-docs`
skill; this skill only says how to measure and in what order to fix.

The skills repository is beside the project as `../skills` unless the
Makefile says otherwise (`SKILLS_SOURCE`).

## Assess

Produce one report, written to a scratch location or printed, never into
`docs/` (it is planning). Every line of it is a measurement or a verdict
with a `file:line`; no restatement of the standard.

1. **Inventory.** Root Markdown files and their line counts; whether
   `CLAUDE.md` exists and what it holds; the `docs/` tree; every directory
   under `.agents/skills` and `.claude/skills` and whether the latter is a
   symlink; the Makefile targets; what `ci` runs; whether
   `.agents/skills/shared.sum` and `scripts/skillscheck` exist.
2. **Mechanical drift.** Run the project-docs checker from the repository
   root. If the repo has no `scripts/docscheck`, run the reference one
   without installing it:

       go run ../skills/project-docs/scripts/docscheck/main.go

   Record every line it prints, and the uncited-headings list.
3. **AGENTS.md scorecard.** Line count against 200. Which of the nine
   sections exist, in what order. Count the paths and `make` targets it
   names that do not exist. Mark each paragraph as one of: fact the agent
   needs, procedure (belongs in a skill), reasoning (belongs in `docs/`),
   style rule a linter enforces, or restatement of defaults. Note any two
   lines that contradict each other.
4. **README scorecard.** Does it answer the person's four questions (what,
   install, use, where the docs are) above the fold? List what in it
   belongs elsewhere.
5. **docs/ classification.** For each file: the one question it answers, or
   "two" or "none"; whether it names code symbols; whether it is
   time-bound. Verdict per file: keep, split, merge into X, delete, or freeze
   as `research/<date>-<topic>.md`. Note whether `docs/README.md` exists and
   whether its table matches the tree. Note how decisions are recorded, if
   at all.
6. **Skills classification.** For each skill: shared (exists in `../skills`;
   compare with `diff -r` and note drift), project (repo-specific procedure
   worth keeping), noise (restates language conventions, employer-specific,
   or no procedure), or candidate (generic and good; propose promoting it
   to `../skills`).
7. **Comment sample.** Count, with `grep -rn` over the source, the
   mechanical patterns the standard bans: work-item ids, "Added", "Updated",
   "Fixed" or dated annotations in comments, banner lines, pointers in
   string literals. Then read one package's comments end to end and give a
   one-paragraph judgement: mostly why, mostly what, or restating.
8. **Score and order.** Close with a table of the steps below, each marked
   needed or not, with a size (small, medium, large) and the evidence line
   that justifies it. The order is fixed; the sizes decide whether the
   reconcile runs here or as backlog items.

Stop and report. Do not begin reconciling in the same turn unless the person
already asked for both.

## Reconcile

Each step is one commit on the checked-out branch, scoped to that step's
files, with `make ci` green at the end of it. Steps are skipped when the
assessment marked them not needed.

1. **Gates first.** Add `skills-sync` and `skills-check` to the Makefile,
   put `skills-check` in `ci`, run `make skills-sync <shared skills>` to
   vendor what the repo uses (`project-docs` and `sound-patterns` at
   least), and commit the copies with `shared.sum`. If the repo lacks a
   `docs-check`, add `scripts/docscheck` from `project-docs` and the target,
   and put it in `ci`. Fix nothing else yet; a red `docs-check` at this
   point is expected and is the next step's input.
2. **AGENTS.md.** Rewrite from the template in `project-docs`, from the
   Makefile and the tree, not from the old file. Then diff against the old
   file and carry over only gotchas and invariants that earn a line. Mark
   unbuilt paths "(planned)". the client rules file (`CLAUDE.md` and the
   like) becomes a pointer to `AGENTS.md` or is deleted. Nested agent files are reduced to their delta.
3. **README.** Trim to the person's questions; move the rest to where the
   assessment said.
4. **docs/.** Create or fix `docs/README.md` first, then apply the per-file
   verdicts: merges, splits, deletes, freezes. Rename headings only with
   their citations, in the same commit. Record the decisions that are
   already made and still contested, with ids.
5. **docs-check green.** Fix every line the checker prints. Cite or delete
   uncited design headings.
6. **Skills.** Delete the noise. Promote candidates by copying them into
   `../skills`, committing there, and re-running `make skills-sync`.
   Project skills that duplicate a shared one are reduced to the delta.
7. **Comments, mechanical.** Remove the grep-able patterns with a small
   script, then read every changed site: a mechanical rewrite that produces
   prose you would not have written needs a person. Commit per package.
8. **Comments, judgement.** Package by package, apply the comment rules of
   `project-docs`. This is slow and is usually filed as backlog items
   rather than done in the alignment session.

Definition of done: `make ci` green with `docs-check` and `skills-check` in
it; `AGENTS.md` under 200 lines with every path and target checkable;
`docs/README.md` matching the tree; `shared.sum` present and every shared
skill identical to its source; the report's table with every needed step
marked done or filed.

## Reporting

The report back names, per step, the commit that did it or the item that
was filed, and nothing else. Design questions the reconcile raised (a
decision with no recorded reason, a document whose question nobody could
name) are listed for the person, not resolved by guessing.
