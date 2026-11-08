# The hand-over

The owner reads the conversation, opens the page, and answers one
question. They do not read the JSON, the proto or the YAML.

## Shape

```text
Order cancellation adds one action to the orders API and two columns to
the orders table. A cancelled order stays readable: GET /orders/{id}
returns it with a status of CANCELLED and the time and reason. Nothing
existing changes shape; the two new fields are optional, so current
clients keep working.

+ added  ~ changed  - removed

[API ROUTING TREE]
Orders API v1  /api/v1
├── /orders
│   ├── GET   (Res: OrderList)  List the caller's orders
│   └── POST  (Req: CreateOrder, Res: Order)  Place an order
├── /orders/{id}
│   └── GET   (Res: Order)  Fetch one order
└── /orders/{id}/cancel
    └── + POST  (Req: CancelOrder, Res: Order)  Cancel an order that has not shipped

[DATA SCHEMAS]
~ Order (resource)
├── id: string (required)
├── status: OrderStatus (required)
├── + cancelledAt: timestamp (optional)
└── + cancelReason: string (optional)

~ OrderStatus (enum)
└── + CANCELLED

+ CancelOrder (request)
└── reason: string (optional)

[STORAGE]
~ orders  migration 0007_orders_cancellation  backs Order
├── + cancelled_at: timestamptz (nullable)
└── + cancel_reason: text (nullable)

The map: <link the harness gave, or .agents/topology/order-cancellation.html>.
Click any node; "Only changes" leaves the four that move.

Decisions:
1. Cancel as an action (POST /orders/{id}/cancel) or as DELETE /orders/{id}?
   A: the action; the order stays readable with its reason. B: DELETE;
   simpler, but a cancelled order disappears from the list. I recommend A:
   support looks cancelled orders up every day.
2. Reason free text or an enum? A: free text now, optional. B: an enum we
   have to guess today. I recommend A; we can add an enum beside it later
   without a break.

Accept, or what is off?
```

The paragraph says what changes in use, not which files. The tree is
`render.mjs --ascii`, cut to the changed nodes and their parents when the
full tree runs past a screen (the page has the whole thing). Every
decision has options, what each changes in use, and one recommendation
with a reason from how the product is used. The closing question is always
the same.

## Where to look

- **A page the harness can host.** When the harness has an artifact, page
  or canvas feature, publish the rendered HTML there and give the link; it
  travels between machines and survives the session. Republish to the same
  link on every revision so the owner's bookmark stays right.
- **The file.** Otherwise the path of the rendered page, absolute, for the
  owner to open in a browser. It has no dependencies and no network calls,
  so a `file://` open works.
- Never a screenshot in place of the page: the owner clicks nodes to see
  fields, and the screenshot cannot be clicked.

## A revision

The owner: "Accept the action, but the reason should be an enum with
`OTHER` and a free-text field only when it is OTHER."

The agent edits the same JSON: `CancelOrder.reason` becomes
`CancelReason` (enum, `added`) and `detail: string (optional)`, with a
`note` saying when it is read; the enum gets its values; `Order` gains
`cancelReason: CancelReason`. Re-render to the same path, republish to the
same link, and hand over again with only the changed part of the tree and
the sentence "Changed since last time: the reason is an enum with a
free-text detail for OTHER." The decisions list carries only what is still
open. No second map, no second link.

## Recording acceptance

| Gate | Where the acceptance goes |
|---|---|
| plan (`plan-feature`) | the plan is accepted as a whole; the stories inherit it |
| contract (`connect-rpc`, `api-contract`) | the contract commit's body: "Shape accepted by the owner on the topology map, YYYY-MM-DD." |
| schema (`golang-database`) | the migration commit's body, the same line |
| module or flow (`contract-spec`) | a dated Decisions line, as that skill records any owner answer |

The map itself is never committed; the line says it was shown and accepted.
