# Migration recipes

Each numbered step below is a separate release unless marked otherwise. Old
and new binaries must both run against the schema at every step.

## Rename a column `a` to `b`

1. Migration: add `b` (nullable). Code: write both `a` and `b`, read `a`.
2. Backfill `b` from `a` in bounded batches (`UPDATE ... WHERE id IN (SELECT
   id ... WHERE b IS NULL LIMIT 5000)`) until none remain.
3. Code: read `b`, still write both.
4. Code: stop writing `a`.
5. Migration: drop `a`. Its down re-adds `a` nullable; data is not restored,
   so the file says so and the owner approves.

## Change a type

Same as a rename: a new column of the new type, dual-write with the
conversion in code, backfill, switch reads, drop. Never `ALTER COLUMN ...
TYPE` on a large table: it rewrites the table under an exclusive lock.

## Add `NOT NULL` to an existing column

1. Code writes the value always; backfill.
2. Migration: `ADD CONSTRAINT x_not_null CHECK (col IS NOT NULL) NOT VALID`.
3. Migration: `VALIDATE CONSTRAINT x_not_null` (no write lock), then
   `ALTER COLUMN col SET NOT NULL` (uses the validated check), then drop the
   check.

## Add an index to a large table

`CREATE INDEX CONCURRENTLY IF NOT EXISTS ...` in a migration the tool runs
outside a transaction (check the tool's per-file directive). Its down is
`DROP INDEX CONCURRENTLY IF EXISTS ...`. A failed concurrent build leaves an
`INVALID` index: drop it and retry.

## Drop a table or column

Stop reading it, then stop writing it, then drop it a release later. The
owner approves the drop before it is written.

## Every migration

- `SET lock_timeout = '5s';` at the top of anything that takes a lock on a
  busy table, so it fails fast instead of queueing every query behind it.
- Test up, down, up against a copy of the current schema in an integration
  test or the repository's migration-walk target.
