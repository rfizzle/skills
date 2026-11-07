# Quadlet units

The files a project keeps under `deploy/` and installs into the service
user's `~/.config/containers/systemd/` (Quadlet) and
`~/.config/systemd/user/` (plain units). Angle brackets are placeholders;
`<app>` is the service name, `<env>` is `staging` or `prod`. Needs Podman 5
(`Notify=healthy`, drop-ins).

## Contents

- Repository layout
- The app
- The migration
- Network and volume
- The database
- The per-environment drop-ins
- The env files
- The backup timer
- The tunnel
- Checking the units

## Repository layout

```text
deploy/
  quadlet/                  identical in every environment
    <app>.container
    <app>-migrate.container
    <app>-postgres.container
    <app>.network
    <app>-pgdata.volume
  systemd/
    <app>-backup.service
    <app>-backup.timer
  staging/                  only what differs per environment
    <app>.container.d/env.conf
    <app>-migrate.container.d/env.conf
    <app>-postgres.container.d/env.conf
    staging.env             sops-encrypted
    staging.db.env          sops-encrypted
  prod/
    ...same names, prod values
.sops.yaml
```

The `Image=` digest in the repository copy is a placeholder; the host copy
holds the deployed digest and the deploy step rewrites it.

## The app

```ini
# <app>.container
[Unit]
Description=<app>
Requires=<app>-migrate.service <app>-postgres.service
After=<app>-migrate.service <app>-postgres.service

[Container]
Image=ghcr.io/<owner>/<app>@sha256:<digest>
ContainerName=<app>
Network=<app>.network
# The port is published by the env drop-in, on 127.0.0.1 only.
ReadOnly=true
Tmpfs=/tmp
DropCapability=ALL
NoNewPrivileges=true
PidsLimit=256
Memory=512m
# JSON array: the runtime image has no shell for the string form.
HealthCmd=["/app","healthcheck","--ready"]
HealthInterval=10s
HealthTimeout=3s
HealthRetries=3
HealthStartPeriod=20s
Notify=healthy
# No AutoUpdate= line. The digest moves only in a deploy.

[Service]
Restart=on-failure
TimeoutStartSec=120
# Longer than the app's shutdown deadline (service-operations).
TimeoutStopSec=40

[Install]
WantedBy=default.target
```

`healthcheck --ready` calls `/readyz`; `HealthOnFailure=` stays unset, so a
database outage marks the container unhealthy without restarting it (the
liveness rule). A crash is `Restart=on-failure`'s job.

## The migration

```ini
# <app>-migrate.container
[Unit]
Description=<app> migrations
Requires=<app>-postgres.service
After=<app>-postgres.service

[Container]
Image=ghcr.io/<owner>/<app>@sha256:<digest>
Network=<app>.network
Exec=migrate up
ReadOnly=true
DropCapability=ALL
NoNewPrivileges=true

[Service]
Type=oneshot
# Not RemainAfterExit: the unit goes inactive after each run, so every
# start of the app pulls it in and runs it again (a no-op when current).
TimeoutStartSec=15min
```

`Exec=` replaces the image's `CMD`, so the container runs `/app migrate up`.
It has no `[Install]`: the app's `Requires=` starts it.

## Network and volume

```ini
# <app>.network
[Network]
NetworkName=<app>
Subnet=10.89.10.0/24
# Host-originated traffic (the tunnel) reaches the app from this address;
# it is the only entry in the app's trusted proxy list. Confirm it once
# from the access log on the host: pasta may present another address.
Gateway=10.89.10.1
```

```ini
# <app>-pgdata.volume
[Volume]
VolumeName=<app>-pgdata
```

## The database

```ini
# <app>-postgres.container
[Unit]
Description=<app> PostgreSQL

[Container]
Image=ghcr.io/rfizzle/postgres:<stream>@sha256:<digest>
ContainerName=<app>-postgres
Network=<app>.network
Volume=<app>-pgdata.volume:/var/lib/postgresql/data
HealthCmd=["pg_isready","-U","app","-d","app"]
HealthInterval=5s
Notify=healthy
NoNewPrivileges=true
PidsLimit=512

[Service]
Restart=on-failure
TimeoutStartSec=120

[Install]
WantedBy=default.target
```

Valkey is the same shape: `ghcr.io/rfizzle/valkey`, its own `.volume`,
`HealthCmd=["valkey-cli","ping"]`. The database image digest is bumped by
Renovate in the repository and deployed by copying the unit, never by
auto-update.

## The per-environment drop-ins

```ini
# <app>.container.d/env.conf
[Container]
EnvironmentFile=/etc/<app>/<env>.env
PublishPort=127.0.0.1:8080:8080
```

```ini
# <app>-migrate.container.d/env.conf
[Container]
EnvironmentFile=/etc/<app>/<env>.env
```

```ini
# <app>-postgres.container.d/env.conf
[Container]
EnvironmentFile=/etc/<app>/<env>.db.env
```

Two environments on one host use different service users and different
loopback ports (8080, 8081); nothing else changes.

## The env files

`/etc/<app>/<env>.env` holds the `APP_` variables (database URL, session
keys, flags); `/etc/<app>/<env>.db.env` holds `POSTGRES_USER`,
`POSTGRES_PASSWORD` and `POSTGRES_DB`. Each is mode 0600, owned by the
service user; Podman reads them as that user. The database password appears
in both, so a rotation writes both and restarts both units.

```yaml
# .sops.yaml
creation_rules:
  - path_regex: deploy/(staging|prod)/.*\.env$
    age: age1<owner public key>
```

Edit with `sops deploy/prod/prod.env`; write with the command in the deploy
runbook. A Podman secret replaces one variable when it must not sit in a
file: `podman secret create <app>-session-key -` (value on stdin), then
`Secret=<app>-session-key,type=env,target=APP_SESSION_KEY` in the drop-in.

## The backup timer

A plain user unit: it runs `pg_dump` inside the running database container,
so the dump is written by the service user and needs no second password.

```ini
# ~/.config/systemd/user/<app>-backup.service
[Unit]
Description=<app> nightly dump
Requires=<app>-postgres.service
After=<app>-postgres.service

[Service]
Type=oneshot
EnvironmentFile=/etc/<app>/<env>.restic.env
ExecStart=/bin/sh -c 'podman exec <app>-postgres pg_dump -U app -d app --format=custom > %h/backups/<app>-$$(date -u +%%Y%%m%%dT%%H%%MZ).dump'
ExecStartPost=/usr/bin/restic backup --tag <app> %h/backups
ExecStartPost=/usr/bin/find %h/backups -name '*.dump' -mtime +7 -delete
```

```ini
# ~/.config/systemd/user/<app>-backup.timer
[Unit]
Description=<app> nightly dump

[Timer]
OnCalendar=*-*-* 03:15:00 UTC
Persistent=true
RandomizedDelaySec=10min

[Install]
WantedBy=timers.target
```

Enable with `systemctl --user enable --now <app>-backup.timer` (plain units
can be enabled; Quadlet ones cannot). `restic` encrypts and sends the dumps
off the host; the `.restic.env` file (repository URL, password, object
store keys) is 0600 like the others. Retention is stated in the backup
runbook, and the restore drill restores from these dumps
(`service-operations`).

## The tunnel

`cloudflared` from Cloudflare's apt repository, installed as the system
`cloudflared.service`, with a locally managed config:

```yaml
# /etc/cloudflared/config.yml
tunnel: <tunnel id>
credentials-file: /etc/cloudflared/<tunnel id>.json
ingress:
  - hostname: <app>.<domain>
    service: http://127.0.0.1:8080
  - hostname: <app>-staging.<domain>
    service: http://127.0.0.1:8081
  - service: http_status:404
```

It runs on the host, so `127.0.0.1` is the published port. Run as a
container, it would need `Network=host` for the same address to mean the
same thing. Admin hostnames get a Cloudflare Access application in front;
the app still authenticates every request (`go-auth`).

## Checking the units

```sh
/usr/libexec/podman/quadlet -dryrun -user    # prints generated units or the error
systemctl --user daemon-reload
systemctl --user list-unit-files '<app>*'
systemd-analyze --user verify <app>.service
```

A unit with a syntax error is silently not generated; the dry run is where
the error shows.
