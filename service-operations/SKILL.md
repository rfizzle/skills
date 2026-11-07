---
name: service-operations
description: Use this skill when making a Go service operable or checking that it is, before its first deploy or when adding an alert, a dependency or a launch flag. Covers /healthz and /readyz, graceful shutdown, structured slog with request IDs, RED metrics, traces, feature flags (typed, from config, removed after launch), runbooks with one page per alert, and backups with a tested restore drill. Triggers include "add a health check", "readiness probe", "request ID", "what should we alert on", "write a runbook", "add a feature flag", "remove the flag", "how do we restore", "backup drill", "is this ready for production", "write a postmortem" and "what do we do after the outage". Not for deploying, promoting or rolling back a release (use deploy), choosing metric types, label rules or span attributes in detail (use golang-observability), secret handling or hardening (use golang-security), build and CI setup (use repo-tooling), or the container image (use container-image).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Service operations

The baseline every service meets before it takes traffic. Each item is a
rule with a check; the signal-design detail is in `golang-observability`
and the security detail in `golang-security`.

## Health

- `GET /healthz` is liveness: 200 while the process can serve a request. It
  checks no dependency; a database outage must not restart every replica.
- `GET /readyz` is readiness: 200 only when the service can do its work.
  It pings the database with a short timeout (about a second) and checks the
  schema is at or past the migration version the binary needs, so the
  previous release still passes after a rollback (`deploy`). Otherwise 503.
- Both sit outside API versioning, need no authentication, and return a
  short status with no hostnames, versions or error text. `/metrics` sits
  beside them, reachable only from the scrape network.
- The binary has a `healthcheck` subcommand that calls `/healthz`, and
  `/readyz` with `--ready`, when it runs in a shell-less image. The deploy
  unit's `HealthCmd` uses `--ready`, so systemd holds a restart until the
  new release is ready (`deploy`).

## Shutdown

On SIGTERM: `/readyz` turns 503, the server stops accepting and drains
in-flight requests within a deadline shorter than the platform's grace
period (the unit's `TimeoutStopSec` under `deploy`), background workers stop taking work and finish or release it, then
dependencies close in the reverse of their start order. Every step honours
the context deadline.

## Logs

- `log/slog` JSON handler to stdout, one logger built at startup and passed
  down; level from config.
- Request middleware takes an incoming `X-Request-ID` when it is a short
  token of safe characters, otherwise generates one; sets it on the
  response header; adds it, the route template and the trace ID to the
  request's logger in the context.
- The request ID appears in Problem Details responses (an `instance` or
  extension member) so a user report finds the log line.
- One access-log line per request (method, route template, status,
  duration, request ID). Errors are logged once, at the boundary.

## Metrics and traces

- RED per route template: request count, error count (5xx, and 4xx
  separately if alerted on), and a duration histogram. Workers and queues
  get the same per job type, plus queue depth and age of the oldest item.
- Pool saturation from the driver's pool stats as gauges.
- OpenTelemetry traces on inbound requests, database calls and outbound
  calls; W3C `traceparent` propagated in and out; sampling from config.
- Label, bucket and attribute rules: `golang-observability`.

## Alerts and runbooks

- Alert on symptoms users feel (error ratio, latency, readiness, queue
  age), not on causes. A page is actionable at any hour; anything that can
  wait for working hours is a ticket, and anything no one acts on is a
  dashboard panel instead.
- Two severities, one rule with `golang-observability`'s alerting
  reference: page is its `critical` label (`for:` 2 to 5 minutes), ticket
  is its `warning` label (`for:` 10 to 30 minutes). The runbook states
  which.
- One runbook page per alert: `docs/runbooks/<alert-name>.md`, with
  Symptom, Check and Fix. The alert's annotation links to it. Template:
  `references/runbook-template.md`.
- A runbook names commands and dashboards that exist; it is updated in the
  commit that changes the alert, the metric or the fix. Its bad-deploy fix
  is the digest rollback in `docs/runbooks/deploy.md` (`deploy`).

## After an incident

An incident is a page users felt, a rollback, a failed deploy or a failed
restore drill.

1. Declare it: one person owns it and says so, with the start time, where
   the project's runbooks say to.
2. Mitigate with the alert's runbook, rollback first when a deploy is in
   the window; find the cause after users are whole.
3. Within a week, write a blameless postmortem at
   `docs/incidents/YYYY-MM-DD-<slug>.md` (template in `project-docs`):
   timeline in UTC, impact, cause, what worked, action items. Systems and
   decisions are causes; people are not.
4. File each action item as a story; the page lists them by title only.
5. Link the postmortem from the alert's runbook page under Incidents, and
   fix the runbook in the same commit if it misled.

## Feature flags

- A flag is a typed field in the config struct (`Flags.BulkExport bool`
  from `APP_FLAG_BULK_EXPORT`), default off, read at startup. No runtime
  flag service and no per-request evaluation unless the owner asks.
- A flag guards a launch, not a configuration. When it is created, its
  removal is filed as a story; it is removed, with its dead branch, within
  one release of the feature being on everywhere.
- Code checks the flag at one entry point (the route registration, the
  worker start), never deep in the call tree.

## Backups and restore

- The database has continuous backups (PITR on PostgreSQL through WAL
  archiving or the managed service's equivalent; WAL-shipping or a scheduled
  online backup for SQLite), encrypted, kept in a
  separate account or location, with stated retention.
- A restore drill runs on a schedule (at least quarterly) and after any
  backup change: restore to a scratch instance at a chosen time, run the
  binary's migration status against it, run the read checks in the
  runbook, and record the date, the restore point and the time taken.
- The backup runbook holds the restore procedure and the last drill's
  result. A backup never restored is not a backup.
- Steps: `references/restore-drill.md`.

## Definition of done

- `/healthz`, `/readyz` and `/metrics` behave as above; readiness fails
  when the database is down and during shutdown.
- SIGTERM drains and closes in reverse start order within the deadline.
- Every log line is JSON with a request ID where one exists; no secret is
  logged (`golang-security`).
- RED metrics and traces exist for every route and worker.
- Every alert links to a runbook page with Symptom, Check and Fix.
- Every flag has a removal story.
- The last restore drill is recorded and within schedule.
- Every incident has a postmortem within a week, linked from its runbook,
  with its action items filed.

## References

- `references/runbook-template.md`: the runbook page.
- `references/restore-drill.md`: the drill steps and the record line.
