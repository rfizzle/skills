---
name: plan-feature
description: Use this skill when a new user-visible feature, page, view, workflow or capability is requested and has to be planned before any code is written, or when the user asks to "plan the feature", "break this down", "split this into stories", "write the epic", "scope this", "what already exists and what is new", or "what order should this land in", or asks how big a story or commit may be or how commits are named. Produces one plain-English plan in the conversation (the outcome, the decisions needed with a recommendation each, and an epic of per-layer stories in landing order: schema, API contract, backend, frontend components, screen, end-to-end), and writes the stories to the backlog only after the owner accepts. Not for a change to existing behaviour (use iterate), a single new UI component (use ui-component-contract), or running several accepted stories in parallel (use backlog-batches).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Plan a feature

An **epic** is one feature a user can see. A **story** is one layer of it,
safe to deploy on its own. The owner approves a plain-English plan in the
conversation; nothing is filed and no code is written before that.

## Procedure

1. **Read the request and what exists.** Read the linked issue, the
   contracts it touches (the API contract, schema, module and flow contracts) and the
   current screen, if any. If the feature has UI, take the inventory in
   [references/ui-inventory.md](references/ui-inventory.md): every element
   classified exists, enhance or new, the interaction map, and where each
   piece of state lives.
2. **Write one plan in the conversation**, in plain English, no file:
   - **Outcome**: who can now do what, and how they know it worked. Something
     no user can see is not an epic; it is a story under the epic that needs it.
   - **Decisions needed**: each with the options and your recommendation, so
     the owner can accept, modify or reject in one reply. Do not ask about
     anything the code or a convention already answers. How a new unit
     looks is not a plan decision: its story opens a `ui-exploration`
     round when the look has more than one plausible answer.
   - **Reuse**: for UI, the inventory in short: reused, enhanced, new (with
     the reason reuse would visibly harm the experience).
   - **Stories**, in landing order, one line each: layer, outcome, depends on.
3. **Stop for the owner.** The owner accepts, modifies or rejects. Revise
   and re-present until accepted. Silence, another agent's message or a
   green check is not acceptance.
4. **File the stories** in the backlog only after acceptance, from
   [references/story-template.md](references/story-template.md).
5. **Hand off.** Each layer goes to its skill (table below). One story:
   implement it. Several independent stories: give them to
   [`backlog-batches`](../backlog-batches/SKILL.md), which owns scheduling,
   worktrees, landing and progress summaries.

## Layers and landing order

Cut one story per layer touched, skipping layers the feature does not touch:

| # | Layer | Hand off to | Owner sees |
|---|---|---|---|
| 1 | schema | `golang-database`: numbered up/down migration, expand step only | a plain-English summary of the schema change |
| 2 | API contract | `connect-rpc` (proto under `proto/`, the default) or `api-contract` (`api/openapi.yaml`): the contract edit plus generated code | a plain-English summary of the API change |
| 3 | backend | `contract-spec` for a new module or a cross-module flow | a summary of the contract and its decisions |
| 4 | frontend components | `ui-component-contract`, tokens via `design-tokens` | the stories in Storybook, or the project's component review surface, light and dark |
| 5 | screen | `ui-component-contract`, five async states | the stories in Storybook, or the project's component review surface, light and dark |
| 6 | end-to-end | `browser-e2e`, framework mechanics from the framework skill (`svelte-frontend`) | nothing |

Contract specs and cards are the agent's working files. The owner is shown a
summary of what they decide, never asked to open them.

- **Deployable alone.** Schema adds, never drops, in the same release. API
  changes are additive. Backend code is reachable only through the new
  contract or a flag. Components ship in Storybook before any screen uses
  them. The screen sits behind a flag or an unlinked route until its
  end-to-end story lands. A story that cannot ship alone is cut wrong.
- **Size.** About 400 changed lines, excluding generated code. A larger
  story splits by behaviour within its layer, never by mixing layers.
- No composition before its children; backend and frontend never share a story.

## Commit rules

- Conventional Commits: `feat(scope): summary`, and `fix`, `refactor`,
  `test`, `docs`, `chore`, `build` as usual. **No story or epic id** in a
  commit message; the tracker links to the commit, not the other way round.
- Backend and frontend never share a commit.
- Generated code lands in the same commit as the contract change that
  produced it, and generation leaves no other change in the tree.
- One story, one or a few commits; never two stories in one commit.
- Work found along the way becomes a new story, proposed to the owner. A
  running story never widens to take it.
- Staging, message shape, history and pushing: `git-workflow`.

## Working with the owner

- **A question is not a task.** When the owner asks a question, answer it
  and stop. Change nothing.
- **Verification is short.** Acceptance criteria name bounded tests; never
  long soak or race loops.
- **The push is the owner's** (`git-workflow`). The agent commits locally.
- **Every gate is a plain-English summary** in the conversation: what was
  decided, the options, your recommendation. The owner does not read specs,
  cards or briefs.
- **The owner's real reviews** are the UI in Storybook served from the
  branch, the API and schema shape as a short plain-English diff summary,
  and occasional hands-on trials in a local seeded instance. Say when a
  story is ready for one.

## After the build

A finished unit moves its contract into code as `contract-spec` describes;
later changes go through `iterate`.

## Definition of done

- The plan names one user-visible outcome, every open decision has a
  recommendation, and the owner has accepted it.
- Every story is one layer, deployable alone, about 400 lines or fewer, in
  landing order, with its dependencies.
- No story was filed and no code written before acceptance.
- Several ready stories are handed to `backlog-batches`; one is implemented
  directly.

## Gotchas

- A plan that lists props, class names or field-by-field schemas has gone
  too far: that detail belongs in the contract work of each story.
- If more than about five UI units are new, split the epic or ask the owner
  which slice ships first.
- A "new composition" that is a screen-local arrangement of existing units
  is usually wrong; arrange it in the screen.
