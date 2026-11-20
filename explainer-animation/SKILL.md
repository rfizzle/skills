---
name: explainer-animation
description: Use this skill when the owner wants an incident, attack chain, architecture, migration or plan explained as an animation or an interactive page, from whatever the session holds (chat threads, logs, tickets, documents, pasted notes): "animate this incident", "make a video of how this works for the deck", "explain this architecture as a film", "turn this attack chain into slides", "an incident replay page", "a timeline anyone can scrub", "show the before and after as an animation", an executive roadmap, risk or funding visual. Produces one story file with provenance on every record, then a film for slide decks (MP4, GIF, a clip and a still per step, in a flat or isometric style) and a replay page (one self-contained HTML file read alone), both from the same story. Not for a static screen sketch (use ui-sketch), a pre-code API or schema map (use api-topology), a pre-code business flow (use flow-map), or the security architecture work itself (use security-architecture).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Explainer animation

Hand-built explainer animations went wrong in repeatable ways: invented figures shown as fact,
packets too fast to read, labels covering each other, a page that passed every arithmetic check
and still looked wrong, and a "shareable" file that needed a network. The kit in this skill makes
the timing, placement and emphasis rules hold by construction, and the checks below catch the
rest. What stays with you: the story, its honesty, the copy, and looking at frames.

## Two deliverables, one story

| | Film | Replay |
|---|---|---|
| Goes into | slide decks, shown while presenting or on a screen share | a link or attachment, read alone |
| Form | `full.mp4`, `full.gif`, one clip and one still per step | one HTML file with a clock, a graph, stat cards, an event stream and a chart |
| Reads | zones, systems, links, phases, steps (`beats`, `frame`), controls | the same plus `events`; draws its own small graph |
| Needs | nothing beyond the story | time-stamped `events`; without them there is no replay |

Both are built from `<slug>.story.json` ([references/story.md](references/story.md)), so nothing on
screen can say more than the story does. **A replay needs `events`** (times in seconds, one record
per action); an architecture or plan explainer has no such log, so it gets a film only, and
`build --replay` refuses it. `SKILL` below means the directory holding this file; run commands from
the owner's working directory. Builds write where `-o` says; `export.mjs` and `equivalence.mjs`
default to `./explainer-out/<name>/` there (never inside the skill); `--out` overrides.

## Procedure

1. **Gather** from what the session has: chat, logs, tickets, documents, pasted notes. Assume no
   source. Say what you read and why. Normalise facts into a story: systems, links, phases, steps,
   events with times in seconds, controls. Every record carries `source` (`provided` with a `ref`
   specific enough to find it, `derived`, or `illustrative`). Record gaps and conflicts; ask.
2. **Confirm.** Show the owner a short summary (systems and zones, steps with one-line bodies,
   event counts by source kind, figures with sources, open gaps, redaction applied). Build only
   after they say yes.
3. **Validate.** `node $SKILL/scripts/check-story.mjs story.json [--style flat|iso]` prints one line
   per problem with the fix. Zero errors before anything else.
4. **Choose** the style and the pattern. `flat` reads best at high complexity and in a wide frame;
   `iso` shows containment well and is the more striking look. Offer both when unsure; the build is
   cheap. The `flow` pattern covers a path through nested systems; for another scenario see
   "Beyond `flow`" below and [references/patterns.md](references/patterns.md).
5. **Write the film layer**: `beats`, `frame` and `callouts` on each step, `layout` and `route`
   hints only if the checks ask. Without `beats` the build still works and is dull.
6. **Build.** `node $SKILL/scripts/build.mjs story.json --style flat -o film.flat.html`
   (or `--style iso`; without `-o` it writes `<story>.<style>.html` beside the story). The build
   refuses a story with errors and refuses a page that would load from the network.
7. **Check without a browser.** `node $SKILL/scripts/check-layout.mjs story.json --style flat`
   (containment, frame audit, route lanes). Fix what it reports; every line it prints, and the
   fix for a scale under 0.70, a link with no clean route and a refused isometric estate, is in
   [references/layout.md](references/layout.md).
8. **Check with a browser.** Needs a harness ([references/checks.md](references/checks.md);
   `export EXPLAINER_BROWSER_DIR=<harness>`; if `$EXPLAINER_BROWSER_DIR/run.sh` or its
   `node_modules/playwright` is missing, say so and build one, do not skip).
   `node $SKILL/scripts/render-check.mjs film.flat.html` must print `PASS`; then
   `node $SKILL/scripts/frames.mjs film.flat.html frames steps` and **open the PNGs**. Fix, rebuild,
   look again. Arithmetic passed on pages that still looked wrong. The owner previews the same
   file by opening it in a browser (controls, Space, arrow keys; `N` narration, `P` presenter).
9. **Export the film.** `node $SKILL/scripts/export.mjs film.flat.html --out explainer-out/film`
   (`--narration caption` for a title-only cut; about 13 frames a second, so a 150 s film takes
   about six minutes; `--range 0,12` while developing). Open a clip and a still.
10. **Replay.** `node $SKILL/scripts/build.mjs story.json --replay -o replay.html`, then
    `node $SKILL/scripts/check-replay.mjs replay.html`, then open it at 1440 wide and read it as
    a stranger would. Needs `events`. The page says, in the masthead and in the sticky bar, that
    it is a reconstruction of recorded events, not a live view, with the incident's time range.
11. **Hand over**: file paths, durations, which records are illustrative, what is still open.

## Hard rules

- Nothing invented is shown without the "Illustrative" mark. Mark such records
  `source.kind: "illustrative"`; the kit then shows the chip in film and replay. Never relabel one
  as `provided` to remove it.
- Counts are computed, not typed: totals, spans, "N of M", time to detect, step counts in copy.
  Derive them from `events`, `controls[].stops` and the lists; `check-story` refuses a figure whose
  unit is `count` and warns about a typed quantity in a title, body, callout, label or card.
- Credentials, tokens and key material never enter a story. Hostnames, addresses, account ids and
  people become roles ("payments service", "on-call engineer") unless the owner says otherwise;
  `meta.redaction` says what was done.
- Gaps are asked about, not filled. An illustrative bridge is allowed, labelled, and shown to the
  owner at the confirmation.
- Every built page is one self-contained file with no network request. A hand-adapted page goes
  through `build.mjs --inline` before hand-off.
- Copy limits: step title 6 words, body 30, callout 6, at most 2 callouts, tags 1 to 2 words, and
  character caps that fit the frame (`check-story` warns; [references/rules.md](references/rules.md)
  section B). Executive scenes: business names, not system names ([references/rules.md](references/rules.md)).
- Look at rendered frames before calling anything done. A green check is not a look.

## Isometric style in this version

Not supported: `camera` beats (skipped with a warning), `grow` on frames (ignored), more than one
`card` beat in a step (the first is shown). Frames are fitted in ground units, not projected, so
`check-layout --style iso` cannot promise a clean close-up: look at the frames. Ground layout is
the flat tree algorithm, so a story written for flat may want `layout.iso` and `route.iso`.
Beats, callouts, checks and export otherwise work. `check-story --style iso` lists each skipped item.
`check-layout --style iso` can **refuse** an estate before any build (`REFUSED iso:`): a full view
zoomed out below 0.45, or two blocks overlapping when projected. Try `layout.iso` `cols` (wraps a
row into a grid; implies a row) or fewer systems per zone; if that fails, **flat is the fallback**
and always builds. Which flat hints change in iso: [references/layout.md](references/layout.md) section 6.

## Beyond `flow`

Patterns that are not kit modules go through the **custom seam**: `build.mjs story.json --style flat
--pattern custom --scene <file.js>`. The story names the scene (`meta.scene`) and carries the
pattern's blocks (`lanes`, `risks`, ...) and `figures`; the scene file draws only its own picture
through `ctx` (`ctx.figure`, `ctx.count`, `ctx.hud`, `ctx.emphasise`, `ctx.tl`), and the kit keeps the
stage, chrome, timing, chip and `window.anim`. The roadmap is ported
(`assets/examples/roadmap-risk-burn-down.*`). The other six (two outcomes, three outcomes, state morph,
object transformation, coverage over time, cascade) exist as working pages in `assets/patterns/`:
copy the nearest one, replace its data block, run `build.mjs --inline page.html -o out.html`, then
steps 8 and 9. Those pages carry their own figures: keep their `source` honest and the "Illustrative
figures" chip. A number typed into a scene file is yours to catch; read figures only through `ctx.figure`.
Inside a flow story, one extra beat kind may be added with `--extra file.js` registering
`EXK.extra.beats.<kind>(c, beat, t)`; at most one per story. A second is a missing beat in the kit:
say so instead. Detail: [references/patterns.md](references/patterns.md).

## References

- [references/story.md](references/story.md): every field, beats, hints, provenance rules. Read before writing a story.
- [references/rules.md](references/rules.md): the design rules, split into what the kit enforces and what you still own.
- [references/patterns.md](references/patterns.md): the catalogue, executive scenes, adapting a reference.
- [references/layout.md](references/layout.md): what `check-layout` prints and what to do about it, flat and iso.
- [references/checks.md](references/checks.md): browser harness, what each check prints, export, equivalence test; `--json` on the four check scripts prints findings as one JSON array.
- [references/history.md](references/history.md): how the design got here and why; read when a rule seems arbitrary.
- `assets/examples/ssrf-attack-chain.story.json`: a complete story (invented, so it shows the chip).
- `assets/examples/roadmap-risk-burn-down.story.json` and `.scene.js`: a complete custom-pattern story and its scene.
