---
name: golang-database
description: Use this skill when writing, reviewing, testing or debugging Go code that talks to PostgreSQL through pgx/v5 and pgxpool, including repository methods, fixed or dynamic queries, row scanning, NULL handling, transactions, row locking and job-queue claims, database-to-domain error translation, connection pool setup, pgxmock or integration tests, and schema migrations. Also use it for any migration question: adding a column or index, renaming or dropping one, changing a type, backfilling, a long-locking change, or "can I edit this migration". Not for package placement (go-project-layout), general test style (golang-testing), or query tuning methodology beyond the basics here (golang-performance).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Go database (PostgreSQL, pgx/v5)

The default store is PostgreSQL through `github.com/jackc/pgx/v5` with
`pgxpool`; a project may name another (SQLite through a pure-Go driver, which
is used through `database/sql`). Use the repository's established query
approach (sqlc, or hand-written SQL scanned with pgx's `CollectRows`). Do not
add a second data-access layer, ORM, query builder or migration system beside
the project's without a decision record. Mechanics below are PostgreSQL
unless labelled.

## Repository rules

1. The repository lives in the owning module (`go-project-layout`) and maps
   rows to `domain` values. Generated rows, `pgtype` values and
   persistence-only fields (hashes, internal flags) never leave it.
2. It depends on a narrow query interface (the methods of `pgx.Tx` and
   `*pgxpool.Pool` it uses, or sqlc's `DBTX`), so one implementation runs on
   the pool, a transaction or pgxmock. It never opens a pool.
3. `context.Context` goes to every query.
4. Every value is a `$N` parameter. Identifiers (sort columns, table names)
   cannot be bound: allowlist them against a fixed map.
5. Explicit column lists. Never `SELECT *`.
6. `pgx.ErrNoRows` becomes the module's documented not-found error; a
   constraint violation the contract names (`23505` unique, `23503` foreign
   key) becomes its documented error via `errors.As(err, &pgErr)`. Every
   other failure is wrapped with `%w` and returned, not logged.
7. Lists are bounded and deterministically ordered (`ORDER BY ..., id`);
   pagination is keyset, matching the API's cursor (`api-contract`).
8. With raw `pgx.Rows`: `defer rows.Close()` and check `rows.Err()`. Prefer
   `pgx.CollectRows` / `CollectExactlyOneRow` with `RowToStructByName`.

See [scanning](references/scanning.md) for NULLs, JSON and dynamic queries.

## Transactions and locking

- A transaction exists only when several statements must commit as one
  invariant. Prefer one `UPDATE ... WHERE ... RETURNING` when it holds the
  invariant alone.
- Run the same repository code against the transaction's query interface; do
  not write transactional twins of methods.
- PostgreSQL: `FOR UPDATE` only for a read-then-write decision on the same row; lock
  several rows in a stable order. `FOR UPDATE SKIP LOCKED` for competing
  queue claimers, in a short claiming transaction.
- Never hold a transaction across network, object-storage or LLM I/O.
- PostgreSQL: retry `40001` / `40P01` only around the whole idempotent transaction, with
  bounded context-aware backoff.

See [transactions](references/transactions.md) for the `WithinTx` shape.

## Pool

The pool is built once in `internal/app` from config, shared by repositories,
migrations and the readiness check, and closed after the HTTP server drains.
PostgreSQL: pgxpool connects lazily: ping within a timeout at startup and register the
ping as the `/readyz` check. Size it from observed concurrency, not guesses.
SQLite: one `*sql.DB`, WAL, a busy timeout, and writes serialized by the
single-writer rule; claims are `UPDATE ... RETURNING`.

## Migrations

The schema is deployed once a migration is applied anywhere shared. Rules:

1. Every change is a new numbered, reversible pair (`NNNNNN_name.up.sql`,
   `.down.sql`, or the tool's equivalent sections) created by the
   repository's `make` target, never by hand-numbering or a bare tool
   command that picks a timestamp.
2. **Never edit an applied migration**, including the baseline. Fix forward
   with a new one.
3. The down path reverses the up path exactly. A change that cannot be
   reversed (data loss) is declared irreversible in the file and approved by
   the owner first.
4. **Expand/contract** for every rename, drop or type change, each step its
   own release so old and new binaries both run against the schema:
   1. expand: add the new column/table (nullable or defaulted);
   2. dual-write: the code writes both;
   3. backfill: in bounded batches, outside the migration if it is large;
   4. switch reads to the new shape;
   5. contract: drop the old shape in a later release.
5. **Destructive or long-locking changes go to the owner before they are
   written** (PostgreSQL locks): a drop, a type rewrite, a `NOT NULL` or unique constraint on a
   large table, a non-concurrent index on a hot table. State the lock taken,
   the row count, the rollout and the rollback. Use `CREATE INDEX
   CONCURRENTLY` (outside a transaction), `ADD CONSTRAINT ... NOT VALID`
   then `VALIDATE`, and `SET lock_timeout` in the migration.
6. No secrets or environment-specific data in a migration.
7. `migrate up` on a schema already ahead of the binary exits 0, so the
   restart after a rollback (`deploy`) succeeds.
8. The schema change is its own story and its own commit, landing first; the
   owner reviews the up and down SQL (schema gate).

See [migrations](references/migrations.md) for the expand/contract recipes.

## Tests

| Behaviour | Tool |
|---|---|
| Row-to-domain mapping, identifier allowlists | plain unit test |
| PostgreSQL: query arguments, scan and error branches | pgxmock (`github.com/pashagolub/pgxmock/v4` or the version in `go.mod`) |
| A service that uses a repository | hand-written fake of the consumer's port; never pgxmock under business logic |
| Constraints, locking, `SKIP LOCKED`, commit visibility, migration up and down | real PostgreSQL behind `//go:build integration` |

See [testing](references/testing.md). Run the repository's generation step
first, then its test and integration targets.

## Definition of done

- Every value bound, identifiers allowlisted, columns explicit.
- Not-found and constraint errors match the module's documented contract and
  each has a test.
- The transaction scope holds the invariant without extra locking.
- Migrations: new pair, down tested, applied ones untouched,
  expand/contract followed, owner approval recorded for anything destructive.
- `make generate`, the unit and integration test targets and `make lint`
  pass.
