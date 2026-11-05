# Testing database code

## pgxmock

Against the repository's query interface. Assert arguments, scan results,
`pgx.ErrNoRows` translation, constraint errors and transaction
begin/commit/rollback where the repository owns them. Match SQL with
`regexp.QuoteMeta` or a whitespace-tolerant matcher so reformatting does not
break tests. Always call `mock.ExpectationsWereMet()`.

## Fakes for consumers

A service receives a local port; its test uses a small hand-written fake
(function fields or an in-memory map). Never mock pgx beneath business logic.
If the port has two or more real implementations, write a conformance suite
instead (`go-conformance-suite`).

## Integration

- Files start with `//go:build integration`.
- One disposable PostgreSQL container per test binary, started from
  `TestMain` by the repository's harness; a fresh migrated database (or
  schema) per test, so tests can run in parallel.
- Without a container runtime the harness skips; an environment variable
  the harness documents turns that skip into a failure in CI.
- Cover what a mock cannot prove: constraints and their translation,
  `FOR UPDATE SKIP LOCKED` with two concurrent claimers, commit visibility
  and rollback, `timestamptz`/`jsonb`/array round trips, migration up, down,
  up.
- Never point a test at a shared or production database.
