# Device record

One page per device the owner configured by hand,
`docs/runbooks/<device-role>.md`, named by role (`nas`, `edge-router`,
`media-server`), not by model or hostname. A runbook page with no alert:
the reader is the owner, months later, when the device misbehaves or is
replaced. Keep it to a screen or two.

```markdown
# <Device role>

What it does: <one sentence: what depends on it>.
Last changed: YYYY-MM-DD, <what the session did, in a clause>.

## Hosts

| Role | Name | Address | Reached by |
| --- | --- | --- | --- |
| <role> | <hostname> | <address or "DHCP reservation"> | <admin console URL, SSH through the tunnel, front panel> |

## Versions

- Firmware or OS: <version>, updates <automatic | manual, how>.
- <package, container or app>: <version or image digest>.

## Settings

Changed by hand in the admin console:

| Where (menu path) | Setting | Was | Now | Why |
| --- | --- | --- | --- | --- |
| Network > Firewall | Inbound rule "ssh-wan" | allow 22/tcp from any | removed | SSH goes through the tunnel (`cloudflare-edge`) |

Changed by the agent over SSH or the API:

| What | Where it lives | Why |
| --- | --- | --- |
| <service, unit, cron entry, config file> | <path on the device or the repo path it came from> | <reason> |

## Secrets

| Secret | Lives in | Rotated |
| --- | --- | --- |
| <name, e.g. tunnel token> | <file on the device, vault entry> | YYYY-MM-DD |

No values. A secret set only in the vendor's UI says so: "the vendor's
dashboard, Settings > API".

## Check

1. `<command run from the agent's side or the owner's machine>`: expect
   <result>.
2. In the admin console, <page>: expect <what the owner sees>.

## If it breaks

1. <Symptom the owner would notice>: <steps the owner can follow alone>.
   Done when <check 1> passes.
2. Restart: <the exact control or command>, and what the lights or the
   console show when it is back.
3. Factory reset, last resort: <the control by position and label, how
   long to hold>. It erases <list>. To rebuild, follow Settings above in
   order and restore secrets from <where>.

## Access

- The agent's access: <SSH key on the host for user X, API token scope>,
  granted YYYY-MM-DD. To revoke: <where>.
```

Rules:

- Every setting in Settings is one this session saw on the screen or read
  from the device; nothing from memory of another firmware version.
- Every command in Check was run once while writing the page.
- Hostnames and addresses go in the Hosts table only, so a rename touches
  one row.
- A later session that changes the device updates this page in the same
  commit, and moves "Last changed".
- A device that fires an alert links this page from the alert's runbook
  page instead of repeating its Settings.
