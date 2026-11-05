# Data handling

## string, []byte, []rune

| Type | Default for | Use when |
|---|---|---|
| `string` | everything | immutable values, map keys, display |
| `[]byte` | I/O | writing to an `io.Writer`, building output, mutation |
| `[]rune` | Unicode work | an index or length must count characters, not bytes |

Each conversion allocates. Stay in one type until you need the other, and
build strings in a loop with `strings.Builder` or `bytes.Buffer`.

## Iterators for large result sets

Return an `iter.Seq2[T, error]` instead of a slice when a caller may read
more rows than fit comfortably in memory. The iterator owns the rows and
closes them however the caller's loop ends:

```go
func (s *Store) Users(ctx context.Context) iter.Seq2[User, error] {
	return func(yield func(User, error) bool) {
		rows, err := s.db.Query(ctx, `SELECT id, name, email FROM users ORDER BY id`)
		if err != nil {
			yield(User{}, fmt.Errorf("query users: %w", err))
			return
		}
		defer rows.Close()
		for rows.Next() {
			var u User
			if err := rows.Scan(&u.ID, &u.Name, &u.Email); err != nil {
				yield(User{}, fmt.Errorf("scan user: %w", err))
				return
			}
			if !yield(u, nil) {
				return
			}
		}
		if err := rows.Err(); err != nil {
			yield(User{}, fmt.Errorf("iterate users: %w", err))
		}
	}
}
```

Query shape, pagination and transactions are `golang-database`.

## Streaming a large response

Encode each item as it arrives so memory stays constant. Once the first
byte is written the status is sent, so a mid-stream failure can only end the
response; record it and stop:

```go
enc := json.NewEncoder(w)
for u, err := range h.users.Users(r.Context()) {
	if err != nil {
		h.log.ErrorContext(r.Context(), "stream users", "err", err)
		return
	}
	if err := enc.Encode(u); err != nil {
		return // client went away
	}
}
```

Prefer newline-delimited JSON for streams; a JSON array needs hand-written
brackets and commas around the encoder.
