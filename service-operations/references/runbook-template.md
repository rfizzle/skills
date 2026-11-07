# Runbook page

One file per alert, `docs/runbooks/<alert-name>.md`, named exactly as the
alert. The alert's `runbook_url` annotation points here. Keep it to a
screen: the reader is paged and wants the next command.

```markdown
# <AlertName>

Fires when: <the alert expression in words, with threshold and window>.
Severity: page (critical) | ticket (warning).

## Symptom

What users or callers see: <errors, slowness, missing results>, and which
dashboard panel shows it: <dashboard / panel>.

## Check

1. `<command or query>`: expect <normal value>; if <abnormal>, go to Fix 1.
2. `<command or query>`: expect <normal value>; if <abnormal>, go to Fix 2.
3. Recent deploys: `tail ~/.local/state/<app>/deploys.log` on the host. A
   deploy in the window: Fix 3.

## Fix

1. <cause>: <exact steps>. Done when <signal> returns to <value>.
2. <cause>: <exact steps>. Done when <signal> returns to <value>.
3. Bad deploy: roll back to the previous digest
   ([deploy.md#rollback](deploy.md#rollback)): as the service user, set the
   digest from the line before the bad one in `deploys.log` in
   `<app>.container` and `<app>-migrate.container`, then
   `systemctl --user daemon-reload && systemctl --user restart <app>`. Done
   when `/readyz` is 200 and the alert clears. The schema stays; then open
   a story for the cause.

Not fixed after these: escalate to <role or rotation>.

## Incidents

- YYYY-MM-DD: [<slug>](../incidents/YYYY-MM-DD-<slug>.md)
```

Rules:

- Every command was run once while writing the page.
- No secrets, hostnames of people's machines or one-off ticket links.
- A fix that becomes routine is automated, and the page shrinks.
- Severity follows `golang-observability`'s two levels: page is the
  `critical` label, ticket is `warning`.
- Every postmortem of an incident this alert opened is listed under
  Incidents, newest first.
