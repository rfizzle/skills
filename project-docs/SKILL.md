---
name: project-docs
description: The document set for a repository that agents edit and people read, and the rule that keeps it true. Use when setting up documentation, when asked to "update the docs", "write AGENTS.md", "add a decision" or "add an ADR", when deciding where a fact belongs (code, doc comment, test, AGENTS.md, docs/, a skill or a check), when a change moves a command, path, contract or decision, when AGENTS.md or a document is growing, and when writing or reviewing a code comment. Also use it to assess, audit, align or reconcile a repository against this standard, or when adopting the shared skills in a repo for the first time (references/align.md). Settles the base Go layout (cmd/ and internal/, no pkg/). Not for building a skill (create-skill), a module or flow contract (contract-spec), or prose style in user-facing copy.
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Project documentation

Nothing in a repository that agents edit is read end to end, so a wrong
sentence survives until someone acts on it. The design follows from that:
every fact has one home, contracts live where tests keep them honest, prose
survives only where code cannot carry the fact, a check catches mechanical
drift, and a change that moves a fact moves its sentence in the same commit.

Two rules carry most of it. **Each file answers one question.** **One home
per fact; everything else links.**

## The document set

| Home | Reader | Question it answers | Size |
|---|---|---|---|
| `README.md` | a person deciding whether to use it | What is this, how do I install and run it? | one screen |
| `AGENTS.md` | every agent, every session | Where is the code, how is it checked, what bites? | under 200 lines |
| client rules file (`CLAUDE.md`, ...) | one client | nothing: a pointer to `AGENTS.md` | 1–2 lines, or absent |
| `doc.go`, doc comments | a caller of the package | What does this promise? | the API doc |
| `Example` tests, behaviour-named tests | a caller, and `go test` | What does it do, exactly? | as many as the contract |
| a code comment | the next editor of the line | Why is this line like this? | as long as the reason |
| `docs/README.md` | anyone opening `docs/` | What answers what? | a table |
| `docs/product.md`, `docs/architecture.md` | a person judging a change | What is it for; what are the big shapes and why? | pages |
| `docs/flows/` | a person changing a hand-off | How does work cross modules; what if a step fails? | one per flow |
| UX notes beside the view or in `docs/` | a person judging the UI | What does the user see and do? | until a story shows it |
| `docs/decisions/` | a person about to re-litigate | What was decided, when, why? | one record per decision |
| `docs/runbooks/` | whoever is paged | An alert fired; what now? | one page per alert |
| `docs/incidents/` | a person asking "has this happened before?" | What went wrong, and what changed? | one postmortem per incident |
| `docs/research/<date>-<topic>.md` | a person asking "what did we look at?" | A dated snapshot | never edited |
| `docs/reference/` | a person who needs the exact value | Flags, config keys, wire formats | generated or golden-tested |
| `.agents/skills/<name>/` | an agent doing one kind of task | How is this kind of change made here? | small; see `create-skill` |

Nothing is created empty. `docs/` starts as `README.md` plus whichever file
has a real reader today, and grows by one file when a new question is asked.

## Contracts live in code

A unit's contract (what it returns, refuses, guarantees) lives in `doc.go`,
doc comments, `Example` functions with `// Output:`, and tests whose names
state the behaviour. `go test` keeps those true; a document does not. A unit
spec written before the build is a working file: when the code lands, its
promises move into those forms and the spec is cut, in the same commit, to
its purpose and non-goals.

Separate prose survives only for what no one package can hold: cross-module
flows, user experience, decisions, runbooks, and the product and
architecture overview. Detail: `references/code.md`.

## Where a fact belongs

Before writing a sentence, decide which question it answers; that names the
home. If the sentence is already true somewhere, link there and stop. The
duplicate is the drift.

| The fact is | Its one home | Everything else |
|---|---|---|
| a command | the Makefile, named in `AGENTS.md` | `README.md` shows the two or three a user runs |
| a path or the code map | `AGENTS.md` | documents name no file, package or symbol |
| a unit's contract | doc comments, `Example`s, tests | no spec or doc restates it |
| why a line is the way it is | a comment on that line | |
| a product or design reason | `docs/` section, cited from code | `// See docs/<file>.md#<heading>` |
| a hand-off between modules | `docs/flows/` | modules link it |
| what the user sees | UX notes, then a Storybook story or route test | |
| a decision that passes the test | a decision record | others state the result and link it |
| a procedure | a skill | `AGENTS.md` routes to it |
| a rule that must always hold | a check (lint, test, CI) | not a sentence |
| a rule the model follows at runtime | the tool's schema, description or prompt | the reason lives in `docs/` |
| an operational response | `docs/runbooks/<alert>.md` | |
| anything time-bound | `docs/research/<date>-<topic>.md` | never cited |
| a plan, story, ticket or roadmap | the tracker | nothing in the repo names one |

## Decision records

Record one only when a reviewer could reasonably ask "why not the obvious
alternative?", the answer is not in the code, and reversing it costs more
than a commit. **Not a decision record:** what a convention or linter
answers, a choice local to one package (comment it), a contract (code), a
rule that can be checked (build the check), a plan (tracker), a procedure
(skill), a survey with no choice (research), or a restatement of an earlier
record. The full test is `references/decisions.md`.

Ids are `YYYY-MM-DD-slug`, never sequential numbers: two branches cannot
both take the same id, and in the rare case they pick the same date and
slug, git reports an add/add conflict instead of merging two records under
one id. A superseded record is kept and marked. A reason an agent did not
hear from a person or see in the code is written "reason not recorded".

## The change rule

A change is not done until every document it falsifies is true again, in
the same commit. An agent fixes objective facts (a command, path, flag,
version) on its own; a change to intent, policy or a decision is proposed in
the report and left to a person. Every command or path written is one that
was run or opened in this session. Then `make docs-check`. The full
checklist is `references/maintenance.md`.

Delete rather than archive; git history keeps the old text.

## make docs-check

The mechanical half: this skill's `scripts/docscheck/`, a stdlib-only Go
program vendored into a project when the skill is synced, run by
`make docs-check` inside `make ci`, never edited in a project. It fails on
broken links and `docs/` citations, a citation of research, a missing
backticked path in `AGENTS.md` or `README.md`, an unknown `make` target, a
Go version that disagrees with `go.mod`, a work-item id, an undated research
file, and an oversized `AGENTS.md`. It lists, without failing, design
headings nothing cites. Flags and the target: `references/templates.md`.

## Audits and alignment

For a quick audit at a milestone, follow "The audit" in
`references/maintenance.md`. To assess a whole repository against this
standard and then reconcile it step by step, follow `references/align.md`:
assess first and report, change nothing until the reconcile phase.

## References

- `references/agents-md.md`: what goes in `AGENTS.md`, the client file, and
  `README.md`.
- `references/docs-tree.md`: each kind of file under `docs/`.
- `references/decisions.md`: what is and is not a decision record; ids and
  layout.
- `references/code.md`: contracts in code, cutting unit specs, skills versus
  documents, Go layout.
- `references/comments.md`: the comment rules and before/after pairs.
- `references/maintenance.md`: the change rule in full, the checker, the
  audit, adopting a repository.
- `references/align.md`: assess-then-reconcile a repository.
- `references/templates.md`: skeletons for `AGENTS.md`, `README.md`,
  `docs/README.md`, a decision record, a postmortem, and the Makefile target.
- `references/sources.md`: what was read, with URLs.
