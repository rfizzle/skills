# {{ORG_NAME}} data classification

| | |
|---|---|
| Owner | {{OWNER_ROLE}} |
| Approver | {{APPROVER_ROLE}} |
| Status | draft |
| Version | {{VERSION}} |
| Approved on | {{APPROVED_DATE}} |
| Review by | {{REVIEW_DATE}} |

## Purpose

This scheme sets the handling rules for data at {{ORG_NAME}}. Every data
set has a tier, and the tier decides how it is stored, moved, accessed,
shared and disposed of. The tier label is
set by the impact of loss of confidentiality, using the impact scale in the
risk appetite; integrity and availability impacts are recorded alongside it.

## Roles

| Role | Held by | Responsibility |
|---|---|---|
| Data owner | {{OWNER_ROLE_FOR_DATA}} | Classifies the data, approves access, reviews the tier |
| Custodian | {{CUSTODIAN_ROLE}} | Operates the systems that hold it and applies the handling rules |
| User | Anyone with access | Handles it by its tier and reports loss or exposure |

Security supplies the scheme, challenges outliers and checks the rules; it
does not classify data it does not own.

## Tiers

Use four tiers at most.

| Tier | Definition by impact | Examples at {{ORG_NAME}} |
|---|---|---|
| Public | Loss of confidentiality has no impact; may be published | {{EXAMPLES}} |
| Internal | Loss of confidentiality has minor or moderate impact (levels 1 to 2) | {{EXAMPLES}} |
| Confidential | Loss of confidentiality has major impact (level 3) | {{EXAMPLES}} |
| Restricted | Loss of confidentiality has severe or critical impact (levels 4 to 5), or breaches law | {{EXAMPLES}} |

Levels are those of the impact scale in the risk appetite. The tier label
is set by confidentiality impact because it drives the handling rules.
Integrity and availability impacts are recorded alongside the label, for
example "public, integrity high", and set the integrity and availability
controls.

Glossary: {{LOCAL_TERM}} means {{TIER}}.

## Handling rules

Each cell is checkable by a reviewer or a scanner. Replace the placeholders
with the rule that applies; do not leave a cell empty.

| Rule | Public | Internal | Confidential | Restricted |
|---|---|---|---|---|
| Encryption in transit | {{RULE}} | {{RULE}} | {{RULE}} | {{RULE}} |
| Encryption at rest | {{RULE}} | {{RULE}} | {{RULE}} | {{RULE}} |
| Access | {{RULE}} | {{RULE}} | {{RULE}} | {{RULE}} |
| Storage location | {{RULE}} | {{RULE}} | {{RULE}} | {{RULE}} |
| Logging (P9) | {{RULE}} | {{RULE}} | {{RULE}} | {{RULE}} |
| Sharing with third parties | {{RULE}} | {{RULE}} | {{RULE}} | {{RULE}} |
| Retention and disposal | {{RULE}} | {{RULE}} | {{RULE}} | {{RULE}} |
| Use in non-production | {{RULE}} | {{RULE}} | {{RULE}} | {{RULE}} |

## Rules

- **Default tier**: data with no label is internal until its owner
  classifies it.
- **Aggregation**: a collection takes the tier of the worst result of its
  loss, which may be higher than any of its parts. The owner of the
  collection classifies it.
- **Derived data**: inherits the highest tier of its inputs until the owner
  reclassifies it.
- **Reclassification**: the data owner may raise a tier at any time and
  records the reason.
- **Declassification**: lowering the tier. One approver, the data owner,
  records the decision with a date. Copying data to another place never
  changes its tier.

## Labelling

Label {{WHAT_IS_LABELLED}} using {{LABEL_METHOD}}. A label is visible to the
person handling the data and readable by tools. Where labelling is not
practical, the system carries the tier of the data it holds and the
register records it.

## Review cadence

The owner reviews each data set's tier at least every {{INTERVAL}}, and
after a change of use, a sharing arrangement or an incident. The scheme is
reviewed by {{OWNER_ROLE}} at least every {{INTERVAL}}.
