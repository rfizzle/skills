# Threat model: {{SYSTEM_NAME}}

| | |
|---|---|
| Owner | {{OWNER_ROLE}} |
| Approver | {{APPROVER_ROLE}} |
| Status | draft |
| Version | {{VERSION}} |
| Approved on | {{APPROVED_DATE}} |
| Review by | {{REVIEW_DATE}} |

## Scope and assumptions

- **In scope**: {{COMPONENTS_AND_FLOWS}}
- **Out of scope** (and why): {{EXCLUSIONS}}
- **Assumptions**: {{ASSUMPTIONS_THAT_IF_FALSE_INVALIDATE_THIS_MODEL}}
- **Participants**: {{PEOPLE_WHO_TOOK_PART}}
- **Method**: data-flow diagram, trust boundaries, STRIDE per data flow
  crossing a boundary and the element at each end; ratings by likelihood
  and impact against the risk appetite.

## 1. What are we working on?

### Data-flow diagram

{{DIAGRAM_OR_LINK}}

The diagram must show:

- external entities, processes, data stores and data flows, each named;
- every trust boundary, as a line, and the identity domain on each side;
- the data tier on every flow and store;
- the direction of each flow and the protocol;
- administrative and control-plane access paths;
- third parties and supply chain inputs.

### Assets and data tiers

| Asset | Data tier | Loss that matters (C, I, A) | Owner |
|---|---|---|---|
| {{ASSET}} | {{TIER}} | {{PROPERTY_AND_IMPACT}} | {{ROLE}} |

### Trust boundaries

| Boundary | From | To | Identity proved by | Authorised by | Enforcement point | Logged where |
|---|---|---|---|---|---|---|
| {{BOUNDARY}} | {{ZONE}} | {{ZONE}} | {{METHOD}} | {{POLICY}} | {{COMPONENT}} | {{LOG_STORE}} |

## 2. What can go wrong?

Apply STRIDE to each data flow that crosses a boundary and to the process
or external entity at each end of it, and to each store of the two highest
tiers. Properties: spoofing (authentication), tampering
(integrity), repudiation (non-repudiation), information disclosure
(confidentiality), denial of service (availability), elevation of privilege
(authorisation).

| ID | Element | Boundary | STRIDE | Source | Threat | Likelihood | Impact | Rating | Mitigation | Principle | Control | Status | Owner |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | {{ELEMENT}} | {{BOUNDARY}} | {{S/T/R/I/D/E}} | {{THREAT_SOURCE}} | {{THREAT}} | {{L}} | {{I}} | {{RATING}} | {{MITIGATION}} | {{P_ID}} | {{CONTROL_ID}} | {{STATUS}} | {{ROLE}} |

Status is one of: mitigated, accepted, transferred, open. Source is a row
of the threat sources table in the risk appetite. Rating is likelihood by
impact, read off the grid in the risk appetite: inside tolerance, above
tolerance or above appetite.

## 3. What are we going to do about it?

### Accepted risks

| Threat ID | Residual risk | Accepted by | Date | Expires | Exception ID |
|---|---|---|---|---|---|
| {{ID}} | {{RISK_STATEMENT}} | {{APPROVER_FOR_BAND}} | {{DATE}} | {{DATE}} | {{EXCEPTION_ID}} |

Acceptance is by the approver for the residual risk's band, in the risk
appetite's "Risk acceptance and exception approval" table.

### Transferred risks

| Threat ID | Transferred to | Mechanism | Evidence |
|---|---|---|---|
| {{ID}} | {{PARTY}} | {{CONTRACT_OR_INSURANCE}} | {{LINK}} |

### Open questions

- {{OPEN: question}}

## 4. Did we do a good enough job?

- [ ] Every flow that crosses a trust boundary, and the process or entity
      at each end, is examined for each applicable STRIDE category.
- [ ] Every threat is mitigated, accepted or transferred; none is open.
- [ ] Every mitigation names a principle and a control.
- [ ] Every acceptance names an owner at the required level and an end
      date.
- [ ] The diagram matches the system as built or designed, reviewed by
      someone who did not draw it.
- [ ] Administrative access, third parties and the logging path are on the
      diagram.
- [ ] Ratings use the appetite scales and no local score.
- [ ] Each threat can be tested, or a detective control for it exists.

## Trace

- **Principles applied**: {{P_IDS}}
- **Risk addressed**: {{RISK_REGISTER_ID_OR_THREAT_ASSET_CONSEQUENCE}}
- **Control mapping** ({{BASELINE_NAME_AND_VERSION}}): {{BASELINE_CONTROL_IDS}}

## Review triggers

Revise this model when any of these occur, and at the review date:

- a new trust boundary, external party or identity provider;
- a data tier added to an existing flow or store;
- a change to administrative or control-plane access;
- a significant incident or near miss involving this system;
- an accepted risk reaching its end date;
- {{SYSTEM_SPECIFIC_TRIGGER}}
