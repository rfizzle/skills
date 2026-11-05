# Keeping the documents true

## The change rule, in full

A change is not done until every document it falsifies is true again, in
the same commit. Before finishing a change, ask in order:

1. Did it move a **command, path, target, flag or version**? Fix the line in
   `AGENTS.md` or `README.md`. These are objective facts; fix them without
   asking.
2. Did it change a **contract**? Update the doc comment, the `Example`, or
   the test name that states it. If a unit spec still restates it, cut the
   spec to its purpose.
3. Did it change a **behaviour a flow, UX or design document describes**?
   Update the section, and check whether the citing comment's reason still
   holds.
4. Did it make or reverse a **decision** that passes the test in
   `decisions.md`? Add or supersede the record. If the decision was not
   yours to make, say so in the report instead of recording it.
5. Did it add a **trap** that cost real time? One bullet under Gotchas in
   `AGENTS.md`, symptom first.
6. Did it change what a **tool's schema, description or prompt** says? Name
   which, and cite the section that holds the reason.
7. Is every command, flag or path you wrote one you ran or opened in this
   session? An invented one lands in someone's install instructions.
8. Run `make docs-check`.

An agent fixes objective facts on its own. A change to intent, policy or a
decision is proposed in the report and left to a person. A doc-only commit
is `docs(scope): ...`; a doc change that rides with code is in that code's
commit.

Delete rather than archive. git history keeps the old text.

## make docs-check

One stdlib-only Go program under `scripts/docscheck`, run by
`make docs-check`, which `make ci` includes. It is this skill's
`scripts/docscheck/`; syncing the skill vendors it too, hashed in the lock
file, so it is never edited in a project. Per-repo differences are flags on
the `make` target (`-workitem`, `-agents-max`, `-skip`, `-uncited=false`).
It fails on:

- a Markdown link whose file or heading does not exist;
- a `// See docs/<file>.md#<heading>` citation in Go that does not resolve;
- a citation of `docs/research/`;
- a backticked path in `AGENTS.md` or `README.md` that does not exist and is
  not marked "(planned)";
- a `make <target>` in any document that the Makefile lacks;
- a required-Go-version claim in a root file that disagrees with `go.mod`;
- a work-item id in a document or in code;
- a research file whose name does not start with a date;
- an `AGENTS.md` over the line limit.

And it lists, without failing, the design headings nothing cites.

What not to add: a prose linter, a generated table of contents, or an LLM
pass over the docs. They cost more than they catch at this scale. Check
external URLs only on a schedule, never in the commit gate.

## The audit

At each milestone, or when a session reports a stale instruction. For a
full assessment of a repository against this standard, with a scored report
before any change, use `align.md` instead.

1. `make docs-check`; fix everything it names.
2. Read `AGENTS.md` top to bottom against the repository. Delete every line
   the agent would get right anyway. Resolve any two lines that disagree.
3. Read the uncited-headings list. Each is a section to cite, rewrite or
   delete.
4. Confirm every row of `docs/README.md` still names a file that answers
   its question, and no file is missing from the table.
5. Look for unit specs that still restate a built contract; cut them.
6. Prune, then add.

## Adopting a repository

For a repository with no `docs/`, or one with too much:

1. Inventory every Markdown file. For each, write the one question it
   answers. A file with two answers is split; a file with none is deleted;
   two files with the same answer are merged.
2. Write `AGENTS.md` fresh from the Makefile and the tree, not from the old
   file. Then carry over only the gotchas and invariants that earn a line.
3. Reduce `README.md` to the person's questions; move the rest.
4. Create `docs/README.md` with the table, then only the files that have a
   reader today. Date and freeze anything time-bound under `docs/research/`.
5. Move contracts out of prose into doc comments and tests; cut the prose.
6. Record the decisions that are already made and still contested.
7. Copy `scripts/docscheck`, add the `docs-check` target to `ci`, run it,
   and fix what it finds.
8. Move procedures out of documents into skills.
