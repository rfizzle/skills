# Pre-mortem

Assume the epic shipped and failed: it was late, it was rolled back, or
nobody used it. Work back to the reasons. Most of them are assumptions
the plan never said out loud. This step finds those bets before the owner
accepts the plan, so the plan makes them on purpose and checks the
riskiest ones first.

Run it on every plan. For a one-story epic with nothing irreversible it
is one line ("no risky assumptions: <why>"). It is not a reason to grow
the plan.

## 1. List the assumptions

For each story, ask what has to be true for it to work. Things that are
easy to miss:

- **Data**: the rows exist, have the shape the plan expects, and fit the
  volume the plan expects. A backfill finishes in the window it has.
- **Dependencies**: an upstream API, library, module or other team
  behaves the way the plan uses it, and will still do so when this lands.
- **Performance**: the query, page or job is fast enough at real volume,
  not only at fixture size.
- **Users**: they have the problem, they find the feature, and they use
  it the way the interaction map assumes.
- **Execution**: a story really fits in one layer and about 400 lines,
  and nothing waits on a person who is not here.

Write each one as a claim that can be false: "the orders table has a
`customer_id` on every row", not "data is available".

## 2. Rate each one

- **Confidence**: *high* means checked (the code or data was read, the
  query was run); *medium* means likely but not checked; *low* means
  plausible but untested; *unknown* means nobody knows.
- **Impact if wrong**: *critical* means the epic fails; *high* means a
  story is redone or the landing order changes; *medium* means rework
  inside one story; *low* means a small adjustment.

The **vulnerabilities** are the assumptions with low or unknown
confidence and critical or high impact. Only those go in the plan. Check
the rest in the code before writing the plan, which moves them to high
confidence or out of it.

## 3. Find the weakest link

Some assumptions depend on others: the screen assumes the API, and the
API assumes the data. Name the one link whose failure breaks the most
stories after it. That link is checked first.

## 4. Separate one-way doors

List the steps that cannot be undone cheaply once they land: a migration
that drops or rewrites data, a public API or event shape other code will
depend on, a deleted feature, an external promise or date. Anything not
on that list can be reverted, so it can tolerate a medium-confidence
assumption. A one-way door cannot.

## 5. Say how each vulnerability is retired

For each vulnerability, pick the cheapest check that settles it before it
matters. Run a query or read the code now, if that settles it. Otherwise
put a first story or spike ahead of the stories that depend on it, or
add a gate before the one-way door. Then state the stop rule: "continue
if <observable result>; stop and re-plan if <observable result>". An
epic of more than a few stories gets a check-in point: after which story
the result is read.

## In the plan

```text
Risks
- [vulnerability] — confidence low, impact critical — retired by: [check],
  before story N. Continue if …; re-plan if ….
- Weakest link: [assumption]; stories N–M depend on it.
- One-way doors: [step] in story N (…why it cannot be undone…).
```

The owner accepts the risks with the plan. A vulnerability the owner
chooses to carry anyway stays in the plan, worded as a bet the owner
made.
