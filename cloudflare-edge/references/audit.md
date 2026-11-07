# Exposure list and audit

## The exposure list

One per host, in the repository that owns the host (`docs/edge.md`), or
the owner's notes for an appliance. One row per hostname or open port:

```markdown
| Hostname or port | Tunnel | Row | Policy or reason | App session | Checked |
|---|---|---|---|---|---|
| nas.<zone> | <host> | owner | owner | 24h | 2026-11-08 |
| www.<zone> | <host> | public | public site; WAF, rate limit | - | 2026-11-08 |
| udp <game port> | - | public | game traffic, cannot be proxied (override) | - | 2026-11-08 |
```

A row with no policy and no reason is the finding.

## The outside check

Run from a network without the Cloudflare One Client (a phone hotspot, a
host that is not enrolled) or with the client off:

```sh
# hosts.txt: the list's hostnames, one per line
while read -r h; do
  printf '%-32s ' "$h"
  curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "https://$h/"
done < hosts.txt
```

- Access rows: `302` to `https://<team>.cloudflareaccess.com/...`. A `200`
  is an exposure, unless the client is still on.
- Public rows: the app's status, or `403` with a `cf-mitigated: challenge`
  header when a challenge rule matched.
- A route with no healthy connector shows a tunnel error page; a CNAME
  with no route shows one too.
- Ports: from the same network, `nmap -Pn` (or the owner's port checker) on
  the host's public address finds only the ports the list names.

Then turn the client on and open each owner row once.

## Public zones

Set once per zone that serves a public hostname:

- SSL/TLS mode Full (strict); Always Use HTTPS; minimum TLS 1.2; DNSSEC on.
- The managed WAF ruleset on (on by default for the free plan's ruleset).
- One rate-limiting rule on the API host and path prefix, generous enough
  for many people behind one carrier address (about 30 requests per 10
  seconds per address, block for 10 seconds); the app keeps its own finer
  limits.
- Bot Fight Mode on only when the zone serves no API to scripts or apps.
- A Worker's wrangler config: `workers_dev = false`, `preview_urls = false`,
  so the API has no address outside the zone's rules.
- HSTS from the app or a response-header rule; `includeSubDomains` and
  preload only when every name on the zone is HTTPS for good.

## The quarterly audit

The owner runs it; the agent may prepare the lists through the API with a
read-only token.

1. **Hostnames**: every route on every tunnel, and every DNS record on
   each zone. Each one is in an exposure list with a policy or a reason;
   CNAMEs to `cfargotunnel.com` with no route are deleted; A and AAAA
   records naming a home or host address are either on the list or
   removed.
2. **Access**: every application matches a live hostname; no Bypass
   policy; no Include rule of Everyone or a bare login method; the
   `people` policy lists only current people.
3. **Tunnels**: one per host, each Healthy, each connector's version
   current (the tunnel's connector list, or `cloudflared --version` on the
   host); no tunnel for a host that is gone.
4. **Service tokens**: each still used, its expiry more than a month away,
   and the Expiring Access Service Token notification on.
5. **Devices**: only the owner's current devices are enrolled; revoke the
   rest.
6. **Ports**: the outside check above, with the date written in the list.
