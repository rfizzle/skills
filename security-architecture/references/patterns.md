# Patterns

Layer 6 holds the pre-approved answers to recurring design problems. This
skill ships no domain patterns. Domain patterns depend on the
organisation's technology, risk and obligations, so they are written by the
organisation, with the method below. A pattern may be drafted (status
draft) from what reviews keep finding, with the risk stated inline, but it
is not approved until layers 1 to 4 exist. A pattern approved before then
has no principle, appetite or trust model to trace to.

## Questions to ask first

- What do design reviews keep finding? Collect the last year's findings.
- What exceptions are requested again and again? Each repeat is a missing
  pattern or a wrong standard.
- Which teams build the most, and what do they copy from each other today?
- Who will own each pattern and be available to answer questions about it?
- Where are patterns kept so that teams find them (a repository, a wiki)?
  A pattern nobody can find does not exist.

## Pattern, standard, decision record

| Item | What it is | Effect |
|---|---|---|
| Pattern | A reusable, pre-approved answer to a recurring design problem | Used unchanged, the design needs no full review; a conformance checklist is enough |
| Standard | A rule ("all external endpoints require mutual authentication") | Applies to every design; checked, not chosen |
| Decision record | One choice made once, with context and consequences | Records a product or option choice so it can be revisited |

A pattern may cite standards, and its product choices live in decision
records. If a document tries to be all three, split it.

## Anatomy

Every pattern has these parts. The template is
`assets/pattern.md`.

1. **Problem and context**: the recurring situation, and the conditions
   under which the pattern applies. Say what is out of scope.
2. **Forces**: the competing concerns that make it hard (cost against
   isolation, usability against assurance). Without forces, the solution
   looks arbitrary and is bent at the first objection.
3. **Solution**: described as capabilities and required properties, never
   a product ("a workload obtains a credential valid for under an hour",
   not a named vendor's service). Product choice goes in a decision record.
4. **Diagram with trust boundaries**: the boundaries and enforcement points
   from `references/trust-model.md`, so a reviewer sees what crosses where.
5. **Principle trace**: the principles it applies, and any it departs from
   with the reason.
6. **Threats addressed and residual risk**: the STRIDE threats the pattern
   mitigates, and what remains. Residual risk is stated against the risk
   appetite, since the team inherits it.
7. **Control mapping**: baseline control IDs the pattern helps satisfy
   (`references/control-framework.md`).
8. **Conformance checklist**: yes or no items a team self-assesses, each
   tied to a principle ID. See below.
9. **Known variations**: approved deviations and the checks each needs.
10. **When not to use it**: conditions under which the pattern is the wrong
    answer, and where to go instead.
11. **Owner and review date**, plus the decision records for products.

## Standards

A standard is one checkable rule: a statement, its scope, how it is
checked, and a Trace block. It uses the standard header and Trace block
from `SKILL.md`; there is no separate template. Write it so a reviewer can
answer yes or no from evidence ("every external endpoint requires mutual
authentication, checked by the gateway configuration"). A standard that
names no principle and risk is preference and is removed. Exceptions
depart from standards, so the exception register tracks repeats by
standard (`references/governance.md`).

## The conformance checklist

The checklist is what makes a pattern usable without the function. Write
each item so it can be answered yes or no from evidence, in minutes, by
someone who did not build the system: "Workload credentials expire within
{{N}} hours (P6, P11)" works; "Credentials are managed securely" does not.
Five to fifteen items is normal; more means the pattern is two patterns.

A design that answers yes to every item and has no variation is conforming,
and design review is a confirmation. A no, or a variation outside the list,
sends it to full review. A design in the highest data tier goes to full
review even when it conforms (`references/governance.md`).

## Which patterns to write first

Write patterns where evidence says demand is. Rank candidates by how often
the problem appears in review findings and exception requests, then by the
loss involved. Do not write patterns because a framework has a chapter on
them.

Typical first domains, as areas and not as content:

- identity and access;
- secrets and keys;
- network exposure;
- data protection;
- logging and detection.

Write two or three, use them in real reviews, and revise them before
writing more. A large library written at once is stale on release.

## Lifecycle

A pattern carries the header status only, mapped as follows.

| Header status | Meaning |
|---|---|
| draft | Proposed: drafted, under review; not citable as pre-approved |
| approved | Owner and approver named; use unchanged means conformance |
| superseded | Deprecated: replaced or found unsound; no new use. Reason and replacement are recorded in "Owner and review" |

Approval is by the approver the charter names for patterns. A pattern's
residual risk is accepted by the appetite owner or their delegate before
the status becomes approved; the pattern's approver does not accept it.
Teams using the pattern unchanged inherit that acceptance. A pattern has
a review date; past it, it counts as expired and teams are told.

When a pattern is superseded (deprecated):

- State the reason and the replacement, or that none exists.
- Systems already on it are not automatically in breach. They get a
  migration date set by the risk (a pattern deprecated for a flaw has a
  short date; one for obsolescence a long one).
- Until migrated, each such system carries an exception with an owner and
  an end date, so the debt is visible.
- New designs may not cite it.

## The test of a good pattern

- A team can apply it without talking to the function.
- A reviewer can check conformance in minutes, from evidence.
- Replacing the product does not change the pattern. If it does, the
  pattern has a product in it.
- Every checklist item traces to a principle, and every threat it claims to
  address is in a threat model.
- The same exception has not been granted three times against it; if it
  has, the pattern is wrong.

## Common failures

- Patterns approved before principles or the trust model exist.
- A pattern that names a product, so replacing the product means rewriting
  the pattern.
- A checklist with items nobody can verify ("follows best practice").
- A library of twenty patterns, none exercised in review.
- No "when not to use", so patterns are applied to problems they do not
  fit.
- No owner or review date, so the pattern ages out quietly.
- Deprecating a pattern with no plan for systems built on it.
