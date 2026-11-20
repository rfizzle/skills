# Render checks, frames and export

Three scripts load a page in headless Chromium with `?capture=1` and drive it through
`window.anim.seek(t)`: `scripts/render-check.mjs` (pass/fail checks), `scripts/frames.mjs` (look at
frames) and `scripts/export.mjs` (the film). Arithmetic checks passed on pages that still looked
wrong; look at frames.

## Contents

Harness; check-layout; check-replay; render-check; machine-readable output; frames; export; per-beat test; equivalence.

## Pointing the scripts at a browser harness

A harness is a directory with `node_modules/playwright` (and `ffmpeg-static`, unless `ffmpeg` is on
PATH). Set it once per shell:

```
export EXPLAINER_BROWSER_DIR=/path/to/harness
```

`scripts/lib/browser.mjs` loads Playwright from there, falling back to a plain `import('playwright')`.
If neither works the scripts exit with a message naming the variable.
**A new shell has no `EXPLAINER_BROWSER_DIR`**: it is an environment variable and a shell started
later (another terminal, another tool call that does not keep state) does not have it, so the first
browser script prints `No browser available: Playwright was not found. Set EXPLAINER_BROWSER_DIR ...`.
That is not a failure of the page: export it again (`export EXPLAINER_BROWSER_DIR=<harness>`), or
put it in front of one command (`EXPLAINER_BROWSER_DIR=<harness> node $SKILL/scripts/render-check.mjs ...`).
If the directory it named is gone, rebuild the harness (below); never skip the browser checks. If the directory also holds
`syslibs/root/usr/lib` and `syslibs/fonts.conf`, they are set as `LD_LIBRARY_PATH` and
`FONTCONFIG_FILE` for the browser process only, so a plain `node` command works from any directory.
If the directory is missing, say so plainly and rebuild it; scratch directories are often wiped.

Create a harness (general recipe):

```
mkdir harness && cd harness && npm init -y
npm install playwright ffmpeg-static
npx playwright install chromium
```

On an Arch Linux ARM machine where system libraries (NSS, X11, GBM, ALSA, fontconfig) and fonts
cannot be installed, `sh scripts/setup-browser-harness.sh <dir>` builds a harness without installing
system packages (other platforms: adapt its package list, or use the recipe above). It unpacks the libraries and fonts Chromium needs from an Arch Linux ARM mirror into
`<dir>/syslibs`, writes a `fonts.conf`, runs the npm install above, and writes a `run.sh`. It needs
network access to the mirror. Without any font Chromium aborts at start-up with
`SkFontMgr_FontConfigInterface ... Not implemented`. Headless renders use whatever font `system-ui`
resolves to (Inter with that script), so glyph widths differ slightly from macOS.

## check-layout (no browser)

```
node scripts/check-layout.mjs <story.json> [--style flat|iso] [--area WxH]
```

Lays out the estate, routes the links and frames every step, then prints the full-view scale for
the diagram area (default 1920x720), one line per step and per `camera` beat (`cut:` lists the
containers a frame slices; `enclosing:` the ones that became the breadcrumb), and route problems
(shared segments, a route under an unrelated node, a hint that was not honoured). Exit 1 on a
failure. In iso it also says which camera beats were skipped and which frames widened to the full
view (`widened for: ...`). A `cut: account (grow)` is the allowed slice of a `grow: "down"` strip.
It also prints `advice:` lines (the one hint change that raises the scale), `layout:` lines (a
direction the kit chose), an iso zoom line, and `REFUSED iso:` when the estate cannot be drawn.
Every kind of line, with real output and the fix for each, is in [layout.md](layout.md).

## check-replay

```
node scripts/check-replay.mjs <replay.html>
```

Needs the harness. Works on a replay built from any story that has events (`build.mjs` refuses one
that has none). Every probe is chosen from the page's own story and derived data: the sampled clock
values come from the events (before the first, at and just after up to seven of them, inside each
break, the end), the system clicked is the one with the most events, the control card clicked is a
placed one (none placed: that line says so and passes), keyboard and drag use fractions of the
clock. So it handles one control or none, few events, a short clock.

It drives the page forwards then backwards and compares every view (clock readout, stat cards, phase
rows, stream length, scrubber, lit systems, control cards) with what the kit's own derivation gives;
checks the displayed totals against the computed ones (the "to first alert" chip only when an event
raised an alert; "systems reached" with what it excludes), that every control has a card (an unplaced
one says so), graph text of at least 11 px, no overlapping cards or labels, no card text or link label
running out of its card or the graph, no overflow at 900 wide, click, filters, keyboard, the `#t=`
hash, reduced motion, the reconstruction banner, and the illustrative chip and record marks on four variants of the story
(as written; none, every, and a few records illustrative). Page height at 1440 wide is information
(2,000 px is the target for a story of the example's size) and fails only above 2,400 px. One
`PASS` or `FAIL` line each; exit 1 on any failure. It prints `network=0 errors=0` at the end (the page makes no request other than `file:`, `data:` or
`blob:`). **Banner:** the masthead and the sticky bar (scroll the player away and it appears) each
carry the line "Reconstruction of recorded events, not a live view" and the incident's time range
(dates when `meta.startsAt` is set, else the span); the check asserts both, that they are in view,
and, in the all-illustrative variant, "invented events"; it also asserts the banner never repeats
the illustrative fact, which the chip owns. Then
open the page and read it: a pass does not see a graph that is merely ugly.

The graph's automatic layout sizes cards from their text, spaces columns for the labels between
them, and places each link label by a free-space test against cards, frame borders and titles, other
labels and other links, falling back to the label's first word and then hiding it (the link keeps
the full label as a tooltip). `build.mjs --replay` prints `warning: replay: ...` when it hid a
label, when the graph is wider than the page's graph panel draws at a readable size, or when a
control is not on the event log. For the first two, add `replay.layout` to the story:
`{ "replay": { "layout": { "<system id>": [column, row] } } }` moves a system to another cell.

## render-check

```
node scripts/render-check.mjs <page.html>... [--allow-cdn]
```

One line per check, then `PASS` or `FAIL` (exit 1 only on a real failure). "hook missing" and
`WARN` lines never fail.

| Line | Meaning | When it fails |
|---|---|---|
| `console` | no console errors or uncaught exceptions | Read the message; fix the page code. A page that never sets `window.anim.duration > 0` within 15 s also fails here. |
| `network` | no request other than `file:`, `data:` or `blob:` | Something loads from a URL. Inline it (`node scripts/build.mjs --inline <page>` replaces the three GSAP CDN tags; every page in `assets/patterns/` already is). `--allow-cdn` permits those three GSAP 3.13.0 files for a one-off run of an old hand-built page and the line says so. |
| `seek` | the same `t` reached forwards, after a jump to the end and after a jump to 0 looks the same, at 17, 43, 71 and 93 % of the timeline (up to 400 pixels may differ by more than 24 per channel; anti-aliasing) | The scene keeps state outside the timeline (a tween with `immediateRender`, a callback that mutates once). Make every visual a function of `t`. |
| `overlaps` | `window.__overlaps()` is empty every 0.25 s | The failing time and pairs are printed. Move the text, shorten it, or fix the placement. Missing hook prints `overlaps: hook missing (window.__overlaps)`. |
| `hops` | at the midpoint of each hop both end-node labels are at opacity of at least 0.95 and in no overlap pair | A label is dim or covered while a packet is passing it. Show the label earlier, or move what covers it. |
| `speed` | peak packet speed on the 1920x1080 stage is at most 320 px/s (1 px/s slack for rounding); sampled at 30 fps; jumps over 2000 px/s are ignored as teleports | Lengthen that hop. The time and packet index are printed. |
| `rest` | every `window.anim.steps[i]` has a numeric `rest` | Warning only: add `rest` (seconds, where the step has finished moving and its labels are still on screen). Without it the export assumes 0.7 s before the step's end. |

**Capture mode repaints.** With `?capture=1` (what `render-check`, `frames` and `export` use) the page
forces a full repaint of the diagram after every `seek`. Chrome repaints only what changed, and a
packet moving over a dashed lit link left stale pixels that made `seek` disagree with itself, so a
screenshot taken after a jump could differ from the same time reached by playing. If you write a
page that bypasses the shell, do the same or the `seek` line will fail for no reason in the code.

### The per-beat seek and speed test

`node --test scripts/beats.test.mjs` builds one small story for each beat kind (`chain`,
`exchange`, `stream` (plain, `file`, `push`), `card`, `pulse`, `mark`, `camera` (flat only),
`shields`) in both styles and, when `EXPLAINER_BROWSER_DIR` is set, runs `render-check` on each page: `seek` and `speed` must
be `ok` (the card has no packet, so its speed line may say the hook is missing). Without a harness
it runs the builds and prints that the render half was skipped. Run it after changing a beat or a
painter; `make check` runs it.

### Hooks a page exposes

- `window.anim = { duration, seek(t), steps: [{ id, time, rest }] }` is required.
- `window.__overlaps()` returns an array of overlapping text-box pairs (empty when none).
- Hops need `window.__hops()` returning `[{ step, rid, mid, ends: [nodeId, ...] }]`, elements marked
  `data-ov="label:<nodeId>"`, and `window.__overlaps`; otherwise `hops: hook missing`.
- Packets are the children of `[data-layer="packets"]` or of `#L-packets`; otherwise
  `speed: hook missing`. If `#stage` exists its width over 1920 is taken as the stage scale.

## Machine-readable output (`--json`)

`check-story`, `check-layout`, `render-check` and `check-replay` each take `--json`. Stdout is then one JSON
array and nothing else (the human lines are not printed); exit codes do not change. Without the flag the
output is as described above. One shared helper, `scripts/lib/findings.mjs`, collects and prints the findings.

```
{ "check": "check-layout", "rule": "overlap", "severity": "error", "step": "recon", "record": "ns_web",
  "path": "story.json", "message": "siblings overlap: ns_web / ns_pay", "fix": "separate ns_web and ns_pay with layout gap, dir or below" }
```

- `check` the script name without `.mjs`; `rule` a stable kebab-case identifier for the kind of finding;
  `severity` `error`, `warning` or `info`; `step` the step id, `record` the story record (`steps[3]`, a system
  id), both only when the finding has one; `path` the file checked; `message` what is wrong; `fix` what to do
  (an empty string when the script has no advice).
- An empty array is a clean pass with nothing to say. A pass can also carry `info` entries (counts, scale,
  page height, peak speed); `warning` entries do not fail a check. Filter on `error`: that list is empty
  exactly when the exit code is 0. A usage mistake (exit 2) or an unreadable file is an `error` too.
- Several pages in one `render-check` call give one array; tell them apart by `path`.

```
node scripts/check-story.mjs story.json --json | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).filter((f) => f.severity === 'error').length)"
```

Rules each script can emit (listed from the code):

- `check-story`: `usage`, `unreadable-json`, `summary` (info: the counts line), and the validator's own `rule`
  on every problem (`assets/kit/story/validate.js`, fixed where the problem is raised; the closed list):
  `beat-at-invalid`, `beat-no-kind`, `beat-not-object`, `beat-system-unknown`, `beat-tag-too-long`,
  `beat-unknown-key`, `beats-not-array`, `block-not-array`, `body-too-long`, `callout-not-object`,
  `callout-target-unknown`, `callout-text-missing`, `callout-text-too-long`, `callouts-not-array`,
  `callouts-too-many`, `camera-beat-iso`, `camera-hold-unknown`, `camera-invalid`,
  `camera-zoom-invalid`, `caption-line-too-long`, `caption-starts-at-screen`, `caption-typed-count`,
  `caption-unbalanced-backtick`, `card-at-unknown`, `card-beats-iso-skipped`, `card-id-invalid`,
  `chain-not-link`, `chain-too-short`, `control-name-missing`, `control-on-not-link`,
  `custom-name-invalid`, `event-actor-invalid`, `event-missing-step`, `event-not-object`,
  `event-step-unknown`, `event-system-missing`, `event-system-unknown`, `event-time-invalid`,
  `event-visibility-invalid`, `exchange-malformed`, `exchange-not-link`, `figure-not-object`,
  `figure-typed-count`, `figure-value-missing`, `figures-not-object`, `frame-grow-unsupported-iso`,
  `frame-hold-unknown`, `frame-invalid`, `frame-zoom-invalid`, `id-duplicate`, `id-missing`,
  `link-end-unknown`, `link-not-object`, `meta-audience-invalid`, `meta-field-missing`,
  `meta-kind-invalid`, `meta-missing`, `meta-scene-invalid`, `meta-starts-at-invalid`, `missing-source`,
  `pair-malformed`, `pair-system-unknown`, `phase-title-missing`, `record-not-object`,
  `route-hint-unknown`, `route-not-object`, `shields-control-unknown`, `shields-invalid`,
  `source-kind-invalid`, `source-ref-missing`, `step-body-missing`, `step-not-object`,
  `step-phase-unknown`, `step-title-missing`, `step-touch-not-array`, `step-uses-not-array`,
  `steps-empty`, `story-not-object`, `stream-glyph-invalid`, `stream-not-link`, `stream-too-many-items`,
  `stream-too-short`, `system-name-missing`, `system-role-missing`, `system-zone-unknown`,
  `title-too-long`, `touch-unknown-id`, `uses-not-link`, `zone-name-missing`, `zone-parent-self`,
  `zone-parent-unknown`
  `step` is set for a step record or an event's step; `record` is `steps[3]`, `events[0]` and so on.
- `check-layout`: `usage`, `unreadable-json`, `outside-parent`, `overlap`, `zone-parent-unknown`,
  `system-zone-unknown`, `below-not-sibling`, `cols-ignored`, `cols-flat-ignored`, `layout-hint`,
  `frame-cuts-container`, `grow-frame-slices-neighbour`, `frame-hold-unknown`, `frame-grow-invalid`,
  `full-view-scale-low` (warning), `iso-zoom-too-small` and `iso-blocks-overlap` (the iso refusals),
  `iso-label-ambiguous`, `route-blocked`, `route-through-node`, `route-shared-segment`, `route-near-node`,
  `route-skims-border`, `route-narrow-gap`, `route-hint-reassigned`, `route-lanes-unsearched`,
  `route-crossing`; info: `full-view-scale`, `iso-zoom`, `routes`, `zone-auto-dir`, `layout-advice`,
  `frame-widened`, `route-advice`.
- `render-check` (per page, `path` is the page): `usage`, `anim-missing`, `console-error`, `network-request`,
  `seek-nondeterministic`, `overlap`, `hop-label-hidden`, `speed-over-cap`; warning `rest-missing` (with the
  first step); info `hook-missing` (a hook the page does not expose) and `peak-speed`.
- `check-replay`: `usage`, `page-did-not-start`, `duration-mismatch`, `moves-before-play`,
  `views-disagree-with-clock`, `displayed-total-mismatch`, `excluded-not-named`, `activity-caption-mismatch`,
  `lit-systems-mismatch`, `graph-text-too-small`, `graph-overlap`, `card-text-spill`, `label-clipped`,
  `page-height-over-limit`, `system-click-broken`, `filters-broken`, `keyboard-broken`, `play-pause-broken`,
  `scrubber-drag-broken`, `sticky-bar-missing`, `banner-missing-sticky`, `banner-missing-masthead`,
  `control-card-missing`, `control-card-text`, `control-jump-broken`, `hash-restore-broken`,
  `reduced-motion-broken`, `narrow-layout-broken`, `illustrative-marks-mismatch`, `network-or-console-error`,
  `check-failed` (a check with no rule of its own); info: `page-height`, `page-height-over-target`. Passing
  checks are not findings. `check-replay` has no `step` or `record`; the check's name and numbers are the message.

## frames

```
node scripts/frames.mjs <page.html> <outdir> steps          # frames at 30, 60, 95 % of every step
node scripts/frames.mjs <page.html> <outdir> 46.0 47.5 49   # frames at given seconds
```

`QUERY='narration=off'` adds query parameters. Open the PNGs and look at them.

## export

```
node scripts/export.mjs <page.html> [--out <dir>] [--narration full|caption|off] [--fps 30]
     [--gif-width 1280] [--gif-fps 15] [--only full|steps|stills|gif ...] [--range <startSec>,<endSec>]
```

Writes, into `--out` (default `./explainer-out/<page name>/` under the current directory, never
inside the skill): `full.mp4` (H.264, yuv420p,
1920x1080, CRF 16), `steps/NN-<id>.mp4` (a step from its start to its rest frame, held 0.5 s),
`stills/NN-<id>.png` (rest frames, for PDF decks), `full.gif` and `manifest.json` (per-step id, title,
start, rest, end, clip, still; plus `kitVersion` when the page has `EXK.BUILD.kitVersion`). Every
frame is captured once into a temporary directory that is removed at the end; expect about 13
frames per second, so a 150 s timeline takes about six minutes. `--range 0,12` captures only that
window, for development. `ffmpeg` comes from PATH, else `ffmpeg-static` in the harness. The export
fails on any console error or if `window.anim` does not appear.

Pages in `assets/patterns/` and other hand-adapted pages predate some hooks: `hops: hook missing`
and `speed: hook missing` lines are expected for them; `console`, `network` and `seek` must be `ok`.

## equivalence

A regression test of the kit, not a step of making a film. Run it after changing kit code.

```
node scripts/equivalence.mjs <story.json> --style flat [--oracle <page.html>] [--out <dir>]
```

Proves that a kit-built film matches the approved hand-built one (default oracle
`scripts/testdata/oracle/a-flat-attack-chain.html`, which loads GSAP from a CDN, so the run needs a network). It builds the kit page,
opens both in capture mode, and for each step id present in both seeks each page to its rest frame
(the oracle has no `rest`: step end minus 0.7 s, as the export does) and to 30% and 60% of the step.
It writes one contact sheet per step (`NN-<id>.png`: three rows, kit left and oracle right, step id
and title as the caption), the full-size rest frames (`NN-<id>-kit.png`, `-oracle.png`) and an
`index.html` that shows everything and repeats the table. Default output `./explainer-out/equivalence-flat/`
(under the current directory). Look at the sheets: the table cannot see a label on a border.

Structural rows decide the exit code (0 when `structural: PASS`):

| Row | Passes when |
|---|---|
| step ids and order | the two pages list the same step ids in the same order |
| step durations | each step's length is within 20% of the oracle's (both numbers printed) |
| total duration | the whole film is within 15% |
| node centres at full view | every system's centre is within 24 stage px of the oracle's (rendered positions: kit `[data-block]`, oracle node groups matched by label text) |
| frame scale per step | the median width of node boxes fully inside the diagram area in both pages at the rest frame, kit over oracle, is within 15% (catches a camera that frames tighter or looser than the approved film) |
| hop sets per step | the kit's `window.__hops()` lists exactly the links the story's `chain`, `exchange` and `stream` beats name, per step |

The other two files in `scripts/testdata/oracle/` (`b-isometric-attack-chain.html`,
`attack-chain.replay-v2.html`) are the approved isometric film and replay; compare them to a kit
build by eye (`frames.mjs` on both). Only the flat comparison is automated.

Pixel rows are information: the count of pixels whose largest channel delta exceeds 24 at each
rest frame. The first passing run writes `scripts/testdata/equivalence-flat.thresholds.json` (those
counts times 1.5); later runs print `ok` or `OVER guard` and a warning. It is a regression guard, not
acceptance; delete the file to record a new baseline after an intended visual change.

### Intended differences from the v3 film

A reviewer looking at the sheets should expect these, and nothing else:

- Label, callout and card positions: the free-space placer (below the node with a leader, kept off
  container borders in close-ups) instead of the hand `spot*` and `off:` values.
- Route lane geometry where the hints differ (lanes 22 units apart, centred in the corridor).
- No hover tooltips.
- Moving tags give way to text, and port rings light while a packet crosses (both new).
- Breadcrumb timing is uniform (no per-step special cases).
- Text drawn in stage space, so glyph widths differ slightly from the hand-set layout.
- The "Illustrative" chip sits in the narrative band beside the step title (the example scenario is
  invented; the oracle has none).
- Uniform step-end constants: step lengths differ by a few percent.
- Beats the vocabulary does not have (the story's `_gaps`): link-anchored labels with their own
  timing, the alert badge on the detection node, the "Nine steps done" recap before the controls, timed
  callouts, hand-set shield and label spots, the live "n of 3" counter.
- Cards hold for `cardHold` rather than to the step end, so a card may be gone at the rest frame.
- The example's `services` row has a 140-unit `belowGap` (oracle 118) so the corridor lanes clear
  the frame's soft top edge in the services close-up; services nodes sit about 16 stage px lower at
  the full view.
