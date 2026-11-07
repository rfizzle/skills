# Templates

Skeletons, not content. Every placeholder in angle brackets is replaced or
the line is deleted; nothing is left as boilerplate.

## Contents

- AGENTS.md
- CLAUDE.md
- README.md
- docs/README.md
- A decision record
- A postmortem
- Makefile target

## AGENTS.md

```markdown
# AGENTS.md

`<name>` is <one sentence: what it is>. It is <the one-sentence shape: a Go
daemon under `cmd/` and `internal/` that a SwiftUI app in `App/` talks to over
a socket>. The design is in `docs/`; start at `docs/README.md`.

## Scope and restraint

Make the smallest change that is correct, safe and verifiable, following the
local pattern. Don't refactor, rename, reformat, update dependencies, rewrite
tests or expand documentation unless the requested behaviour needs it.

## Documentation

- Each document answers one question; `docs/README.md` is the table.
- Documents name no code symbol; code cites documents:
  `// See docs/<file>.md#<heading>`. Headings are anchors; renaming one
  means fixing its citations in the same commit.
- A change that moves a command, path, behaviour or decision updates the
  document in the same commit. `make docs-check` verifies the mechanical
  part.
- Never a story, ticket or plan id in a document, comment or test name.
- `docs/research/` is dated, never edited, never cited.

## Commands

| Task | Command |
|------|---------|
| Build | `make build` |
| Hermetic tests | `make test` |
| Static checks | `make fmt-check vet lint` |
| Docs | `make docs-check` |
| Everything CI runs | `make ci` |

## Testing

- `make test` is hermetic: <what that excludes here>. Tests that cross a real
  boundary carry a build tag (<tags>).
- Fakes sit at the seams: <the two or three seams>.
- <The one rule that makes tests uncacheable or flaky here.>

## Version control

- Never `git add -A`, `git add .` or `git commit -a`. Name the paths.
- Subject: `type(scope): subject`, imperative, lower case, under 72
  characters. A subject that needs "and" is two commits.
- The push is the person's. Never push.
- The rest of the rule set: `git-workflow`; the push gate: `ci-green`.

## Architecture

(Package doc comments are the detailed map. Mark anything not yet built
"(planned)".)

    cmd/<name>        assembly only
    internal/
      <pkg>/          <one phrase>
      <pkg>/          <one phrase>

Dependencies point down: <the direction, in one line>.

## Invariants

- **<Name it.>** <One sentence a reviewer checks every diff against.>

## Gotchas

- **<The symptom.>** <The cause and the fix, two sentences.>
```

Under 200 lines. If it is longer, something above is a procedure (skill) or
a reason (document).

## CLAUDE.md

```markdown
@AGENTS.md
```

Or no file. Never content of its own beyond lines that only Claude Code can
act on.

## README.md

```markdown
# <name>

<One sentence: what it is, for whom.>

Status: <pre-release, or the version>.

## Install

    <one command>

## Use

    <the shortest working invocation>

<Two or three sentences on what happens, and where output lands.>

The design is in `docs/`; start at `docs/README.md`. <Licence.>
```

A library's first paragraph is its pkg.go.dev front page: it says what the
module holds and what it deliberately does not.

## docs/README.md

```markdown
# <name> · documents

Each file answers one question. Facts live here once; `AGENTS.md` says where
the code is; skills say how a change is made.

| File | Question it answers | Changes when |
|---|---|---|
| `product.md` | What is it, for whom, and what will it never do? | the product changes |
| `architecture.md` | What are the big shapes, and why those? | a shape changes |
| `flows/` | How does work cross modules, and what if a step fails? | a hand-off changes |
| `runbooks/` | An alert fired; what do I check and do? | an alert changes |
| `runbooks/deploy.md` | How do I deploy, verify and roll back? | the deploy changes |
| `incidents/` | What went wrong, and what did we change? | an incident closes |
| `decisions.md` | What was decided, when and why? | a decision is made |
| `research/` | Dated snapshots | never; a new look is a new dated file |

- Documents name no code symbol; code cites documents by path and heading.
  `make docs-check` fails on a citation that does not resolve and lists
  headings nothing cites.
- Anything time-bound goes in `research/` with the date in the filename and
  is not edited afterwards.
- Planning is not in this repository. Nothing here names a story, ticket or
  sprint.
```

## A decision record

As a heading in `docs/decisions.md`, or as `docs/decisions/<id>.md`. Same
fields either way. Write one only if it passes the test in `decisions.md`.

```markdown
## <YYYY-MM-DD-slug>: <the question, as a question>

- Date: <YYYY-MM-DD>
- Status: accepted | proposed | superseded by <id>

**Context.** <What forced the choice; the constraints that are not in the
code.>

**Decision.** <One or two sentences.>

**Why.** <The reason, and the alternative it beat.>

**Consequences.** <What becomes easier, what becomes harder, what to revisit
and when.>
```

Ids are the decision date plus a slug, permanent and never reused. A
superseded record keeps its text and changes only its status line.

## A postmortem

`docs/incidents/YYYY-MM-DD-<slug>.md`, dated by the incident's start.
Blameless: systems and decisions are causes, people are not.

```markdown
# <YYYY-MM-DD>: <what users saw, in a few words>

Alert: [<AlertName>](../runbooks/<alert-name>.md). Severity: page | ticket.

## Impact

<Who was affected, how, for how long (start and end in UTC), what data if
any was lost.>

## Timeline (UTC)

- HH:MM <detected: how>
- HH:MM <each action and what it showed>
- HH:MM <mitigated: by what>

## Cause

<The chain of conditions, ending at the change or fault that started it.>

## What worked

<What shortened it: an alert, a runbook step, the rollback.>

## Action items

- <Change, stated as the outcome.> Filed: <date>.
```

## Makefile target

```make
docs-check: ## Verify docs links, citations, paths, make targets and ids
	@go run ./scripts/docscheck

ci: fmt-check vet lint test docs-check ## Run every check CI runs
```

Flags on the checker: `-workitem` (regexp for a tracker id; empty disables),
`-agents-max` (line limit, default 200), `-skip` (top-level dirs to ignore),
`-uncited=false` (silence the information list).
