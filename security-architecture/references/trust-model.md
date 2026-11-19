# Trust model

Layer 4 says where trust changes and who crosses each boundary. It is the
map that the threat model, the patterns and the design review all draw on.
A trust model is short: one diagram and one boundary table, with small
supporting tables for identity types, zones and third parties. Sources are in
`references/sources.md`.

## Questions to ask first

- What are the organisation's identity systems today, and how many are
  there? Each separate one is a boundary of its own.
- Which environments exist (production, non-production, build, corporate),
  and which of them can reach which?
- Who holds administrative access to the platforms everything else runs on,
  and how do they get it?
- Which third parties connect in, or hold data, or ship code into the
  organisation?
- Is any part of the estate under a different owner (a subsidiary, a joint
  venture, a customer-hosted instance)?

## Definitions

- **Trust boundary**: a place where the level of trust changes, and so a
  check is required. A boundary without a check is a drawing, not a
  control.
- **Subject**: the thing acting (a person, workload, device or third
  party).
- **Object**: the thing acted on (data, service, function).
- **Enforcement point**: the component that checks the subject's authority
  over the object at the boundary and permits or refuses.

Boundaries are drawn where owner, identity domain, data tier, exposure or
privilege differ. Two things in the same zone with the same owner are not
separated by a boundary just because they are different servers.

## The reference monitor test

Apply the reference monitor test (Anderson, 1972) to every enforcement
point. It must be:

1. **Always invoked**: no path to the object avoids it. This is P3, complete
   mediation. A second route (a direct database port, a back-office
   interface, a management endpoint) fails the test however good the
   first route is.
2. **Tamper-proof**: the subject it checks cannot alter it, its policy or
   its record of decisions. Where the subject's own administrators can,
   the check is advisory.
3. **Small enough to verify**: its code and policy can be read and tested
   completely. This is P1, economy of mechanism. A gateway that also
   transforms payloads and runs business rules is too large.

The design review records a pass or fail against all three for each row of
its boundary table. A fail is a finding with a principle, not a note.

## Identity, not network location

Trust is attached to a proven identity and a policy, not to an address or a
network segment (NIST SP 800-207). Being "inside" grants nothing. This is
P3 and P11 together.

In SP 800-207 terms, a policy decision point decides and a policy
enforcement point carries the decision out. Name both for each boundary;
where one component plays both roles, say so, because it is then a larger
trusted component (P1).

### Identity types to enumerate

Enumerate four types. For each, record how it is issued, proved, scoped and
revoked. A type with no revocation path is a standing breach.

| Type | Issued | Proved by | Scoped by | Revoked by |
|---|---|---|---|---|
| People | Joiner process from an authoritative record | Two independent factors (P5) | Role plus task, time-limited elevation (P6) | Leaver or change event, with a stated delay |
| Workloads | At deploy, by the platform, not by a person | Short-lived credential bound to the workload | Narrow grant per workload (P6) | Expiry, plus explicit revocation on retirement |
| Devices | Enrolment by the organisation | Device credential plus a posture check | Access tier by device state | Unenrol or fail posture |
| Third parties | Sponsored by a named internal owner | Federation or issued credential, with two factors for people | Per contract, per system | Contract end, with an expiry date on every grant |

Shared and static credentials appear in none of these rows. Where one
exists, it is an exception with an owner and an end date.

## Zones and the default-deny rule

Define zones by data tier and exposure: for example internet-facing,
internal general, restricted data, and administrative. Keep the number
small. Production and non-production are always separate zones (P7).

Between any two zones the rule is deny unless a documented flow permits it
(P2). Each permitted flow is a row in the boundary table. A flow with no
row does not exist; discovered flows with no row are findings. Do not allow
"any" on source or destination in the permitting rule.

## What every crossing carries

Every boundary crossing has all four, and the table says how:

- **Authentication** of the subject (and of the object's service where it
  matters).
- **Authorisation** against a policy, per request, not per session where
  the data tier is restricted (P3).
- **Encryption in transit**, including inside a zone for confidential and
  above (P11).
- **A record** of the decision and the outcome, held outside the system it
  describes (P9).

A crossing missing one of the four is a design defect, or an accepted risk
with an owner.

## Administrative and control-plane access

The control plane (identity administration, platform and orchestration
management, key management, the deployment pipeline, the logging system)
can change every other boundary. It is therefore its own boundary, in the
highest tier, and is drawn explicitly.

- Administrators use separate identities from their ordinary ones.
- Access is time-limited and approved, by two parties for changes (P5, P6).
- It is reached only from a hardened, separate path, not from the general
  corporate network.
- Its record is held where the administrators cannot alter it (P9).

If the control plane is reachable from a lower zone, every boundary beneath
it is only as strong as that path.

## Third parties and supply chain

Treat each as a boundary: a supplier with data, a service that calls in, a
software dependency, a vendor's remote support route, a build tool that
ships code. What crosses, who proves identity, what the third party may do
with it, and how access ends belong in the table. The contract and the
technical control must agree; a contract term with no enforcement point is
a hope. Code and packages entering the build are a boundary into the
control plane, so give them provenance checks.

## Writing it down

Keep the trust model to one page of diagram and one boundary table, with
the supporting tables, in `assets/trust-model.md`. The diagram
shows zones, the identity systems, the enforcement points, and the flows
between them. The table has one row per boundary crossing:

| Boundary | From | To | Identity proved by | Authorised by | Enforcement point | Logged where |
|---|---|---|---|---|---|---|
| {{BOUNDARY}} | {{ZONE}} | {{ZONE}} | {{METHOD}} | {{POLICY_SOURCE}} | {{COMPONENT}} | {{LOG_STORE}} |

The reference monitor result and the principle trace go in the design
review (`assets/design-review.md`), not in this page. The trust model has
the same header and review date as other documents; it is reviewed when a
zone, an identity system or a third party changes. It is its own page,
with no Trace block, because the other documents trace to it.

## Common failures

- Network location treated as identity: "internal" calls trusted.
- An enforcement point with a second route round it.
- Workload and third-party identities left out of the enumeration.
- A control plane reachable from the general network.
- A flow in production that is in no table.
- Boundaries drawn at every server, so the diagram cannot be read.
- Logs of boundary decisions written to the enforcement point's own host.
