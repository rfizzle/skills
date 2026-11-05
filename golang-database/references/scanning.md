# Scanning and query shapes

## Fixed queries

With sqlc: edit the query source, `make generate`, call the generated method,
map the row with the module's `fromRow` function. Without it: a `const`
query and pgx's collectors.

```go
type orderRow struct {
	ID        string     `db:"id"`
	Total     int64      `db:"total_cents"`
	ShippedAt *time.Time `db:"shipped_at"`
}

func (r *Repository) Get(ctx context.Context, id string) (domain.Order, error) {
	const q = `SELECT id, total_cents, shipped_at FROM orders WHERE id = $1`
	rows, _ := r.db.Query(ctx, q, id) // error surfaces through CollectExactlyOneRow
	row, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByName[orderRow])
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Order{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Order{}, fmt.Errorf("get order %s: %w", id, err)
	}
	return row.toDomain(), nil
}
```

`pgx.CollectRows` returns an empty non-nil slice when nothing matches;
return that, not `nil`, if the API distinguishes them.

## Dynamic queries

Only when the statement's shape varies at runtime (optional filters). Build
the `WHERE` from a slice of clauses and a slice of args, numbering `$N` from
`len(args)+1`; or use the repository's one query builder with the
PostgreSQL placeholder format. Sort and filter columns come from a fixed
`map[string]string` of API name to column; an unknown key is a validation
error, never interpolated.

## NULL and JSON

- A pointer when the application distinguishes NULL from zero; otherwise
  `COALESCE` in SQL and a value type.
- `pgtype.*` only when its status semantics are needed, and never past the
  repository.
- `jsonb` scans into a struct or `json.RawMessage`. `db` tags are for
  scanning, `json` tags for transport; do not reuse one struct for both.
- Timestamps are `timestamptz`, handled as UTC `time.Time`.
