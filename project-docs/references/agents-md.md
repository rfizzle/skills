# AGENTS.md, the client file, and README.md

## AGENTS.md

The one agent instruction file, tool-neutral, read by every agent in every
session. Its budget is attention, not disk: past about 200 lines adherence
drops and the important lines are lost among the rest. For each line ask
"would removing this cause a mistake?" If not, cut it.

What goes in, in this order:

1. **One paragraph**: what the project is and the one-sentence shape.
2. **Scope and restraint**: the smallest correct change; no drive-by
   refactors, renames, reformatting, dependency bumps or doc expansion.
3. **Documentation**: the rules of `project-docs` as they apply here, in
   five or six bullets, and the change rule.
4. **Commands**: a table of task to `make` target. Only targets that exist.
5. **Testing**: the tiers, the fixtures at the seams, the one or two rules
   that make tests uncacheable or flaky here.
6. **Version control**: commit scope, subject format, what never to run.
7. **Architecture**: the directory map with one phrase per entry, and the
   import direction. Mark what does not exist yet as "(planned)".
8. **Invariants**: the five to ten facts a reviewer checks every diff
   against.
9. **Gotchas**: the traps that cost someone an hour, each with its symptom.

What stays out: anything the agent does correctly without being told;
file-by-file descriptions; style rules a linter enforces ("never send an LLM
to do a linter's job"); procedures (a skill); design reasoning (`docs/`);
anything that is true this week only.

- **Every path and command in it must be checkable.** `make docs-check`
  verifies that a backticked path exists and a `make` target is in the
  Makefile. A planned path says "(planned)" on its line.
- **Nested `AGENTS.md`** only for a sub-tree with its own toolchain (an
  `App/` beside a Go core). The nearest file wins; keep the nested one to the
  delta.
- **Hand-written, never generated.** A draft a tool generates from the tree
  is a starting inventory to prune, not a file to commit. Rules that must
  hold every time are hooks or CI checks, not sentences; the file is
  advisory.
- **Routes to skills** in a sentence or a short table, naming the paths or
  situations that trigger each.

## The client rules file

A client's own rules file points at `AGENTS.md` and holds nothing else, or
does not exist. `CLAUDE.md` is the line `@AGENTS.md`; other clients' files
(`.cursor/rules`, `.github/copilot-instructions.md`) are their equivalent
include or a symlink. A client file with content of its own silently forks
the rules, because most clients read only their own file when it exists.
Never a copy.

## README.md

For the person, not the agent. Title, one-sentence description, status if
pre-release, install, the shortest working use, where the documents are,
licence. Long material goes below the fold or in `docs/`. No agent rules, no
architecture, no command table beyond what a user runs. A library's README is
also its front page on pkg.go.dev, so the first paragraph must stand alone.

Skeletons for all three are in `templates.md`.
