# Risk and threat basis

Layer 3 says what is being protected, from whom, and how much loss is
tolerable. It has three parts: a risk appetite, a data classification, and
one threat modelling method. Without them a principle has nothing to apply
to, and "high risk" is a feeling. Sources are in `references/sources.md`.

## Contents

- Questions to ask first
- Part A: Risk appetite
- Part B: Data classification
- Part C: Threat modelling
- Common failures

## Questions to ask first

- Who will sign the risk appetite? If nobody, it and everything traced to
  it is a draft.
- What is the largest loss the organisation could absorb in a year without
  changing its plans?
- Which threat sources matter here: external criminal, insider, supplier,
  state, accidental?
- Does an enterprise risk register already exist, with its own scales? Use
  its scales; do not publish a second set.
- Which regulations or contracts already dictate how some data is handled?
- Does the organisation already label data, even informally ("crown
  jewels", "tier 1")? Keep those words and map them once.

## Part A: Risk appetite

### What it is and who owns it

Risk appetite is how much loss the organisation will tolerate in pursuit of
its goals, by category; tolerance is the measurable limit inside it. The
split between the two is from NISTIR 8286; risk tolerance itself is
defined in NIST SP 800-39. The owner is an executive or the board,
because accepting loss is a business decision made by whoever bears the loss. Security advises and
measures; it does not set appetite or accept above it.

### It must state a tolerable loss

"We accept no risk" gives no guidance: every design then needs an
exception and the exception process becomes the real policy. Each category
carries a level and a number a reviewer can compare a design against.

| Category | Appetite level | Tolerance (measurable) |
|---|---|---|
| Customer data confidentiality | Low | No more than {{N}} records exposed per year; none of the restricted tier |
| Service availability | Moderate | Outage of a critical service under {{N}} hours per event |
| Financial integrity | Very low | Undetected fraudulent loss under {{AMOUNT}} per year |
| Regulatory | Very low | No reportable breach attributable to a known unmitigated gap |
| Safety (where relevant) | None | No design accepted that can cause physical harm |

Safety is the usual place where "none" is honest; have the executive sign
it. A level of none is used only where an executive signs that no loss is
acceptable. These categories are examples; use the organisation's own.
Five levels at most (none to high), each defined, so two people read a word alike.

### Risk statements

Write every risk as threat, asset, consequence, then rate it (NIST
SP 800-30):

> {{THREAT_SOURCE_AND_ACTION}} against {{ASSET}} leads to {{CONSEQUENCE}}.
> Likelihood: {{LEVEL}}. Impact: {{LEVEL}}.

Scales are defined once, in money, people and time, not adjectives. A
risk with no asset or consequence is a worry. Do not invent a numeric
score; a likelihood-by-impact grid read against appetite is enough.

The threat source is part of the statement. SP 800-30 starts with it:
name the sources that matter (external criminal, insider, supplier, state,
accidental), their capability and intent, in the "Threat sources" table of
`assets/risk-appetite.md`. Do not model an adversary nobody has named.

### The grid

`assets/risk-appetite.md` holds a 5 by 5 likelihood-by-impact grid with
three zones: inside tolerance, above tolerance, above appetite. It is a
default; the organisation adjusts the zones. The threat model Rating and
the exception residual level are both read off this grid, so no document
invents its own conversion.

A measurable tolerance sets where the "inside tolerance" zone ends. Take
the tolerance ("N records per year", "an amount per year"), find the
impact level whose range on the scale contains one event's loss, and the
likelihood level whose frequency would reach the tolerance at that impact.
Cells at or below that likelihood for that impact are inside tolerance;
the next band up is above tolerance; the cells beyond the limit the
appetite owner signs are above appetite.

### How appetite sizes governance

- **Design review depth**: a triggered change whose worst credible outcome
  is above tolerance is tier 2, a full review; one wholly inside tolerance
  that follows an approved pattern is tier 1, a self-assessment against
  the pattern. `references/governance.md` defines the tiers.
- **Exception approval**: by band, the risk owner for inside tolerance and
  above tolerance, and the risk owner plus the charter's executive approver
  for above appetite. Security architecture recommends and approves none.
  Nobody below the owner accepts a risk above appetite.

### Work factor

Compare what defeating a control costs an attacker with what the asset is
worth to them (Saltzer and Schroeder). Use it to size: a control that costs
more than the loss tolerance is oversized; one an attacker defeats for less
than the asset is worth is undersized. It is reasoning, not a principle.

## Part B: Data classification

### How many tiers

Four at most: public, internal, confidential, restricted. Fewer tiers get
applied; more do not, because nobody remembers the rules and people pick
one tier regardless. Keep the organisation's own names.

### How to assign a tier

Classify by the impact of loss of confidentiality, integrity and
availability, the idea behind FIPS 199 (low, moderate, high per property).
The tier label is set by the confidentiality impact, because it drives the
handling rules. Integrity and availability impacts are recorded alongside
the label (for example "public, integrity high") and set the integrity and
availability controls. A public price list is public to read, but altering
it may be costly.

Define all four tiers on the confidentiality basis and map every impact
level of the appetite scale to a tier: public is no impact; internal is
minor or moderate; confidential is major; restricted is severe or
critical.

### Handling rules must be checkable

Each tier states rules a reviewer or scanner can verify. A rule that cannot
be checked is a wish. Cover, for every tier:

- encryption in transit and at rest, and the key custody level;
- who may access, by role and by identity type;
- where it may be stored and processed (systems, regions, devices);
- what is logged on access (P9); the highest tier logs reads, not only
  writes;
- retention period and disposal method;
- sharing with third parties and the contract terms required;
- use in non-production (none, masked, or synthetic only).

### Rules that settle arguments

- **The data owner classifies, not security.** The owner knows the impact;
  security supplies the scheme and challenges outliers.
- **Aggregation raises the tier.** A collection can be worse to lose than
  its parts; classify the set, not the row.
- **Default tier for unlabelled data**: internal, stated in the scheme.
  Unlabelled data treated as public is the common leak; a higher default
  puts strict handling on most data and gets ignored.
- **Declassification is lowering the tier.** It is a recorded decision by
  the data owner, never a side effect of copying data elsewhere.

## Part C: Threat modelling

Use one default method. A menu of methods produces no models.

### Steps

1. **Draw a data-flow diagram**: external entities, processes, data
   stores, data flows. One page; split by subsystem if it will not fit.
2. **Draw trust boundaries** wherever the level of trust changes
   (`references/trust-model.md`): owner, identity domain, data tier, exposure or
   privilege.
3. **List the assets** and the tier of the data on each flow and store.
4. **Apply STRIDE to every data flow that crosses a boundary and to the
   process or external entity at each end of it**, and to every store of
   the two highest tiers. Elements wholly inside one zone are examined
   only when modelling a breach (P11).
5. **Rate each threat**: likelihood by impact, on the scales from Part A,
   then read the result off the grid against appetite for that category.
6. **Decide for each threat**: mitigate, accept, or transfer. Mitigation
   names a principle (P-ID) and a control (baseline ID or pattern).
   Acceptance is by the approver for the risk's band in the risk
   appetite's acceptance table, with a date.
7. **Check the work**, then file the model with the design.

The steps answer the four questions (Shostack's frame, in the Threat
Modeling Manifesto's wording): what are we working on (1 to 3), what can go
wrong (4), what are we going to do about it (5 and 6), did we do a good
enough job (7). The template uses them as its spine.

### STRIDE

| Threat | Property violated |
|---|---|
| Spoofing | Authentication |
| Tampering | Integrity |
| Repudiation | Non-repudiation |
| Information disclosure | Confidentiality |
| Denial of service | Availability |
| Elevation of privilege | Authorisation |

Not every category applies to every element:

| Element | S | T | R | I | D | E |
|---|---|---|---|---|---|---|
| External entity | yes | | yes | | | |
| Process | yes | yes | yes | yes | yes | yes |
| Data store | | yes | yes* | yes | yes | |
| Data flow | | yes | | yes | yes | |

\* Repudiation applies to a store that holds logs or audit records.

### Outputs and when it is done

The output is a threat list, each row mitigated, accepted or transferred,
with a principle and a control, plus the diagram. The model is done when
every flow crossing a boundary, and the process or entity at each end,
has been examined for each applicable category and every threat has one
of those outcomes. "Open" is a status, not an outcome; a model with open rows is a draft.

### When to redo it

A new boundary, a new data tier on a flow, a new external party, a change
of identity provider, a significant incident, or the review date. Not on
every release: a change that crosses no boundary does not reopen it.

### When the default is not enough

Add to the default, never replace it: an attack tree for one very
high-value asset; a privacy-specific method for personal data processing
in volume; abuse cases for business-logic fraud, which STRIDE does not
name. Run the default first.

## Common failures

- An appetite no executive signed, or one that accepts nothing.
- Five or more tiers, or tiers with no handling rules.
- A bespoke scoring formula instead of likelihood and impact.
- A threat model drawn after build, with no boundaries on the diagram.
- STRIDE applied to every box: hundreds of rows, none examined.
- Threats left "open" at approval, or accepted below the required level.
- A model never revisited after the architecture changed.
