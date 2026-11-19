# Adopting the function: the first 90 days

How to start at an organisation with no working security architecture, or
one you have just joined. It gives a minimal set and a full set of
documents, a rule for choosing, and a day-by-day order. The aim of the first
90 days is a mandate and a working review, not a library.

## Questions to ask first

- Who sponsored this role, and what do they expect to see at day 90?
- How many people work here, and in engineering specifically?
- Which regulators, customers or contracts impose security obligations?
  Which certifications are promised or being sold?
- What was the last significant incident or audit finding, and was it
  fixed or only closed?
- Which systems would end the business if lost or disclosed (the crown
  jewels, in whatever words the organisation uses)?
- Is there an engineering lead who would co-write the principles?

## The two sets

**Minimal set**: charter, principles, design review, exceptions.

| Document | Why it is in the set |
|---|---|
| Charter | The mandate: without it nothing else has authority |
| Principles | The basis: without them a review is opinion |
| Design review | The working mechanism: where the principles meet real designs |
| Exceptions | The safety valve: without it, teams hide departures instead of declaring them |

These four are enough to make decisions, defend them and survive
disagreement. Everything else can be derived from what reviews find. With
no risk appetite yet, every exception is treated as above appetite: the
risk owner and the executive approver both sign, and the band field
records "no appetite yet". That cost is the reason to write the appetite.

**Full set**: all seven layers (`SKILL.md`): charter, principles, risk and
threat basis (appetite, classification, threat model), trust model, control
framework, patterns, governance.

## Choosing

- Under roughly 200 people and not regulated: minimal set. Add layers only
  when a review keeps hitting the same missing answer.
- Regulated, certified, or over roughly 200 people: the full set, sequenced
  as below. Regulation fixes the control framework early; obligations also
  tend to demand evidence of risk and classification.
- A recent serious incident pulls the relevant layer forward (for example
  trust model after a lateral-movement breach) but not ahead of the
  charter.
- When unsure, start minimal. A missing layer is visible and can be added;
  a large unused set costs credibility.

## Days 1 to 30: listen and inventory

Publish nothing. The cost of a wrong first document is high, and what you
learn now makes the later ones accurate. Drafting is not publishing: if a
document is asked for in this period, write it as a draft with its unknowns
marked `{{OPEN: ...}}` and use the open items as the interview list.

Talk to:

- the sponsor and the likely charter approver;
- engineering leads and platform owners (what slows them, what they trust);
- security operations (what they see, what they cannot);
- risk, audit, privacy and legal (obligations, open findings);
- two or three delivery teams, in their own setting.

Collect:

- existing policies, standards and any principles;
- the last incidents and post-incident reviews;
- open audit and assessment findings;
- architecture diagrams, however stale, and the system inventory;
- the list of crown-jewel systems and who owns each;
- the current change or architecture approval process.

Output: a private notes file with obligations, crown jewels, existing
decision makers and the three biggest frictions. Share a one-page summary
with the sponsor, not a document set.

## Days 31 to 60: mandate, basis, first contact

- Draft the charter from `references/charter.md` and the notes; settle decision
  rights with the sponsor; get it signed by the named executive. Treat it
  as a draft until it is signed.
- Draft principles with two or three engineering leads, starting from the
  eleven in `references/principles.md`. Test them against the argued
  decision you collected. Drop what no design could violate.
- Run the first reviews by hand: ask to join real design discussions, use
  the principle check, and keep a log of what you asked and how teams
  reacted. The goal is to learn the real friction, not to enforce.

Output: signed charter, principles approved by the same executive, a log of
ten or so real reviews.

## Days 61 to 90: mechanism and first patterns

- Put the review process live (`references/governance.md`): triage rule, intake,
  tiers, turnaround. Use the log to set realistic turnarounds.
- Put the exception process live, with a register and an expiry rule.
- Choose the first two or three patterns from what reviews kept finding:
  usually service-to-service authentication, secret handling, or exposing
  a service externally. Draft them (status draft) with the teams that
  struggled, with the risk stated inline. They are not approved until
  layers 1 to 4 exist. The cost: until a pattern is approved, every
  triggered change is tier 2.
- Start risk appetite and data classification: a first draft with a stated
  tolerable loss and tiers that the crown jewels sit in.

Output: review and exceptions running, first patterns drafted (not yet
approved), appetite and classification in progress with named owners and
dates.

## What not to do

- **Do not publish a large standard set.** Nobody reads it, and it cannot be
  defended before the principles and charter exist.
- **Do not introduce a gate before the charter is signed.** A gate with no
  authority behind it is bypassed once, and is never trusted again.
- **Do not pick a control framework before knowing obligations.** The
  choice is driven by regulators, contracts and certification, and is
  expensive to reverse.
- **Do not rewrite what works.** Keep an existing policy that teams use;
  add the principle and risk trace to it.
- **Do not take on operations.** Covering for an understaffed team in the
  first month sets the function's real job.

## After day 90: the remaining layers

Order by what reviews are missing, within this default sequence:

1. Risk appetite and classification, finished and approved. Reviews need a
   tier to size against.
2. Threat model method, applied first to the crown jewels.
3. Trust model: boundaries and who crosses them, drawn from the crown
   jewels outward.
4. Control framework: chosen with obligations known, then every existing
   control mapped as evidence.
5. Approve the first patterns once layers 1 to 4 exist, then write
   further ones, each from at least two recurring review findings.
6. Governance metrics reported to the approver quarterly.

At each step check the traceability rule: each new document names the
principle and risk it applies. Review the whole set at the date in each
header.

## Common failures

- Writing documents in the first month because they are visible.
- Principles drafted alone, so engineering ignores them.
- A review process live but no patterns, so every trigger is tier 2 and the
  queue grows.
- A framework chosen first, then principles bent to match its list.
- Sponsor shown activity (documents) not an outcome (reviews at design
  time, exceptions with expiry).
