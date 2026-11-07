---
name: credential-rotation
description: Use this skill when a system is compromised or may be and the credentials it held must be rotated or revoked: a host or NAS reported malware, a server is being rebuilt after an intrusion, a key or token leaked into a repository, log or chat, a device was lost, someone with access left. Triggers include "what do we need to rotate", "revoke the keys", "the box was hacked", "we're rebuilding it from scratch", "do the API keys next", "I rotated my password and lost my vault", "Invalid key cipher" and "update the incident report". Holds the order (contain, prove the restore, rebuild, rotate, verify, record), the inventory built before the first rotation, one secret at a time with a probe for old and new, revoke over replace, and the record. Not for the postmortem's shape (project-docs), runbooks and restore drills (service-operations), secrets in code and logs (golang-security), tunnel and exposure defaults (cloudflare-edge), or owner-click walkthroughs with no exposure behind them (guided-ops).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Credential rotation

After a host reported malware and was rebuilt, the owner changed a password
manager's master password and its encryption key in one step, with no
backup taken for hours and no restore tried. Every client still
held the old key, the vault looked empty, and the restore lost everything
enrolled since that backup. The agent had no list of what the host held,
so the owner set the order from memory ("next do the API keys, hold off on
the media server"). This skill fixes both: a written inventory before the
first rotation, and an order in which the keys that unlock every backup
change last, and only after a proven restore.

## Order of operations

1. **Contain.** Cut the system's network path: its tunnel, its vendor
   relay, its port forwards. Then revoke, at the issuer, every credential
   the system held *to other systems* (SSH keys in other hosts'
   `authorized_keys`, deploy keys, forge tokens, cloud and DNS API tokens,
   the tunnel token); an attacker uses those next. Revoking needs no new
   secret on the host, so it is safe now. The one exception is the agent's
   own path in: open the replacement first (a new key pair from the clean
   side, or the owner at the console) and revoke the old one the moment
   the new one is proven.
2. **Back up and prove the restore.** Copy configs, app data and evidence
   off the host; check file counts and database integrity; restore one
   piece onto something that does not matter (a scratch directory or
   container) before any destructive step. The backup holds every old
   secret; treat it so.
3. **Rebuild.** Fresh install, images re-pulled, data restored; no binary,
   package folder or script from the old system comes back.
4. **Rotate.** Only on the rebuilt or isolated system: a secret issued
   while the attacker still has the host is captured on arrival.
5. **Verify** each row with its probe (below).
6. **Record** (below), and delete or encrypt the old backups.

## The inventory

Built before the first rotation, from the system, not from memory. Sources:
env files and config files, container definitions (compose files, quadlet
units, `podman inspect` env), SSH `authorized_keys` on the host and the
host's own keys in other hosts, the vendor accounts the system talked to
(API tokens, OAuth apps, webhooks, the tunnel, DNS), and the people and
devices that held credentials to it. Commands that list names without
printing values: `references/inventory.md`.

| Secret | Where used | Issued by | How to rotate | How to verify | If skipped | Status |
|---|---|---|---|---|---|---|
| tunnel token | `media.env: TUNNEL_TOKEN` | edge provider console | owner issues new, agent writes it | old connector refused, new one healthy | attacker runs a connector on the hostnames | verified |
| deploy key, host to forge | `~/.ssh/` on the host | forge settings | revoke; new key only if needed | `ssh -T` with old key denied | push access to repositories | revoked |

- **No values, ever**: a row names the role and the path or key name.
- **Order the rows**: outbound credentials to other systems, then
  service-to-service keys, then human logins, then the keys that unlock
  backups (vault master key, disk encryption, recovery codes) last.
- The agent proposes the order and the owner confirms it; a row the owner
  defers stays in the table as `deferred` with the reason. Status values:
  `open`, `revoked`, `rotated`, `verified`, `deferred`, `kept` (reason).

## One at a time

Rotate one row, update every consumer its "where used" names, restart them,
run the probe, mark it `verified`, then start the next. Two rows in flight
turn one failure into two suspects. Keep a root-only copy of each file
changed until its row verifies, then delete it: it holds the old secret.

A vault master password, a disk or volume encryption key, a backup
repository password and a recovery code set change only after an export or
backup taken minutes before and a successful test restore of it: those are
the keys that make every other backup readable. Change one thing per step
(password, sign in and check; then the key, sign in and check), with every
other client signed out first.

## Revoke over rotate

A credential that may not be needed again is deleted at the issuer, not
replaced: an SSH key, a deploy key, a personal access token, a cloud API
key, an OAuth grant. If the inventory finds no consumer for it today, it is
revoked. A replacement that is needed is new, named for its host, purpose
and month, and scoped to one target so it can be revoked alone. Every
removal goes into the record's revoked list.

## The agent's own access

Keys the agent used from, or stored on, the compromised system (SSH keys to
other hosts, a forge token, its own sign-in) are compromised: they are rows
in the inventory and are revoked in step 1. The agent then asks the owner
for a new path in: it generates a new key pair on the clean side and gives
the owner only the public half to install. Secret values travel by the
handoff in `guided-ops`, never through the chat.

## Verification

Each row passes two probes: the old secret is refused and the new one is
accepted. The agent runs both where it has access, loading the old value
from the pre-rotation copy into a variable and never printing it. Where
only the owner can see (a vendor console), the agent tells the owner what
to check: the old token is gone from the list, or its last-used time is
before the rotation. Probes per credential class:
`references/inventory.md`.

## The record

The incident's postmortem lives where `project-docs` puts it
(`docs/incidents/`, its template); with no project, it sits beside the
host's runbook (`service-operations`). The rotation adds: the timeline in
UTC, the inventory with each row's final status, the revoked list, what
remains open with an owner and a reason, and the detection gap, meaning
what let the compromise run unseen and what now catches it. When the owner
corrects a fact, the record is edited in place with the date. Template:
`references/record.md`.

## Gotchas

- Changing a password manager's master password and its encryption key in
  one step invalidates every client's cached key; a client still signed in
  shows an empty or broken vault. That is not data loss, so check the
  server's item count before restoring anything.
- "Invalid key cipher" on save, after a key rotation or a restore, means a
  client still holds the old key: sign out everywhere (sign out, not lock),
  clear the client's local data, sign in once. If saves still fail, the
  server may still hold the old key's id for the account: stop the
  server, back up its database, and follow the vendor's documented reset
  for that record; never restore the vault again for this symptom.
- A media server's claim token lives a few minutes and is single-use, and
  it is still a secret: never pasted in chat. The owner writes it to a file
  the agent reads, or claims from the server's local page. Any secret that
  lands in the chat during the session becomes a new row.
- Old backups contain the old secrets. Once every row verifies, delete
  them or keep them only encrypted, and say which in the record.
- A vendor relay service (a NAS's remote access, a router's cloud
  management) is disabled or uninstalled, not just unused; `cloudflare-edge`
  has the exposure default.
- A dead key left in an app's history records is harmless once its probe
  shows it refused; do not edit live databases to scrub it.

## Definition of done

- The inventory exists, built from the system, with no values in it.
- Every row is `revoked`, `verified`, `deferred` or `kept`, each of the
  last two with a reason and an owner.
- Every rotated row passed both probes.
- The agent's own old keys are revoked and its new path came from the
  owner.
- No backup holding old secrets remains unencrypted.
- The record has the timeline, the inventory, the revoked list, what
  remains and the detection gap.

## References

- `references/inventory.md`: open when building the inventory; commands
  that list secrets by name, and how to rotate and probe each class.
- `references/record.md`: open when writing or correcting the record; the
  sections the rotation adds to the postmortem.
