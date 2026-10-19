# Error Wrapping and Inspection

## Error Wrapping with `%w`

Add context when crossing a meaningful package/operation boundary; do
not add redundant wrappers at every call frame.

```go
// ✓ Good — wraps with context, preserves the chain
func (s *UserService) GetUser(ctx context.Context, id uuid.UUID) (*User, error) {
    user, err := s.repo.FindByID(ctx, id)
    if err != nil {
        return nil, fmt.Errorf("users.GetUser: %w", err)
    }
    return user, nil
}
```

### Package and transport boundaries

Do not use `%v` merely to conceal a cause; that destroys programmatic inspection. A
package translates known infrastructure outcomes to its documented stable domain error.
The HTTP/controller boundary maps that stable error to a response and never serializes
the internal error string.

```go
func (r *Repository) Get(ctx context.Context, id uuid.UUID) (*User, error) {
    var user User
    if err := database.ScanOne(ctx, r.db, &user, query, id); err != nil {
        if errors.Is(err, database.ErrNotFound) {
            return nil, domain.ErrNotFound
        }
        return nil, fmt.Errorf("users.Repository.Get: %w", err)
    }
    return &user, nil
}
```

## Inspecting Errors: `errors.Is` and `errors.As`

### Prefer `errors.AsType` on Go 1.26+

```go
// Go 1.26+: same chain traversal as errors.As, without the pre-declared variable
if ve, ok := errors.AsType[*ValidationError](err); ok {
    log.Printf("validation failed on field %s: %s", ve.Field, ve.Msg)
}
```

## Combining Errors with `errors.Join`

### Use case: validating multiple fields

```go
func validateUser(u User) error {
    var errs []error

    if u.Name == "" {
        errs = append(errs, errors.New("name is required"))
    }
    if u.Email == "" {
        errs = append(errs, errors.New("email is required"))
    }

    return errors.Join(errs...) // returns nil if errs is empty
}
```

### Use case: parallel operations with independent failures

```go
func closeAll(closers ...io.Closer) error {
    var errs []error
    for _, c := range closers {
        if err := c.Close(); err != nil {
            errs = append(errs, err)
        }
    }
    return errors.Join(errs...)
}
```
