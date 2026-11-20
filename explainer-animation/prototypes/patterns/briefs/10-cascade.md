# Pattern 10: cascade

Reference scenario: **from business outcomes down to the crown jewels, and an incident travelling
back up.** Style: flat. Read `COMMON-exec.md` (and through it `COMMON.md`) first.

## What the pattern is

A layered hierarchy read in both directions. Going down shows what the things leadership cares
about depend on; coming up shows what a failure at the bottom costs. It answers "why does this
system matter" in business terms.

## Mechanism to build

- **Layers** from data, top to bottom: Business outcomes, Business services, Applications, Data
  and platforms. Three or four nodes per layer. Layers are quiet horizontal bands with a label
  at the left; nodes are cards.
- **Depends-on links** between adjacent layers `{ from, to }`, routed as smooth vertical curves.
- **`cascadeDown(layer)`**: draws the links from one layer to the next, top to bottom, one layer
  per beat.
- **Dependents count**: for each bottom-layer node, how many nodes above depend on it, directly
  or indirectly (computed from the links). Shown as a badge; the nodes with the highest counts
  are the crown jewels and get a distinct mark.
- **`impactUp(node)`**: a failure at a node travels up every dependency path, one layer per beat,
  turning links and nodes to the danger colour, and landing on the outcomes as a short impact
  line each (from `FIGURES` and scenario text).
- **`protect(node, control)`**: a shield on a node; replaying `impactUp` from it shows the
  paths stop at the shield and the outcomes stay clear.
- **Headline measure**: "Outcomes at risk from one failure: N of M".

## Scenario

Outcomes: Revenue, Customer trust, Regulatory standing. Services: Online ordering, Payments,
Customer support. Applications: Web shop, Payments platform, Customer records. Data and
platforms: Card data, Customer database, Sign-in service.

Steps: `depends` (the cascade down), `jewels` (dependents counts; Card data and the Sign-in
service stand out), `failure` (Card data is compromised), `impact` (it travels up: payments stop,
ordering stops, all three outcomes are hit, with an impact line each), `protect` (protect the
card data, for example by tokenising it; replay: the paths stop), `focus` (protect the few things
many outcomes depend on). Phases: What depends on what, What a failure costs, Where to invest.
