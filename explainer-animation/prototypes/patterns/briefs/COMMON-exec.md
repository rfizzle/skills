# Common brief for executive-level pattern references

Read `COMMON.md` in this directory first; all of it applies (what to read, starting from an
approved reference file, output rules, rendering and checks, report format). This file adds what
is different about executive scenes. Where the two disagree, this file wins.

## Audience and shape

The audience is a leadership team deciding direction and funding, not engineers. The question
is "where are we going and what does it buy us", not "how does this work".

- One message per scene. 5 or 6 steps, 45 to 80 seconds in total.
- Few elements, no technical labels: name things the way a board paper would ("Card data",
  "Sign-in", "Detection"), not the way a diagram would (`payments-api`, `IMDS`).
- Step title 6 words or fewer; body one or two sentences, 24 words or fewer, in plain business
  language: what changes, and what it buys or costs.
- Numbers carry the point. A headline number is at least 44px on the stage, sits in the same
  place throughout the scene, and changes by counting (a tween on the value), never by cutting.
- Motion is calm: things grow, fill, slide and fade. Where something travels, the speed cap and
  the read-standing-still rules in PATTERNS.md section 6 apply unchanged. A change to a quantity
  (a bar shrinking, a tile filling, a meter climbing) takes at least 1.2s and its result holds
  for max(2.0s, words x 0.35s).
- Emphasis dimming (PATTERNS.md section 8) applies to whatever the current step is about.

## Figures are inputs, never invented silently

Executive scenes will be reused with the owner's real numbers. So:

- Every number shown on the stage comes from one `FIGURES` object at the top of the scenario
  data, each entry `{ value, unit, label, source }`. Counts derived from the scene itself (for
  example "9 of 12 capabilities") are computed from the data, not typed.
- `source` is `'provided'` or `'illustrative'`. In this prototype every hand-written figure is
  `'illustrative'`.
- While any illustrative figure is visible, a small fixed chip reading "Illustrative figures"
  shows in the diagram area's top-right corner. It is part of the scene (it must appear in the
  exported film), is driven by the timeline like everything else, and cannot be turned off by a
  URL parameter.
- Use relative or indexed quantities for illustrative figures (an index out of 100, "1.6x",
  "9 of 12"), not currency amounts or dates.

## Starting file

Flat scenes: start from `prototypes/patterns/03-state-morph--vpn-to-zero-trust.flat.html`. It is
the smallest flat reference and already has fixed HUD panels (banner, legend, a headline
measure), the overlap hook and no camera. Isometric scenes: start from
`prototypes/patterns/02-two-outcomes--blast-radius.iso.html` (banner, scoreboard, zone slabs,
overlap hook). Both were built from the approved v3 files and keep their stage, phase rail,
narrative band, controls, timing rules and `window.anim` contract. Delete what you do not use.

Also expose `rest` on every entry of `window.anim.steps` (PATTERNS.md section 3): the time at
which the step has finished moving with its title, body and every figure it mentions on screen.

## Report additions

List every figure in `FIGURES` with its source, and say in one sentence what a deck author
would have to supply to make this scene real.
