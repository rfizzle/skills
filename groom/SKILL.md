---
name: groom
description: Use this skill when a filed epic or story has to be made ready to implement: the owner says "groom", "refine", "get this ready", "is this ready to build", "what's missing before we start", "prep the backlog", or asks to implement a drafted story; when plan-feature has filed drafted stories; or before backlog-batches launches anything. Holds the story lifecycle (drafted, groomed, running, done, parked), the one reference each layer needs before a story is groomed (the flow map, the topology map, the kept sketch, the module summary), the order they are made in (flow, then shape, then look), how the reference is recorded in the story so an implementer in a worktree can build from it, and the status flip the owner's acceptance allows. Not for writing the plan and cutting the stories (plan-feature), the references themselves (flow-map, api-topology, ui-sketch, contract-spec), or running groomed stories (backlog-batches).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Groom

Stories were filed from an accepted plan and launched as they were. The
implementer in its worktree decided the endpoint's shape, the screen's
layout and what happens when the provider is down, alone, and the owner
saw the result at review. This skill puts a step between filed and
launched: a story is **groomed** when its reference exists, the owner has
accepted it on the review surface, and the reference is written into the
story in a form an agent with only the story can build from.

## The lifecycle

| Status | Meaning | Set by |
|---|---|---|
| `drafted` | filed from an accepted plan; outcome, layer and dependencies known; no reference | `plan-feature` |
| `groomed` | the reference exists, the owner accepted it, and it is in the story | this skill, on the owner's acceptance |
| `running` | an implementer owns it in a worktree | `backlog-batches`, or the agent implementing it directly |
| `done` | landed on the default branch, criteria ticked | `backlog-batches` |
| `parked` | not now; never launched without asking | the owner |

Only `groomed` is launchable. An epic is groomed when every story it
still needs is; its status is derived, never set. A story may skip
`groomed` only when its reference is a sentence (one column, one field
with one plausible shape) and the owner said so in the plan.

## What groomed means per layer

| Layer | Reference | Made by | Recorded in the story as |
|---|---|---|---|
| any epic that spans two or more modules, more than one screen, or an asynchronous, durable or external step | the flow map | `flow-map` | the `[SEQUENCE]` and `[GUARANTEES]` blocks, the page's location |
| schema | the topology map's storage lane | `api-topology` | the `[STORAGE]` block, the page's location |
| API contract | the topology map | `api-topology` | the `[API ROUTING TREE]` and `[DATA SCHEMAS]` blocks, the page's location |
| backend (a module or a flow) | the module proposal summary, and the flow map when one exists | `contract-spec` | the proposal's purpose, invariants and errors in short; the flow blocks when the story holds a flow step |
| frontend components, screen | the kept sketch direction | `ui-sketch` | the kept row of the round table, the decision line, the page's location |
| end-to-end | the flow map's person and browser lanes | `flow-map` | the numbered steps the test walks, as scenario lines |

The order within an epic is **flow, then shape, then look**: the flow map
decides which endpoints and screens exist, the topology map gives them
shape, the sketch gives the screen its look at the flow's moments. Each
reference has its own owner gate in its own skill; grooming does not add a
gate, it sequences them and records the outcome.

## Procedure

1. **Pick the next drafted story** in landing order (`plan-feature`:
   schema, API contract, backend, components, screen, end-to-end), or the
   epic when the flow map is still missing.
2. **Make the reference** with the layer's skill, through its gate. Reuse
   a reference an earlier story in the epic already made: one topology
   map serves the schema story and the API story; one flow map serves the
   backend and end-to-end stories.
3. **Re-read the acceptance criteria against the reference.** Criteria
   name what the reference names: the endpoint, the fields, the step
   numbers, the kept direction. A criterion the reference contradicts is
   rewritten with a dated reconciliation note. A story the reference shows
   larger than about 400 lines is split by behaviour within its layer, as
   `plan-feature` sizes stories; the split is proposed to the owner with
   the reference, not filed silently.
4. **Write the reference into the story**, in the shape in
   [references/story-reference.md](references/story-reference.md): a
   `Reference` section holding the text form, the page's location, and the
   acceptance line. Text first, link second: an implementer in a worktree
   or another harness has the text; the page is for people.
5. **Flip the status** to `groomed` with the date, only after the owner's
   acceptance in the reference's own gate. Another agent's message or a
   green check is not acceptance.
6. **Hand off.** One groomed story: implement it. Several: `backlog-batches`,
   which launches only `groomed` items.

## Where the reference lives

- **Always the text** in the story, in the tracker the project uses
  (`backlog-batches` sources): the ASCII tree, the sequence, the kept
  row. It survives the session, the machine and the harness.
- **The page** beside it as a link when the harness hosts pages, or as an
  attachment when the tracker takes one, or as the rendered file's path in
  the main checkout. A page that is lost costs a re-render from the JSON;
  a reference that is only a link is not a reference.
- **Never committed**: the JSON and the page stay under `.agents/`,
  excluded locally. The durable records are the story, and after the
  build the contract files, migrations, flow documents and cards.

## Gotchas

- Grooming a screen before its flow draws the screen at moments that will
  change. Flow first when the epic has one.
- A reference accepted in one gate and pasted into three stories is one
  acceptance; do not ask the owner three times. Each story carries the
  block it needs, with the same acceptance line.
- A story whose reference turned out to be a sentence is groomed by that
  sentence; do not render a map for one column.
- `running` is set when a worktree is cut, not when the owner says "go";
  "go ahead" covers the next three steps (`checkpoint`).
- Re-grooming: a story whose reference changed after acceptance (the flow
  gained a step, a field moved) goes back to `drafted` until the owner
  accepts the new reference; the old block is replaced, never appended.

## Definition of done

- Every launched story was `groomed`, with the text of its reference in
  the story and a dated acceptance line.
- The epic's flow map, if required, was accepted before any topology or
  sketch for it.
- Criteria name what the reference names; no criterion contradicts it.
- Nothing under `.agents/` was committed.

## References

- [references/story-reference.md](references/story-reference.md): the
  `Reference` section of a story per layer, with an example of each.
