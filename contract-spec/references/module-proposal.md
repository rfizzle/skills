# Module proposal template

Copy to `internal/modules/<module>/<module>.spec.md`. Fill every section;
delete the guidance lines. One page.

````markdown
# `<module>`

> Status: draft

## Purpose

<One paragraph: what this module is for and where it sits.>

Non-goals:
- <What it deliberately does not do, and which module or system does.>

## Contract

```go
// New builds a Store over the given ports.
func New(db querier, clock func() time.Time) *Store

// Claim leases the oldest pending job to owner for d.
func (s *Store) Claim(ctx context.Context, owner string, d time.Duration) (Job, error)
```

## Invariants

- I1: <Testable behaviour, e.g. "A job is leased to at most one owner at a time.">
- I2: <"An expired lease is reclaimable by any owner.">

## Errors

| Error | Returned when | Retry? |
|---|---|---|
| `ErrNoJob` | nothing is claimable | yes, after a poll interval |
| wrapped database error | any other failure | the caller decides |

## Collaborators

```go
// querier is the subset of pgx used; satisfied by the pool or a transaction.
type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}
```

## Test scenarios

- unit: I1 with two concurrent claimers on a fake.
- integration: I1 with two connections and `SKIP LOCKED`.
- integration: I2 after the lease expires.
- unit: `ErrNoJob` on an empty queue.

## Open questions

- <Question, options, the one you recommend.>
````

On approval the header becomes `Status: approved · Approved: YYYY-MM-DD by
<owner>`, and Open questions is replaced by:

```markdown
## Decisions

- YYYY-MM-DD: <the answer, in one line>.
```

After the build the file is cut to the header, Purpose and Non-goals.
