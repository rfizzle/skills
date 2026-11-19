# Control framework

Layer 5 picks the external baseline that controls are mapped to, so the
organisation can show coverage to an auditor, a customer or a regulator.
The baseline is evidence. The design comes from principles and risk. Sources
are in `references/sources.md`.

## Questions to ask first

- Which contracts, regulators or customers require a named standard or a
  certification? List each with the clause that says so.
- Does the organisation sell internationally, or to customers who ask for
  certification as a condition of purchase?
- Does it do US federal work, or work under a regulation that cites a
  specific catalogue?
- Is a management system or an audit programme already running against some
  framework? That is the baseline unless an obligation says otherwise.
- How many people maintain the controls? A catalogue with hundreds of
  controls needs staff to tailor it.

## Choose one primary baseline

Start from obligations, then size. Do not start from preference or from
what a consultant recommends.

1. **An obligation names a standard.** That is the baseline.
2. **No obligation names one.** Use the rule below.

| Situation | Baseline |
|---|---|
| Customers demand certification, or the organisation operates in several jurisdictions | ISO/IEC 27001, with 27002 as the control guidance |
| US federal or regulated work, or a wish for a detailed free catalogue | NIST SP 800-53 Revision 5, with CSF 2.0 as the reporting structure |
| Small organisation, no external obligation | CIS Controls, implementation group 1, growing to groups 2 and 3 as it grows |

CSF 2.0 on its own is an outcome structure (Govern, Identify, Protect,
Detect, Respond, Recover). It says what to achieve, not what to implement,
so it needs a control catalogue beneath it. Use it for reporting to
executives, not as the only baseline.

### One primary, others mapped

One baseline is primary. Every other framework the organisation must answer
to is mapped to the primary through a published crosswalk, or by the
mapping field on each pattern and standard. Never run two baselines in
parallel: two control lists mean two owners, two evidence sets and
conflicting wording, and the cost is paid every audit cycle.

## How mapping works here

Every pattern and standard carries a `Control mapping` field listing
baseline control IDs it helps satisfy. The reasoning:

- Design starts from principles and risk. A system designed from a control
  list satisfies the list and can still be insecure, because no list knows
  this system's threats.
- Mapping happens after the design, as evidence that the baseline is
  covered.
- Cite control IDs only. Do not copy control text from copyrighted
  frameworks. NIST text is public domain and may be quoted with attribution;
  ISO and CIS text may not.
- A pattern maps to the controls it implements or supports, not every
  control it touches. Mapping a pattern to thirty controls is padding.

## Coverage check

Run it when the baseline is adopted, at each annual review, and when the
baseline is revised.

1. List the baseline controls in scope (after tailoring; record each
   exclusion with a reason).
2. For each, find the patterns and standards whose `Control mapping` names
   it.
3. **Baseline control with no pattern or standard**: a gap. Add it to the
   gap list with an owner. The answer is a pattern or standard, a
   documented accepted risk, or a documented not-applicable. It is not
   silence.
4. **Pattern or standard with no baseline control**: fine. The principles
   and risk justify it; baselines do not cover everything. Note it and move
   on. Do not remove a requirement because the baseline is silent.
5. Report coverage as a count of controls with a mapped pattern or
   standard, a gap list, and the age of each mapping.

A gap is a prompt to ask which principle and risk the control addresses. If
none does, the control may be excluded as not applicable; say so.

## When the baseline is revised

Frameworks are revised, and IDs move or split. Keep mappings working:

- Store the baseline name and version in the mapping field of every
  document that carries a mapping (the Trace block has a place for it).
- On a revision, map old IDs to new ones once, in one crosswalk table, not
  in every pattern. Update documents from the crosswalk at their next
  review.
- Leave the principle trace alone. It does not change when a baseline does,
  which is why traceability starts from principles.
- Keep the old version's mapping until the organisation's next audit has
  moved to the new one.

## Tailoring

Adopt the full baseline as the starting list, then tailor by scope and
risk, and record why each control is excluded or strengthened. An unrecorded
exclusion is indistinguishable from a forgotten control.

## Common failures

- Two baselines run in parallel because two customers asked for different
  ones.
- Choosing the biggest catalogue to look serious, with no staff to tailor
  it.
- Treating CSF alone as a control set.
- Designing from the control list, then reading the pattern as complete
  because every box is ticked.
- Mapping text copied from a licensed standard into internal documents.
- Dropping a sound requirement because no baseline control names it.
- Revising the baseline version without updating or archiving the mapping.
