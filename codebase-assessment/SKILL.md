---
name: codebase-assessment
description: Use this skill when the owner asks for an assessment, analysis, audit, review or "architect discussion" of a codebase or of how it is being built - "did we miss anything", "is this over-engineered", "are these tests AI slop", "are we on par with X", "what do other projects do", "is our CI efficient", "what is inefficient", "does this teach our skills anything" - and for the periodic review inside a long unattended run ("every ten stories, check we have not deviated"). Holds the procedure: one question, a plan with the agent count shown before anything runs, evidence gathered a tier below and judged at the session's tier, named peers, ranked findings with evidence, and filing that keeps the backlog bounded. Not for reviewing one diff or one item (backlog-batches reviewer), an accessibility audit (a11y-review), aligning documents (project-docs), or checking one pattern against the standard library (sound-patterns).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Codebase assessment

The owner asked for an assessment about ten times across six repositories:
readiness for a release, whether a plan had been followed, whether the
tests were worth having, whether CI was efficient, how the product
compared with the one it replaces. Each session invented the shape. Some
began with a dozen agents before saying what they would look at; one was
asked for "a summary of what you plan to do with how many sub-agents"
first. Findings came back as opinion with no file behind them, the fixes
were started inside the assessment, and one run had to be told "only add
required items, do not get us into an infinitely growing backlog".

An assessment answers one question with evidence and changes nothing.

## 1. The question and the finish line

Write the question in one sentence and what the answer will decide:

| The owner asks | The question is | Lens |
| --- | --- | --- |
| did we miss anything; are we ready | what the finish line requires that is absent or wrong | conformance |
| have we deviated | where the build differs from the accepted plan | conformance |
| are these tests warranted | which tests cannot fail, duplicate another, or test the mock | tests |
| is CI / the gate efficient | where the minutes go and which buy nothing | gates |
| is this over-engineered | what exists that no requirement or caller needs | structure |
| how do we compare to X | which capabilities X has, we lack, and the finish line needs | parity |
| what is inefficient in how we work | which steps repeat, wait or get redone | process |
| does this teach our skills anything | which observed pattern is generic and absent from the library | library |

Several lenses in one request are several questions; say so and answer
each. The finish line is the owner's (a release, "replace product X for my
own servers"); without one, ask before starting, because "missing" has no
meaning without it. [references/lenses.md](references/lenses.md) lists the
evidence each lens gathers. Read the rows for the lenses in use.

## 2. The plan, shown before anything runs

Give the owner, in the conversation, and stop for a go:

- the question and finish line as understood;
- each lens, what will be read or run for it, and what will not be;
- the agents: how many, which lens each takes, which tier, and whether
  any command they run costs something (a CI run, a paid request, a
  long test tier);
- the peers to compare against, by name;
- the expected time, and the shape of the report.

Skip the stop only when the owner has said to run unattended, and then
write the plan at the top of the report.

## 3. Evidence, a tier below

Gathering is separate from judging, and the gatherer does not decide what
is a problem.

- One read-only agent per lens, at the tier below the session's (the
  routine tier for counting, listing and measuring). Each gets the lens's
  evidence list, the paths, and the finish line. It does not get the
  suspicion: an agent handed a hypothesis returns it confirmed.
- It returns facts only: `file:line` and the text there, a command and
  its output, a count and how it was counted, a duration and the run it
  came from. No adjectives, no severity, no fixes.
- Measure rather than estimate: test counts by kind, the gate's duration
  per step, lines per package, what imports what. A number from memory or
  from the documentation is marked as unverified.
- Peers are read at the source: the project's repository, its
  documentation, its public pipeline. A claim about a peer carries its
  URL and the date read. Two named peers at least; "industry standard"
  with no name is not evidence.

## 4. Judgement, at the session's tier

The session, or one independent agent at its tier, reads the evidence and
decides. The strongest tier is used only for the decisions the project
reserves for it (a trust boundary, a guarantee across asynchronous steps),
never because the codebase is large.

Each finding has one class:

- **wrong**: built, and not what the plan, the contract or the finish
  line says; or a defect with a failure scenario;
- **missing**: required by the finish line and absent;
- **waste**: present, and nothing requires it; or cost with no return (a
  slow gate step that has never failed, a test that cannot fail);
- **risk**: sound today, and a named event breaks it.

Before a wrong or missing finding is reported, reopen its evidence and
confirm it yourself: the file still says that, the command still prints
that. A finding that cannot be shown is dropped, not softened.

## 5. The report

In this order:

1. **The answer**, one paragraph: yes, no, or how far, to the question as
   asked.
2. **Findings**, ranked, one row each: class, the claim in a sentence, the
   evidence (`file:line`, command, number), what it costs in use, the
   fix in a phrase and its size (small, medium, large as `backlog-batches`
   sizes items), and confidence when it is not high.
3. **Checked and sound**: what was examined and is right, so the owner
   knows it was looked at. An assessment that finds only faults was not
   asked whether anything is good.
4. **Against the peers**: a table of the same measures for each, with
   sources.
5. **Not checked**, and what it would take.
6. **Recommendation**: what to do first, and what to leave.

Plain language, the owner's terms, no restating of the task. The owner
reads this to decide; a report for other readers is published the way the
harness shares documents, and the conversation carries the answer.

## 6. Filing and fixing

- Nothing is fixed during an assessment, including "while I was there".
- File only on the owner's word, and by class: wrong and missing become
  items in the project's source, groomed or not as `groom` says; waste and
  risk go to the parked list unless the owner picks them. "File
  everything" from the owner overrides this.
- State the backlog's size before and after filing. A periodic assessment
  inside a run may add only items the finish line requires.
- Fixes run as an ordinary batch (`backlog-batches`), builders a tier
  below, with the assessment's rows as the items' evidence.

## 7. The periodic form

In a long unattended run the owner may ask for a check every N landed
items. It is this procedure with the question fixed ("have the last N
items deviated from the plan, and do their tests assert the behaviour")
and the scope `git diff <last check>..<head>`:

- one independent agent at the session's tier, the conformance and tests
  lenses only, minutes not hours;
- findings classed wrong go back to the item's builder before the next
  wave; missing ones are filed if the finish line requires them; nothing
  else is added;
- the result is one line in the run's next report, with the range it
  covered.

## Gotchas

- A lens with no finish line produces a list of everything that could be
  better. Stop and ask.
- Counting lines, files or tests and calling the count a finding. A count
  is evidence for a claim about use, or it is nothing.
- Comparing a peer's documentation with this project's code. Compare the
  same thing on both sides, and say when only one side could be measured.
- An assessment of the process read from memory of this conversation.
  Process evidence is the record: the session transcripts, the tracker's
  history, CI run durations, `git log`.
- A library comparison that proposes a skill for something seen once. A
  pattern earns a rule when it was observed going wrong, is generic, and
  is absent; then it is proposed with the evidence, and written only when
  the owner picks it (`create-skill` has the bar).
