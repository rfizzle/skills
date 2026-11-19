# Governance: design review, decision records, exceptions

Governance is layer 7: how designs are reviewed, how decisions are kept, and
how departures from a standard are allowed and ended. It turns the charter's
decision rights into a working mechanism. Templates are
`assets/design-review.md`, `assets/decision-record.md` and
`assets/exception.md`.

## Contents

- Questions to ask first
- Triage: which changes need review
- Turnaround
- Findings and outcomes
- Disagreement
- Decision records
- Exceptions
- Metrics
- Common failures

## Questions to ask first

- Is there an existing change or architecture board? Reuse its calendar and
  intake; do not add a second meeting.
- What is the delivery cadence (continuous, fortnightly, quarterly)? It sets
  how fast a review must be.
- Where do decisions get recorded today (wiki, repository, tickets)? Records
  go where engineers already look.
- Who is the named risk owner for each business area, for exception sign-off?
- What is the longest exception the approver will tolerate?

## Triage: which changes need review

Review is sized by risk. Reviewing everything makes a queue that teams route
around; reviewing after build is an audit. Apply the triggers to the change,
not the project: a large project with none of them needs no review.

**Triggers for review** (any one is enough):

- A new trust boundary, or a change in who or what crosses one.
- A new external exposure: anything reachable from outside the organisation.
- A new class of data, or a change of data tier for existing data.
- A change to authentication, authorisation, cryptography or secret
  handling.
- A new third party with access to data or to a production system.
- A change to administrative or control-plane access.
- A departure from an approved pattern.

**Three tiers of outcome:**

| Tier | When | What happens |
|---|---|---|
| 0 No review | No trigger is met | Team proceeds; the standing patterns and standards apply |
| 1 Self-service | A trigger is met, an approved pattern is followed unchanged, and the worst credible outcome is inside tolerance | Team completes the pattern's checklist and files it; security architecture samples a share after the fact |
| 2 Full review | A trigger is met and any of: no approved pattern applies, the design departs from a pattern, the data is in the highest tier, or the worst credible outcome is above tolerance | Review meeting or written review against the principles, with a recorded outcome |

"Tolerance" is the measurable limit in the risk appetite
(`assets/risk-appetite.md`). **"High-risk change" means tier 2**, and
nothing else; every file in this skill uses it with that meaning. The
gate applies to tier 2 only: work does not go to production without a
recorded outcome. Tier 1 and everything else is advisory.

Tier 1 only works if a pattern exists. Until one is approved, trigger cases
fall to tier 2, which is why pattern drafting starts in days 61 to 90 and
approval follows as soon as layers 1 to 4 exist (`references/adopt.md`). A team may always ask for a higher tier; it may
not choose a lower one. When in doubt, the architect assigns the tier, and
records which trigger caused it.

## Turnaround

Commit to numbers and publish them in the charter.

- Triage decision: one working day.
- Tier 1: filed on completion; sampled within ten working days.
- Tier 2: first response within two working days; outcome within ten.
- Urgent change: a named fast path with a same-day response, and a
  retrospective review within a fixed time. Count its use; if it is more
  than a few percent of reviews, the normal path is too slow.

A review that misses its commitment is reported in the metrics, not
quietly extended. If the function cannot meet them, reduce tier 2 scope
before adding steps.

## Findings and outcomes

A finding is useless if the team cannot act on it without a meeting. Each
one contains:

- **Principle ID** (P1 to P11) it applies. No principle, no finding.
- **Risk**: threat, asset and consequence, or the register ID.
- **Required change**, or the **accepted alternative** that meets the
  same principle by other means.
- **Severity**: how it affects the outcome. Use three levels: blocking
  (must change before release), conditional (must change by a stated date),
  advisory (recommended, no obligation).

Outcome states:

- **Approved**: no blocking or conditional findings.
- **Approved with conditions**: conditional findings, each with an owner
  and a due date; release may proceed, and the conditions are tracked to
  closure.
- **Not approved**: at least one blocking finding. The team changes the
  design or raises an exception.

Record the outcome against the design version reviewed. A later change that
meets a trigger is a new review.

## Disagreement

The architect's outcome stands unless escalated. Escalation follows the
path in the charter and has a time limit at each step:

1. Reviewer and the design owner, within three working days.
2. Head of the function and the engineering lead.
3. The charter's executive approver, with both positions written down.

If the decision is to proceed against a "not approved" outcome, it is an
exception signed by the risk owner (see below), never a quiet override. The
function can lose an argument; it must not lose the record of it.

## Decision records

Record decisions that are hard to reverse, were argued, or will be asked
about again: a product choice, a resolved tension between principles, a
pattern change. Use the shape from Nygard (2011): title with ID, status,
context, decision, consequences. Add the Trace block and an options table.
Status is the one in the document header (draft, approved, superseded);
there is no second status field.

Rules:

- **Immutable once approved.** Do not edit an approved record to change
  what was decided; the record's value is knowing what was believed then.
  Typo and link fixes are allowed.
- **Superseded, not edited.** A new record states what it supersedes, and
  the old one has its status set to superseded and names the new ID. Nothing is
  deleted.
- **Consequences include what becomes harder.** A record listing only
  benefits will be re-argued.
- **Product choices live here**, not in patterns, so a pattern survives
  a change of product.

## Exceptions

An exception permits a departure from a standard or pattern for a stated
time. It is the safety valve of the whole system; without it, teams hide
departures.

- **Who may request**: the owner of the system, with their engineering
  lead. Not security architecture on a team's behalf.
- **One departure per exception.** Two departures with different removal
  plans (an identity gap and a network exposure, say) are two records
  with two dates. Anything fixable before go-live is a condition of
  go-live, not part of the exception.
- **Who approves**, by the appetite band the residual risk falls in after
  compensating controls (the grid is in `assets/risk-appetite.md`):

  | Band | Approver |
  |---|---|
  | Inside tolerance | Risk owner |
  | Above tolerance | Risk owner |
  | Above appetite | Risk owner plus the charter's executive approver |

  Security architecture records a recommendation at every band and
  approves none of them (charter: risk acceptance). The requester's own
  engineering line never approves. Until a risk appetite is approved,
  nobody has been delegated the right to accept risk, so every exception
  is treated as above appetite: the risk owner and the executive approver
  both sign, and the band field records "no appetite yet". Where the
  exception concerns data, the data owner is consulted and named.
- **Mandatory expiry date**, never longer than the maximum in the charter.
  An exception without one is a silent change of policy.
- **Compensating controls**, named, with an owner, and tied to the
  principle departed from.
- **A plan to remove it**: steps, owner, date.
- **Review at expiry**, with three outcomes: closed (departure ended),
  renewed (with new justification and a new date), or standard changed.
- **Three times rule.** If the same exception is granted three times, the
  standard is wrong or unaffordable. Do not grant a fourth; open a decision
  record to change the standard or the pattern. Track repeat exceptions by
  the standard they depart from.

Keep a register, with expiry visible, and review it monthly. Exceptions
past expiry are reported, not renewed by silence.

## Metrics

Few, and used to change something:

- Share of tier 2 changes reviewed at design time (not after build).
- Median and 90th percentile review turnaround, by tier.
- Exceptions open, and open past expiry.
- Exceptions granted more than once for the same standard.
- Findings per principle, so repeat causes become patterns or training.

## Common failures

- Every change reviewed, so the queue grows and teams stop asking.
- Reviews reached after build, when the only possible finding is "ship it".
- Findings without a principle or risk, which read as taste.
- Approved decision records edited in place, so history is lost.
- Exceptions with no expiry, or renewed by default.
- The function approving exceptions to its own standards.
- A fast path used so often that it is the real process.
