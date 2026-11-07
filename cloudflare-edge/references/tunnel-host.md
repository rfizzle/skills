# The host's tunnel

One tunnel per host, named for the host, remotely managed: its routes live
in the dashboard next to the Access applications, so one place answers
"what does this host publish". The host holds only the token.

## Contents

- Creating the tunnel
- On a Debian host (systemd)
- In a container (a NAS or an appliance)
- SSH through the tunnel
- A private-network route
- The locally managed override
- Replacing a tunnel

## Creating the tunnel

1. The owner creates a tunnel of the `cloudflared` type under Tunnels,
   named for the host, and copies only the token from the install step
   (the long string after `--token`). The install command itself is not
   run: it puts the token on a command line.
2. The token goes straight into the host's env file from the owner's own
   terminal, never through the chat (`guided-ops`).
3. `cloudflared` starts (below); the tunnel shows Healthy with its
   connectors. Routes can be added only after that.

## On a Debian host (systemd)

`cloudflared` comes from Cloudflare's apt repository, and the host's
unattended upgrades include that origin (`deploy`,
`references/host-setup.md`).

```sh
sudo install -d -m 0755 /etc/cloudflared
sudo install -m 0600 -o root -g root /dev/null /etc/cloudflared/tunnel.env
# the owner, from their own terminal on the host:
#   sudoedit /etc/cloudflared/tunnel.env   ->   TUNNEL_TOKEN=<token>
#   (or TUNNEL_TOKEN_FILE=<path> with a systemd LoadCredential= line)
```

```ini
# /etc/systemd/system/cloudflared.service
[Unit]
Description=Cloudflare Tunnel for this host
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=/etc/cloudflared/tunnel.env
ExecStart=/usr/bin/cloudflared tunnel run
DynamicUser=yes
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared
systemctl show cloudflared -p ExecStart | grep -c TUNNEL    # 0: the token is not on the command line
journalctl -u cloudflared -n 20                              # "Registered tunnel connection" four times
```

`cloudflared service install <token>` writes its own unit; if it was used,
check its `ExecStart` and move the token into the env file. Systemd reads
`EnvironmentFile` as root, so the file stays root-only while the process
runs as a dynamic user.

## In a container (a NAS or an appliance)

```yaml
services:
  cloudflared:
    image: cloudflare/cloudflared@sha256:<digest>   # Renovate bumps the digest
    command: tunnel --no-autoupdate run
    env_file: ./cloudflared.env                     # TUNNEL_TOKEN=<token>, mode 0600
    network_mode: host                              # so localhost is the host's loopback
    restart: unless-stopped
```

Never `command: tunnel run --token <token>`: the token then shows in the
process list and the container's inspect output to anyone on the host.
Without host networking, `localhost` in a route means the container itself
(`deploy`, Gotchas).

## SSH through the tunnel

Server side: a route from `ssh.<host>.<zone>` to `ssh://localhost:22` and
an Access application on it with the `owner` policy, 24-hour session.

Client side, in `~/.ssh/config`:

```text
Host <host>
  HostName ssh.<host>.<zone>
  ProxyCommand cloudflared access ssh --hostname %h
```

The first connection opens a browser for the Access login; after that it
is ordinary SSH with the same key. A machine that connects without a
person (a backup job, the agent's container) uses a service token on the
`machines` policy instead:

```text
  ProxyCommand cloudflared access ssh --hostname %h
```

with `TUNNEL_SERVICE_TOKEN_ID` and `TUNNEL_SERVICE_TOKEN_SECRET` exported
from that machine's env file; `cloudflared access` reads them, so nothing
secret sits in the SSH config. Close port 22 in the host firewall only after a second, new
session has come in through the tunnel; keep the first one open until then.

## A private-network route

For a non-HTTP service the owner reaches only from enrolled devices: on the
tunnel, a private-network route for the host's address (a `/32`, not the
whole LAN); in the client's device settings, make sure Split Tunnels sends
that address through Cloudflare (the default exclude list holds the private
ranges); and a Gateway network policy allowing the owner's identity to that
address and port, followed by a block for the same destination. No public
hostname exists for it.

## The locally managed override

A host set up by `deploy` keeps its ingress in `/etc/cloudflared/config.yml`
from the repository (`deploy`, `references/quadlet-units.md`), so the
routes are reviewed with the code. Then the credentials file is the
secret (0600, root), DNS records come from
`cloudflared tunnel route dns <tunnel> <hostname>`, and the origin check
is set per ingress rule:

```yaml
  - hostname: <app>.<zone>
    service: http://127.0.0.1:8080
    originRequest:
      access:
        required: true
        teamName: <team>
        audTag: [<aud tag>]
```

## Replacing a tunnel

When a host is rebuilt: create a new tunnel, move the routes, start the
new connector, check from outside, then delete the old tunnel, which
invalidates its token. A token that may have leaked from a running host
follows `credential-rotation`.
