# The hand-over

```text
Order cancellation: a customer cancels an unshipped order from the order
page and sees it cancelled at once. If they had paid, a refund is issued
in the background and they are emailed when it lands. A shipped order
cannot be cancelled here; the page says so and links the carrier.

[SEQUENCE]
 1. + [Customer] Opens the order and chooses Cancel, optionally giving a reason  (screen: OrderPage)
 2. + [Browser] Calls the cancel endpoint with the reason  (endpoint: cancelOrder)
 3. + ? [orders] Has the order shipped?
    ├── yes → 4
    └── no → 5
 4. + [] [Browser] Shows 'already shipped' with the carrier link; nothing changes
 5. + [orders] In one transaction: status CANCELLED, cancelledAt and reason set, and a refund job enqueued if payment was captured
    ├── payment captured [refund job] → 7
    └── fails: the transaction fails → nothing changes; the browser shows a retry
 6. + [] [Browser] Shows the order as cancelled; a refund notice when one is due
 7. + ~> [payments] Claims the refund job with a lease; refunds with the order id as idempotency key
    └── fails: the lease expires mid-call → another worker claims it; the second call is a no-op at the provider
 8. + >> [Payment provider] Accepts the refund and returns a reference
    ├── fails: provider down or retryable → retries with backoff for 24 hours, then dead and alerts
    └── fails: provider refuses → dead with the reason; support alerted; the order keeps CANCELLED
 9. + [] [orders] Records the refund reference and emails the customer

[GUARANTEES]
+ G1: a cancelled paid order produces at least one refund attempt (step 5)
+ G2: the provider refunds at most once per order (steps 7, 8)
+ G3: a shipped order is never cancelled here (steps 3, 5)

The map: <link, or .agents/flows/order-cancellation.html>. The States tab
has the order and refund-job transitions.

Decisions:
1. How long does a refund retry before it goes dead? A: 24 hours, then
   support is alerted. B: 72 hours, fewer alerts, a customer waits longer.
   I recommend A: a provider outage longer than a day is an incident anyway.
2. Who emails the customer? A: orders, when the refund reference lands.
   B: payments, when the provider confirms. I recommend A: one place
   speaks to the customer about their order.

Accept, or what is off?
```

The paragraph is the person's experience and the system's promise, no
module names. The sequence is `render.mjs --ascii`, with the `[STATES]`
block cut when it runs long (the page has it). Every decision has options
and a recommendation rooted in how the product is used.

## Where to look

As in `api-topology`: the page hosted by the harness when it can host one,
republished to the same link on every revision; otherwise the rendered
file's absolute path; never a screenshot.

## A revision

The owner: "Accept, but the customer must be able to cancel from the
order list too, not only the order page."

Step 1 gains a second `screen` reference or a sibling step on the Customer
lane (`Chooses Cancel on the order list row`) that leads to the same step
2. Re-render to the same path, hand over again with the changed steps and
"Changed since last time: cancel also starts from the list row."

## From the map to the flow document

On acceptance the agent writes `docs/flows/<name>.flow.md` from the map
as `contract-spec` lays it out: Capability and success from the model's
header, Participants from the lanes, Sequence from the steps, State
transitions from the states, Guarantees from the guarantees, Failure and
recovery from the `fails` entries. The header carries `Status: approved ·
Approved: YYYY-MM-DD by <owner>` and a Decisions line per decision above.
The map is deleted or kept as a snapshot; the document is the record.
