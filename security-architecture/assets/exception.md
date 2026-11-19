# Exception {{EXCEPTION_ID}}: {{SHORT_TITLE}}

| | |
|---|---|
| Owner | {{OWNER_ROLE}} |
| Approver | {{APPROVER_ROLE}} |
| Status | draft |
| Version | {{VERSION}} |
| Approved on | {{APPROVED_DATE}} |
| Review by | {{REVIEW_DATE}} |

## Summary

| | |
|---|---|
| Requester | {{REQUESTER}} |
| Engineering lead | {{ENGINEERING_LEAD}} |
| System | {{SYSTEM_NAME}} |
| Standard, pattern, or review finding departed from | {{STANDARD_PATTERN_OR_FINDING_ID}} (principle {{P_ID}}) |
| Residual risk band | {{INSIDE_TOLERANCE_ABOVE_TOLERANCE_OR_ABOVE_APPETITE}} |

## What is requested

{{THE_SPECIFIC_DEPARTURE_AND_ITS_SCOPE}}

## Why the standard cannot be met now

{{REASON_AND_WHAT_WOULD_HAVE_TO_CHANGE}}

## Risk introduced

- **Threat**: {{THREAT}}
- **Asset**: {{ASSET}}
- **Consequence**: {{CONSEQUENCE}}
- **Likelihood**: {{LIKELIHOOD}}
- **Impact**: {{IMPACT}}
- **Residual likelihood / impact after compensating controls**:
  {{RESIDUAL_LIKELIHOOD}} / {{RESIDUAL_IMPACT}}

The residual band in the summary is read off the grid in the risk
appetite, using the residual values.

## Compensating controls

| Control | Owner | Principle it supports | In place since |
|---|---|---|---|
| {{CONTROL}} | {{OWNER}} | {{P_ID}} | {{DATE}} |

## Plan to remove the exception

| Step | Owner | Date |
|---|---|---|
| {{STEP}} | {{OWNER}} | {{DATE}} |

## Expiry date

Expires on {{EXPIRY_DATE}}. An expiry date is mandatory and may not be
later than {{MAX_EXCEPTION_DURATION}} from approval.

## Prior exceptions for the same thing

Number previously granted for this standard and system: {{COUNT}}.
References: {{PRIOR_EXCEPTION_IDS}}.

If the same exception has been granted three times, do not grant it again.
Raise a decision record to change the standard or the pattern.

## Approval

| Role | Name | Decision | Date |
|---|---|---|---|
| Risk owner (accepts the risk; every band) | {{NAME}} | {{ACCEPTED_OR_REFUSED}} | {{DATE}} |
| Executive approver (above appetite, or no appetite yet) | {{NAME}} | {{ACCEPTED_OR_REFUSED}} | {{DATE}} |
| Data owner (consulted, where data is concerned) | {{NAME}} | {{CONSULTED}} | {{DATE}} |
| Security architecture (records recommendation) | {{NAME}} | {{RECOMMEND_OR_NOT}} | {{DATE}} |

Security architecture's recommendation: {{RECOMMENDATION_AND_REASON}}

## Trace

- **Principles departed from**: {{P_IDS_DEPARTED_FROM}}
- **Principles applied by compensating controls**: {{P_IDS}}
- **Risk addressed**: {{REGISTER_ID_OR_THREAT_ASSET_CONSEQUENCE}}
- **Control mapping** ({{BASELINE_NAME_AND_VERSION}}): {{BASELINE_CONTROL_IDS}}

## Review at expiry

| | |
|---|---|
| Reviewed on | {{DATE}} |
| Outcome | {{CLOSED_OR_RENEWED_OR_STANDARD_CHANGED}} |
| Notes | {{NOTES_OR_NEW_RECORD_ID}} |
