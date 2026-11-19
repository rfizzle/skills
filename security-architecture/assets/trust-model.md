# {{ORG_NAME}} trust model

| | |
|---|---|
| Owner | {{OWNER_ROLE}} |
| Approver | {{APPROVER_ROLE}} |
| Status | draft |
| Version | {{VERSION}} |
| Approved on | {{APPROVED_DATE}} |
| Review by | {{REVIEW_DATE}} |

## Purpose

This page states where trust changes at {{ORG_NAME}} and who or what
crosses each boundary. Threat models, patterns and design reviews draw on
it. Trust is attached to a proven identity and a policy, not to a network
location.

## Identity types

Enumerate all four types. A type with no revocation path is a standing
breach.

| Type | Issued by | Proved by | Scoped by | Revoked by |
|---|---|---|---|---|
| People | {{ISSUER}} | {{PROOF}} | {{SCOPE}} | {{REVOCATION}} |
| Workloads | {{ISSUER}} | {{PROOF}} | {{SCOPE}} | {{REVOCATION}} |
| Devices | {{ISSUER}} | {{PROOF}} | {{SCOPE}} | {{REVOCATION}} |
| Third parties | {{ISSUER}} | {{PROOF}} | {{SCOPE}} | {{REVOCATION}} |

Shared and static credentials are exceptions with an owner and an end date.

## Zones

Keep the number small. Production and non-production are separate zones.

| Zone | Data tiers | Exposure | Default rule between zones |
|---|---|---|---|
| {{ZONE}} | {{TIERS}} | {{EXPOSURE}} | Deny unless a row in the boundary table permits the flow |

## Diagram

{{DIAGRAM_OR_LINK}}

One page. It shows zones, identity systems, enforcement points and the
flows between them.

## Boundaries

One row per boundary crossing. A flow with no row does not exist; a flow
found with no row is a finding. Every crossing carries authentication,
authorisation, encryption in transit and a record held outside the system
it describes. The reference monitor result for each row is recorded in the
design review.

| Boundary | From | To | Identity proved by | Authorised by | Enforcement point | Logged where |
|---|---|---|---|---|---|---|
| {{BOUNDARY}} | {{ZONE}} | {{ZONE}} | {{METHOD}} | {{POLICY_SOURCE}} | {{COMPONENT}} | {{LOG_STORE}} |

## Administrative and control-plane access

The control plane (identity administration, platform management, key
management, the deployment pipeline, the logging system) is its own
boundary, in the highest tier.

- Separate administrator identities: {{HOW}}
- Time-limited, approved access, by two parties for changes: {{HOW}}
- Reached only from {{HARDENED_PATH}}, not from the general network.
- Its record is held at {{LOG_STORE}}, where administrators cannot alter it.

## Third parties

| Third party | What crosses | Identity proved by | May do | Access ends |
|---|---|---|---|---|
| {{THIRD_PARTY}} | {{DATA_OR_SERVICE}} | {{METHOD}} | {{PERMITTED_USE}} | {{END_CONDITION_AND_DATE}} |

The contract and the technical control agree: each contract term has an
enforcement point.

## Review triggers

Revise this page when any of these occur, and at the review date:

- a new or changed zone;
- a new identity system or identity provider;
- a new third party, or a change in what one may do;
- a change to administrative or control-plane access;
- {{ORGANISATION_SPECIFIC_TRIGGER}}
