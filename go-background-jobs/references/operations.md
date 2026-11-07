# Metrics, alerts, runbooks and commands

## Metrics

Names and labels follow golang-observability; `kind` is the only label
beyond `outcome` and `state`, and kinds are a fixed set from the registry.

| Metric | Type | Labels | Set by |
|---|---|---|---|
| `jobs_started_total` | counter | `kind` | worker, after claim |
| `jobs_finished_total` | counter | `kind`, `outcome` (`done`, `retry`, `dead`, `released`) | worker, after the outcome write |
| `job_duration_seconds` | histogram | `kind` | worker, around the handler |
| `jobs_lease_expired_total` | counter | `kind` | reaper |
| `jobs_depth` | gauge | `kind`, `state` (`queued`, `running`, `dead`) | collector query |
| `jobs_oldest_ready_age_seconds` | gauge | `kind` | collector query |

Failures by kind are `jobs_finished_total{outcome=~"retry|dead"}`.

The two gauges come from one query run by a Prometheus collector on scrape,
with a two-second timeout. Every replica reports the same values; alert on
`max by (kind)`.

```sql
SELECT kind, state, count(*) AS depth,
       COALESCE(EXTRACT(EPOCH FROM now() - min(run_at)
                FILTER (WHERE state = 'queued' AND run_at <= now())), 0) AS oldest_ready_seconds
FROM jobs
WHERE state IN ('queued', 'running', 'dead')
GROUP BY kind, state;
```

Age is measured from `run_at`, not `created_at`: a job delayed for retry or
scheduled for later is not late until it is due.

## Alerts

| Alert | Expression | For | Severity |
|---|---|---|---|
| `JobsBacklogAge` | `max by (kind) (jobs_oldest_ready_age_seconds) > 300` | 5m | page (`critical`) |
| `JobsDead` | `max by (kind) (jobs_depth{state="dead"}) > 0` | 15m | ticket (`warning`) |

The 300-second budget is the default; a kind with a tighter promise (a
password-reset email) gets its own rule with its own threshold. Each alert
carries a `runbook_url` to its page.

## Runbook pages

Two pages from service-operations' template, `docs/runbooks/JobsBacklogAge.md`
and `docs/runbooks/JobsDead.md`. Their substance:

**JobsBacklogAge.** Symptom: emails, webhooks or other side effects arrive
late. Check: `<app> jobs stats` for depth and age by kind; worker logs for
`claim jobs` errors; pool saturation; whether the kind is registered in the
running release (an unregistered kind is never claimed); one handler kind
hogging every slot through long timeouts. Fix: restore the database or the
downstream the handler waits on; raise worker concurrency or replicas; roll
back a release that dropped a handler.

**JobsDead.** Symptom: a side effect never happened. Check:
`<app> jobs dead --kind <kind>` for `last_error`; group by error. Fix the
cause first (a bad payload is a code fix; a downstream outage needs nothing),
then `<app> jobs replay --kind <kind> --since <time>` or by id. A job that
must not run any more: `<app> jobs discard <id>`, which marks it done with
`last_error = 'discarded by operator'`.

## Commands

A `jobs` command group on the service binary (golang-spf13-cobra), using
the same config and pool as the server:

| Command | Does |
|---|---|
| `jobs stats` | depth and oldest ready age by kind and state |
| `jobs dead [--kind K] [--limit N]` | the dead-letter list: id, kind, attempts, `last_error`, `finished_at` |
| `jobs replay <id>...` or `--kind K --since T` | dead to queued, attempts reset; prints the ids requeued |
| `jobs discard <id>...` | dead to done with a discard note; asks for confirmation unless `--yes` |

Replay never touches `running` or `done` rows. Every command logs what it
changed at Info with the operator's ids.

## Retention

- `done`: pruned by the `jobs.prune` schedule after 7 days (the default) in
  batches of 5,000 until none remain.
- `dead`: kept until replayed or discarded; never pruned automatically.
- A fact a person or an audit will ask about later ("was the invoice
  emailed?") is written by the handler into the module's own table. The
  jobs table is a queue, not a history.

## When a broker earns a decision record

The jobs table stays the default until one of these is measured, not
predicted:

- job writes are a material share of the database's write load, or the
  jobs table's vacuum cannot keep up;
- another service, with its own database, must consume the events;
- fan-out to many consumers or sub-second delivery at a volume polling
  cannot reach.

Then a decision record (project-docs) picks the broker: Valkey streams
(the owner's `valkey` image) or NATS JetStream. What changes and what does
not:

- The outbox stays: the business transaction still writes a job row. A
  relay handler publishes it to the broker and completes the row, so a
  broker outage delays messages and loses none.
- Delivery is at least once; consumers dedupe by the message id (the job
  id), the same idempotency rule as handlers.
- The broker joins readiness, backups, the restore drill and the runbooks
  (service-operations), and its own depth and age alerts replace or join
  the two above.
