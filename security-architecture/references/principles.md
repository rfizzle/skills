# The principle set

Eleven principles. P1 to P8 are the eight design principles of Saltzer and
Schroeder (1975), under their original names. P9 is one of the two further
principles the same paper offered as "imperfectly applicable" to computer
systems. P10 and P11 are later additions the 1975 set does not contain.
Full citations are in `references/sources.md`.

## Contents

- Questions to ask first
- How to write a principle
- P1 to P8: the Saltzer and Schroeder principles
- P9 to P11: the additions
- What is deliberately not a principle
- How modern terms map back
- Adapting the set

## Questions to ask first

- Does the organisation already have principles (security, engineering or
  enterprise architecture)? Reconcile with them; do not publish a rival set.
- Who must be able to apply these unaided: architects only, or every
  engineering team? That sets the reading level and the examples.
- Which recent decision was argued without resolution? A good set would
  have settled it. Use it as the test case.

## How to write a principle

Each principle has five parts. A principle missing the last two will be
agreed with and ignored. The template adds a sixth, "Here, this means": one
example from the organisation's own systems, which is what makes people
recognise the principle.

- **Statement**: one sentence, imperative, able to make a design wrong.
- **Rationale**: why, in terms of what attackers and mistakes do.
- **Implications**: what a design must show. This is the part reviewers use.
- **Review question**: the single question to ask of any design.
- **Typical violation**: the form the failure usually takes.

## P1 to P8: the Saltzer and Schroeder principles

### P1 Economy of mechanism

- **Statement**: Keep the design of every security mechanism as simple and
  small as possible.
- **Rationale**: Security flaws are found by inspection, not by normal use,
  because normal use never exercises the path an attacker takes. Only a
  small mechanism can be inspected completely.
- **Implications**: One enforcement mechanism per decision, reused, in
  place of several partial ones. The components that must be correct for
  security to hold (the trusted computing base) are listed and kept short.
  Features are removed from security-critical components, not added.
- **Review question**: What must be correct for this to be secure, and can
  one person read all of it?
- **Typical violation**: Authorisation logic repeated, slightly differently,
  in each service.

### P2 Fail-safe defaults

- **Statement**: Base access on permission, not exclusion; the default is
  no access.
- **Rationale**: A mistake in an allow-list denies a legitimate request,
  which is noticed and reported. A mistake in a deny-list permits an
  illegitimate one, which is not.
- **Implications**: Default deny on networks, identities and data. New
  resources start private. On error, timeout or missing policy, the
  decision is deny, and the failure state leaks nothing.
- **Review question**: What happens when the check cannot be made?
- **Typical violation**: A policy engine that allows when it cannot reach
  its policy store.

### P3 Complete mediation

- **Statement**: Check every access to every object for authority, every
  time.
- **Rationale**: Any path that skips the check is the path an attacker
  uses. A decision cached past a change of authority is a skipped check.
- **Implications**: No resource is reachable except through an enforcement
  point. Authority is re-evaluated when it can have changed; cached
  decisions have a stated lifetime and a revocation path. Network position
  alone grants nothing.
- **Review question**: Is there any way to reach this without passing the
  check, and how long does a revoked permission keep working?
- **Typical violation**: Authorisation at the edge only, with internal
  calls trusted because they are internal.

### P4 Open design

- **Statement**: Security must not depend on the secrecy of the design;
  it depends only on the secrecy of keys and credentials.
- **Rationale**: Designs leak, are reverse engineered and are known to
  insiders. A secret design also cannot be reviewed. Keys can be changed
  when exposed; designs cannot. This is Kerckhoffs's 1883 principle for
  ciphers, generalised.
- **Implications**: Published, reviewed algorithms and protocols only.
  Designs are documented and open to internal review. Every secret is a
  rotatable value, held outside the code and the design.
- **Review question**: If an attacker had this document and the source,
  what would they still need?
- **Typical violation**: A home-made token format or an unlisted admin
  address treated as a control.

### P5 Separation of privilege

- **Statement**: Where practical, require two independent conditions to
  grant access or perform a critical action.
- **Rationale**: One compromised key, account or person then is not
  enough. The conditions must fail independently or they count as one.
- **Implications**: Multi-factor authentication for people. Two-person
  approval for changes to production, to identity and to the controls
  themselves. Separation of duties between requesting, approving and
  executing. Keys split or held by different parties for the highest tiers.
- **Review question**: Which single credential or person, if compromised,
  is sufficient on its own?
- **Typical violation**: An approver who can also approve their own change.

### P6 Least privilege

- **Statement**: Every user, program and process operates with the
  smallest set of privileges necessary for the job, for the shortest time.
- **Rationale**: Privilege held is damage available, to an attacker who
  takes the identity or to an error made with it.
- **Implications**: Permissions scoped to the task, not the role's
  convenience. Standing administrative access replaced by time-limited
  elevation. Workloads have their own identities with their own narrow
  grants. Unused permissions are measured and removed.
- **Review question**: If this identity were taken over now, what could it
  reach, and does the job need all of that?
- **Typical violation**: A shared service account with wide rights because
  narrowing it was never scheduled.

### P7 Least common mechanism

- **Statement**: Minimise the mechanisms shared between users or between
  trust levels.
- **Rationale**: Anything shared is a channel between its users and a
  single point whose compromise reaches all of them.
- **Implications**: Isolation between tenants, environments and data
  tiers. Production and non-production do not share credentials, networks
  or control planes. Shared services that must exist are treated as highest
  tier. The blast radius of each shared component is stated.
- **Review question**: What do these two things share, and what crosses
  between them if it is compromised?
- **Typical violation**: One deployment pipeline with write access to every
  environment.

### P8 Psychological acceptability

- **Statement**: Make the secure way the easy way, so people apply the
  protection correctly and routinely.
- **Rationale**: A control people work around does not exist, and it also
  hides the workaround from you.
- **Implications**: Secure defaults and paved roads over prohibitions.
  The user's mental model matches what the mechanism enforces. The cost a
  control puts on legitimate users is measured and counted in its design.
- **Review question**: What will a busy person do to get round this?
- **Typical violation**: Forced frequent password changes, answered with
  predictable increments.

## P9 to P11: the additions

### P9 Compromise recording

- **Statement**: Record security-relevant events reliably enough that a
  compromise is discovered and its extent can be established.
- **Rationale**: Prevention fails. Without a trustworthy record the
  organisation cannot know that it failed, or what was reached. (The 1975
  paper notes the limit: a system that is compromised may have its records
  altered, so the record must be protected from what it records.)
- **Implications**: Authentication, authorisation decisions, privilege
  changes and access to the highest data tier are logged. Logs leave the
  system that produced them and cannot be altered by its administrators.
  Detection has an owner and a tested response path.
- **Review question**: If this were compromised today, how would we know,
  and how would we tell what was taken?
- **Typical violation**: Logs stored on the host they describe, writable by
  the account they describe.

### P10 Defense in depth

- **Statement**: No single control stands alone between an attacker and a
  critical asset; layers are independent.
- **Rationale**: Every control has an unknown flaw. Layers help only when
  one flaw does not defeat several of them.
- **Implications**: For each critical asset, name the controls an attacker
  must defeat in sequence and show they do not share a failure (the same
  credential, the same vendor component, the same administrator).
  Preventive, detective and corrective controls each appear.
- **Review question**: If this control failed silently, what stops the
  attacker next?
- **Typical violation**: Several layers that all trust the same identity
  provider session.
- **Tension with P1**: Layers add mechanism. Add a layer only where it
  fails independently; otherwise it is complexity, not depth.

### P11 Assume breach

- **Statement**: Design as though an attacker already holds a position
  inside; limit what that position yields and how long it lasts.
- **Rationale**: Perimeters are crossed by phishing, supply chain and
  insiders. A design that is safe only while the inside is clean is not
  safe.
- **Implications**: Internal traffic is authenticated and encrypted.
  Segmentation limits lateral movement. Credentials are short-lived.
  Recovery (rebuild, rotate, restore) is designed and rehearsed, and its
  time is known.
- **Review question**: Starting from a compromised workstation or
  workload, what is the path to the highest-tier asset, and how fast can we
  cut it?
- **Typical violation**: A flat internal network where any host reaches the
  database tier.

## What is deliberately not a principle

- **Work factor** (the other "imperfectly applicable" 1975 principle):
  compare the cost of defeating a mechanism with the attacker's resources.
  It is a way of reasoning used in risk analysis
  (`references/risk-and-threat.md`),
  not a rule a design can be checked against.
- **Confidentiality, integrity, availability**: these are the properties
  being protected, the "what". They belong in classification and risk
  statements. Principles are the "how".
- **Zero trust**: an architecture built from P2, P3, P6 and P11. Treat it
  as a pattern family, not a twelfth principle.
- **Compliance**: an obligation and a source of evidence, never a
  principle. See `references/control-framework.md`.

## How modern terms map back

Use this when someone asks where a current practice comes from.

| Modern term | Principles |
|---|---|
| Zero trust, continuous verification | P3, P2, P6, P11 |
| Default deny, allow-listing, secure by default | P2 |
| Just-in-time access, scoped tokens | P6 |
| Multi-factor authentication, two-person rule | P5 |
| Tenant isolation, sandboxing, segmentation | P7, P11 |
| Minimal trusted computing base, attack surface reduction | P1 |
| No security through obscurity, standard cryptography | P4 |
| Paved roads, usable security, passkeys | P8 |
| Audit logging, detection engineering | P9 |
| Policy enforcement point | P3 (the reference monitor: always invoked, tamper-proof, small enough to verify, which is P3 with P1) |
| Resilience, recovery objectives | P11 |

## Adapting the set

- Keep the IDs. Rename, reword and add local examples freely.
- Add a principle only with all five parts and a design it would have
  changed. Privacy by design and resilience are the usual candidates; many
  organisations fold them into P6 and P11.
- Record the tensions the organisation meets (P10 against P1, P9 against
  privacy, P8 against P5) and how it resolves them. The resolutions are the
  most reused part of the document.
- Have the charter's approver approve the set. Principles nobody approved
  are suggestions.
