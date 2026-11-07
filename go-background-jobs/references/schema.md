# Schema and statements

## Contents

- [PostgreSQL tables](#postgresql-tables)
- [SQLite tables](#sqlite-tables)
- [Enqueue](#enqueue)
- [Claim](#claim)
- [Renew, finish, release](#renew-finish-release)
- [Reap expired leases](#reap-expired-leases)
- [Schedules](#schedules)
- [Dead jobs, replay, pruning](#dead-jobs-replay-pruning)

Every statement below is one round trip and its own transaction unless it
says otherwise. `$2` style is PostgreSQL; `?1` style is SQLite.

## PostgreSQL tables

```sql
CREATE TABLE jobs (
  id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind          text        NOT NULL,
  payload       jsonb       NOT NULL CHECK (octet_length(payload::text) <= 65536),
  state         text        NOT NULL DEFAULT 'queued'
                            CHECK (state IN ('queued', 'running', 'done', 'dead')),
  run_at        timestamptz NOT NULL DEFAULT now(),
  attempts      integer     NOT NULL DEFAULT 0,
  max_attempts  integer     NOT NULL DEFAULT 10 CHECK (max_attempts > 0),
  leased_by     text,
  leased_until  timestamptz,
  last_error    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);

-- The claim: ready rows in run order. Partial, so done rows cost nothing.
CREATE INDEX jobs_ready_idx    ON jobs (run_at, id)     WHERE state = 'queued';
-- The reaper: running rows by lease end.
CREATE INDEX jobs_leased_idx   ON jobs (leased_until)   WHERE state = 'running';
-- Pruning and the dead view.
CREATE INDEX jobs_finished_idx ON jobs (finished_at)    WHERE state IN ('done', 'dead');

CREATE VIEW jobs_dead AS
SELECT id, kind, attempts, max_attempts, last_error, created_at, finished_at
FROM jobs WHERE state = 'dead';

CREATE TABLE job_schedules (
  name          text        PRIMARY KEY,          -- stable, e.g. 'billing.close_day'
  kind          text        NOT NULL,
  payload       jsonb       NOT NULL DEFAULT '{}',
  cron          text,                             -- five fields, evaluated in UTC
  every_seconds integer     CHECK (every_seconds > 0),
  next_run_at   timestamptz NOT NULL,
  locked_until  timestamptz,
  CHECK ((cron IS NULL) <> (every_seconds IS NULL))
);
CREATE INDEX job_schedules_due_idx ON job_schedules (next_run_at);
```

The jobs table churns: every job is an insert and three or four updates. On
a busy service, lower its autovacuum threshold in the same migration
(`ALTER TABLE jobs SET (autovacuum_vacuum_scale_factor = 0.02)`).

## SQLite tables

Same columns and states. The differences:

| PostgreSQL | SQLite | Why |
|---|---|---|
| `bigint GENERATED ... IDENTITY` | `INTEGER PRIMARY KEY` | rowid alias |
| `jsonb` with a size check | `TEXT CHECK (json_valid(payload) AND length(payload) <= 65536)` | no JSON type |
| `timestamptz`, `now()` in SQL | `INTEGER` UTC unix milliseconds, passed in | the database runs in the process, so the app clock is the database clock |
| `FOR UPDATE SKIP LOCKED` | nothing | one writer at a time already serialises claims |
| `kind = ANY($3)` | `kind IN (SELECT value FROM json_each(?5))` | no arrays; pass a JSON array |
| `pg_notify` / `LISTEN` | nothing | poll only; a single process can also signal its own worker in memory after commit |

Declare the tables `STRICT`. Partial indexes work as above. The DSN sets WAL
and a busy timeout (`modernc.org/sqlite`:
`?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)`), per
golang-database.

## Enqueue

Run on the caller's query interface, which is the business transaction for
an outbox write.

```sql
INSERT INTO jobs (kind, payload, run_at, max_attempts)
VALUES ($1, $2, now() + make_interval(secs => $3), $4);

SELECT pg_notify('jobs', $1);  -- delivered at commit, dropped on rollback
```

`now()` is the transaction's start time, so a job enqueued late in a long
transaction is already due when it commits. That is harmless.

## Claim

PostgreSQL, one statement:

```sql
UPDATE jobs
SET state = 'running', attempts = attempts + 1,
    leased_by = $1, leased_until = now() + make_interval(secs => $2)
WHERE id IN (
  SELECT id FROM jobs
  WHERE state = 'queued' AND run_at <= now() AND kind = ANY($3)
  ORDER BY run_at, id
  LIMIT $4
  FOR UPDATE SKIP LOCKED
)
RETURNING id, kind, payload, attempts, max_attempts;
```

The locking clause belongs in the subquery beside `LIMIT`. Without it two
workers select the same ids and both updates succeed.

SQLite:

```sql
UPDATE jobs
SET state = 'running', attempts = attempts + 1,
    leased_by = ?1, leased_until = ?2 + ?3
WHERE id IN (
  SELECT id FROM jobs
  WHERE state = 'queued' AND run_at <= ?2
    AND kind IN (SELECT value FROM json_each(?5))
  ORDER BY run_at, id
  LIMIT ?4
)
RETURNING id, kind, payload, attempts, max_attempts;
```

`?2` is now and `?3` the lease, both in milliseconds. Keep it one statement:
a deferred `BEGIN` that reads and then writes can fail with `SQLITE_BUSY`
without waiting on the busy timeout.

## Renew, finish, release

Each is fenced by `id`, `state = 'running'` and the attempt number the claim
returned (`$2`). Zero rows affected means the lease was lost: the caller
stops and records nothing.

```sql
-- renew
UPDATE jobs SET leased_until = now() + make_interval(secs => $3)
WHERE id = $1 AND attempts = $2 AND state = 'running';

-- complete
UPDATE jobs
SET state = 'done', finished_at = now(), last_error = NULL,
    leased_by = NULL, leased_until = NULL
WHERE id = $1 AND attempts = $2 AND state = 'running';

-- fail: $3 is 'queued' (retry) or 'dead', decided in Go; $4 the backoff in seconds
UPDATE jobs
SET state = $3, run_at = now() + make_interval(secs => $4),
    last_error = left($5, 2000),
    finished_at = CASE WHEN $3 = 'dead' THEN now() END,
    leased_by = NULL, leased_until = NULL
WHERE id = $1 AND attempts = $2 AND state = 'running';

-- release on shutdown: not a failure, so the attempt is given back
UPDATE jobs
SET state = 'queued', attempts = attempts - 1, run_at = now(),
    leased_by = NULL, leased_until = NULL
WHERE id = $1 AND attempts = $2 AND state = 'running';
```

## Reap expired leases

Run on every poll by every worker; it is idempotent and served by
`jobs_leased_idx`. The returned kinds feed `jobs_lease_expired_total`.

```sql
UPDATE jobs
SET state       = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'queued' END,
    finished_at = CASE WHEN attempts >= max_attempts THEN now() END,
    run_at = now(), last_error = 'lease expired',
    leased_by = NULL, leased_until = NULL
WHERE state = 'running' AND leased_until < now()
RETURNING kind;
```

The attempt was counted at claim time, so a job that crashes its worker
every time reaches `dead` instead of looping.

## Schedules

Claim due schedules like jobs, then advance each in its own short
transaction.

```sql
UPDATE job_schedules
SET locked_until = now() + interval '1 minute'
WHERE name IN (
  SELECT name FROM job_schedules
  WHERE next_run_at <= now() AND (locked_until IS NULL OR locked_until < now())
  ORDER BY next_run_at
  LIMIT 10
  FOR UPDATE SKIP LOCKED
)
RETURNING name, kind, payload, cron, every_seconds, next_run_at, locked_until,
          now() AS db_now;
```

Then, per row, in one transaction (`BEGIN IMMEDIATE` on SQLite):

```sql
INSERT INTO jobs (kind, payload, run_at)
VALUES ($1, $2::jsonb || jsonb_build_object('scheduledFor', $3::timestamptz), $3);

UPDATE job_schedules SET next_run_at = $4, locked_until = NULL
WHERE name = $5 AND locked_until = $6;   -- zero rows: roll back, another worker owns it
```

`$3` is the slot (`next_run_at`); `$4` comes from the Go next-run function
given `db_now` (see [worker.md](worker.md#schedules)). SQLite builds the
payload with `json_set(?2, '$.scheduledFor', ?3)`.

Schedules are declared in code and upserted at startup:

```sql
INSERT INTO job_schedules (name, kind, payload, cron, every_seconds, next_run_at)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (name) DO UPDATE
SET kind = excluded.kind, payload = excluded.payload,
    cron = excluded.cron, every_seconds = excluded.every_seconds;
```

The upsert keeps `next_run_at`, so a deploy does not reset the cadence. A
schedule dropped from code is deleted by a migration in the release after.

## Dead jobs, replay, pruning

```sql
-- the dead-letter list
SELECT id, kind, attempts, last_error, finished_at FROM jobs_dead
WHERE ($1::text IS NULL OR kind = $1) ORDER BY finished_at DESC LIMIT 100;

-- replay chosen dead jobs once the cause is fixed
UPDATE jobs
SET state = 'queued', attempts = 0, run_at = now(), finished_at = NULL
WHERE state = 'dead' AND id = ANY($1)
RETURNING id;

-- prune done rows past retention, in batches, from a scheduled job
DELETE FROM jobs WHERE id IN (
  SELECT id FROM jobs
  WHERE state = 'done' AND finished_at < now() - make_interval(days => $1)
  LIMIT 5000
);
```

Replay keeps `last_error` until the next attempt overwrites it. Dead rows
are never pruned automatically; the operator replays or discards them, and
`JobsDead` keeps firing until they do.
