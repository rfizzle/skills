---
name: cloudflare-edge
description: Use this skill when putting a self-hosted service on the internet through Cloudflare or checking one - a NAS and its apps, a media server, an admin or game-server panel, SSH to a host, a static site with Worker APIs - with cloudflared tunnels, Zero Trust Access applications and policies, WARP, service tokens, tunnel DNS records, WAF, bot and rate-limit settings, and session lengths. Triggers include "expose this without opening a port", "is the panel worth putting behind Access", "is this the right place to protect the tunnels", "block SSH from the internet", "turn off the vendor's remote access", "do the others need hostnames", "protect the website and the APIs", "keep me logged in longer", "the firewall policies page is empty" and "everything looks open from my machine". Not for the service's units and host baseline (deploy), the app's own sign-in and Access JWT middleware (go-auth), rotating a leaked tunnel token (credential-rotation), or handing a secret to the agent (guided-ops).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Cloudflare edge

Every service the owner runs reaches the internet through Cloudflare, and
the same questions kept coming back in new words: is this the right place
for the protection, is the panel worth putting behind Access, do the others
need hostnames, why does the client keep logging out. Answers were
improvised each time. One NAS was broken into through its vendor's relay
while a tunnel sat beside it unused; one agent tested hostnames from a
machine running the Cloudflare One Client, saw them open, and reported an
exposure that did not exist. This is the one way a service is exposed.
Each rule is a default; a project's `AGENTS.md`, a decision record or the
host's exposure list may override it with a written reason.

The owner does the dashboard steps (`guided-ops`); the agent writes the
checklist, the host files and the outside check, or makes the changes
through the API with a token scoped to tunnel, zone DNS and Access edit.

## Who reaches it decides how

| Reached by | Exposure | Why |
|---|---|---|
| The owner, over HTTP(S) | tunnel route + Access application with the reusable `owner` policy | a pre-auth bug in the app is out of reach of anyone who has not passed Access |
| The owner, non-HTTP (SMB, a database port) | tunnel private-network route reached only from enrolled devices, a Gateway network policy allowing the owner, no public hostname | nothing is published, so there is no name to find |
| Named people | Access application with the `people` policy: their emails, login by one-time PIN | strangers never see the sign-in page, and the people need no Cloudflare account |
| The public | tunnel route with no Access; the zone's managed WAF rules, a rate-limiting rule on API paths, Bot Fight Mode unless the zone serves an API to scripts or apps | the app's own controls face everyone, so the edge drops floods and known exploits first |
| Machines | Access application with the `machines` policy (action Service Auth) and a service token; mTLS where the client already holds a certificate | a script cannot finish a browser login |

An admin surface (anything that runs commands, changes configuration or
holds secrets: a NAS's admin page, a game-server panel, a metrics UI) is
an owner row even when the app has its own login.

Never, whatever the row:

- **A router port forward**: it hands the app's login, and every pre-auth
  bug in it, to the whole internet.
- **A vendor relay** (a NAS's own remote-access service or cloud ID): it
  relays raw traffic to the login page; a random ID hides nothing from an
  exploit. Disable it, and on a rebuild skip it in the setup wizard.
- **A public SSH port**: SSH is a tunnel route to `ssh://localhost:22` with
  an `owner` Access application in front and `cloudflared access ssh` as
  the client's proxy command; port 22 closes once that path is proven.
- **A proxied DNS record in front of an open port**: anyone with the
  origin address skips Cloudflare; origins bind to loopback.
- **A Bypass policy**: it turns Access off for matching requests and logs
  nothing.

The usual written override: a public protocol Cloudflare cannot proxy,
such as a game's UDP ports, stays on an unproxied record, opened in the
host firewall port by port; the game's panel still goes through the tunnel.

## A new hostname

1. **Pick the row** and add the hostname to the host's exposure list
   (`references/audit.md`) with its policy, or the reason it has none.
2. **Tunnel**: the host's tunnel, one per host and named for it. Creating
   it, and where its token goes: `references/tunnel-host.md`.
3. **Route**: on that tunnel, a published application route from the
   hostname to `http://localhost:<port>`, the service bound to loopback
   (`deploy`). The dashboard route creates the proxied CNAME to
   `<tunnel-id>.cfargotunnel.com`; no other DNS record names the service.
4. **Access application**: self-hosted, the exact hostname, with the
   row's reusable policy, each defined once under Policies: `owner` allows
   the owner's emails, `people` the named emails, `machines` the service
   token. Public rows get none.
5. **Origin check**: on the route's Access setting, turn on protection with
   the team name and the application's AUD tag, so `cloudflared` itself
   refuses a request that did not pass Access.
6. **Sessions** (where each lives is in the table below):
   - Access global session: 24 hours, the default.
   - Application session: 24 hours for admin surfaces and SSH; up to one
     week for an everyday app.
   - Cloudflare One Client authentication (beta; Allow and Block policies
     only): on for applications the owner opens from enrolled devices, with
     a 30-day session (the maximum is 90).
     It overrides the application and policy durations, so it is the
     answer to "stay logged in longer" and is never on for `people` apps.
   - Client (Gateway) session: unset, which is unlimited. It exists only on
     a Gateway Network or HTTP Allow policy that enforces one.
7. **Public rows only**: the zone settings in `references/audit.md`
   (Public zones); a Worker API also sets `workers_dev = false` and
   `preview_urls = false` in its wrangler config.
8. **Check from outside**, with the client off or from a network without
   it: an Access row redirects to the team's Access login, never the app's
   page; a port scan of the host's address finds nothing new. Then turn
   the client on and use the app. Commands: `references/audit.md`.

## Where things live

Product areas, not click paths: the dashboard renames and moves pages
often, so search the dashboard for the area's name when a path below is
gone, and say in an answer which name was used.

| What | Where (names as of late 2026) |
|---|---|
| Tunnels, their routes and connectors | Networking → Tunnels (also listed in the Zero Trust dashboard under Networks) |
| Access applications, reusable policies | Zero Trust → Access controls → Applications, and Policies |
| Service tokens | Zero Trust → Access controls → Service credentials |
| Global session, Cloudflare One Client authentication | Zero Trust → Access controls → Access settings |
| Login methods, one-time PIN | Zero Trust → Integrations → Identity providers |
| Gateway policies, client session | Zero Trust → Traffic policies → Firewall policies |
| Enrolled devices | Zero Trust → Team & Resources → Devices |
| WAF managed, custom and rate-limiting rules | the zone's Security → Security rules |
| Bot Fight Mode, security settings | the zone's Security → Settings |
| Records, DNSSEC | the zone's DNS |

## The app side

- Access is an outer guard: the app keeps its own login, and a Go service
  verifies `Cf-Access-Jwt-Assertion` (`go-auth`, `references/external-identity.md`).
- TLS ends at the edge: the unit publishes the app's port on `127.0.0.1`
  only, and the host admits nothing inbound (`deploy`, `references/host-setup.md`).

## Hygiene

- One tunnel per host, named for the host; never one token on two hosts,
  so deleting a host's tunnel cuts only that host.
- The tunnel token (or a locally managed tunnel's credentials file) is a
  secret: it sits in the host's 0600 env file, never on a command line, in
  a compose file, a unit's `ExecStart` or a chat. The owner hands it over
  under `guided-ops`; one that may have leaked is replaced under
  `credential-rotation`; a rebuilt host gets a new tunnel.
- `cloudflared` updates through the host's package manager or a pinned
  image bumped by Renovate, never a curl-pipe or its own updater.

## Gotchas

- Access does nothing for a hostname that is not in an application. A
  route added without one is public. On a zone that serves nothing public,
  a catch-all `*.<zone>` application with the `owner` policy closes any
  hostname someone forgets; check the application order in the dashboard
  after adding one beside it.
- The Cloudflare One Client on the owner's machine makes everything look
  open there: Access accepts the device's identity. Test from a clean
  network or with the client off before calling anything exposed.
- An empty Firewall policies page is normal for an Access-only setup;
  Gateway policies are for traffic leaving enrolled devices, not for
  protecting hostnames. Nothing is missing.
- The WAF applies per zone, Access per application. A hostname on another
  zone, or the Worker's `workers.dev` address, skips the zone's rules.
- Native apps (a password manager's apps, a media server's TV and phone
  apps) cannot finish a browser login. On the owner's enrolled devices,
  Cloudflare One Client authentication covers them; for anyone else, a
  service token where the app can send headers, otherwise a written
  override. Never a Bypass on the API paths.
- Deleting a route leaves its CNAME behind; the audit removes it.
- A device missing from Devices was revoked or had the client's data
  cleared; look there before re-enrolling.

## Definition of done

- The hostname's row is in the host's exposure list, with its policy or
  the reason it has none.
- Its only DNS record is the tunnel route's CNAME; the origin listens on
  loopback; no port forward, vendor relay or public SSH port exists.
- Non-public hostnames have an Access application with a reusable policy,
  no Bypass, and the origin check on the route.
- The outside check ran with the client off and showed the Access login
  or the challenge.
- The tunnel token is in the host's env file only.

## References

- `references/tunnel-host.md`: open when creating a host's tunnel, running
  `cloudflared` under systemd or in a container, adding SSH or a
  private-network route, or using a locally managed tunnel.
- `references/audit.md`: open when writing a host's exposure list, setting
  a public zone, running the outside check, or doing the quarterly audit.
