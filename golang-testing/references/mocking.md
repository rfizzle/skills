# Test Doubles and Fixtures

## Contents

- [Consumer interfaces](#consumer-interfaces)
- [Function-field fakes](#function-field-fakes)
- [Stateful fakes](#stateful-fakes)
- [Fixtures](#fixtures)
- [Time](#time)

## Consumer interfaces

Mock the behavior consumed by the unit, not a concrete implementation. Define the port
next to its consumer. Only small vocabulary interfaces (the `io.Reader` kind) are shared,
and those are tested with a conformance suite rather than mocked per consumer.

```go
type orderGetter interface {
    GetByID(context.Context, string) (*domain.Order, error)
}
```

## Function-field fakes

Small hand-written fakes stay type-safe and require no framework:

```go
type fakeOrderGetter struct {
    getByID func(context.Context, string) (*domain.Order, error)
}

func (f fakeOrderGetter) GetByID(
    ctx context.Context,
    id string,
) (*domain.Order, error) {
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
