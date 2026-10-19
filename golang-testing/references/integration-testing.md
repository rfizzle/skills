# Integration Testing

## Contents

- [Scope](#scope)
- [Build tag](#build-tag)
- [Infrastructure](#infrastructure)
- [Isolation](#isolation)
- [Verification](#verification)

## Scope

Use integration tests for behavior a fake cannot prove: PostgreSQL constraints and locks,
migrations, pgx scanning, S3-compatible semantics, generated HTTP wiring, and interactions
between real adapters.

## Build tag

Place the integration constraint before the package declaration:

```go
//go:build integration

package sessions
```

Do not use `testing.Short()` as the primary separation mechanism; tagged files should not
enter ordinary unit-test compilation.

## Infrastructure

Use the repository's containerized test infrastructure (a harness backed by a container
runtime) and its integration-test target. Do not create a second per-package
container stack unless the project deliberately adopts that pattern.

Run the repository's generation step, then its integration-test target.

Use environment-provided test DSNs and credentials. Never point tests at production or a
shared environment containing valuable data.

## Isolation

- Generate unique IDs for each test.
- Clean owned rows/objects with `t.Cleanup`.
- Do not assume test order.
- Use transactions only when rollback matches the behavior under test; transaction-based
  isolation cannot test commit visibility or some locking behavior.
- Wait on service health, not arbitrary sleeps.

## Verification

Cover the golden path plus relevant constraints, not-found translation, null/scan behavior,
locking or idempotency, and rollback/recovery. Keep failures explicit about the operation
and test data involved.
