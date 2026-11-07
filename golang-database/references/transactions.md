# Transactions

A repository that owns a multi-statement invariant exposes `WithinTx`, which
runs a callback on a copy bound to one `pgx.Tx`.

```go
func (r *Repository) WithinTx(ctx context.Context, fn func(*Repository) error) (err error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if rbErr := tx.Rollback(ctx); rbErr != nil && !errors.Is(rbErr, pgx.ErrTxClosed) {
			err = errors.Join(err, fmt.Errorf("rollback tx: %w", rbErr))
		}
	}()
	if err = fn(&Repository{pool: r.pool, db: tx}); err != nil {
		return err
	}
	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	return nil
}
```

- The callback never calls `Commit` or `Rollback`, never keeps the scoped
  copy, and never nests another `WithinTx`.
- With sqlc, the scoped copy also carries `r.queries.WithTx(tx)`.
- A transaction spanning two modules is a flow concern: the orchestrating
  service owns it through a port, and the flow spec states the guarantee
  (`contract-spec`).
- The default isolation is READ COMMITTED. A stronger level is a contract
  change stated in the module's doc comment, with the retry rule from
  SKILL.md.

## Queue claim

```sql
UPDATE jobs
SET state = 'running', attempts = attempts + 1,
    leased_by = $1, leased_until = now() + make_interval(secs => $2)
WHERE id IN (
  SELECT id FROM jobs
  WHERE state = 'queued' AND run_at <= now()
  ORDER BY run_at, id
  LIMIT $3
  FOR UPDATE SKIP LOCKED
)
RETURNING id, kind, payload, attempts;
```

Commit the claim, then do the work, then record the outcome in a second
short statement fenced by `id`, `state = 'running'` and the returned
`attempts`. The full queue (leases, retries, schedules):
`go-background-jobs`.
