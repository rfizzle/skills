# {{ORG_NAME}} security architecture charter

| | |
|---|---|
| Owner | {{OWNER_ROLE}} |
| Approver | {{APPROVER_ROLE}} |
| Status | draft |
| Version | {{VERSION}} |
| Approved on | {{APPROVED_DATE}} |
| Review by | {{REVIEW_DATE}} |

## Purpose

This charter establishes the security architecture function at {{ORG_NAME}}
and states what it may decide, what it advises on, and on whose authority.
It is not in force until signed by the approver named above.

## Mission

{{ONE_SENTENCE_MISSION}}

## Scope

**In scope**

- {{IN_SCOPE_ITEM}}
- {{IN_SCOPE_ITEM}}

**Out of scope**

- {{OUT_OF_SCOPE_ITEM}}: handled by {{OWNING_FUNCTION}}
- {{OUT_OF_SCOPE_ITEM}}: handled by {{OWNING_FUNCTION}}

## Authority and reporting line

- The function reports to {{REPORTING_ROLE}}.
- Its authority derives from {{APPROVER_NAME}}, {{APPROVER_ROLE}}, who
  approves this charter and the security principles.
- If the reporting line cannot settle a disagreement, escalation is as set
  out under "Escalation".

## Decision rights

Each decision has one decider. Cells are Decides, Consulted or Informed;
write a recommendation or a request as Consulted (recommends) or
Consulted (requests).

| Decision | Security architecture | Engineering | Risk owner |
|---|---|---|---|
| Security principles and standards | {{DECIDES_CONSULTED_INFORMED}} | {{DECIDES_CONSULTED_INFORMED}} | {{DECIDES_CONSULTED_INFORMED}} |
| Patterns | {{DECIDES_CONSULTED_INFORMED}} | {{DECIDES_CONSULTED_INFORMED}} | {{DECIDES_CONSULTED_INFORMED}} |
| Design approval, high-risk change (tier 2) | {{DECIDES_CONSULTED_INFORMED}} | {{DECIDES_CONSULTED_INFORMED}} | {{DECIDES_CONSULTED_INFORMED}} |
| Design approval, other change | {{DECIDES_CONSULTED_INFORMED}} | {{DECIDES_CONSULTED_INFORMED}} | {{DECIDES_CONSULTED_INFORMED}} |
| Exceptions | {{DECIDES_CONSULTED_INFORMED}} | {{DECIDES_CONSULTED_INFORMED}} | {{DECIDES_CONSULTED_INFORMED}} |
| Product selection | {{DECIDES_CONSULTED_INFORMED}} | {{DECIDES_CONSULTED_INFORMED}} | {{DECIDES_CONSULTED_INFORMED}} |
| Risk acceptance | {{DECIDES_CONSULTED_INFORMED}} | {{DECIDES_CONSULTED_INFORMED}} | {{DECIDES_CONSULTED_INFORMED}} |

Risk acceptance is decided by the business owner of the risk. Security
architecture states the risk and recommends; it does not accept risk on
the owner's behalf.

## Services

| Service | What it provides | Turnaround commitment |
|---|---|---|
| Design review | Review of tier 2 changes, with a recorded outcome | {{TURNAROUND}} |
| Self-service checklists | Pattern checklists teams complete without a meeting | Sampled within {{TURNAROUND}} |
| Patterns | Pre-approved designs, maintained | New or changed within {{TURNAROUND}} |
| Exception recommendations | A written recommendation to the risk owner | {{TURNAROUND}} |
| Advice | Answers to design questions from teams | First response within {{TURNAROUND}} |

## Engagement model

- Teams reach the function through {{INTAKE_CHANNEL}}.
- Design approval for tier 2 changes (a review trigger is met and there is
  no approved pattern, a departure, the highest data tier, or an outcome
  above tolerance; see `references/governance.md`) is a gate: the change
  does not go to production without a recorded outcome.
- All other engagement, tier 1 included, is advisory.
- Urgent change follows {{FAST_PATH}}, with a retrospective review within
  {{RETRO_PERIOD}}.
- Contact for each business area: {{CONTACT_LIST_LOCATION}}.

## Interfaces

| Function | What security architecture provides | What it receives |
|---|---|---|
| Security operations | Detection requirements | Observed attack patterns and gaps |
| Risk | Risk statements from reviews | Risk appetite and register |
| Audit | Principles and review records as evidence | Findings on whether they are applied |
| Enterprise architecture | Security requirements in designs | Architecture direction and governance calendar |
| Privacy and legal | Technical controls for obligations | Obligations and interpretations |

## Escalation

1. Reviewer and design owner: {{TIME_LIMIT}}.
2. {{HEAD_OF_FUNCTION_ROLE}} and {{ENGINEERING_LEAD_ROLE}}: {{TIME_LIMIT}}.
3. {{APPROVER_ROLE}}, with both positions in writing: {{TIME_LIMIT}}.

Proceeding against a "not approved" outcome requires an exception signed by
the risk owner. No exception runs longer than {{MAX_EXCEPTION_DURATION}}
without a fresh approval; the per-band durations in the risk appetite may
not exceed it.

## Success measures

| Measure | Target | Source |
|---|---|---|
| Share of tier 2 changes reviewed at design time | {{TARGET}} | {{DATA_SOURCE}} |
| Median review turnaround | {{TARGET}} | {{DATA_SOURCE}} |
| Exceptions open past expiry | {{TARGET}} | {{DATA_SOURCE}} |
| Pattern adoption | {{TARGET}} | {{DATA_SOURCE}} |
| Repeat findings against the same principle | {{TARGET}} | {{DATA_SOURCE}} |

## Review cadence

This charter is reviewed by {{REVIEW_DATE}}, and on a change of approver,
reporting line or scope.

## Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Approver: {{APPROVER_ROLE}} | {{NAME}} | {{SIGNATURE}} | {{DATE}} |
| Owner: {{OWNER_ROLE}} | {{NAME}} | {{SIGNATURE}} | {{DATE}} |
