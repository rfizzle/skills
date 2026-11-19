# The charter

The charter is layer 1: it states what the security architecture function
may decide, for whom, and on whose authority. Every later document borrows
that authority, so a vague charter weakens all of them. This file covers how
to scope the mandate; `assets/charter.md` is the template.

## Questions to ask first

- Who is the executive who will sign it? If nobody will, stop: the result is
  a draft with no standing.
- Who does the function report to today, and who would the sponsor prefer?
- What does engineering currently believe the function can stop? Write down
  the belief; the charter must confirm or correct it.
- Who owns risk acceptance today, if anyone? Is there a risk register?
- Which neighbours already exist: security operations, a risk function,
  internal audit, enterprise architecture, privacy or legal?
- Is any decision already made by someone else that this function would be
  tempted to take (product selection, vendor approval, network design)?

## Deciding, being consulted, being informed

Three roles, and a decision has exactly one decider.

- **Decides**: the outcome is final unless escalated. Accountable for it.
- **Consulted**: must be asked before the decision, and the answer is
  recorded. Can be overruled, and the overruling is written down.
- **Informed**: told after, with no right to change it.

A function that is consulted but behaves as if it decides gets bypassed. A
function that decides but is only informed becomes an audit. State the role
for each kind of decision; do not leave it to be discovered in a dispute.

| Decision | Security architecture | Engineering | Risk owner |
|---|---|---|---|
| Security principles and standards | Decides (approved by the charter approver) | Consulted | Informed |
| Patterns | Decides | Consulted | Informed |
| Design approval, high-risk change (tier 2) | Decides | Consulted | Informed |
| Design approval, other change | Informed (checklist against a pattern) | Decides | Informed |
| Exceptions to a standard or pattern | Consulted (recommends) | Consulted (requests) | Decides |
| Product selection | Consulted (properties required) | Decides | Informed |
| Risk acceptance | Consulted (states the risk) | Consulted | Decides |

Adjust the cells to the organisation; keep the shape.

**Risk acceptance belongs to the business owner of the risk.** That person
owns the asset or the service and carries the consequence, so they are the
only party able to weigh it against the benefit. If security architecture
accepts risk, two things go wrong: the owner never learns what they own, and
the function is blamed for losses it cannot trade against revenue. Security
architecture's duty is to state the risk plainly (threat, asset,
consequence) and recommend. Where a design review says "not approved" and
the owner wants to proceed, that is an exception signed by the owner, not an
override of the review.

Where no risk owners are named yet, the charter's executive approver holds
the role until they name them; say so in the charter.

Product selection stays with engineering because the function owns the
required properties (in a pattern), not the market. It becomes a decision
record, so the choice can change without rewriting the pattern.

## Where the function reports, and why it matters

Reporting line sets what the function can say without permission. Where
security operations or risk sit under a different executive from the
sponsor, both executives agree the interfaces in writing. A function of one
person has no head above the reviewer: escalation goes from reviewer and
design owner straight to the engineering lead, then the approver.

- Under the head of engineering or technology: close to delivery and quick
  to be consulted, but its findings can be softened by the person whose
  delivery they delay. Needs an explicit escalation route outside that line.
- Under the head of security: independent of delivery, with a direct link to
  risk and operations. Risk is that it is seen as a gatekeeper far from
  the work.
- Under enterprise architecture: works well where that function already has
  design governance (TOGAF-style); security rides on it instead of building
  a parallel process.

Whichever is chosen, record it, and record the escalation route for a
disagreement the line cannot settle. Choose by asking where a "not
approved" finding would be heard with the least rewriting.

## Engagement model

- **How teams reach the function**: one named intake (a queue, a form, a
  channel), not people's inboxes. Anything raised elsewhere is redirected.
- **Advisory or gate**: decide per decision type. Design approval for
  high-risk change is a gate: work does not proceed to production without
  an outcome. "High-risk change" means tier 2 as defined in
  `references/governance.md`, which also gives the triage. Everything
  else, tier 1 included, is advisory, backed by patterns teams can adopt
  without asking. A function that gates everything becomes a queue; one
  that gates nothing has no mandate.
- **Turnaround**: publish commitments (for example, first response in two
  working days). A gate with no deadline is a blocker.
- **Embedding**: say whether architects are assigned to teams or called on
  demand, and who is the contact for each business area.

## What is out of scope

State the exclusions, and name the interface to each.

| Out of scope | Why | Interface |
|---|---|---|
| Security operations and monitoring | Run-time work with its own on-call | Function defines detection requirements (P9); operations feeds back what it sees |
| Incident response | Time-critical and operational | Function joins post-incident review and turns lessons into patterns |
| Audit and assurance | Must be independent of what it examines | Function supplies the principles and records as evidence; audit tests them |
| Risk management process | Owned by the risk function | Function supplies risk statements; risk function runs the register |
| Product or vendor procurement | Commercial decision | Function supplies required properties and reviews the design |

If the function also runs one of these, say so and say that it is a
separate service with its own owner, so independence is not lost quietly.

## Authority

The charter takes its authority from a **named executive approver**, by
role and by name, with a date. Wording does not create authority; the
signature does. Also record:

- the approver's own term of office or review date, so a change of executive
  triggers re-confirmation;
- that the principles set is approved by the same person;
- the escalation path (architect, head of function, approver) with the time
  allowed at each step.

## Success measures

Measure outcomes, not activity. "Forty reviews held" says the function is
busy. These say whether it works.

| Measure | Why it is an outcome |
|---|---|
| Share of tier 2 changes reviewed at design time | Shows the gate is reached before build, not after |
| Median review turnaround | Shows the function is not the delay |
| Exceptions open past their expiry date | Shows exceptions are owned, not abandoned |
| Pattern adoption (share of new systems using a pattern) | Shows the paved road is the chosen road |
| Repeat findings against the same principle | Shows teaching and patterns are working |

Set a target for each and name the data source before the charter is
signed. A measure with no source will not be reported.

## Common failures

- Signed by nobody, or by a manager with no authority over engineering.
- Decision rights listed as "advises on" for everything, so nothing is
  decided and the first dispute is settled by whoever is louder.
- The function quietly accepting risk to unblock a team, then owning it.
- Scope includes operations "for now", and the function becomes a ticket
  queue with no time for design.
- Success measured by documents published or reviews held.
- No review date, so a charter written for a team of five governs two
  hundred.
