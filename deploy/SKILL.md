---
name: deploy
description: Use this skill when taking a release tag to a running service, or when the user says "deploy this", "ship v1.4 to prod", "promote staging", "roll back", "put it on the server", "run it under systemd", "write the .container file", "who runs the migrations", "where do the secrets go on the host", "expose it without opening a port", "the service died when I logged out", "the deploy moved on its own" or "write the deploy runbook". Holds the one default shape: the signed image pinned by digest, run rootless by Podman Quadlet under systemd, migrations as a one-shot unit before the app, Cloudflare Tunnel in front, the env file from sops, staging and prod promoting the same digest, and docs/runbooks/deploy.md. Not for building or signing the image (container-image), tagging and the changelog (release), health endpoints, alerts and backup policy (service-operations), local Compose and CI (repo-tooling), or writing migrations (golang-database).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Deploy

The release checklist used to end in a `<deploy step>` placeholder and the
runbook in "roll back to the previous release" with no command; nobody said
who runs migrations or when. A deploy invented under pressure runs `main`,
moves a pinned image or drops the schema the rollback needed. This is the
one shape from a release tag to a running service. The agent writes the
units, the runbook and the commands; the owner runs them (`release`).

## The default target

| Piece | Default |
|---|---|
| Artifact | the signed image from `container-image`: `ghcr.io/<owner>/<app>@sha256:<digest>` |
| Runtime | rootless Podman 5 Quadlet under a dedicated service user's systemd |
| Migrations | `<app>-migrate.container`: one-shot, same digest, before the app |
| Database | `ghcr.io/rfizzle/postgres` (or `valkey`) Quadlet, named `.volume` |
| Ingress | `cloudflared` unit to the app's loopback port; no public port |
| Config | `/etc/<app>/<env>.env`, 0600, owned by the service user, `APP_` keys |

A project overrides a row with a decision record (`project-docs`); the
owner's Debian-package exception is under Alternatives.

## Environments

- `dev` is Compose on the developer machine (`repo-tooling`).
- `staging` and `prod` run the same units from `deploy/quadlet/` on
  separate hosts, or as separate service users on one host for a small
  project. Per environment the repository holds only `env.conf` drop-ins
  (env file path, loopback port) and the sops-encrypted env file.
- One build, promoted: prod runs the digest staging verified. No
  environment-specific builds, build arguments or tags.

## Units

`~/.config/containers/systemd/<app>.container` (rootless), in full with
the other units in `references/quadlet-units.md`:

```ini
[Unit]
Requires=<app>-migrate.service <app>-postgres.service
After=<app>-migrate.service <app>-postgres.service
[Container]
Image=ghcr.io/<owner>/<app>@sha256:<digest>
Network=<app>.network
ReadOnly=true
Tmpfs=/tmp
DropCapability=ALL
NoNewPrivileges=true
PidsLimit=256
Memory=512m
HealthCmd=["/app","healthcheck","--ready"]
Notify=healthy
```

No `AutoUpdate=` line: the digest moves only when a person moves it. The
service user has `loginctl enable-linger`.

## The sequence

Order matters; each step exists for the reason beside it. Run on the
staging host as the service user, then on prod with the same digest.

1. **Tag, not branch.** The owner pushes `vX.Y.Z`; the release workflow
   builds, signs and prints the digest (`container-image`).
2. **Verify, then pull, by digest.** `cosign verify` against the release
   workflow's identity at the tag, so a branch build fails here; then
   `podman pull`, so the start never waits on the registry.
3. **Pin** the digest in `<app>.container` and `<app>-migrate.container`,
   then `systemctl --user daemon-reload`.
4. **Migrate while the old release serves.** `systemctl --user start
   <app>-migrate.service` runs `migrate up` and blocks until it exits,
   while the previous release keeps serving on the new schema. That is
   release's rollback rule: expand migrations ship first, the contract step
   a release later (`golang-database`).
5. **Restart** `<app>.service`. `Notify=healthy` holds the unit in
   `activating` until the health command's `/readyz` passes
   (`service-operations`), so the restart returns only when the new release
   can work and fails if it never can. One instance restarts in place; a
   few seconds of tunnel 502s is the accepted cost.
6. **Verify and record**: `/readyz`, one smoke request through the public
   hostname, the error and latency panels for 15 minutes; append the tag
   and digest to `deploys.log`.

The exact commands are the runbook: `references/runbook-deploy.md`.

## Rollback

Pin the previous digest from `deploys.log` in both files, `systemctl
--user daemon-reload`, `systemctl --user restart <app>`; the commands live
in `docs/runbooks/deploy.md`. The schema stays unless the release notes say
otherwise. This needs the previous binary's `migrate up` to exit 0 on a
schema ahead of it and its `/readyz` to accept a schema at or past its own.

## Secrets

- The owner or a secrets step writes the env file; secrets are never in
  the image, a unit file or a CI log, and CI never decrypts them.
- Default: sops with age. `deploy/<env>/<env>.env` is committed encrypted;
  the owner decrypts locally and pipes it over SSH into the 0600 file. The
  age private key never enters the repository.
- Alternative: a Podman secret (`Secret=<name>,type=env,target=APP_...`)
  for a value that must not sit in a file at all.

## Proxy and TLS

- Cloudflare terminates TLS; the tunnel targets the app's port, published
  on `127.0.0.1` only. HSTS and security headers still come from the app.
- `CF-Connecting-IP` is trusted only from the tunnel's peer: the `.network`
  gateway, pinned with `Gateway=`, alone in the trusted proxy list
  (`go-http-server`).
- Cloudflare Access guards admin surfaces as an outer layer, never as the
  app's auth (`go-auth`).

## Host baseline

Debian stable, Podman 5, unattended upgrades; `podman-auto-update.timer`
disabled; journald persistent and capped; `<app>-backup.timer` writing the
nightly dump the restore drill restores from (`service-operations`); a
firewall admitting nothing inbound, SSH included once it runs through the
tunnel. Steps: `references/host-setup.md`.

## Alternatives

- **Debian package under systemd**: a host agent that must drive Podman or
  systemd itself (the owner's game-server agent), by decision record;
  GoReleaser builds it (`repo-tooling`).
- **Kubernetes**: only when the project already has a cluster.
- **Cloudflare Workers**: static sites and small edge functions.

## Gotchas

- `AutoUpdate=registry` lets `podman auto-update` silently move a pinned
  deploy. Leave the key out and disable the timer.
- Without linger, rootless units die at the user's logout and skip boot.
- `Requires=` without `After=` starts the migration and the app together;
  the app wins the race against the old schema. Both lines, always.
- `ReadOnly=true` breaks a binary that writes a cache outside `/tmp`;
  point it at `/tmp` or add a `Tmpfs=`, never drop `ReadOnly`.
- `Notify=healthy` with no `HealthCmd` never turns healthy and the start
  times out. A string `HealthCmd` needs `/bin/sh`, which the image lacks.
- A tunnel to `localhost` inside a container reaches that container, not
  the app; `cloudflared` runs on the host.
- User namespaces remap uids: a volume's files show subordinate host uids.
  Inspect and fix with `podman unshare`, never `chown` from the host.
- `sudo -u <user> systemctl --user` has no bus; use
  `sudo machinectl shell <user>@`. Quadlet units cannot be `enable`d;
  `[Install]` starts them at boot.
- Two different digests in the app and migrate units run one release's
  migrations under another's code. The pin step writes both and prints one.
- Deploying `main` or a branch image: the signature check rejects it,
  which is why it is never skipped "just this once".

## Definition of done

- `deploy/quadlet/` units carry the hardening above, no `AutoUpdate`, and
  the app `Requires=` and `After=` the migrate unit.
- Staging and prod run one `cosign`-verified digest from a `v*` tag.
- No secret is in the image, a unit, CI, or the repository in clear.
- The host admits nothing inbound; the tunnel reaches a loopback port.
- `docs/runbooks/deploy.md` exists with commands that were run once, and
  the alert runbooks' bad-deploy fix points at its rollback.

## References

- `references/quadlet-units.md`: open when writing or changing any unit:
  app, migrate, database, network, volume, drop-ins, backup timer, tunnel.
- `references/host-setup.md`: open when preparing a new host or service
  user, or auditing one against the baseline.
- `references/runbook-deploy.md`: the `docs/runbooks/deploy.md` template
  with every command; open when writing it or deploying.
