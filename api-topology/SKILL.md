---
name: api-topology
description: Use this skill whenever an API or data shape is about to be decided or changed and the owner must see it before code is written: a new or changed endpoint, RPC, request or response schema, field, enum value, table or column; the contract gate of connect-rpc or api-contract, the schema gate of golang-database, a plan-feature plan with a schema or API story, an iterate change to the API contract or schema; or the owner says "show me the API", "what does the backend look like", "map the endpoints", "draw the schema", "what changes in the API" or "before and after". Produces one topology map: a JSON model of roots, endpoints, schemas and tables with every change marked, rendered as an interactive page (lanes, connectors, inspector, diff highlighting) and as the ASCII tree in the conversation; the owner accepts the shape on the map, not a proto or YAML diff. Not for the contract edit (connect-rpc, api-contract), the migration (golang-database), module behaviour (contract-spec), or a screen's look (ui-exploration).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# API topology

The owner was asked to approve "the API change" three times for one
feature: once as a proto diff, once as a paragraph in a plan, once as a
migration summary, each in a different shape, none showing what connected
to what. They approved a list endpoint with no pagination and a response
that returned a field the frontend must never see, and found out at the
screen story. This skill puts one picture in front of every one of those
gates: the roots, endpoints, schemas and tables the change touches, with
the change marked on each, as an interactive map and as a text tree. The
owner says "accept, or what is off" to the map; no gate asks them to read
a contract file.

## When a map is made

| Moment | Mode | What it shows |
|---|---|---|
| `plan-feature` step 2, when the epic has a schema or API contract story | change | the proposed surface, every node added or changed, beside the plan |
| the contract gate (`connect-rpc` or `api-contract` step 5) | change | the real contract diff against the last release tag |
| the schema gate (`golang-database` migrations rule 8) | change | the storage lane: tables and columns, with the schemas they back |
| an `iterate` change hitting the API contract or schema row | change | the nodes the change touches, one hop of context |
| "show me the API", "what does the backend look like" | snapshot | what exists, no change marks |

Skip it when the change is one field or one column with one plausible
shape: the gate's sentence says it. Never skip it for a new endpoint, a
removed or renamed field, a new table, or anything marked breaking.

## Procedure

1. **Read the ground.** The contract as it is (`proto/`, `api/openapi.yaml`,
   or the plan's intended surface), the migrations, and for a change the
   contract at the last release tag (`git show <tag>:<path>`), so "before"
   is what shipped, not what is on the branch.
2. **Write the model** to `.agents/topology/<slug>.json`, from
   [references/model.md](references/model.md): only the nodes the story
   touches. An unchanged node appears only when a changed node needs it to
   resolve (the root, a response schema that already exists, the table a
   changed schema is stored in), and then as a name with no fields:
   context, not content. Every endpoint names its request and response schema; every list is
   paginated; every schema a response returns is a `resource` or a
   `response`; a table names the schemas it backs. Mark `added`, `changed`
   (with `was` for what moved) and `removed`; mark `breaking` with the
   reason where the versioning rules say so. The directory is excluded
   through `.git/info/exclude` as `checkpoint` does for its note; nothing
   here is ever committed.
3. **Check and render.** `node .agents/skills/api-topology/scripts/check.mjs <file>` must pass
   with no errors; read its warnings, they are usually a missing summary
   or an orphan schema. Then `node .agents/skills/api-topology/scripts/render.mjs <file>`
   writes the page beside the JSON, and `--ascii` prints the tree.
4. **Look at it yourself.** Open the page: every node opens in the
   inspector, the connectors land where the model says, light and dark,
   "Only changes" leaves exactly the change. A map you have not opened is
   not ready.
5. **Hand over and stop**, in the shape in
   [references/hand-over.md](references/hand-over.md): one paragraph of
   what changes in use, the ASCII tree, where to look (the page, hosted by
   the harness when it can host one, else the file path), the decisions
   each with options and a recommendation, and the question "accept, or
   what is off?". Another agent's message or a green check is not an
   answer.
6. **Revise on the same map.** The owner's "but" changes the JSON and the
   page is re-rendered at the same path; never a second map beside the
   first. Acceptance is recorded where the owning skill says: the story,
   the contract commit body, a `contract-spec` Decisions line.
7. **After the build**, the map is stale: delete `.agents/topology/<slug>.*`
   or re-render it as a snapshot. The contract files and migrations are the
   truth; a map is a view for one gate.

## What the map must say

- **Every endpoint** carries method, path, summary, request and response
  schema, the errors it declares, whether it is idempotent, paginated,
  streamed, and what authenticates it. A Connect RPC names its `rpc` and its
  procedure path; reads with no side effects are `GET`.
- **Every schema** carries kind (resource, request, response, enum, value),
  every field with type and required or default, and a summary where the
  name does not say it. Field types are lowercase scalars or another
  schema's id, so the viewer links them; `Order[]` is a list.
- **A table** carries its columns, keys and nullability, the migration that
  changes it, and the schemas it backs, so the owner sees a response field
  with no column behind it, and a column no response exposes.
- **A change says what was.** `changed` without `was` on a field is a
  check warning; make it an error for yourself.
- **Breaking is a red pill**, never a note: the hand-over says it ships in
  the next version as `connect-rpc` or `api-contract` require.

## Gotchas

- A whole-service snapshot at a change gate buries the change. Endpoints
  and schemas the story does not touch are not on the map; a referenced
  unchanged schema is a name, never a card full of fields. The owner can
  ask for the rest, and a `snapshot` map answers that.
- Writing the proto or YAML first and the map from it inverts the gate: the
  map is accepted, then the contract is written to match. At the contract
  gate itself, the map is drawn from the real diff.
- A map that lists only endpoints has no schemas to click; a map that lists
  only schemas shows no routing. Both lanes, always; storage when a table
  moves.
- A `resource` returned whole by a list endpoint puts every present and
  future field on the wire (`connect-rpc` gotcha); the map makes this
  visible, say it in the hand-over when it is a decision.
- Do not hand-edit the rendered page; edit the JSON and render again.
- The viewer and the scripts have no dependencies and need only the Node
  the repository already pins; do not add a bundler, a framework or a
  diagram library for this.

## Definition of done

- The model passed `check.mjs` with no errors and was rendered; the page
  was opened in both themes before the hand-over.
- The hand-over carried the ASCII tree, the page's location, each decision
  with a recommendation, and ended on "accept, or what is off?".
- The owner accepted the map before the contract, migration or controller
  was written, and the acceptance is recorded where the owning skill says.
- Nothing under `.agents/topology/` was committed.

## References

- [references/model.md](references/model.md): every field of the JSON
  model, the change markers, and the example model (`scripts/example.json`).
- [references/hand-over.md](references/hand-over.md): the conversation
  shape, the ASCII tree format, a revision round, and the hosting options.
