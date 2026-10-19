# Test Doubles and Fixtures

## Contents

- [Consumer interfaces](#consumer-interfaces)
- [Function-field fakes](#function-field-fakes)
- [Stateful fakes](#stateful-fakes)
- [Fixtures](#fixtures)
- [Time](#time)

## Consumer interfaces

Mock the behavior consumed by the unit, not a concrete implementation. Preserve central
shared domain interfaces where the architecture establishes them; define module-private
ports next to their consumer.

```go
type sessionGetter interface {
    GetByID(context.Context, uuid.UUID) (*domain.Session, error)
}
```

## Function-field fakes

Small hand-written fakes stay type-safe and require no framework:

```go
type fakeSessionGetter struct {
    getByID func(context.Context, uuid.UUID) (*domain.Session, error)
}

func (f fakeSessionGetter) GetByID(
    ctx context.Context,
    id uuid.UUID,
) (*domain.Session, error) {
    return f.getByID(ctx, id)
}
```

Use explicit call counters or captured arguments only when they are observable parts of
the contract.

## Stateful fakes

Use an in-memory fake when several operations share meaningful state. Protect it with a
mutex if tests or production code call it concurrently. Match important semantics such as
not-found behavior and defensive copies; do not accidentally make the fake more permissive
than the real adapter.

## Fixtures

- Prefer fixture constructors that return a fresh value on every call.
- Use fixed IDs and times unless randomness is the behavior under test.
- Keep fixtures beside their consumers; avoid a global grab-bag fixture package.
- Copy slices/maps when mutation by one test could leak into another.

## Time

Prefer, in order:

1. Pass an explicit timestamp to pure logic.
2. Inject a narrow `now func() time.Time` seam.
3. Use stable `testing/synctest` for concurrent timer behavior on Go 1.25+.

Do not add a clock dependency or sleep in tests when one of these approaches suffices.
