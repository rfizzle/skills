---
name: go-background-jobs
description: Use this skill when a Go service must do work outside the request that caused it, or on a schedule - background jobs, a task or work queue, retries, sending an email or webhook after a write, a nightly, hourly or periodic task, a delayed reminder, a cleanup or prune, a dead-letter queue, replaying failed work, the outbox pattern, at-least-once delivery, idempotent handlers, job metrics and alerts - and whenever someone proposes River, asynq, Redis, a message broker, a cron library or a time.Ticker in main. Also covers outbound integrations - signed webhooks sent and received, an email provider with a dev sink, presigned object-storage uploads. Jobs live in the project's own PostgreSQL or SQLite database by default. Not for a locking query on its own (golang-database), goroutine and errgroup basics (golang-concurrency), the cross-module guarantee document (contract-spec), or the health, shutdown and runbook baseline (service-operations).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Background jobs

Work that must happen after a request, or at a time rather than on a
request, needs a home that survives a deploy and runs once across replicas.
With no default, an agent adds River, asynq or Redis on one change and a
`time.Ticker` in `main` on the next. The ticker runs on every replica, drops
its work on each deploy, and leaves nothing to inspect or replay. The
default is a jobs table in the service's own database, written in the same
transaction as the business change, claimed under a lease by a worker in
the same binary. A project's `AGENTS.md` or a decision record may override
it.

## Where it lives

| Piece | Home |
|---|---|
| `jobs` and `job_schedules` tables | a migration (golang-database) |
| Store, worker, scheduler, `Enqueue` | `internal/platform/jobs/` |
| A kind's handler and payload type | the module that owns the work |
| Registering kinds and schedules, start and stop | `internal/app` |
| Webhook, email, object-storage adapters | `internal/platform/<capability>/`, behind consumer ports |

A kind is a stable string `<module>.<action>` (`orders.send_confirmation`),
a constant beside its payload type. Renaming a kind or changing its payload
incompatibly makes a new kind; the old one stays registered until its rows
drain.

## The jobs table

`id`, `kind`, `payload` (JSON, at most 64 KiB), `state` (`queued`,
`running`, `done`, `dead`), `run_at`, `attempts`, `max_attempts`,
`leased_by`, `leased_until`, `last_error`, `created_at`, `finished_at`, with
partial indexes for the claim, the reaper and pruning. SQLite keeps the
shape, stores times as UTC unix milliseconds and claims with a plain
`UPDATE ... RETURNING`: its single writer already serialises claims. DDL and
every statement: [schema.md](references/schema.md).

## Claim, lease, finish

1. Claim in one statement, golang-database's queue claim:
   `UPDATE jobs SET state = 'running', attempts = attempts + 1, leased_until
   = now() + lease WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED LIMIT n)
   RETURNING ...`. It commits before any handler starts.
2. Claim only the kinds this binary registered, so an older replica in a
   rolling deploy leaves a new kind queued instead of failing it.
3. The lease is short (30 s) and renewed every third of its length while
   the handler runs. A renewal that matches no row means another worker
   reclaimed the job: cancel the handler.
4. Fence every later write (renew, complete, fail, release) on `id`,
   `state = 'running'` and the `attempts` value the claim returned. The same
   process can reclaim its own expired job, so a worker id does not fence.
5. A reaper on each poll returns `running` rows with an expired lease to
   `queued`, or to `dead` when attempts are spent, and counts them.

## The worker

- One `Worker.Run(ctx)` per process, started by the composition root.
  `errgroup.SetLimit(n)` bounds concurrent handlers; each claim asks for the
  free slots only, so no claimed job waits in memory with its lease running.
- It polls every few seconds with ±50% jitter, so replicas do not claim in
  step. PostgreSQL's fast path: `Enqueue` also calls `pg_notify` in the
  same transaction (delivered at commit) and one connection `LISTEN`s and
  wakes the loop. The notification is a hint, the poll is the guarantee.
- Shutdown, inside service-operations' sequence after the HTTP server
  drains: stop claiming; give running handlers a bounded drain that fits
  the rest of the grace period; then cancel them and release their leases
  with the attempt given back. Outcome writes use `context.WithoutCancel`
  plus a short timeout, so they land after cancellation.

Code for the loop, registry, enqueue and listener:
[worker.md](references/worker.md).

## Handlers

- Registered by kind in `internal/app` with a typed payload and a timeout:
  `jobs.Handle(reg, orders.KindSendConfirmation, 30*time.Second,
  ordersSvc.SendConfirmation)`. A payload that fails to decode or
  `Validate` is dead at once: a retry reads the same bytes.
- Idempotent by design: a job runs at least once and sometimes twice (a
  crash after the side effect, before `done`). Check the module's own state
  first, write under a unique key, or hand the job id to the provider as
  its idempotency key (api-contract). The doc comment says which.
- Payloads carry ids and the values that must reflect the moment of the
  write; never secrets or large content (store it, carry the key).
- Classify errors where the handler knows the cause: `jobs.Permanent(err)`
  when no retry can succeed (invalid input, a 4xx other than 408 and 429,
  the target is gone); `jobs.RetryAfter(err, d)` when the remote says when.
  Any other error, a timeout or a recovered panic retries.

## Retry and dead jobs

- Backoff from 10 s, doubling, capped at 1 h, with equal jitter (half
  fixed, half random). `max_attempts` defaults to 10, about an hour of
  tries; then `dead` with `last_error`.
- The `jobs_dead` view lists dead rows; the binary's `jobs dead`,
  `jobs replay` and `jobs discard` commands act on them once the cause is
  fixed. Dead rows are never deleted automatically.
- Done rows are pruned in batches by a scheduled job after a stated
  retention (7 days); `jobs` is a queue, not a history.

## Scheduled work

A periodic task is a `job_schedules` row (`name`, `kind`, `payload`, `cron`
or `every_seconds`, `next_run_at`, `locked_until`), declared in
`internal/app` and upserted at startup. On each poll a worker claims due
rows with the same `UPDATE ... SKIP LOCKED ... RETURNING`, setting
`locked_until`; then one transaction enqueues the slot's job and advances
`next_run_at`, fenced on that `locked_until`. Every replica runs the
scheduler and each slot runs once.

- Never a ticker in `main` or a cron library's runner: both fire on every
  replica and forget what they missed. A cron expression needs only "next
  time after t" (a small tested five-field parser); schedules are UTC and
  the next slot comes from the database clock (`RETURNING now()`).
- After downtime, one catch-up run, then back on the grid. The payload
  carries `scheduledFor`; work that must cover every missed period keeps
  its own watermark.

## Outbox: side effects commit with the write

A side effect a module emits (an email, a webhook, a domain event another
module consumes) is a job row written in the same transaction as the
business write. It becomes visible when the write commits and is lost only
if the write is. This is how a module sends email atomically; it never
calls a mail client inside a request or a transaction.

```go
return s.repo.WithinTx(ctx, func(r *Repository) error {
	if err := r.Insert(ctx, order); err != nil {
		return err
	}
	// Enqueue runs jobs.Enqueue on the repository's query interface: the transaction.
	return r.Enqueue(ctx, KindSendConfirmation, ConfirmationPayload{OrderID: order.ID})
})
```

A hand-off between modules this way is a flow (contract-spec). A broker
(Valkey, NATS) needs a decision record and a measured reason; the outbox
stays in front of it ([operations.md](references/operations.md#when-a-broker-earns-a-decision-record)).

## Metrics and alerts

Per kind: `jobs_started_total`, `jobs_finished_total{outcome}`,
`job_duration_seconds`, `jobs_lease_expired_total`; from one query on
scrape, `jobs_depth{state}` and `jobs_oldest_ready_age_seconds`, the queue
depth and age service-operations asks for. Age counts from `run_at`, so a
delayed retry is not late. Alerts `JobsBacklogAge` (page) and `JobsDead`
(ticket), each with its runbook page. Rules, page content and the commands:
[operations.md](references/operations.md).

## Tests

Each handler gets a table mapping every downstream answer to done, retry or
dead, with a fake clock. Integration tests on the real database prove two
workers claim disjoint jobs, an expired lease is reclaimed with the crashed
worker's late write fenced off, and a rolled-back write leaves no job
([testing.md](references/testing.md)).

## Gotchas

- Doing the work inside the claiming transaction: row locks and a pooled
  connection held for the whole job, and a crash rolls back the attempt
  count, so a poison job never reaches `dead`. Claim, commit, then work.
- A claim subquery without `FOR UPDATE SKIP LOCKED` beside its `LIMIT`:
  two workers pick the same ids and both updates succeed. Plain
  `FOR UPDATE` makes them queue behind each other instead.
- Unbounded payloads: table bloat and slow claims. `Enqueue` refuses over
  64 KiB; `pg_notify` carries only the kind (its limit is 8000 bytes).
- `time.Now()` on the app host for schedules or `run_at`: replica clocks
  differ, so slots drift or fire early. PostgreSQL uses `now()` in SQL;
  SQLite runs in the process, where the app clock is the database clock.
- SQLite has one writer: without WAL and a busy timeout, claims fail with
  `SQLITE_BUSY`. Keep the claim one statement and use `BEGIN IMMEDIATE`
  for the schedule transaction.
- Proof someone will ask for ("was the invoice emailed?") lives in the
  module's own table, not in a done row that pruning removes.
- The `LISTEN` connection is held for good: size the pool one higher.

## Definition of done

- Work outside a request goes through `jobs.Enqueue`, in the business
  transaction when it is a side effect of a write; no goroutine, ticker or
  cron runner started for it in `main` or a handler.
- Each kind has a typed payload, a timeout, an idempotency note in the
  handler's doc comment and a classification test.
- The claim, lease-reclaim and rollback integration tests pass.
- The metrics and both alerts exist, each alert links to its runbook, and
  `jobs dead` and `jobs replay` work.
- Shutdown stops claiming, drains within its bound and releases the rest.

## References

- [schema.md](references/schema.md): open when writing the migration or
  any jobs or schedules SQL, for either dialect.
- [worker.md](references/worker.md): open when writing the worker, the
  registry, `Enqueue`, the listener, the next-run function or the wiring.
- [operations.md](references/operations.md): open for metrics, alerts,
  runbook pages, the `jobs` commands, retention, or a broker proposal.
- [outbound.md](references/outbound.md): open when sending or receiving
  webhooks, sending email, or accepting file uploads.
- [testing.md](references/testing.md): open when writing a handler test or
  the queue's integration tests.
