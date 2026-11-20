# Incident replay page

## Why this exists

The owner looked at the explorer layouts (a step-through of the animation) and said they prefer
the timeline one, but want the interactive deliverable to be "a bit more like an artifact than
just an interactive version of the animation", with the kind of information on offer in Hugging
Face's "Anatomy of a frontier-lab agent intrusion" replay page. That page is a small dashboard
driven by one incident clock: a summary strip of headline numbers; restart and speed controls
with a running clock ("Day 1 / 5"); stat cards (actions replayed, active phase, blast radius); an
attack-chain graph whose nodes ignite as the attacker reaches them; phase bars from first seen to
last seen; a live stream of representative commands; a volume-per-day chart; a short narrative
per stage; and a footer saying what was redacted.

So the interactive deliverable becomes a **replay**: a standalone record of an incident, with the
diagram as one linked view among several, driven by a clock running over a log of events.

## Start from

`../split/attack-chain.explorer-timeline.html` (copy it to the output path). It already has the
scene (the flat attack-chain diagram and its choreography on a master GSAP timeline, with a
`rest` time per step and a whole-estate camera mode), a draggable timeline, node and container
cards as popovers, inlined GSAP, zero network requests and keyboard support. Read
`../../PATTERNS.md` sections 1 and 4 to 10 for the scene's rules and the theme.

Output: `attack-chain.replay.html` in this directory. Self-contained: no network requests.

## Data model (new; put it at the top of the script, apart from the scene data)

```js
INCIDENT = { id, title, tagline, source: 'illustrative', redaction: '...' }
EVENTS = [{
  t,            // incident time in seconds from first action
  step,         // which of the 11 scene steps this belongs to (so also its phase)
  from, to,     // node ids in the scene
  action,       // one line as it would appear in a log: 'GET /latest/meta-data/iam/security-credentials/'
  note,         // one plain sentence: what this is and why it matters (20 words or fewer)
  count,        // how many real actions this line stands for (default 1; e.g. 412 for a download run)
  visibility    // 'blind' (nothing recorded) | 'logged' (recorded, nobody looked) | 'alerted'
}]
```

Write 60 to 80 events that fit the scenario's 11 steps (several per step, in a believable order,
with believable gaps: seconds to minutes inside the active period, then a long silence before
detection days later). Visibility should tell the true story of this scenario: the edge logs the
web requests, nothing records the metadata call, the cloud audit log records the API calls from
outside but nobody is looking, and the first alert comes late. Everything else shown on the page
(totals, phase spans, systems reached, time to first alert, volumes) is computed from `EVENTS`,
never typed.

All of it is illustrative. A fixed "Illustrative data" chip stays visible in the page header at
all times, and the footer says so in a sentence.

## One clock

- The **replay clock** runs from 0 to about 90 seconds at 1x. Incident time maps onto it
  piecewise: active periods run at a steady rate; any silence longer than a threshold is
  compressed to a short fixed span and shown on every time axis as a visible break labelled with
  the real gap ("8 days 21 hours later"). The live clock readout shows incident time
  (`T+00:04:10`, and `Day n of m`).
- The **diagram** follows the clock: map each step's span on the replay clock linearly onto that
  step's `[start, rest]` span of the scene's master timeline and `seek` it, with the camera held
  on the whole estate throughout. So nodes light, trails accumulate and blast-radius markers
  land as the clock reaches them, and scrubbing backwards un-does them. The event currently under
  the clock pulses its link and its two nodes.
- Everything else reads the same clock. No panel has its own timer.
- Nothing moves until the reader presses Play. Controls: Play/Pause, Restart, speed 0.5x, 1x,
  2x, 4x. At the end it holds on the final state.

## Page, top to bottom

Design for 1440x900 first. Everything through the timeline must fit in the first screen there;
the rest is reached by scrolling. At 1800px wide or more, the event stream may dock as a column
beside the diagram instead of sitting below.

1. **Header** (slim): incident id and title, a one-line tagline, the "Illustrative data" chip.
2. **Summary strip**: four or five headline numbers computed from the events: span of the
   incident, actions, phases, systems reached (of how many), time to first alert.
3. **Console row**: the playback controls and live clock at the left; stat cards to the right
   that change as the clock runs: Actions replayed (n of N, counting), Active phase, Blast radius
   (systems reached so far, and the furthest boundary crossed, in words), Visibility so far
   (blind / logged / alerted counts).
4. **Attack chain**: the diagram, full content width at the scene's aspect (scale 0.7 or more at
   1440 wide). Under it, one "now" line showing the event under the clock: time, action, note.
5. **Timeline**: phase bars from first seen to last seen on the replay axis (with the break
   marks), a row of event ticks coloured by visibility, the step markers from the starting file,
   and the draggable playhead. Dragging scrubs the clock; clicking a phase bar jumps to its
   start; clicking a tick jumps to that event. Keep the slider keyboard behaviour.
6. Below the fold, in two columns:
   - **Event stream**: every event up to the clock, newest at the top, monospace action lines
     with time, from and to, a visibility badge, and the count where it is more than 1. Events
     after the clock are not shown. Clicking a line jumps the clock to it and opens its note.
     Filters above it: All / Blind / Logged / Alerted, and a node filter set by clicking a node
     in the diagram (shown as a removable chip).
   - **Activity**: a bar chart of actions per time bucket on the same axis as the timeline,
     stacked by visibility, with the playhead; and under it the **narrative**: the current
     phase's title and the current step's body text from the scene.
7. **What would have stopped it**: a closing panel, visible from the start but lighting up as the
   clock passes each point: the controls from the scene's last step, each with the event at
   which it would have cut the chain ("stops the chain at action 9 of N") and how many later
   actions that would have prevented, computed from the events.
8. **Footer**: what is illustrative or redacted, and how to read the visibility colours.

Clicking a node still opens its card (keep the existing popover) and also sets the stream's node
filter. Opening a card lights the timeline ticks of the events that node takes part in.

## Other requirements

- `#t=<replay seconds>` in the URL hash restores a moment; update it when playback pauses or a
  jump is made (not on every frame).
- `prefers-reduced-motion`: Play advances event by event with no in-between animation.
- Keyboard: Space play/pause; Left/Right previous/next event; Shift+Left/Right previous/next
  phase; Home restart. All controls reachable by Tab with visible focus and accessible names; the
  event stream is a list a screen reader can read in order.
- Colour for visibility must not rely on hue alone: add a small shape or letter to the badges and
  ticks (for example a hollow, half and solid mark).
- Dark theme as in the scene. Page text at reading sizes (15 to 16px body); headline numbers
  large. Charts follow the same restraint as the scene: neutral axes, colour only for meaning.
- Expose `window.replay = { duration, events, seek(t), play(), pause(), state() }` for checks.
- Remove what this page no longer uses from the starting file: the step text strip with
  Back/Next/More detail, the "Whole estate / This step" toggle, the per-step illustrative clock
  labels (the events now carry real incident times).

## Checks

A headless browser works here:
```
SMOKE=/tmp/claude-502/-Users-copierson-Projects-skills/3ce2e9a4-e16b-49d3-a076-4c76570a39ac/scratchpad/smoke
$SMOKE/run.sh <abs script> <args...>
```
The timeline variant's check script is in `$SMOKE/../split-timeline/check.mjs`; copy it into
your scratch directory (named in your prompt) and adapt it. It must, at 1440x900 and 900x1200:
block the network and fail on any request or console error; confirm nothing moves after load;
press Play and sample the page at eight points through the run, asserting that the stat cards,
the stream length, the playhead and the diagram all correspond to the same clock value (for
example: actions replayed equals the sum of counts of events at or before the clock); drag the
playhead backwards and assert the same; click an event, a phase bar, a tick and three nodes;
apply each filter; load `#t=40`. Assert the computed totals equal what the page displays. Take
screenshots and look at them: first screen at rest, mid-run, end state, the below-the-fold
section, a node card with the filter applied, and the 900-wide layout as a full-page screenshot.
Do not edit files in `$SMOKE` or `../split/`, and do not install anything.

## Constraints

Create only the output file in the repository (this BRIEF.md already exists; do not change it).
Do not modify anything else under `explainer-animation/`. Do not commit.

## Report (under 300 words)

File path and size; the computed headline numbers; diagram scale at 1440; check results;
screenshot names worth opening; what a real incident would have to supply to replace the
illustrative data (be specific about fields); what did not come out clean.
