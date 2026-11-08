# The flow model

One JSON file per flow, `.agents/flows/<slug>.json`, excluded from git.
`scripts/example.json` is a complete change-mode example: order
cancellation with a refund through a payment provider. Copy it and replace
the content. `check.mjs` enforces what is marked *error* and warns about
the rest.

## Top level

| Key | Required | Meaning |
|---|---|---|
| `title` | error | the flow's name (`Order cancellation`) |
| `subtitle` | | the change or scope in a phrase |
| `mode` | error | `change` or `snapshot` |
| `capability` | warning | one paragraph: what the system does end to end and why; the flow document's Capability section |
| `success` | warning | what is true when it worked, testable |
| `lanes` | error, one or more | the participants |
| `steps` | error, one or more | the sequence, in the order it happens |
| `states` | | entity state transitions |
| `guarantees` | | what only the whole path can promise |

Every node may carry `change`, `was`, `note`. Markers follow
`api-topology`: `unchanged` (default), `added`, `changed` (with `was`),
`removed`; snapshot mode ignores them with a warning; a change map with
nothing marked is an error.

## Lanes

```json
{ "id": "payments", "name": "payments", "kind": "module", "summary": "owns refunds; talks to the provider" }
```

`kind` is one of `person`, `browser`, `api`, `module`, `store`,
`external`. A module lane is named as its package is (`contract-spec`).
Only a participant that takes a step is a lane.

## Steps

```json
{ "id": "claimRefund", "lane": "payments", "kind": "async",
  "text": "Claims the refund job with a lease; refunds through the provider with the order id as idempotency key",
  "endpoint": "cancelOrder", "screen": "OrderPage",
  "next": [{ "to": "providerRefund" }, { "to": "rejectShipped", "when": "yes", "label": "409" }],
  "fails": [{ "what": "the lease expires mid-call", "recovery": "another worker claims it; the idempotency key makes the second call a no-op" }] }
```

| Key | Rule |
|---|---|
| `lane` | an existing lane id (error) |
| `kind` | `action` (the person does something), `system` (default), `decision`, `async` (durable or queued; the lane that claims it), `external` (a call outside the system), `end` (an outcome the person sees or the flow's stop) |
| `text` | required; what happens, in the product's words, one sentence |
| `endpoint` | the endpoint id on the topology map this step calls or serves |
| `screen` | the sketch or unit id this step happens on |
| `next` | `to` an existing step id (error); `when` the condition, required on every decision branch (error); `label` the thing handed over (`refund job`) |
| `fails` | `what` and `recovery`, both required (error); an `async` or `external` step without `fails` is a warning |

Steps are listed in the order they happen; the viewer uses the list order
as columns and the text form numbers them. A step nothing leads to, other
than the first, is a warning. A step with no `next` that is not the last
is a warning unless it is `kind: end`.

## States

```json
{ "entity": "order", "state": "PAID", "next": ["SHIPPED", "CANCELLED"], "owner": "orders", "stored": "orders table",
  "change": "changed", "was": { "next": ["SHIPPED"] } }
```

`entity`, `state` and `owner` (a lane id) are required; every `next` must
be a listed state of the same entity (error). An empty `next` is a final
state.

## Guarantees

```json
{ "id": "G2", "text": "The provider refunds at most once per order: the idempotency key is the order id.", "steps": ["claimRefund", "providerRefund"] }
```

`id` and `text` are required; `steps` names the steps that hold it
(warning when empty). The implementer writes one behaviour-named test per
guarantee (`contract-spec`), so the text says what breaks when it fails.
