# The story's Reference section

Added to the story block (`plan-feature`'s template) at grooming, in the
tracker's own format. The text form comes from the reference skill's
`render.mjs --ascii` (or `--text` for a sketch); only the blocks the story
needs are pasted. The acceptance line is the same wherever the reference
was accepted.

## A schema or API contract story

```markdown
### S-125: POST /orders/{id}/cancel (E-12)

- Status: groomed 2026-11-08
- Layer: API contract
- Depends on: S-124
- Touches: api/openapi.yaml, internal/api/gen/, web/src/lib/api/gen/

Acceptance criteria:
- [ ] `POST /api/v1/orders/{id}/cancel` with `CancelOrder` request and `Order` response
- [ ] 404 `order-not-found` and 409 `order-already-shipped` declared
- [ ] Deploys alone: answers 501 until S-126

Reference (topology map, accepted by the owner 2026-11-08; page: <link or path>):

    [API ROUTING TREE]
    Orders API v1  /api/v1
    └── /orders/{id}/cancel
        └── + POST  (Req: CancelOrder, Res: Order)  Cancel an order that has not shipped

    [DATA SCHEMAS]
    ~ Order (resource)
    ├── + cancelledAt: timestamp (optional)
    └── + cancelReason: string (optional)
    + CancelOrder (request)
    └── reason: string (optional)
```

The schema story carries the `[STORAGE]` block of the same map and the
same acceptance line.

## A backend story with a flow

```markdown
Reference (flow map, accepted by the owner 2026-11-08; page: <link or path>):

    [SEQUENCE]
     5. + [orders] In one transaction: status CANCELLED, cancelledAt and reason set, and a refund job enqueued if payment was captured
        ├── payment captured [refund job] → 7
        └── fails: the transaction fails → nothing changes; the browser shows a retry
     7. + ~> [payments] Claims the refund job with a lease; refunds with the order id as idempotency key
        └── fails: the lease expires mid-call → another worker claims it; the second call is a no-op

    [GUARANTEES]
    + G1: a cancelled paid order produces at least one refund attempt (step 5)
    + G2: the provider refunds at most once per order (steps 7, 8)

    Module: payments gains Refund(ctx, orderID) with invariants I1 (idempotent per order) and I2 (dead after 24h); errors: ErrProviderRefused (not retryable).
```

Only the steps the story implements and the guarantees they hold; the
flow document under `docs/flows/` has the rest after acceptance.

## A screen or component story

```markdown
Reference (sketch round 2, kept by the owner 2026-11-08; page: <link or path>):

    | Direction | Axis | What it changes | When it wins | What it costs |
    | BannerCalm (kept) | tone | the cancellation banner in the surface colour with a red rule, the refund line inside it | the person came for the refund | less visible on a busy page |

    2026-11-08: kept BannerCalm over Banner (too loud), Timeline (history nobody asked for), Quiet (refund easy to miss); the owner wants the refund first, calmly.
    States: filled, loading, empty, error, partial as sketched; phone: the banner above the items, items below the fold accepted.
```

`ui-component-contract` writes the card from this block.

## An end-to-end story

```markdown
Reference (flow map, accepted 2026-11-08):

    Scenario: cancel an unshipped paid order
     1. [Customer] Opens the order and chooses Cancel, giving a reason  (screen: OrderPage)
     2. [Browser] Calls the cancel endpoint
     6. [Browser] Shows the order as cancelled; a refund notice
    Scenario: a shipped order
     3. [orders] Has the order shipped? yes
     4. [Browser] Shows 'already shipped' with the carrier link; nothing changes
```

One scenario per path the person can see; the system-only steps are the
backend story's.
