---
name: security-architecture
description: Foundation for a security architecture function at any organisation, built from public first principles (Saltzer and Schroeder, the reference monitor, NIST). Use when asked to stand up, bootstrap or restart a security architecture team or department, write a security architecture charter or mandate, establish security principles, define risk appetite or a data classification scheme, set a threat modelling method, define trust boundaries or a trust model, choose a control framework, write a security pattern or reference architecture, set up a security design review, a decision record or an exception process, plan the first 90 days in a security architect role, or assess an existing security architecture function for gaps. Also use when a security decision needs a principled basis ("why do we require this?", "which principle does this violate?"). Not for secure coding in a specific language, implementing one control, running a penetration test or incident response.
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Security architecture foundation

A security architecture function fails in two ordinary ways: it has opinions
but no mandate, or it has controls nobody can justify. This skill builds the
few documents that prevent both, in an order where each constrains the next.
It is organisation-neutral: every template uses placeholders, and nothing
assumes a vendor, a cloud, a sector or a size.

## The traceability rule

**Every pattern, control, review finding and exception names the principle
it applies and the risk it addresses.** A requirement that traces to neither
is preference and gets removed. A principle no pattern applies is decoration
and gets a pattern or gets cut. Five templates carry a `Trace`
block for this (threat model, pattern, design review, decision record,
exception); do not delete it and do not fill it with "all". The charter,
principles, risk appetite, data classification and trust model have none,
because they are what the others trace to.

## The seven layers

Work top down. A pattern may be drafted early from what reviews keep
finding, but it is not approved before layers 1 to 4 exist, however loudly
a project asks for one.

| # | Layer | Answers | Guidance | Template |
|---|---|---|---|---|
| 1 | Charter | What may this function decide? | `references/charter.md` | `assets/charter.md` |
| 2 | Principles | What do we believe, and why? | `references/principles.md` | `assets/principles.md` |
| 3 | Risk and threat basis | What are we protecting, from whom, how much? | `references/risk-and-threat.md` | `assets/risk-appetite.md`, `assets/data-classification.md`, `assets/threat-model.md` |
| 4 | Trust model | Where are the boundaries and who crosses them? | `references/trust-model.md` | `assets/trust-model.md` |
| 5 | Control framework | Which external baseline do controls map to? | `references/control-framework.md` | (Control mapping line in every Trace block) |
| 6 | Patterns | What is the pre-approved answer? | `references/patterns.md` | `assets/pattern.md` |
| 7 | Governance | How are designs reviewed, decided and excepted? | `references/governance.md` | `assets/design-review.md`, `assets/decision-record.md`, `assets/exception.md` |

Load one reference at a time, when working on that layer. `references/sources.md`
lists the public sources everything derives from; cite them when someone
asks where a rule comes from.

## Which path

- **Nothing exists**: read `references/adopt.md` first. It gives the minimal
  set (charter, principles, design review, exceptions) and the full set, and
  a 30/60/90 day order. Start minimal unless a regulator demands the rest.
- **Something exists**: read `references/assess.md` first. Score what is
  there against the seven layers before writing anything new; replacing a
  working document with a template is a loss.
- **One document requested**: go to its row above, but check the layers
  above it exist. If they do not, say so and offer the smallest version of
  the missing layer; do not silently invent a risk appetite to trace to.

## How to work

1. **Ask before drafting.** Each reference opens with the questions only the
   organisation can answer (who sponsors this, what is regulated, what was
   the last incident). Ask those; do not guess them. Mark anything still
   unknown as `{{OPEN: question}}` in the draft so it is visible.
2. **Copy the template, then cut.** Templates are complete on purpose. A
   section that does not apply is removed, with one line saying why, so a
   reader can tell "not applicable" from "forgot".
3. **Write decisions, not aspirations.** "Access is denied unless a policy
   grants it" can settle an argument. "We value strong access control"
   cannot. Every principle and policy statement must be able to make some
   real design wrong.
4. **Keep the organisation's words.** If they say "tier 1 data" or "crown
   jewels", use that; map it to the template term once, in a glossary line.
5. **Fill the Trace block last and honestly.** If no principle fits, the
   requirement is wrong or the principle set has a gap. Say which.

## Template conventions

- Placeholders are `{{UPPER_SNAKE}}`. A finished document contains none, and
  no `{{OPEN: ...}}` markers the owner has not accepted.
- Every document starts with the same header: Owner, Approver, Status
  (draft, approved, superseded), Version, Approved on, Review by. That
  is the only document status; no template carries a second one. (A
  per-row column, such as a threat's mitigated, accepted, transferred or
  open, is not document status.) A document without a review date is
  treated as expired.
- Principle IDs are `P1` to `P11` as numbered in `references/principles.md`.
  An organisation may rename a principle but keeps the ID, so traces survive.
- Risk references use whatever register the organisation has; if none, the
  risk statement is written inline as "threat, asset, consequence".
- File names in the references are relative to the skill root
  (`references/...`, `assets/...`).
- Templates are Markdown so they move into any wiki or repository.

## Gotchas

- **A charter without a named executive approver is a draft.** Authority
  comes from the signature, not from the wording. Do not present an unsigned
  charter as establishing anything.
- **Advice and decision rights are different.** State for each kind of
  decision whether the function decides, is consulted, or is informed. Most
  friction with engineering comes from leaving this vague.
- **More than about a dozen principles means none are used.** Merge before
  adding.
- **Risk appetite must contain a tolerable loss.** A statement that accepts
  no risk gives no guidance, because every design then needs an exception.
- **Exceptions expire.** One without an end date and an owner is a silent
  change of policy. If the same exception is granted three times, change the
  standard instead.
- **A pattern is not a product.** It names the capability and the
  properties required; a product choice goes in a decision record so it can
  be replaced without rewriting the pattern.
- **Framework mapping is evidence, not design.** Map controls to the
  baseline after designing from principles and risk. Designing from the
  control list produces compliant systems that are not secure.
- **Review at design time, sized by risk.** A review of every change is a
  queue; a review after build is an audit. `references/governance.md` has
  the triage rule.
- **Do not reproduce copyrighted standards.** Name ISO/IEC 27001, SABSA or
  TOGAF and cite clause numbers; quote only public-domain or openly licensed
  text (NIST publications, the 1975 paper within fair quotation).
