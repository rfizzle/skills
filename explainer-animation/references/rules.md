# Design rules: what the kit enforces and what you still own

Every rule here came from the owner watching a prototype and saying what failed (the stories are
in [history.md](history.md)). Read part A once so you stop worrying about those rules; read part B
before writing copy and choosing frames. The numbers live in `assets/kit/scene/timing.js`; the
unit tests in `scripts/timing.test.mjs` pin them.

## Contents

A. Enforced by the kit. B. Owned by the author. C. Page contract. D. Theme.

## A. The kit enforces these: do not hand-tune them

### Motion and reading

- **Speed cap.** No packet is faster than 320 px/s on the 1920x1080 stage (design value 315).
  A hop lasts max(1.6 s, on-screen length / speed), using the camera scale at that time. You
  cannot set a duration or speed; `render-check` samples the peak.
- **Text is read standing still.** A moving packet carries at most a 1 to 2 word `tag` (validated).
  What is being said (`says`, `req`, `resp`, file names) is a stationary label shown at departure
  and held after arrival for max(2.5 s, words x 0.4 s); the last label of a step holds
  max(1.4 s, words x 0.35 s). Nothing with text is hidden on arrival.
- **Request and response are one pair in one place:** the response label replaces the request
  label in the same box (`exchange`).
- **Streams:** at most 4 plain packets (validated), at least 0.9 s apart, with a stationary tally
  at the receiving end that grows as each lands. **Parallel flows** start at least 1.5 s apart and
  both links stay lit.
- **Moving tags give way:** a tag fades (the dot stays) while it would cover a label; labels never
  hide for a packet.
- **Camera moves** take at least 1.2 s (design 1.6 s), eased; motion resumes 1.8 s after a camera
  move; no beat starts during a move.

### Pacing

- A step ends at the latest of: last motion end + 1.0 s; last label's hold end + 0.3 s; the body
  shown for words / 3.5 s. The body appears 0.8 s after the first motion starts.
- A text card holds max(2.5 s, words x 0.35 s). The final step ends on a 3 s hold.
- Each step exposes `rest`: the time it has finished moving with its title and labels still shown.
  Clips and stills end there. An 11-step chain runs about 130 to 150 s; that is acceptable.

### Emphasis

- Active text (labels of the hop's end nodes, their containers, the hop's own label or tally,
  callouts on them, proxies on that link) is full strength; all other visible text dims to 45%
  over 0.4 s. Dim, never hide, never move. The end nodes of a hop in progress are never dimmed or
  covered (`render-check` `hops`). At the end of a summary step everything it names returns to full.

### Large estates

- **Layout is computed:** containers from their children plus padding, never typed; the estate is
  arranged toward the diagram area's aspect so the full view is the default shot.
- **Camera frames never slice** a container border (frames are chosen by held ids; a container
  that encloses the whole frame becomes the breadcrumb `AWS account > VPC > Private subnet`); all
  four edges of the diagram area fade over about 56 px. `check-layout` audits it.
- **Off-frame endpoints are proxies:** a system the flow starts or ends at, outside the frame, is a
  small pinned badge at the frame edge and packets enter and leave through it (flat). Writing
  `frame` is enough.
- **Blast radius accumulates** (`mark`, danger trails on used links); a **mini-map** shows when the
  camera is not at full view; **boundary crossings** are small port rings that light only while a
  packet crosses (merged when closer than 36 px).
- **Routes** are orthogonal with rounded corners, through the gaps between containers; parallel
  runs sit on separate lanes and never share a segment (`check-layout` reports a violation).

### Text placement

- All text is drawn at fixed stage sizes whatever the camera scale: tags 22 px, labels, callouts
  and cards 26 px; node text in the full view about 20 px (the practical floor).
- Labels, tags, pills, callouts, leader lines and active blocks are placed by a free-space test
  and checked in the browser every 0.25 s (`render-check` `overlaps`).
- Iso: a node label shows only when the node is part of the current step; container names are
  small upright tags at the slab's front corner; nothing is painted skewed on slabs.

### The summary step (`shields`)

- **Placement.** Each control's shield stands on its own link (`controls[].on`), at the clearest
  point along it: sampled every 8 stage px, off the end blocks, clear of every block and of every
  label, tag and shield already placed. Shields that would land together stagger. You set none of it.
- **Number.** The shield shows the steps the control would have stopped, computed from `stops`
  (1-based step numbers, in story order): `3` one step, `3/4` two in a row, `2-6` (an en dash) three
  or more in a row, `2/5` separate ones. Longer than three characters becomes the first and a plus
  (`2+`). A control with no `stops` shows a bullet. Controls are shown in order of their first step.
- **Names.** The control's `name` stands beside its shield on one line, or folds onto two lines when
  the name is wide. A leader from shield to name never crosses text or a block (iso may run it over
  the empty corner of a block, never over text). In iso, each protected system is named only
  when its label has room; otherwise its name is folded into the shield's label.
- **Degrade.** When a name still does not fit, or the story has more than six controls, every
  shield carries a letter (A, B, ...) and the names go into one "Controls" panel in a free corner:
  `A  name  (steps)`. The page logs `shields are lettered and named in a legend`. Not a defect;
  fewer controls or shorter names bring the numbers back ([layout.md](layout.md) section 5).

### Honesty

- Illustrative records raise the "Illustrative" chip while visible (film and replay); the chip is
  part of the scene and cannot be switched off by a URL parameter. Counts in the replay and the
  shield numbers are derived. `check-story` refuses missing sources and `unit: "count"` figures.

## B. The author owns these

1. **Copy.** Step `title` 6 words or fewer; `body` 30 words or fewer (validated, but the words are
   yours): one or two plain sentences saying what happens and why it matters, in the voice of a
   security architect talking a mixed audience through it. Callouts: 0 to 2 per step, 6 words or
   fewer, only when a pointer adds something the body does not. Tags 1 to 2 words. The body is
   read beside the replay clock too: it must not need the animation to make sense.
   `check-story` also warns (never refuses) about these caption rules:
   - **Length.** Characters per line, measured at the kit's sizes on the 1920x1080 stage (about 14 px
     a character at 26 px, 24 px at 46 px bold, 12 px at 22 px) with about 10% left for a wider system font:
     title 48 (one line of 46 px in the 1420 px band); body 240 (three lines of 32 px; a fourth
     line runs out of the band); callout, `says`, `req`, `resp` 32 per line (about 440 px, a quarter of
     the diagram area; split a `says` over two lines with `\n`); card row and card title 30; tag,
     `respTag` and `tally` 16.
   - **First word.** A title or body does not start with "Now", "Here" or "Next": they point at the
     screen and say nothing; say what happens ("The attacker enters...").
   - **Backticks** are drawn as written, so they must be balanced (better: absent).
   - **Typed counts.** Digits and a noun ("3 passages"), a number word and a noun ("three tokens"),
     "N of M", "x4" or "4x" in a title, body, callout, `says`, `req`, `resp`, card row or tag. Not
     flagged: a version (`2.4.1`, `TLS 1.3`), an address, a time (`14:02`), a decimal, a port or a
     number after a label word (`port 443`, `Step 3`, `HTTP 200`), an HTTP code before a capitalised
     word (`403 Forbidden`), a year (1900 to 2100), a path or identifier (`/shop?id=7`, `s3`, `sha256`,
     `x509`), a duration or size (`15 minutes`, `10 GB`), text in double quotes, and all text in a `mono`
     beat. Where a number is part of a name, set `"_literal": true` on the step, the beat or the callout.
2. **What each step touches and uses.** `touch` and `uses` drive dimming and focus; list only what
   the step is about, so the dim has something to dim. A summary step has both empty and `all`.
3. **Choosing frames.** `frame: "full"` unless the action sits in one container; then `hold` the
   smallest container or sibling pair that holds it. A strip too flat for 8:3 takes `grow: "down"`
   (flat). Add a `camera` beat only for a close-up inside a step; return with `"full"` after it.
   Set `zoom` only when a small hold should fill the frame.
4. **Layout and route hints** only when `check-layout` reports a problem: `layout.dir`, `gap`,
   `below`, `dx`, `dy` (and `layout.iso`); `route` `exit`, `corridor`, `lane` (and `route.iso`).
   Lane order is yours: the farthest target gets the highest lane so lanes never cross.
5. **Beats.** Defaults are dull: write `beats` with a `tag` and `says` for each hop that carries
   meaning, `exchange` for call and answer, `stream` for data leaving, `card` for a finding or a
   credential, `mark` for blast radius, `shields` on the last step. Use colour for meaning:
   `accent` legitimate, `danger` attacker-controlled, `token` credentials, `identity` identity and
   keys, `secure` controls and detection. Most of the frame stays neutral.
6. **Short names in tight places.** Give systems and zones `short` names (`ns: web`, `Services`,
   `AWS account`) for iso tags, breadcrumbs and proxies.
7. **Executive scenes: business names.** "Card data", "Sign-in", "Detection", not `payments-api`
   or `IMDS`; titles 6 words or fewer, bodies 24 words or fewer, 5 or 6 steps, 45 to 80 seconds
   ([patterns.md](patterns.md)).
8. **Which style.** Flat scales to a wide frame and dense text and is the more readable at high
   complexity; iso shows containment well and was the owner's first choice for look, but a
   diamond-shaped scene leaves the sides of a 16:9 frame empty and is height-limited.
9. **Looking.** Open frames from every step after your last change (`frames.mjs ... steps`);
   read the replay at 1440 and 900 wide. Arithmetic checks passed on versions that still looked
   wrong. If a frame is wrong in a way no check names, fix the story, rebuild and look again.

## C. Page contract (so the checks and export work on any page)

- Fixed 1920x1080 stage scaled to fit; three bands: phase rail on top, diagram area, narrative
  band below. The scene never draws under the rail or the band. Inside the stage nothing responds
  to the mouse (an idea that needs a click belongs to the replay).
- One master timeline; every visible thing is a function of timeline time (explicit `fromTo`
  tweens), so `seek(t)` in any order gives the same frame. No CSS transitions or keyframes, no
  free-running loops, no web fonts, no `Math.random` at render time.
- `window.anim = { duration, seek(t), steps: [{ id, time, rest, title, body }] }` is required;
  `window.__overlaps()` and `window.__hops()` are the check hooks ([checks.md](checks.md)).
- `?capture=1` hides the controls and does not autoplay; `?narration=full|caption|off`;
  `?present=1` pauses at the end of each step. Keys: Space, Left/Right, Home, `N`, `P`. The
  controls and keys are the author's review tool and never ship in a film.

## D. Theme

Dark. `--bg #0b0f17`, `--panel #121826`, `--panel-2 #18202f`, `--line #2a3447`, `--text #e6edf7`,
`--muted #8b98ad`. Meaning colours: `--accent #4cc9f0`, `--danger #ff5d6c`, `--token #f5b941`,
`--identity #a78bfa`, `--secure #3ddc97`. A hand-adapted page keeps these.
