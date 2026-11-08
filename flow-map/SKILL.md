---
name: flow-map
description: Use this skill when a business flow, user journey or cross-module path is about to be decided or changed and the owner has to see it before code is written: a capability spanning two or more modules, more than one screen, or an asynchronous, durable or external step (a queue, a job, a webhook); grooming an epic with such a flow; the contract-spec gate for a flow; an iterate change to cross-module behaviour; or the owner says "walk me through it", "what happens when", "show me the flow", "what if that step fails" or "draw the sequence". Produces one flow map: participants as swimlanes, ordered steps with branches and failure paths, state transitions and guarantees, every change marked, as an interactive page and as the numbered text sequence; steps name endpoint and screen ids so the topology map and sketches line up. Not for endpoint and schema shape (api-topology), a screen's look (ui-sketch), module invariants and the prose flow document (contract-spec), or a change inside one module (iterate).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Flow map

A flow document in `docs/flows/` is a page of prose the agent writes and
the owner never opens. The owner accepted "order cancellation" from a plan
paragraph and learnt at the review that a refund went out before the
cancellation was confirmed, that a shipped order could be cancelled from
a stale page, and that nobody had said what happens when the payment
provider is down. This skill puts the sequence in front of the owner as a
picture: who does what in what order, where the flow branches, where it
goes asynchronous, what happens at each step when it fails, which states
an entity passes through and who owns each, and the guarantees the whole
path makes. The same step ids point at the endpoints on the topology map
and the screens in the sketches, so the three groomed references agree.

## When a map is made

| Moment | Mode |
|---|---|
| grooming an epic whose flow spans two or more modules, more than one screen, or any asynchronous, durable or external step (`groom`) | change |
| the `contract-spec` owner gate for a flow: the map is the summary the owner sees | change |
| an `iterate` change to a hand-off, transition, guarantee or recovery path | change |
| "walk me through it", "what happens when X" about a flow that exists | snapshot |

Skip it for a flow inside one module with one screen and no asynchronous
step; the plan's outcome line and the topology map say enough.

## Procedure

1. **Read the ground.** The modules that take part (`contract-spec`
   proposals, `go-project-layout`), the existing flow documents, the jobs
   table and outbox when anything is durable (`go-background-jobs`), and
   the screens the user touches.
2. **Write the model** to `.agents/flows/<slug>.json`, from
   [references/model.md](references/model.md): lanes for the participants
   (the person, the browser, each module, each store, each external
   system), steps in the order they happen, each on one lane, with `next`
   branches (`when` on every decision branch), `fails` with a recovery on
   every step that can fail, `endpoint` and `screen` ids where they apply;
   the state transitions per entity with an owner; the guarantees only the
   whole path can make, each naming the steps that hold it. A change map
   holds only the steps the story changes plus the steps they connect to.
   The directory is excluded through `.git/info/exclude` as `checkpoint`
   does; nothing here is committed.
3. **Check and render.** `node .agents/skills/flow-map/scripts/check.mjs
   <file>` with no errors; read the warnings, they are usually a step that
   can fail with no recovery. `node .agents/skills/flow-map/scripts/render.mjs
   <file>` writes the page beside the JSON; `--ascii` prints the text form.
4. **Look at it yourself.** Every step opens, every branch label reads,
   the States and Guarantees tabs are filled, light and dark.
5. **Hand over and stop**, in the shape in
   [references/hand-over.md](references/hand-over.md): one paragraph of
   what the person experiences and what the system promises, the text
   sequence, where to look, the decisions each with options and a
   recommendation (a lease length, who owns a transition, retry for how
   long before dead), and "accept, or what is off?".
6. **Revise on the same map**; never a second one beside it. On
   acceptance, the flow document in `docs/flows/` is written from the
   accepted map as `contract-spec` requires, and the acceptance is a dated
   Decisions line there. The map is the review surface; the flow document
   is the durable record.
7. **After the build** the map is stale: delete it or re-render it as a
   snapshot.

## What the map must say

- **Every step that can fail says what happens next**: an external call, a
  durable hand-off, a transaction, a network hop. "It retries" is not a
  recovery; "retries with backoff for 24 hours, then dead and alerts" is.
- **Every decision has two or more branches with a `when`**, and the
  branch the person sees as a dead end is an `end` step on their lane with
  what they are shown.
- **Every asynchronous boundary is an `async` step** on the lane that
  claims the work, with the lease or the idempotency key in its text; the
  guarantee it enables (`at least once`, `at most once`) is a guarantee
  entry naming it.
- **Every entity that changes state has its transitions listed** with the
  owning lane; a transition two lanes both write is a decision to raise.
- **A guarantee names the steps that hold it**, so the test the
  implementer writes (`contract-spec`: one test per guarantee) has a
  place to look.

## Gotchas

- Lanes for every module in the service bury the flow. Only participants
  that take a step are lanes; a store that is only read is not a lane.
- A step text that names a function or a table is a step the owner cannot
  read. Say what happens, in the product's words; the endpoint id links the
  technical side.
- A happy path with no `fails` entries is a draft, not a map; the check
  warns on async and external steps, but a transaction can fail too.
- Branches that merge back are two `next` entries pointing at the same
  later step, not a copied step.
- Do not draw the UI here; a `screen` id points at the sketch.

## Definition of done

- The model passed `check.mjs` with no errors; the page was opened in both
  themes before the hand-over.
- Every failing step has a recovery, every decision has labelled branches,
  every guarantee names its steps.
- The owner accepted the map before any contract, migration or module was
  written, and the flow document under `docs/flows/` was written from the
  accepted map with a dated Decisions line.
- Nothing under `.agents/flows/` was committed.

## References

- [references/model.md](references/model.md): every field of the JSON
  model and the example (`scripts/example.json`, order cancellation with a
  refund).
- [references/hand-over.md](references/hand-over.md): the conversation
  shape, a revision, and how the map becomes the flow document.
