# {{ORG_NAME}} risk appetite

| | |
|---|---|
| Owner | {{OWNER_ROLE}} |
| Approver | {{APPROVER_ROLE}} |
| Status | draft |
| Version | {{VERSION}} |
| Approved on | {{APPROVED_DATE}} |
| Review by | {{REVIEW_DATE}} |

## Purpose

This document states how much loss {{ORG_NAME}} will tolerate, by category.
Security design reviews, exception approvals and risk reports are measured
against it. The appetite as a whole states a tolerable loss; a level of
none is used only where an executive signs that no loss is acceptable
(usually safety).

## Owner of risk appetite

Risk appetite belongs to {{APPETITE_OWNER_ROLE}} (an executive or the
board), not to the security function. The owner accepts, in writing, the
levels below. The security function measures, advises and reports against
them.

Who may accept a risk is set by its band, in one place: the table under
"Risk acceptance and exception approval" below. Above appetite, acceptance
needs {{RISK_OWNER_ROLE}} plus {{EXECUTIVE_APPROVER_ROLE}} (normally
{{APPETITE_OWNER_ROLE}} or their delegate); nobody below that level accepts
risk above appetite.

## Threat sources

The sources of harm this document and the threat models consider. Do not
model an adversary that is not listed.

| Source | Capability | Intent | Examples |
|---|---|---|---|
| External criminal | {{CAPABILITY}} | {{INTENT}} | {{EXAMPLES}} |
| Insider | {{CAPABILITY}} | {{INTENT}} | {{EXAMPLES}} |
| Supplier or third party | {{CAPABILITY}} | {{INTENT}} | {{EXAMPLES}} |
| State | {{CAPABILITY}} | {{INTENT}} | {{EXAMPLES}} |
| Accidental | {{CAPABILITY}} | {{INTENT}} | {{EXAMPLES}} |

Remove a source that does not apply, with one line saying why.

## Rating scales

Use these scales for every risk statement and threat model. Do not create
local scales.

### Impact

| Level | Money | People | Time |
|---|---|---|---|
| 1 Minor | Under {{AMOUNT}} | {{PEOPLE_DEFINITION}} | Under {{DURATION}} disruption |
| 2 Moderate | {{AMOUNT}} to {{AMOUNT}} | {{PEOPLE_DEFINITION}} | {{DURATION}} to {{DURATION}} |
| 3 Major | {{AMOUNT}} to {{AMOUNT}} | {{PEOPLE_DEFINITION}} | {{DURATION}} to {{DURATION}} |
| 4 Severe | {{AMOUNT}} to {{AMOUNT}} | {{PEOPLE_DEFINITION}} | {{DURATION}} to {{DURATION}} |
| 5 Critical | Over {{AMOUNT}} | {{PEOPLE_DEFINITION}} | Over {{DURATION}} |

### Likelihood

| Level | Definition | Frequency |
|---|---|---|
| 1 Rare | {{DEFINITION}} | Less than once in {{N}} years |
| 2 Unlikely | {{DEFINITION}} | Once in {{N}} to {{N}} years |
| 3 Possible | {{DEFINITION}} | Once in {{N}} years |
| 4 Likely | {{DEFINITION}} | Once a year |
| 5 Almost certain | {{DEFINITION}} | More than once a year |

## Rating grid

Likelihood by impact, read against appetite. The threat model Rating and
the exception residual level are read off this grid. This is a default;
{{APPETITE_OWNER_ROLE}} adjusts the zones, and where a category has a
measurable tolerance the "inside tolerance" zone ends where that tolerance
is reached.

| Likelihood \ Impact | 1 Minor | 2 Moderate | 3 Major | 4 Severe | 5 Critical |
|---|---|---|---|---|---|
| 5 Almost certain | Above tolerance | Above tolerance | Above appetite | Above appetite | Above appetite |
| 4 Likely | Inside tolerance | Above tolerance | Above tolerance | Above appetite | Above appetite |
| 3 Possible | Inside tolerance | Inside tolerance | Above tolerance | Above tolerance | Above appetite |
| 2 Unlikely | Inside tolerance | Inside tolerance | Inside tolerance | Above tolerance | Above tolerance |
| 1 Rare | Inside tolerance | Inside tolerance | Inside tolerance | Inside tolerance | Above tolerance |

Zones: inside tolerance (the measurable limit is not reached), above
tolerance (the limit is exceeded, within what {{APPETITE_OWNER_ROLE}} has
accepted), above appetite (beyond what has been accepted).

## Appetite by category

| Category | Appetite level | Tolerance (measurable) |
|---|---|---|
| Customer data confidentiality | {{LEVEL}} | {{MEASURE}} |
| Service availability | {{LEVEL}} | {{MEASURE}} |
| Financial integrity | {{LEVEL}} | {{MEASURE}} |
| Regulatory | {{LEVEL}} | {{MEASURE}} |
| Safety | {{LEVEL}} | {{MEASURE}} |
| {{CATEGORY}} | {{LEVEL}} | {{MEASURE}} |

Appetite levels: none, very low, low, moderate, high. None needs an
executive signature. Remove categories that do not apply, with one line
saying why.

## Risk statement format

Write each risk as threat, asset, consequence:

> {{THREAT_SOURCE_AND_ACTION}} against {{ASSET}} leads to {{CONSEQUENCE}}.
> Likelihood: {{LEVEL}}. Impact: {{LEVEL}}. Category: {{CATEGORY}}.

A risk with no named asset or no consequence is not entered in the
register. Reference the register ID in documents that trace to the risk;
without a register, write the statement inline.

## How appetite is applied

### Design review triage

| Tier | Worst credible outcome | Review |
|---|---|---|
| Tier 1 | Wholly inside tolerance, a trigger is met, and an approved pattern is followed unchanged | Self-assessment against the pattern's checklist; filed and sampled by the function |
| Tier 2 | A trigger is met and any of: worst credible outcome above tolerance in any category, no approved pattern, a departure from a pattern, or the highest data tier | Full design review before build; this is the gate |

Tiers are defined in `references/governance.md`.

### Risk acceptance and exception approval

This table applies to every acceptance of risk: an exception, an accepted
threat in a threat model, and a pattern's residual risk.

| Band | May approve | Maximum duration |
|---|---|---|
| Inside tolerance | {{RISK_OWNER_ROLE}} | {{DURATION}} |
| Above tolerance | {{RISK_OWNER_ROLE}} | {{DURATION}} |
| Above appetite | {{RISK_OWNER_ROLE}} plus {{EXECUTIVE_APPROVER_ROLE}} | {{DURATION}} |

Security architecture recommends at every band and approves none. No
duration exceeds the maximum in the charter. Every exception has an owner
and an end date.

## Review cadence

Reviewed at least every {{INTERVAL}} by {{APPETITE_OWNER_ROLE}}, and after
any incident that exceeded a tolerance, a change in regulation or strategy,
or a material change in the scale of the business.
