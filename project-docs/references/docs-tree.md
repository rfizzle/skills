# docs/

Prose in `docs/` survives only where code cannot carry the fact: a flow that
crosses modules, what the user experiences, a decision, an operational
runbook, and the product and architecture overview a person reads before
judging a change. A module's contract is not here; it is in the code (see
`code.md`).

Nothing is created empty. `docs/` starts as `README.md` plus whichever file
has a real reader today, and grows by one file when a new question is
actually asked. Diátaxis is a lens for classifying a page by the need it
serves, not a folder template.

## The index

`docs/README.md` is a table: file, the question it answers, when it changes.
It is the only place the document set is enumerated. A new file is added to
the table in the same commit that creates it.

## Product and architecture

`product.md` (what it is, for whom, what it will never do) and
`architecture.md` (the big shapes and why those), plus a domain document when
the product has a vocabulary the code must share. Written for a person
judging a change, not for an agent making one.

- **Headings are anchors; treat one like an exported symbol.** Code cites a
  heading as `// See docs/architecture.md#the-heading`. Renaming one breaks
  every citation; rename deliberately and fix the citations in the same
  commit.
- **A section nothing cites is either wrong or unnecessary.** The checker
  lists uncited headings; read that list at every audit.
- **No symbols, no roadmaps, no open questions.** Symbols drift; roadmaps
  and questions are planning, which lives in the tracker.

## Flows

`docs/flows/<name>.md`: a capability that spans two or more modules and that
no single package owns (a pipeline, a queue hand-off, a reconciliation
loop). It states the steps, who owns each, and what happens when a step
crashes. It stays prose because no one package can hold it. How to write one
is the `contract-spec` skill.

## User experience

What a user sees and does, for a view or workflow whose behaviour is not
obvious from the component tree: the states, the empty and error cases, the
words. Kept only while a person still judges the UI against it; once a
Storybook story or a route test shows the behaviour, the prose is cut to the
purpose and the rest points at the story.

## Runbooks

`docs/runbooks/<alert-name>.md`, one page per alert: what fired, what to
check, how to mitigate, how to roll back. The `service-operations` skill has
the shape.

## Decisions

See `decisions.md`.

## Research

Anything time-bound: a competitor survey, a platform's API table, a UX
sketch, a spike's result. The file name starts with the date
(`docs/research/YYYY-MM-DD-topic.md`). It is never edited afterwards and
never cited from code; a new look gets a new dated file. This keeps the other
documents free of material that rots.

## Reference

Exact facts a person needs to look up that doc comments cannot carry: CLI
flags, configuration keys, a wire format, a file layout on disk. Each page is
generated from the code by a `make docs` target or is a golden file a test
regenerates with an update flag, so that it cannot disagree with the binary.
A hand-written reference page is a bug report waiting to happen.
