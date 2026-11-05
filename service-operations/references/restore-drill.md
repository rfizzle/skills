# Restore drill

Runs at least quarterly and after any change to the backup setup. Never
against production; the target is a scratch instance that is deleted
afterwards.

1. Pick a restore point: a timestamp inside the retention window, not the
   latest, so point-in-time recovery is exercised.
2. Restore to a new scratch instance with the provider's PITR, or base
   backup plus WAL replay. Start a timer.
3. Point the service binary at it (read-only credentials) and run its
   migration status: the version must match the release deployed at the
   restore point.
4. Run the read checks the backup runbook lists: row counts of the main
   tables within the expected range, the newest row's timestamp just before
   the restore point, a sample of known records readable.
5. Stop the timer; that is the measured restore time.
6. Delete the scratch instance and its credentials.
7. Record the result in the backup runbook under `Last drill`:

```markdown
Last drill: YYYY-MM-DD, restore point YYYY-MM-DDTHH:MM:SSZ, <n> minutes,
migration version <n>, checks passed | failed: <what failed>.
```

A failed drill is a page-severity problem: open a story the same day.
