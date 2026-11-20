# Explainer animation patterns

What the prototypes established, in the order a new animation needs it. Every rule here came from
the owner watching a prototype and saying what worked; the source is noted where it matters.
Reference implementations: `prototypes/v3/a-flat-attack-chain.html` (flat 2D) and
`prototypes/v3/b-isometric-attack-chain.html` (isometric). Each has a code map beside it
(`*.md`). The briefs that produced them are `prototypes/v1/BRIEF.md`, `v2/BRIEF.md`,
`v3/BRIEF.md` and `v3/BRIEF-isometric.md`.

## 1. Deliverables

Two outputs from one scenario description, with different jobs:

| | Animation | Interactive |
|---|---|---|
| Goes into | slide decks; shown while presenting, also over Teams or Meet screen share | a link or attached file in a calendar invite; read alone |
| Form | MP4 (H.264) master, GIF fallback, one clip per step plus the full run, a still per step for PDF decks | one self-contained HTML file, libraries inlined, no network needed |
| Narrative | phase rail, step title and body text on screen (the owner wants the narrative in the video); `--narration caption` gives a title-only cut | full, plus extra detail per step and per node; it must explain itself |
| Clock | fixed timeline | none; the reader advances |

The slide tool and the host are not fixed. Do not depend on a particular one, and do not depend
on Claude artifacts for sharing.

### Four layers; two are deliverables

| Layer | What it is | Who sees it |
|---|---|---|
| **Scene** | The diagram, the step-by-step choreography on one timeline, and the copy. No buttons, no hover, no clicks. | Nobody directly; both deliverables are made from it |
| **Film** | The scene on a fixed clock with the phase rail, step titles and narrative body, exported to MP4, GIF and stills (`prototypes/tools/export.mjs`) | An audience, in a deck |
| **Replay** | A standalone record of the incident or plan: one clock over a log of events drives its own chain graph, stat cards, phase rows, an event stream, an activity chart and the narrative (`prototypes/replay/`) | One reader, from a link |
| **Preview** | The scene with a scrubber, step keys, narration and presenter toggles | Only the author and reviewer |

Everything in `prototypes/v3/` and `prototypes/patterns/` is a scene shown in the preview. The
controls bar and keys are the review tool and never ship.

Rules that keep them apart:

- **Inside the 16:9 stage, nothing responds to the mouse.** An idea that needs a click, a hover
  or a choice belongs to the explorer, not the scene.
- **A pattern reference defines only the scene.** It is done when the film reads well with no
  interaction at all. Review it by looking only at the stage, as if it were already a video.
- **The replay shares the scenario, not the scene.** Version 1 embedded the film's diagram and
  mapped its clock onto the scene's timeline; the result was a dense architecture drawing at 0.6
  scale that had to be studied. Version 2 (`prototypes/replay/attack-chain.replay-v2.html`)
  draws its own small graph for the page: compact system cards in a few trust-zone frames, lit
  as a pure function of the events at or before the clock. It takes the systems, phases, steps
  and copy from the scenario and adds an event log from which every number is computed.
- **Replay page shape** (from comparing with the reference): a masthead with one loud headline
  and summary chips; a player card with the clock and a scrubber showing phase bands and any
  compressed gap as a labelled break; three stat cards; then panels on a strict grid (chain
  graph beside phase rows; action stream beside an activity chart with the narrative), about
  2,000px tall at 1440 wide. Dense but ordered beats both a single squashed screen and a long
  scroll: the owner called the first "very busy and squashed", and the second separated views
  that are read together.
- Feedback is filed by layer: "film" changes the scene; "replay" changes the page around it. A
  wish to click something to see more is replay feedback.

How the interactive deliverable got here: the first attempt was an "explorer", the animation
with step navigation, built in four layouts (`prototypes/split/`: stacked, full-bleed tour,
scrollytelling, timeline). The owner preferred the timeline but wanted "a bit more like an
artifact than just an interactive version of the animation", pointing to Hugging Face's incident
replay page (summary numbers, playback with a running clock, stat cards, a graph that ignites,
phase bars, a live action stream, a volume chart). The replay is that; the timeline explorer is
its base and the other three layouts are kept for reference only.

What the interactive version adds, per pattern (recorded here, not built into scenes; written
for the explorer and still to be rethought as replays beyond pattern 1):

| Pattern | Film | Explorer adds |
|---|---|---|
| Flow along a path | Steps play in order | Jump to any step; click a node for its role |
| Two outcomes | Run A, rewind, run B, compare | A switch between the two runs at any step |
| State morph | Today morphs to target | A today/target toggle; click what was retired or added |
| Object transformation | Wrap, encrypt, rotate in sequence | Click a part of an object to see what protects it |

### What a scene must expose so both deliverables can wrap it

Found while building the export tool and the first explorer. None of the references does all of
this yet; apply it when the shared scene code is extracted, not by patching each file.

- **Scene means the diagram area only.** The phase rail and narrative band are film and preview
  chrome. Today they are built into each reference's stage, so the explorer had to cut them out.
- **Frame aspect is a parameter.** The references lay out for a 1920x720 diagram area (what is
  left of 16:9 after the rail and band). An explorer layout may want a different shape, and the
  film may too once its caption strip is slimmer. Layout and camera frames take the aspect as
  input.
- **Each step has a `rest` time** (section 3): finished moving, with every label the narrative
  mentions still shown at full strength. Clips, stills and the explorer all stop there. No label
  a step relies on may have faded before `rest`, and emphasis must not dim it there.
- **The camera can be overridden at rest**: the wrapper can ask for the whole estate or the
  step's own frame without replaying the step. Tallies stay visible in both.
- **Named moments**, not only steps: a two-outcome scene exposes the end of each run; a state
  morph exposes "today" and "target". The explorer's run switch and state toggle seek to these.
- **Node and container details live in the scenario data** (what it is, what happened to it; the
  steps it takes part in are derived from the steps), with the longer per-step "more detail"
  text. The explorer currently holds its own copy of this.

The hover tooltips the references inherited from v1 have been removed. Each node's one-line
`tip` string is still in the scenario data, unused; it is the seed for the explorer's node cards.

## 2. Stack

- SVG drawn from scenario data, animated by GSAP (core, MotionPathPlugin, DrawSVGPlugin). GSAP is
  free for commercial use but not open source; anime.js v4 fits the same design if that matters.
- Isometric is the same stack with a hand-rolled `iso(x, y, z)` projection. No Three.js: the
  owner ranked full 3D last, and it was dropped after v1.
- No web fonts, no CSS transitions or keyframes, no free-running loops.

## 3. Page contract

- Fixed 1920x1080 logical stage, scaled to fit. Three bands: phase rail (top), diagram area,
  narrative band (bottom). The scene never draws under the rail or the band.
- One paused-capable master `gsap.timeline()`; everything visible is a function of timeline time.
  Build with explicit `fromTo` tweens so seeking to any time, in any order, gives the same frame.
- `window.anim = { duration, fps: 30, steps: [{ id, time, title, body }], phases, seek(t), play(), pause() }`.
  Steps should also carry `rest`: the time at which the step has finished moving and its title
  and labels are all still shown. Step clips and stills end there, and the explorer rests there.
  The v3 files and pattern references do not expose it yet; the export tool falls back to 0.7s
  before the step's end, and the explorer copy computes its own.
- `?capture=1` hides controls and tooltips, does not autoplay, fills the window.
  `?narration=full|caption|off`, `?present=1` (pause at the end of each step).
- Keys: Space, Left/Right, Home, `N` (narration), `P` (presenter).
- Scenario data (nodes, containers, edges, steps, copy) sits at the top of the script, apart from
  stage, timeline and renderer code.

## 4. Theme

Dark. `--bg #0b0f17`, `--panel #121826`, `--panel-2 #18202f`, `--line #2a3447`, `--text #e6edf7`,
`--muted #8b98ad`. Meaning colours: `--accent #4cc9f0` legitimate traffic, `--danger #ff5d6c`
attacker-controlled, `--token #f5b941` credentials and tokens, `--identity #a78bfa` identity and
keys, `--secure #3ddc97` controls, detection, encrypted. Most of the frame is neutral; colour
marks what is active or what kind of thing it is.

## 5. Narrative

Liked as built; keep.

- **Phase rail**: phase names across the top, current one highlighted, one dot per step.
- **Narrative band**: step counter, title (6 words or fewer), body (one or two plain sentences,
  30 words or fewer) that says what happens and why it matters. The body appears after the step's
  first motion starts.
- **Callouts**: 0 to 2 per step, 6 words or fewer, anchored to their target, placed by testing
  for free space.
- Narration modes change visibility only, never timing.

## 6. Motion that can be read

The v2 prototypes failed here ("ListBuckets goes very fast, you can't read it"; "streaming
elements are fast"). These rules fixed it and are enforced by helpers, not hand-tuning.

- **Speed cap**: no packet faster than 320 px/s on the stage. Hop duration =
  max(1.6s, on-screen path length / 320), using the camera scale at that time.
- **Text is read standing still**: a moving packet carries an icon or a 1 to 2 word tag at most.
  What is being said (`s3:ListBuckets`, a file name) is a stationary label beside the link or at
  the destination, shown at departure and held after arrival for max(2.5s, words x 0.4s).
  Nothing with text is hidden on arrival.
- **Request and response are one pair in one place**: the response label replaces the request
  label; two chips do not pass each other.
- **Streams**: at most 4 plain packets, at least 0.9s apart, with a stationary tally at the
  receiving end that grows as each lands.
- **Parallel flows** start at least 1.5s apart; both links stay lit to show they overlap.
- **Moving tags give way**: a packet's tag fades (the dot stays) while it would cover a label;
  labels never hide for a packet. Built in isometric; the flat reference does not have it yet
  (its tags pass behind nodes instead).

## 7. Pacing

Owner: v1 "a bit fast"; v3 "pace is right, just that last pause between each step is a little
slow"; fixed as below.

- Packet travel and camera moves stay slow (camera 1.2s or more, eased).
- The next step starts at the latest of: last motion end + 1.0s; last label's hold end + 0.3s;
  narrative body shown for words / 3.5 seconds.
- The last stationary label in a step holds max(1.4s, words x 0.35s); earlier labels keep 2.5s.
- A text card (a finding, a credential) holds max(2.5s, words x 0.35s) after it has appeared.
- The final step ends on a 3s hold.
- An 11-step chain runs about 130 to 150 seconds. That is acceptable.

## 8. Text emphasis

Owner: "dim the non-active text items (the ones that are not in the path at the moment)".

- Active text: labels of the two end nodes of the hop in progress (kept until the next hop
  starts), the labels of the containers that hold them, that hop's stationary label or tally,
  callouts targeting them. A pill and the node it points at share emphasis.
- All other visible text dims to about 45%, eased over 0.4s. Dim, never hide, never move.
- The end nodes of the hop in progress are never dimmed or hidden by anything.
- At the end of a summary step, everything named in the summary returns to full.

## 9. Showing a large estate

The stress test (13 nodes, 5 nesting levels) set these.

- **Lay out for the frame.** Arrange the estate to roughly the diagram area's aspect ratio so the
  full view is the default shot. Flat reached 0.71 scale by moving account-level services to a
  row under the VPC, which also made the perimeter-bypass route short.
- **Containers are computed** from their children plus padding, never hand-typed.
- **Camera frames never slice.** Frame by container (the smallest one or sibling pair holding the
  action). No visible border is cut by the frame edge, except containers enclosing the whole
  frame, which become a breadcrumb (`AWS account  ›  VPC  ›  Private subnet`). All four edges of
  the diagram area fade to the background over about 56px. (v2's "weird cut-offs" came from
  framing a rectangle around the active nodes.)
- **Off-frame endpoints are proxies.** A node the flow starts or ends at, outside the frame,
  appears as a small pinned badge at the frame edge; packets enter and leave through it. This
  keeps long-distance steps framed close. Built in flat; not yet in isometric.
- **Blast radius accumulates**: a node the attacker has used keeps a danger marker, and used
  links keep a faint danger trail.
- **Mini-map** in a corner when the camera is not at full view.
- **Boundary crossings** are one small flat port marker each (merged when closer than 36px),
  lighting only while a packet crosses (the lighting is built in isometric only). Upright "gate" panels in isometric read as random squares
  and were removed.

## 10. Labels

- Flat: every node shows its label; container labels are tabs at the top-left of the container.
  Node text in the full view is about 20px, the practical floor.
- Isometric: text clutter was the owner's complaint in v2. A node label shows only when the node
  is part of the current step. Container names are small upright tags at the slab's front
  corner, shown only for the containers around the action (top two levels in the full view).
  No text is painted skewed on slabs. Short names ("ns: web", "Services", "AWS · prod").
- All text is drawn at fixed stage sizes (tags 22px, labels and callouts 26px) whatever the
  camera scale.
- Nothing overlaps: labels, tags, pills, callouts, leader lines, active blocks and their markers
  are placed by a free-space test and verified in the browser (section 12).

## 11. Style notes

- **Flat** scales better to a wide frame and dense text, and is the more readable of the two at
  high complexity. Orthogonal links with rounded corners routed through gaps; parallel runs
  offset, never sharing a segment.
- **Isometric** shows containment well (each nesting level a thin slab on its parent, a shade
  step per level) and is the owner's first choice for look. A diamond-shaped scene leaves the
  sides of a 16:9 frame empty and is height-limited. Depth order is by layer, so slabs need gaps.

## 12. Verification

Arithmetic checks passed on v2 while it still looked wrong; rendered frames are the test.

- `tools/smoke.mjs`: console errors, and that `seek(t)` gives the same frame when reached
  forwards, backwards and after a jump, at several probe times. "Same" allows a few hundred
  pixels of anti-aliasing difference: the scene state is exact, but Chromium's rasteriser is not
  pixel-identical across seek routes, so two exports of one file may not be byte-identical.
- `tools/frames.mjs`: frames at 30%, 60%, 95% of every step, or at given times. Look at them.
- In-page `window.__overlaps()` (isometric): pairs of visible text boxes that intersect, with
  dimmed text and moving tags counted; leader lines tested against pills, labels and non-target
  blocks. Zero at every 0.25s.
- Hop assertion: at the midpoint of every hop, both end-node labels are at full opacity and
  untouched by other text.
- Speed sample: peak on-stage packet speed across the whole timeline is under the cap.

## 13. Pattern catalogue

The recurring patterns behind most security architecture visuals, and where each has a reference.

| # | Pattern | Reference |
|---|---|---|
| 1 | Flow along a path | v1 (token request), v3 (attack chain) |
| 2 | Same scene, two outcomes | `prototypes/patterns/` (blast radius) |
| 3 | State morph: current to target | `prototypes/patterns/` (VPN to zero trust) |
| 4 | Layered or nested containment | v3 |
| 5 | Object transformation | v1 (JWT, token narrowing, mTLS ciphertext); `prototypes/patterns/` (envelope encryption) |
| 6 | Graph reachability | not built |
| 7 | Timeline with overlay | not built |
| 8 | Ownership or coverage overlay | v3 step 11 (controls on the chain) is a start |
| 9 | Roadmap: time is the scene, with lanes, horizons and dependencies | `prototypes/patterns/` (roadmap with risk burn-down) |
| 10 | Cascade: a hierarchy read down (depends on) and up (impact) | `prototypes/patterns/` (crown jewels to business impact) |
| 11 | Quantities over time: bars, meters and flows instead of a diagram | parts of 9 (risk bars) and 8b (coverage meters); no dedicated reference |

Variants built on existing patterns: 2b, three outcomes (funding scenarios); 8b, coverage overlay
over time (control roll-out).

### Executive scenes

Patterns 9 to 11, 2b and 8b are for leadership audiences: direction and funding, not mechanism.
`prototypes/patterns/briefs/COMMON-exec.md` holds their rules. In short: one message, 5 or 6
steps, 45 to 80 seconds, business names instead of technical labels, headline numbers at 44px or
more that change by counting. Every number on the stage comes from one `FIGURES` object with a
`source` of `provided` or `illustrative`, and an "Illustrative figures" chip shows in the scene
(and so in the film) whenever an illustrative one is visible. The blast radius reference predates
this rule and still shows invented containment times without the chip.

Further executive candidates, not built: cost of delay (2), strategy on a page (10), risk
appetite versus actual (11), regulatory horizon (7), concentration risk (6), operating model
shift and tool consolidation (3), accountability gaps (8), legacy retirement (3), investment
allocation (11).

## 14. Open

- The film export tool and the first explorer page are being built from the flat v3 scene. The
  explorer works from a copy of the scene file; producing both from one scene file is not solved.
- A shared runtime: each prototype carries its own copy of stage, narrative, timing, emphasis and
  camera code. Extract it once the pattern set has settled.
- Automatic layout for diagrams larger than the stress test; edge lanes and some callouts in the
  flat reference are still hand-ordered.
