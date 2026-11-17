# A hand-off to another repository's session

Written when work here needs a session in another repository to act. The
owner pastes it there, so it reads cold: the receiver knows its own
repository and nothing of this conversation.

## Template

```markdown
# Hand-off: <what to do, in a phrase>

To: <repository> (its session, or the next one opened there)
From: <repository> at `<short hash>` | release `<tag>`, <YYYY-MM-DD>
When: <now | queue into the current batch, wave or train | before <event>>

## What changed here
- <the change, in one line, and the tag or commit that ships it>
- <what it means for the receiving repository>

## Do
1. <step, with the exact command or the path in the receiving repository>
2. <step>

## Do not
- <the tempting wrong move, and why>

## Verify
- `<command>` prints or exits <what means done>.

## Not checked from here
- <anything stated about the receiving repository that this session did
  not read or run there, or "nothing">
```

## Example

```markdown
# Hand-off: move the UI kit onto skills v0.9.0

To: templates
From: skills, release `v0.9.0`, 2026-11-10
When: now, before the next wave starts

## What changed here
- `svelte-frontend` now holds the six layers and their import order, and
  the default headless library; `design-system` is new and is for apps.
- The local conventions skill repeats two sections the shared skills now own.

## Do
1. `make skills-sync SKILLS_REF=v0.9.0`, then `make skills-check`.
2. Delete "Behaviour" and "Layout" from the local conventions skill; keep
   one line naming the reference component for each.

## Do not
- Vendor `design-system`: it tells an app how to use a design, not how to
  build one.

## Verify
- `make ci` passes; `git status --short` shows only the vendored skills
  and the local conventions skill.

## Not checked from here
- Whether `cards-check` is green on the current head; it was red on drafts
  awaiting the owner when this was written.
```

## Rules

- One hand-off, one receiver, one purpose. Two repositories get two notes.
- A release is named by its tag; a change not yet released says so and
  names the commit, and the receiver decides whether to wait.
- "Queue into the current batch" means the receiving orchestrator files
  the steps as items in its own source and bundles them into one landing;
  it does not interrupt running agents.
- The note lives at `.agents/handoffs/<receiver>-<date>.md` here (ignored
  like the state note) until the owner says it was delivered.
