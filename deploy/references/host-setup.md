# Host setup

Once per host, then once per service user. Debian stable with Podman 5.
Commands marked `sudo` run as the administrator; the rest run as the
service user, reached with `sudo machinectl shell <app>@` (not `sudo -u`,
which leaves `systemctl --user` without a bus).

## Contents

- Packages
- The service user
- Env files
- Units
- Unattended upgrades and auto-update
- Journald
- Firewall
- Proving it

## Packages

```sh
sudo apt install podman passt uidmap restic curl systemd-container \
  unattended-upgrades nftables
```

`cosign` from its GitHub release with the checksum verified, or the distro
package where it is current. `cloudflared` from Cloudflare's apt
repository (`references/quadlet-units.md`, The tunnel).

## The service user

```sh
sudo useradd --create-home --shell /bin/bash <app>     # no password: key or machinectl only
grep <app> /etc/subuid /etc/subgid                    # a range each, or rootless fails
sudo loginctl enable-linger <app>                      # units survive logout and start at boot
```

Two environments on one host are two users (`<app>-staging`,
`<app>-prod`), each with its own units, volumes and loopback port.

## Env files

```sh
sudo install -d -m 0755 /etc/<app>
for f in <env>.env <env>.db.env <env>.restic.env; do
  sudo install -m 0600 -o <app> -g <app> /dev/null /etc/<app>/$f
done
```

Fill them from the owner's machine; the clear text never touches disk
there and never enters a CI job:

```sh
sops --decrypt deploy/<env>/<env>.env | ssh <host> 'sudo -u <app> tee /etc/<app>/<env>.env >/dev/null'
```

## Units

```sh
mkdir -p ~/.config/containers/systemd ~/.config/systemd/user ~/backups ~/.local/state/<app>
# copy deploy/quadlet/* and deploy/<env>/*.d/ into ~/.config/containers/systemd/
# copy deploy/systemd/* into ~/.config/systemd/user/
/usr/libexec/podman/quadlet -dryrun -user >/dev/null    # fails loudly on a bad unit
```

Then the first deploy is the normal one in `docs/runbooks/deploy.md`, and
`systemctl --user enable --now <app>-backup.timer`.

## Unattended upgrades and auto-update

```sh
sudo dpkg-reconfigure -plow unattended-upgrades
```

In `/etc/apt/apt.conf.d/52unattended-upgrades-local`: add Cloudflare's
origin to `Unattended-Upgrade::Origins-Pattern` so `cloudflared` stays
current, and set `Unattended-Upgrade::Automatic-Reboot "true";` with a
`-Time` outside working hours. Linger and `[Install]` bring the units back.

`podman auto-update` stays off; pins move only in a deploy:

```sh
sudo systemctl disable --now podman-auto-update.timer
systemctl --user disable --now podman-auto-update.timer   # as each service user
grep -r '^AutoUpdate=' ~/.config/containers/systemd/      # prints nothing
```

## Journald

```ini
# /etc/systemd/journald.conf.d/retention.conf
[Journal]
Storage=persistent
SystemMaxUse=2G
MaxRetentionSec=30day
```

`sudo systemctl restart systemd-journald`. The service user reads its
units' logs with `journalctl --user -u <app>`.

## Firewall

Nothing inbound. Before turning it on, make sure SSH works through the
tunnel (a Cloudflare Access application on an `ssh.<host>.<zone>` ingress
to `ssh://127.0.0.1:22`, `cloudflare-edge`) or through the provider's console; otherwise this
locks the owner out.

```text
# /etc/nftables.conf
#!/usr/sbin/nft -f
flush ruleset
table inet filter {
  chain input {
    type filter hook input priority 0; policy drop;
    iif lo accept
    ct state established,related accept
    meta l4proto ipv6-icmp accept
  }
  chain forward {
    type filter hook forward priority 0; policy drop;
  }
}
```

`sudo systemctl enable --now nftables`. Rootless containers reach the
network through `pasta` in user space, so a dropped forward chain does not
affect them; the tunnel is outbound only.

## Proving it

After setup and after any baseline change:

```sh
sudo reboot
# then, as the service user:
systemctl --user is-active <app> <app>-postgres <app>-backup.timer
curl -fsS http://127.0.0.1:8080/readyz
# as the administrator:
sudo nft list ruleset | grep 'policy drop'
```

From another machine, a port scan of the host's public address finds
nothing open.
