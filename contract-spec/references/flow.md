# Flow template

Copy to `docs/flows/<name>.flow.md`. Fill every section; delete the guidance
lines. Aim for one page; a flow that needs three is several flows.

```markdown
# <Name> flow

> Status: draft

## Capability

<One paragraph: what the system does end to end and why.>

Success criterion: <what is true when it worked, e.g. "every completed
order produces exactly one shipment request in the warehouse system">.

## Participants

- `orders`: records the completed order and enqueues fulfilment.
- `fulfilment`: claims the job and calls the warehouse.
- `warehouse` (external): accepts the shipment request.

## Sequence

1. `orders` commits the order and a fulfilment job in one transaction.
2. `fulfilment` claims the job with a lease (asynchronous, durable queue).
3. `fulfilment` sends the request with the order id as idempotency key.
4. `fulfilment` records the warehouse reference and completes the job.

## State transitions

| State | Next | Owner | Stored in |
|---|---|---|---|
| pending | leased | `fulfilment` | jobs table |
| leased | done, or pending on lease expiry | `fulfilment` | jobs table |

## Guarantees

- G1: A completed order produces at least one fulfilment attempt.
- G2: The warehouse sees at most one shipment per order (the order id is the
  idempotency key).

## Failure and recovery

| Step | Failure | Left behind | Recovery |
|---|---|---|---|
| 2 | worker crash | leased job | lease expires; another worker claims it |
| 3 | warehouse 5xx | leased job | bounded retry, then pending again |

## Test scenarios

- Golden path: order to warehouse reference.
- G2: the job is redelivered after step 3 succeeds; one shipment exists.
- Recovery: worker killed mid-step 3; the job completes after lease expiry.
- Fakes: the warehouse client port.

## Open questions

- <Question, options, the one you recommend.>
```

On approval the header becomes `Status: approved · Approved: YYYY-MM-DD by
<owner>` and Open questions becomes:

```markdown
## Decisions

- YYYY-MM-DD: <the answer, in one line>.
```
