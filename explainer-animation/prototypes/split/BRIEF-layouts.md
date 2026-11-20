# Explorer layout variants

The owner looked at the first explorer page (`attack-chain.explorer.html`: a diagram with a
reading panel of phases, steps and text) and said: "Not the biggest fan of the attack chain
explorer layout. What can we do to mix it up a bit?" Three different layouts are being built as
separate files so the owner can pick one. You are building one of them.

## Start from

`attack-chain.explorer.html` in this directory. Copy it to your output path. Read
`../../PATTERNS.md` section 1 (the four layers: you are building the **explorer** layer, which
wraps a finished scene and never changes its choreography) and sections 6 to 10 for the scene's
rules.

Keep from the file you copy: the scene (diagram, layout, routing, choreography, emphasis), the
master timeline and each step's `rest` time, `window.anim`, `window.explorer.goTo/showNode/state`
(extend them as your layout needs), all the copy (summary, step bodies, "more detail" text, node
and container cards), the inlined GSAP, zero network requests, `#step=N` in the URL hash,
`prefers-reduced-motion` handling, keyboard access with visible focus, and the dark theme.

Replace: the page layout and how the reader moves through the story, as your variant describes.
Remove the reading panel's list-and-detail structure unless your variant says otherwise.

Common requirements:
- Nothing moves until the reader acts (scrolling counts as acting in the scroll variant).
- The diagram is the largest thing on the page. At 1440x900 the diagram scale must be 0.7 or more
  (node text about 15px or larger) and there are no empty bands around it.
- A step, once reached, plays once and rests on its `rest` frame.
- Clicking a node or a container label shows its card (what it is, what happened to it in this
  incident, links to the steps it takes part in), as a popover anchored to the thing clicked, on
  the diagram, placed so it does not cover the clicked node. Escape or clicking elsewhere closes it.
- Works at 1440x900 and at 900x1200; say in the report what happens below 700px wide (it must not
  break, but need not be polished).

## Variant A: full-bleed tour

Output: `attack-chain.explorer-tour.html`

The diagram is the page. It fills the window (the scene's diagram area scaled to fit, centred, on
a continuous background), with only a small title at the top left and an "Overview" control.

- **Step card**: one floating card (about 400px wide) carries the current step: number, title,
  body, a "More detail" disclosure, Back and Next. It sits next to where the step's action is and
  moves (eased, 0.4s) when the step changes. Choose its position per step by test, not by hand:
  from candidate spots around the step's active nodes and labels at rest, take the first where
  the card covers no active node, label, pill or tally. If nothing fits, dock it bottom-left.
- **Step strip** along the bottom edge: one dot per step grouped under the five phase names,
  current step and phase highlighted, visited steps marked; click a dot to go there.
- **Camera**: each step uses its own frame by default, fitted to the window; a "Whole estate"
  toggle shows the full view. On open: the whole estate, with the card showing the incident
  summary and a "Start" button.
- Below about 800px wide the card becomes a sheet docked at the bottom.

## Variant B: scrollytelling

Output: `attack-chain.explorer-scroll.html`

Reads like an article; no buttons to learn.

- The diagram is pinned to the top of the window (`position: sticky`), full content width, at the
  scene's aspect, no taller than about 55% of the window height.
- Under it the story scrolls: a title and summary, then for each phase a heading, and for each
  step a section (number, title, body, the "more detail" paragraph shown inline in a quieter
  style). Each step section is tall enough (about 60% of the window height) that one step is
  current at a time. A closing section repeats the controls summary from step 11 and offers
  "Back to top".
- A step becomes current when its section crosses a trigger line a third of the way down the
  text area. Becoming current by scrolling down plays the step once to its rest frame. Scrolling
  up, or arriving by a jump, shows the step at rest without playing. If the reader scrolls fast,
  only the section that is current after scrolling settles (150ms) plays; skipped steps do not.
- The current section is at full strength; others are dimmed.
- A slim progress rail at the right edge: a dot per step grouped by phase; click to scroll there.
  Left/Right keys scroll to the previous/next step section.
- The camera follows the step's own frame; a small "Whole estate" toggle on the diagram.

## Variant C: incident timeline

Output: `attack-chain.explorer-timeline.html`

A horizontal timeline is the main control; suited to a post-incident review.

- Top: the diagram, full content width at the scene's aspect.
- Middle: a slim strip with the current step's number, title and body on one or two lines, and a
  "More detail" disclosure that expands the strip.
- Bottom: the timeline. The five phases are bands with their names; each step is a marker with
  its number and a short title under it; a playhead shows the current position. The bands'
  widths follow the steps' durations on the master timeline.
  - Clicking a step marker plays that step once, from its start to its rest frame.
  - Dragging the playhead scrubs the master timeline directly (`seek`), so the reader can move
    back and forth through a moment by hand; releasing leaves it where it is.
  - A play/pause button beside the timeline plays on from the playhead and stops at the next
    step's rest frame.
- Each step carries an incident clock label shown at its marker (for example `T+00:00`,
  `T+00:04`, ... `T+9d`). Write plausible values into the step data and mark them clearly in the
  code and in a small footnote on the page as illustrative, not real.
- Opening a node card also lights the markers of the steps that node takes part in.
- Camera: the step's own frame while a step is current; the whole estate while scrubbing between
  steps would cause jumps, so while the playhead is being dragged keep whatever the master
  timeline's camera does at that time.

## Checks

A headless browser works here:
```
SMOKE=/tmp/claude-502/-Users-copierson-Projects-skills/3ce2e9a4-e16b-49d3-a076-4c76570a39ac/scratchpad/smoke
$SMOKE/run.sh <abs script> <args...>
```
The first explorer's check script is in `$SMOKE/../split-checks/`; copy it into your own scratch
directory (named in your prompt) and adapt it. It must, at 1440x900 and 900x1200: block the
network and fail on any request or console error; confirm nothing is animating after load; reach
every step by your layout's own means of navigation (clicks, scrolling or the timeline), wait
for rest and screenshot; open three node cards and screenshot; load `#step=6` directly. Then
look at the screenshots yourself. Do not edit files in `$SMOKE` or in `split-checks/`, and do
not install anything.

## Constraints

Create only your output file in the repository. Do not modify `attack-chain.explorer.html` or
anything else under `explainer-animation/`. Do not commit.

## Report (under 250 words)

File path and size; diagram scale and smallest diagram text at 1440 wide; check results;
screenshot names worth opening (opening state, two mid steps, a node card, the smaller viewport);
what did not come out clean; and one honest sentence on what kind of reader this layout suits.
