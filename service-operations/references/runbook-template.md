# Runbook page

One file per alert, `docs/runbooks/<alert-name>.md`, named exactly as the
alert. The alert's `runbook_url` annotation points here. Keep it to a
screen: the reader is paged and wants the next command.

```markdown
# <AlertName>

Fires when: <the alert expression in words, with threshold and window>.
Severity: page | ticket.

## Symptom

What users or callers see: <errors, slowness, missing results>, and which
dashboard panel shows it: <dashboard / panel>.

## Check

1. `<command or query>`: expect <normal value>; if <abnormal>, go to Fix 1.
2. `<command or query>`: expect <normal value>; if <abnormal>, go to Fix 2.
3. Recent deploys: <where to see them>. A deploy in the window: Fix 3.

## Fix

1. <cause>: <exact steps>. Done when <signal> returns to <value>.
2. <cause>: <exact steps>. Done when <signal> returns to <value>.
3. Bad deploy: roll back to the previous release (<command>), then open a
   story for the cause.

Not fixed after these: escalate to <role or rotation>.
```

Rules:

- Every command was run once while writing the page.
- No secrets, hostnames of people's machines or one-off ticket links.
- A fix that becomes routine is automated, and the page shrinks.
