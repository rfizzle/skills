# Building the inventory

Every command here prints names, paths, fingerprints or counts, never a
value. Run them on the compromised host (read-only) or on the backup copy
of it. A command that would print a value is wrong; fix it before running.

## Contents

- Files on the host
- Containers and units
- Keys and tokens the host holds to other systems
- Vendor accounts, people and devices
- Rotating and probing each class
- Probing with the old value

## Files on the host

```sh
# env files, then their key names only
sudo find / -xdev -type f \( -name '*.env' -o -name '.env' \) 2>/dev/null
sudo grep -vE '^\s*(#|$)' <file> | cut -d= -f1

# config files that hold something secret-shaped, files only
sudo grep -rIlEi '(api[_-]?key|token|secret|passw(or)?d|private[_-]?key)' <config dirs> 2>/dev/null

# the key names inside one of them (stops before the value)
sudo grep -oEi '^[[:space:]]*[A-Za-z0-9_.-]*(key|token|secret|password)[A-Za-z0-9_.-]*' <file> | sort -u

# TLS and other private keys
sudo find / -xdev -type f \( -name '*.key' -o -name '*.pem' -o -name 'id_*' ! -name '*.pub' \) 2>/dev/null
```

An app that keeps its key in an XML or JSON config is listed by the
file-only search; record the element name (`ApiKey`), not its content.

## Containers and units

```sh
podman ps -a --format '{{.Names}}'
podman inspect --format '{{range .Config.Env}}{{println .}}{{end}}' <name> | cut -d= -f1
grep -nE 'env_file|environment|secrets|EnvironmentFile|Secret=' <compose files and unit files>
systemctl cat <unit> | grep -nE '^(Environment|EnvironmentFile|LoadCredential)'
sudo crontab -l; ls /etc/cron.d    # scheduled jobs carry tokens in URLs and headers
```

A docker host uses `docker` in place of `podman`; the format strings match.

## Keys and tokens the host holds to other systems

These are step 1 of the order: revoke them first.

```sh
# private keys and where they were used
sudo find / -xdev -name 'id_*' ! -name '*.pub' 2>/dev/null
ssh-keygen -lf <key>.pub                     # fingerprint and comment, to match at the far side
cat ~/.ssh/config; cut -d' ' -f1 ~/.ssh/known_hosts | sort -u   # the targets

# credential stores, by path (list, do not open)
ls -l ~/.config/gh/hosts.yml ~/.git-credentials ~/.netrc ~/.docker/config.json \
  "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/containers/auth.json" ~/.aws/credentials \
  ~/.config/gcloud ~/.cloudflared 2>/dev/null
```

Run the same for each user with a home directory, including container
homes and the agent's own config directory (its sign-in is a row).

Who can reach the host: `sudo find / -xdev -name authorized_keys` and
`ssh-keygen -lf` on each, then `getent passwd | grep -vE 'nologin|false'`.
Every key and account is matched to a person or device, or removed.

## Vendor accounts, people and devices

The host cannot list these; the agent asks the owner and writes the
answers as rows:

- Accounts the host called: forge, edge and DNS provider, VPN provider,
  media and metadata services, mail relay, monitoring pings, cloud storage.
  Each one's token page and its OAuth grants.
- Webhooks whose target is one of the host's hostnames, and webhook
  secrets the host verified.
- People with an account on the host or a share from it; devices signed
  in to services it ran (password manager clients, media clients).
- The vendor relay or remote-access service, and the router's port
  forwards and remote management.

## Rotating and probing each class

| Class | Rotate | Old refused | New accepted |
|---|---|---|---|
| SSH key, host to elsewhere | delete the line at the target or forge; new key `ssh-keygen -t ed25519 -C <host>-<purpose>-<yyyy-mm>` only if needed | `ssh -o IdentitiesOnly=yes -o BatchMode=yes -i <old> <target> true` fails with "Permission denied" | same with the new key exits 0 |
| Forge personal token | revoke in the forge's settings | `curl -s -o /dev/null -w '%{http_code}\n' -H @<(printf 'Authorization: Bearer %s' "$OLD") <the forge's token-check endpoint; for GitHub, /user>` prints 401 | same with the new token prints 200 |
| App API key | regenerate in the app, update every consumer the row names | the app's status endpoint with `X-Api-Key: $OLD` returns 401 | each consumer's "test connection" passes |
| Tunnel token | owner refreshes it in the edge console; agent writes it, restarts the connector | the console lists no connector started before the rotation | the connector is healthy and each hostname answers |
| Edge, DNS or cloud API token | owner rolls it in the console | the provider's token-verify call with the old value is refused | the same call with the new value succeeds |
| VPN private key | owner creates a new config and deletes the old one at the provider | the old config is gone from the provider's list (owner checks) | the egress address seen from inside the container is the VPN's |
| OAuth client or webhook secret | rotate at the vendor, update the verifier | a test delivery signed with the old secret is rejected | a test delivery returns 2xx |
| Database password | `\password <role>` in psql, which prompts and never echoes | a connection with the old password fails | the service's readiness probe passes |
| Service session secret | rotate the signing key, or delete every row of the session table (`go-auth`) | an old session cookie gets 401 | a fresh sign-in works |
| Media server token | owner signs out every device at the vendor and re-claims the server | consumers' tests fail until re-authorised | each consumer's test passes |
| TLS private key | reissue with a new key, revoke the old certificate | the old certificate shows as revoked | the served certificate has the new key's fingerprint |
| Password manager | the SKILL.md rule: fresh export, test restore, one change per step | sign-in with the old master password fails | item count equals the export's, and a save succeeds on each client |
| Backup repository password | `restic key add`, test a restore with the new key, `restic key remove <old id>` | `restic snapshots` with the old password fails | `restic snapshots` with the new one lists them |
| Recovery codes | owner regenerates them at the vendor | the vendor shows the new set's date (never spend a code to test) | the owner has stored the new set offline |

## Probing with the old value

Load the old value from the pre-rotation copy into a variable, use it, and
unset it; never echo it and never put it on a command line the shell logs:

```sh
OLD=$(sudo sed -n 's/^API_KEY=//p' <backup copy of the env file>)
# The header comes from a process substitution so the value never sits in the process list.
curl -s -o /dev/null -w '%{http_code}\n' -H @<(printf 'X-Api-Key: %s' "$OLD") http://127.0.0.1:<port>/<status path>
unset OLD
```
