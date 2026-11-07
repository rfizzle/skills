# The rotation record

The incident's postmortem uses the template in `project-docs`
(`references/templates.md`, A postmortem) at
`docs/incidents/YYYY-MM-DD-<slug>.md`. With no project, the record sits in
the directory that holds the host's runbook (`service-operations`), named
the same way. A rotation adds the sections below to it; it never becomes
a second document.

Nothing in the record is a secret: rows name roles and paths, people are
named by role, and no hostname, address or account name appears that is
not already in the runbook beside it.

```markdown
## Detection gap

<What let the compromise run unseen, and for how long: the unpatched
release, the exposed service, the missing alert. Then what now catches it:
the watchdog, the advisory subscription, the alert, each with where it
lives.>

## Rotation

Contained: <UTC time>, by <what was cut>. Rebuilt: <UTC time>.
Restore proven: <UTC time>, <what was restored where>.

| Secret | Where used | Issued by | Status | Verified (UTC) | Note |
|---|---|---|---|---|---|
| <role> | <path or key name> | <issuer> | revoked / verified / deferred / kept | <time> | <reason for deferred or kept> |

## Revoked

- <credential by role and fingerprint or name>, at <issuer>, <UTC time>.

## Remains

- <row or task>: owner <role>, reason <why it waits>, due <date>.

## Old backups

<Each backup that holds the pre-rotation secrets: where it is and whether
it was deleted or encrypted, with the date.>
```

Timeline rows for the rotation go in the postmortem's own Timeline (UTC):
contained, backup verified, restore proven, rebuilt, each rotation batch
verified, last row closed, old backups deleted.

## Corrections

When the owner corrects a fact (the real entry point, a misleading label,
a row's status), the record is edited in place in the same session. Under
version control, the commit says what changed. Outside it, a dated line
goes under a closing `## Corrections` heading: the date, the fact, what it
now says. Action items still become stories, listed by title only.
