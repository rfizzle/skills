# Assessing an existing function

How to score a security architecture function that already exists against
the seven layers, and how to report so the existing work is kept. The test
is use, not presence: most functions have documents; few have documents
that change what gets built.

## Questions to ask first

- Who asked for the assessment, and what will they decide with it?
- Is the assessment about the function (people, mandate) or the artefacts
  (documents), or both?
- Which layers does the organisation believe it has? Record this before
  looking; the gap between belief and evidence is a finding.
- Who can show recent real use: a team that went through review last
  month, not the person who wrote the process?
- What is out of bounds (named systems, confidential reviews)?

## Scoring scale

Score each layer on the same scale.

| Score | Meaning |
|---|---|
| 0 | Absent |
| 1 | Exists but unused: written, approved perhaps, and nobody applies it |
| 2 | Used, but untraceable or unowned: people apply it, but no link to a principle or risk, or no one maintains it |
| 3 | Used, owned, traceable and reviewed on schedule |

A layer scores the lowest of its parts. A signed charter nobody has
looked at since is 1, whatever the signature says. A review date in the
past caps the score at 2.

## Evidence and the test for "used"

| Layer | Evidence to ask for | Used, not merely existing, if |
|---|---|---|
| 1 Charter | Signed charter, approver, decision rights | A recent dispute was settled by quoting it, and the approver recalls signing |
| 2 Principles | Principle set with IDs and review questions | Recent findings and exceptions cite principle IDs; engineers can name two |
| 3 Risk and threat basis | Appetite with tolerable loss, classification scheme, threat models | A recent design was sized by a data tier; a threat model changed a design |
| 4 Trust model | Boundary diagram, list of enforcement points | A review identified a boundary crossed from it; diagrams match reality |
| 5 Control framework | Baseline choice, mapping of controls | A control change was traced to a baseline ID; the choice has a recorded reason |
| 6 Patterns | Pattern catalogue with owners | A new system used one without a special request; usage is counted |
| 7 Governance | Review records, decision records, exception register | Reviews happened before build; no exceptions past expiry; records are immutable |

Ask for artefacts from the last three months. Older evidence shows what
was once done.

## The traceability sample test

The strongest single test, because it needs no judgement of quality.

1. Pick five recent controls or review findings, chosen by you and not
   offered. Trace each to a principle and to a risk. Count the complete
   traces.
2. Pick three principles. For each, find at least one pattern or standard
   that applies it. A principle with none is decoration.
3. Pick three patterns. For each, find the principles and the risks.
   A pattern with none is preference.
4. Pick three open or recent exceptions. Check each has an owner, an
   expiry date, and a principle departed from.

Read the result: five of five complete traces and all principles applied
suggests layer 2 scores 3. Two of five suggests the later layers were
written without the earlier ones. Report the count, not an impression.

## Interviews

Ask two groups the same question: "What would you do if you needed to put a
new service on the internet next week?" Compare the answers. If the
function and the delivery teams describe different paths, the process
exists on paper only.

Ask delivery teams one more: "When did the function last change your
design?" None in a year means the function is not reached, or is not
influential.

## How to report

- **Keep what works.** List first what scored 3 and what is in use at 2.
  Do not replace a used document with a template; add the missing trace to
  it.
- **Order gaps by layer, top first.** Charter before principles before
  risk, and so on. Lower layers cannot be fixed before upper ones: patterns
  with no principles cannot be justified, and principles with no charter
  cannot be enforced. A gap at layer 6 caused by a gap at layer 2 is
  reported once, at layer 2.
- **Name the smallest fix** for each gap and its owner. Do not propose
  the full set where the minimal set would do (`references/adopt.md`).
- **Separate belief from evidence.** Where the organisation scored itself
  higher than the evidence, say so with the sample result.
- **Do not score people.** The scale applies to layers.

## Report outline

1. Scope and sources: what was asked, what evidence was seen, what was not.
2. Summary: score per layer in one table, and the top three gaps.
3. What works: layers and artefacts to keep.
4. Gaps, in layer order: finding, evidence, smallest fix, owner.
5. Traceability sample: counts and examples.
6. Order of work for the next 90 days.
7. Open questions, marked `{{OPEN: ...}}` until answered.

## Common failures

- Scoring presence of a document as use.
- Accepting the process owner's account without asking a delivery team.
- Reporting gaps at every layer without noticing one upstream cause.
- Recommending a rewrite of a working document to fit a template.
- Choosing the sample from what the function offers, which is its best work.
- Assessing the artefacts but not asking who can change them.
