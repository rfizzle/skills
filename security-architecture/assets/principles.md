# {{ORG_NAME}} security principles

| | |
|---|---|
| Owner | {{OWNER_ROLE}} |
| Approver | {{APPROVER_ROLE}} |
| Status | draft |
| Version | {{VERSION}} |
| Approved on | {{APPROVED_DATE}} |
| Review by | {{REVIEW_DATE}} |

## Purpose

These principles are the basis for every security architecture decision at
{{ORG_NAME}}. A design, pattern, standard or exception names the principles
it applies or departs from. A requirement that traces to no principle and
no risk is not a requirement.

They derive from Saltzer and Schroeder, "The Protection of Information in
Computer Systems" (1975): P1 to P8 are its eight design principles and P9
is a further principle from the same paper. P10 and P11 are later
additions.

## How to use them

- **Designing**: answer each review question for your design before review.
- **Reviewing**: record findings against a principle ID.
- **Disagreeing**: say which principle you think applies differently. If
  two principles conflict, see "Resolved tensions" below; if the case is
  new, raise it with {{OWNER_ROLE}} and it will be added.

## The principles

<!-- Repeat this block for P1 to P11. Keep the ID; adapt the name, wording
and example to {{ORG_NAME}}. Starting text for each is in
references/principles.md. -->

### {{ID}} {{PRINCIPLE_NAME}}

- **Statement**: {{ONE_SENTENCE_THAT_CAN_MAKE_A_DESIGN_WRONG}}
- **Rationale**: {{WHY}}
- **Implications**:
  - {{WHAT_A_DESIGN_MUST_SHOW}}
  - {{WHAT_A_DESIGN_MUST_SHOW}}
- **Review question**: {{QUESTION}}
- **Here, this means**: {{LOCAL_EXAMPLE_FROM_THIS_ORGANISATION}}
- **Typical violation**: {{COMMON_FAILURE}}

## Summary

| ID | Principle | Review question |
|---|---|---|
| P1 | Economy of mechanism | {{QUESTION}} |
| P2 | Fail-safe defaults | {{QUESTION}} |
| P3 | Complete mediation | {{QUESTION}} |
| P4 | Open design | {{QUESTION}} |
| P5 | Separation of privilege | {{QUESTION}} |
| P6 | Least privilege | {{QUESTION}} |
| P7 | Least common mechanism | {{QUESTION}} |
| P8 | Psychological acceptability | {{QUESTION}} |
| P9 | Compromise recording | {{QUESTION}} |
| P10 | Defense in depth | {{QUESTION}} |
| P11 | Assume breach | {{QUESTION}} |

## Resolved tensions

Record each real conflict between principles and how it was settled, so the
next team does not argue it again.

| Tension | Case | Resolution | Decided in |
|---|---|---|---|
| {{ID}} against {{ID}} | {{SITUATION}} | {{WHAT_WE_DO}} | {{DECISION_RECORD_ID}} |

## Changes

| Version | Date | Change | Approved by |
|---|---|---|---|
| {{VERSION}} | {{DATE}} | {{CHANGE}} | {{APPROVER_ROLE}} |
