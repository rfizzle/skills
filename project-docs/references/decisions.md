# Decision records

A decision is recorded once, where it is made, with a permanent id, the date,
its status, the context, the decision and its consequences. A superseded
decision is never deleted; it gains a status naming its successor.

## What is a decision record

Record one only when all three hold:

1. A reviewer could reasonably ask "why not the obvious alternative?"
2. The answer is not in the code, its doc comments, or a test name.
3. Reversing it later would cost more than a single commit.

## What is not a decision record

Each of these fails the test above. Put it where the right column says, or
nowhere.

| It is | So it goes |
|---|---|
| What a convention, linter or the language already answers | nowhere |
| A choice local to one package (a type, a helper, an algorithm) | a comment on the code |
| A module's contract or error behaviour | `doc.go`, doc comments, tests |
| A rule that can be checked | the check |
| A task, plan, estimate, or "we will do X next" | the tracker |
| A procedure (how to do X) | a skill |
| A survey of options with no choice made | `docs/research/<date>-<topic>.md` |
| A restatement of an earlier record with nothing new | a link to that record |
| A preference stated once in a chat with no alternative weighed | nowhere, unless it is asked again |

If an agent finds itself writing a fourth record in one session, stop and
reread this table: most of them are comments or nothing.

The reason in a record is the reason a person gave or the code evidences.
An agent that infers one writes "reason not recorded" and asks. An invented
rationale is worse than none, because the next reader will defend it. A
decision that was not the agent's to make is proposed in the report, not
recorded.

## Ids and layout

The id is the date the decision was made plus a short slug:
`2026-11-05-lease-claims`. Sequential numbers collide silently when two
branches each take the next one; a date-slug pair cannot, and in the rare
case two branches pick the same date and slug, git reports an add/add
conflict instead of merging two records under one id. The date also sorts
the log.

Two layouts, same record:

- A single `docs/decisions.md` while every decision fits on a screen; one
  heading per decision, starting with the id.
- One file per decision, `docs/decisions/<id>.md`, once reasons run to
  paragraphs or several people record decisions at once.

The id, not the file, is the identity, so moving from one layout to the
other breaks nothing. A repository that already has `NNNN-slug.md` records
keeps those ids; new records use date-slug ids, and nothing is renumbered.

The template is in `templates.md`.
