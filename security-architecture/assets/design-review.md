# Design review: {{SYSTEM_NAME}}

| | |
|---|---|
| Owner | {{OWNER_ROLE}} |
| Approver | {{APPROVER_ROLE}} |
| Status | draft |
| Version | {{VERSION}} |
| Approved on | {{APPROVED_DATE}} |
| Review by | {{REVIEW_DATE}} |

This template is for tier 2 reviews. A tier 1 change files the pattern's
conformance checklist instead of this document.

## Summary

| | |
|---|---|
| System | {{SYSTEM_NAME}} |
| Requester | {{REQUESTER}} |
| Date | {{REVIEW_DATE_HELD}} |
| Reviewer | {{REVIEWER}} |
| Design version reviewed | {{DESIGN_VERSION_OR_LINK}} |
| Triage tier | 2 |
| Trigger that caused review | {{TRIGGER}} |

## What is changing

{{DESCRIPTION_OF_THE_CHANGE_AND_WHY}}

## Data handled and its classification

| Data | Classification | Where it is stored or sent |
|---|---|---|
| {{DATA}} | {{TIER}} | {{LOCATION}} |

## Trust boundaries crossed

| Boundary | From | To | Enforcement point | Authentication | Authorised by | Encrypted | Logged where | Reference monitor (invoked / tamper-proof / small: pass or fail) |
|---|---|---|---|---|---|---|---|---|
| {{BOUNDARY}} | {{ACTOR_OR_SYSTEM}} | {{ACTOR_OR_SYSTEM}} | {{WHERE_ENFORCED}} | {{HOW}} | {{POLICY_SOURCE}} | {{YES_OR_NO_AND_HOW}} | {{LOG_STORE}} | {{PASS_OR_FAIL_X3}} |

A fail on any reference monitor property is a finding with a principle.

## Patterns applied and departures

| Pattern | Applied as written? | Departure and reason |
|---|---|---|
| {{PATTERN_ID}} | {{YES_OR_NO}} | {{DEPARTURE_OR_NONE}} |

## Principle check

Answer each question for this design. A row with no finding says "none".

| Principle | Review question answered | Finding ref |
|---|---|---|
| P1 Economy of mechanism | {{ANSWER}} | {{FINDING_ID_OR_NONE}} |
| P2 Fail-safe defaults | {{ANSWER}} | {{FINDING_ID_OR_NONE}} |
| P3 Complete mediation | {{ANSWER}} | {{FINDING_ID_OR_NONE}} |
| P4 Open design | {{ANSWER}} | {{FINDING_ID_OR_NONE}} |
| P5 Separation of privilege | {{ANSWER}} | {{FINDING_ID_OR_NONE}} |
| P6 Least privilege | {{ANSWER}} | {{FINDING_ID_OR_NONE}} |
| P7 Least common mechanism | {{ANSWER}} | {{FINDING_ID_OR_NONE}} |
| P8 Psychological acceptability | {{ANSWER}} | {{FINDING_ID_OR_NONE}} |
| P9 Compromise recording | {{ANSWER}} | {{FINDING_ID_OR_NONE}} |
| P10 Defense in depth | {{ANSWER}} | {{FINDING_ID_OR_NONE}} |
| P11 Assume breach | {{ANSWER}} | {{FINDING_ID_OR_NONE}} |

## Findings

Severity is blocking, conditional or advisory.

| ID | Principle | Risk | Severity | Required change | Owner | Due |
|---|---|---|---|---|---|---|
| {{FINDING_ID}} | {{P_ID}} | {{THREAT_ASSET_CONSEQUENCE_OR_REGISTER_ID}} | {{SEVERITY}} | {{REQUIRED_CHANGE_OR_ACCEPTED_ALTERNATIVE}} | {{OWNER}} | {{DUE_DATE}} |

## Outcome

Outcome: {{APPROVED_OR_APPROVED_WITH_CONDITIONS_OR_NOT_APPROVED}}

Conditions (if any):

- {{CONDITION}}: owner {{OWNER}}, due {{DUE_DATE}}

Approval applies to design version {{DESIGN_VERSION_OR_LINK}}. A later change
that meets a review trigger is a new review.

## Exceptions raised

| Exception ID | Standard, pattern or finding departed from | Status |
|---|---|---|
| {{EXCEPTION_ID}} | {{STANDARD_PATTERN_OR_FINDING}} | {{STATUS}} |

## Trace

- **Principles applied**: {{P_IDS}}
- **Risk addressed**: {{REGISTER_ID_OR_THREAT_ASSET_CONSEQUENCE}}
- **Control mapping** ({{BASELINE_NAME_AND_VERSION}}): {{BASELINE_CONTROL_IDS}}

## Sign-off

| Role | Name | Date |
|---|---|---|
| Reviewer | {{NAME}} | {{DATE}} |
| Design owner | {{NAME}} | {{DATE}} |
