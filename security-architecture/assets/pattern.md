# Pattern {{PATTERN_ID}}: {{PATTERN_NAME}}

| | |
|---|---|
| Owner | {{OWNER_ROLE}} |
| Approver | {{APPROVER_ROLE}} |
| Status | draft |
| Version | {{VERSION}} |
| Approved on | {{APPROVED_DATE}} |
| Review by | {{REVIEW_DATE}} |

## Problem

{{THE_RECURRING_DESIGN_PROBLEM_IN_ONE_PARAGRAPH}}

## Context

- **Applies when**: {{CONDITIONS}}
- **Out of scope**: {{EXCLUSIONS}}
- **Data tiers covered**: {{TIERS}}

## Forces

The concerns that pull against each other, so a reader can tell why the
solution is shaped as it is.

- {{FORCE}} against {{FORCE}}
- {{FORCE}} against {{FORCE}}

## Solution

Described as capabilities and required properties. Name no product; product
choices belong in decision records, listed below.

| Capability | Required properties |
|---|---|
| {{CAPABILITY}} | {{PROPERTIES_THAT_CAN_BE_CHECKED}} |

## Diagram

{{DIAGRAM_OR_LINK}}

The diagram shows trust boundaries, enforcement points, identity domains and
the data tier on each flow.

## Threats addressed

| Threat | STRIDE | Mitigated by | Principle |
|---|---|---|---|
| {{THREAT}} | {{S/T/R/I/D/E}} | {{CAPABILITY_ABOVE}} | {{P_ID}} |

### Residual risk

{{WHAT_REMAINS_AND_ITS_RATING_AGAINST_APPETITE}}

Accepted by: {{APPETITE_OWNER_OR_DELEGATE_ROLE}} on {{DATE}}

The pattern's status does not become approved until this acceptance is
recorded. A team using the pattern unchanged inherits the accepted risk and
does not need a separate acceptance for it.

## Conformance checklist

A team answers each item with yes or no from evidence. A no, or a variation
not listed below, sends the design to full review. A design that handles
the highest data tier goes to full review even when every item is yes.

- [ ] {{CHECKABLE_STATEMENT}} ({{P_ID}})
- [ ] {{CHECKABLE_STATEMENT}} ({{P_ID}})
- [ ] {{CHECKABLE_STATEMENT}} ({{P_ID}})

## Variations

| Variation | Allowed when | Extra check |
|---|---|---|
| {{VARIATION}} | {{CONDITION}} | {{CHECK}} |

## When not to use

- {{CONDITION_AND_WHERE_TO_GO_INSTEAD}}

## Related decision records

| Record | Product or option chosen | Status |
|---|---|---|
| {{DECISION_RECORD_ID}} | {{CHOICE}} | {{STATUS}} |

## Trace

- **Principles applied**: {{P_IDS}}
- **Principles departed from (and why)**: {{P_IDS_OR_NONE}}
- **Risk addressed**: {{RISK_REGISTER_ID_OR_THREAT_ASSET_CONSEQUENCE}}
- **Control mapping** ({{BASELINE_NAME_AND_VERSION}}): {{BASELINE_CONTROL_IDS}}

## Owner and review

Owner: {{OWNER_ROLE}}. Questions to {{CONTACT}}. Reviewed at least every
{{INTERVAL}} and when a threat, a principle or the baseline changes.

Status is the header status only (draft is proposed, superseded is
deprecated). If superseded: reason {{REASON}}; replacement
{{REPLACEMENT_OR_NONE}}; migration date {{DATE}}. Systems still on it carry an exception with an
owner and an end date.
