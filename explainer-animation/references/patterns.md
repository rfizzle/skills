# Pattern catalogue

The recurring shapes behind most security architecture visuals, which of them the kit builds from
a story, and how to reach the rest. Read this when a scenario is not "a path through nested
systems".

## Contents

1. Catalogue. 2. Kit modules. 3. The custom scene seam, and the hand-adapt references (one paragraph
each). 4. Executive scenes. 5. Adapting a reference. 6. One custom beat inside a flow story.

## 1. Catalogue

| # | Pattern | In this skill |
|---|---|---|
| 1 | Flow along a path, with nested containment (4) | kit module `flow`, flat and iso |
| 2 | Same scene, two outcomes | reference `assets/patterns/02-two-outcomes--blast-radius.iso.html` |
| 2b | Three outcomes (funding scenarios) | reference `02b-three-outcomes--funding-scenarios.flat.html` |
| 3 | State morph: current to target | reference `03-state-morph--vpn-to-zero-trust.flat.html` |
| 5 | Object transformation | reference `05-object-transformation--envelope-encryption.flat.html` |
| 6 | Graph reachability | not built |
| 7 | Timeline with overlay | not built (the replay is a timeline of one incident, not this) |
| 8 | Ownership or coverage overlay | the `shields` beat on a flow's last step is a start |
| 8b | Coverage over time (control roll-out) | reference `08b-coverage-over-time--control-rollout.iso.html` |
| 9 | Roadmap: time is the scene, with lanes, horizons, dependencies | custom scene `assets/examples/roadmap-risk-burn-down.scene.js` (reference page also kept) |
| 10 | Cascade: a hierarchy read down and up | reference `10-cascade--crown-jewels-impact.flat.html` |
| 11 | Quantities over time: bars, meters, flows | parts of 9 (risk bars) and 8b (meters); no dedicated page |

Further executive candidates, not built: cost of delay (2), strategy on a page (10), risk appetite
versus actual (11), regulatory horizon (7), concentration risk (6), operating model shift and tool
consolidation (3), accountability gaps (8), legacy retirement (3), investment allocation (11).

## 2. Kit modules

- **`flow`** (`--pattern flow`, the default): systems nested in zones, links between them, steps
  made of beats (`chain`, `exchange`, `stream`, `card`, `mark`, `pulse`, `camera`, `shields`) in
  `--style flat` or `--style iso`. Everything in [rules.md](rules.md) part A lives in it. Authoring
  reference: [story.md](story.md). A story with `figures` and a `meta.audience` of `executive` is
  still a flow story; an executive scene that is not estate-based is a reference below.
- **The replay** (`build.mjs --replay`): the second deliverable; not a pattern but a page. It reads
  the same story plus `events`, draws its own small graph (compact system cards in a few
  trust-zone frames, lit as a pure function of the events at or before the clock), and computes
  every number from the events.

## 3. The custom scene seam

`--pattern custom --scene <file.js>` builds a page whose picture is drawn by your scene file and
everything else is the kit's: stage, phase rail, narrative band with counter, controls, narration,
presenter and capture modes, the master timeline, step sequencing and length (the step-end rule),
`rest`, `window.anim` with `moments`, the "Illustrative" chip, the overlap hook, seek rules. Use it
when the scenario is not "a path through nested systems" and no pattern module covers it.

```
node $SKILL/scripts/build.mjs story.json --style flat --pattern custom --scene roadmap.scene.js -o film.html
```

The story names the scene (`meta.scene`) and carries its pattern blocks ([story.md](story.md)
section 7). The file registers `EXK.scenes.<name> = { build(ctx), step(ctx, step, t0) }`. `build`
runs once and draws everything in its first-state look; `step` runs once per story step in order,
adds tweens at times from `t0`, and returns `{ end, firstMotion?, hold?, labelEnd?, rest? }`, all
in seconds from `t0`: `end` is the last motion, `firstMotion` is when the first motion starts (the
body appears after it; default `end`), `hold` is how long the result must stay readable after
`end` (an executive step returns `ctx.timing.resultHold()`, 2.0 s). The kit turns these into the step
length and `rest`; the scene never computes either (`rest` is an override, rarely needed).

`ctx` (all the scene may touch):

| | |
|---|---|
| `ctx.tl` | the master timeline, only `fromTo(target, from, to, position)` (always `immediateRender:false`) and `addLabel`; `to`, `from`, `set`, `call` throw. The build refuses `gsap.timeline(` |
| `ctx.layers.world`, `ctx.layers.hud` | an svg `<g>` in the diagram area (area px, 1920 x 720, origin at the area's top-left) and one in the text layer above it (stage px, 1920 x 1080; the area starts at `ctx.area.y`). `ctx.el(tag, attrs, parent)` makes svg elements |
| `ctx.area`, `ctx.timing`, `ctx.THEME`, `ctx.story`, `ctx.stepIndex`, `ctx.isLast` | the diagram rectangle, the pacing constants (use `QUANTITY_MIN` for a change to a quantity, `resultHold()`), the colour tokens |
| `ctx.text.add(parent, str, attrs, key)` | an svg `<text>` registered with the text layer: it gets `data-ov` (so `__overlaps` sees it) and joins emphasis. `.also(els)` dims other elements with it, `.keep()` exempts it. `ctx.text.register({key, el, dim})` registers one you drew |
| `ctx.emphasise(items, t)` | the dimming rule: `items` stay at full, every other registered item goes to 45 % over 0.4 s; `'all'` restores. Call it at each step start, in time order |
| `ctx.figure(key)` | `{ value, unit, label, source, shown(t0, t1) }` from `story.figures`; an unknown key throws |
| `ctx.shown(item, t0, t1)` | a figure or a story record is on screen from `t0` to `t1` (`Infinity` allowed) |
| `ctx.count(n, of)` | a computed count, `{ n, of, text: "9 of 12", derived: true }` |
| `ctx.block(name)` | `story[name]`, throws if absent |
| `ctx.moment(name, t)` | adds a named moment to `window.anim.moments` |
| `ctx.hud.panel(rect)` | a panel in stage px; draw its content in `.body` at local coordinates; `.show/.hide/.border(color, t)` |
| `ctx.hud.measure({label, key \| value, of?, suffix?, sub?, color?, rect?})` | a 54 px headline that stays in one place; `.to(n, t, dur)` counts to `n` (default 1.2 s); `value` may be a `ctx.count`; `.show/.hide` |
| `ctx.hud.banner(text, color)`, `ctx.hud.legend(rows, {title, staged})` | a state pill; a swatch list whose rows can appear one by one |

HUD primitives start hidden; fade them in with `show(t)`. They sit in stage space with the theme's
tokens and are never dimmed.

**The chip follows the scene.** "Illustrative" shows only while illustrative figures or records
are on screen: report each with `ctx.figure(key).shown(t0, t1)` or `ctx.shown(record, t0, t1)` at
the time the scene makes it visible (a headline built with `key` reports itself). Windows close
together merge. A scene that reports nothing while the story carries illustrative figures keeps
the chip up for the whole scene (with a console warning), never off. Only `shown` drives it:
`source` on steps, phases and `meta` does not.

**The figure rule.** A number typed into a scene file instead of read through `ctx.figure` cannot be
detected in general, so the rule is yours: nothing shown is a literal. Positions that are layout
(pixels, durations) are fine; quantities (an index, a count, a span) come from `figures`, `ctx.count`
or the blocks. (An unknown figure key stops the page at start-up: the console shows `custom scene:
ctx.figure("key"): no such key in story.figures (known: ...)` and `render-check` reports it.) The build warns about a digit inside a string literal passed to `ctx.hud.banner`,
`measure`, `legend` or `panel` and about `value: 12` in them, unless the string is a figure key.
Read the warning list; derived text (`fig.value + ' ' + fig.unit`) has no literal and passes.

**Checks.** `render-check` applies as to any page (`hops` and `speed` print "hook missing": there
are no packets). `check-story` accepts the story and requires sources; an unknown scene, a file
that registers nothing, or `--pattern custom` without `--scene` is a build error naming the fix.
Seek determinism is yours to keep: every visual is a `fromTo` on `ctx.tl`, state set once at build
time is only the first-state look (use element attributes, not `gsap.set`).

Example: `assets/examples/roadmap-risk-burn-down.{story.json,scene.js}` (the roadmap pattern ported).
Not yet in the seam: camera or zoom, estate layout, packets and tags, a second scene in one page,
HUD content that changes text mid-step (cross-fades), and anything isometric.

### Hand-adapt references

Seven working pages in `assets/patterns/`. Each is a complete scene (stage, phase rail,
narrative band, `window.anim`, hooks) with its scenario data in one block at the top of the
script and a comment block naming the data fields and helpers. They are not built from a story:
you copy one, replace the data, and keep the helpers. All seven pass `render-check` for console,
network and seek; "hook missing" lines are expected. Every tween is a `fromTo` on the master
timeline, so `seek(t)` is exact.

**Two outcomes (02, iso).** The same starting event is played twice on one scene; one control is
the only difference, and the last step shows both side by side. The scenario is a stolen
credential with and without segmentation. Driven by `RUNS` (`{ id, label, color, controls,
result }`), `STEPS[].run` (`A`, `B` or `AB`), `NODES`, `ZONES` (the control: they only exist in
run B) and `ROUTE_SPEC`. Helpers: a run banner; a damage log that `rewind()` un-plays in reverse
(trails retract, markers fade) while a rewind indicator shows; `raiseZones()` lifting zone slabs
under the blocks; `refuse()` for a hop that stops at a zone edge; dashed ghost outlines of run
A's reach during run B; a scoreboard whose cells are tweened proxies. Roughly 10 steps in five
phases. With about seven systems every label shows.

**Three outcomes (02b, flat).** One decision, three options. The same period (three years) plays
once per option on the same board; each finished run docks as a small copy, the main board rewinds
to empty, and the end shows the three copies enlarged with the differences stated as numbers.
Driven by `FIGURES`, `DOMAINS` and `CAPS` (a board of 4 domains by 3 capability tiles), `RISKS`
(each lists the capabilities it needs; it closes when all are delivered) and `RUNS` (`{ id,
label, cost, delivers: { year1, year2, year3 } }`); counts and closing years are derived, not
typed. Helpers: `buildBoard()` draws once and the copies are clones; `playYear()`, `dock()`,
`rewindMain()`, `toCompare()`, `callout()`. Six steps.

**State morph (03, flat).** One diagram changes from today's architecture to the target while
the audience watches: what is retired, new, kept or moved. The scenario is VPN to zero-trust
access. `NODES`, `CONTS` and `EDGES` each carry `in: ['current']`, `['target']` or both (an edge
lists its ends per state); `TREES` give the nesting of each state, and nothing has coordinates.
Helpers: `layoutState()` runs the layout engine per state; `classify()` counts retired, new and
kept; `buildWorld()` makes one element per id so shared elements are the same element in both
states; the morph step strikes retired things, glides shared ones to their target geometry, grows
new ones in with a badge and re-routes edges last. Fixed panels: state banner, before-and-after
measure, change legend. Demonstration steps after the morph reuse the flow helpers.

**Object transformation (05, flat).** The subject is what happens to an object (a record is
encrypted, a key is wrapped inside another key's shell, a version ticks over), not where it
travels; the places (KMS and HSM, application memory, storage) are a quiet backdrop of lanes.
`OBJECTS[]` hold `kind` (key, record, envelope) and `parts` (label, colour, state); `LANES`,
`STEPS`, `PHASES` and an `INVARIANT` note ("the root key never leaves the HSM") that is lit while
a step demonstrates it. Helpers: `applyKey()` (encrypt and decrypt: the key rides a bar across the
record and each character flips from a seeded sequence), `wrap()`, `bundle()`, `shred()`,
`reversion()`, and fold and unfold to a chip to travel (which obeys the speed cap).

**Coverage over time (08b, iso).** The estate is a fixed map; what changes is how much of it each
control covers. Coloured bands land on blocks quarter by quarter, one meter per control climbs,
and the end outlines what is still uncovered. Driven by `ZONES` (slabs left to right, systems as
unlabelled blocks), `CONTROLS` (array position is the band's fixed slot on every block),
`COVERAGE[q]` (`{ controlId: [system ids] }` for each of six quarters, 0 being today) and
`STEPS[].quarters`. Helpers: `landBand()`, `quarter()` (a left to right sweep), `meterValue()` (a
pure function of time, so seeking shows the right number), `focus()`, `gapStep()` and
`assertSchedule()`, which checks at build time that the schedule tells the story.

**Roadmap with risk burn-down (09, flat; ported to the custom seam).** Time is the scene. Initiatives sit in lanes on a time
axis; a playhead sweeps it, one horizon per step; a bar fills as the playhead crosses it, and when
it lands a thin link flashes to the risks it reduces and those bars shrink, leaving a ghost of
where they started. A headline counts risks still above appetite. Driven by `FIGURES`, `HORIZONS`
(Now, Next, Later; no calendar dates), `LANES`, `INITS` (`{ id, name, lane, start, end, reduces:
[{ risk, by }] }` in horizon units), `DEPS` (asserted at build time: a dependent starts after its
predecessor ends) and `RISKS`. Helpers: `barGeo()`, `routeDep()`, `runHorizon()`, `land()`,
`setEmph()`. The honest ending: one risk stays above appetite because nothing on the roadmap
addresses it, and the last step says so. The seam version is the example above: the same scene in
a story (`horizons`, `lanes`, `initiatives`, `risks`, `dependencies`, 25 figures) and a scene file of
284 lines against the page's 647-line script (its data and copy moved into the story, its stage,
chrome, timing and contract into the kit).

**Cascade (10, flat).** Layers from business outcomes at the top to data and platforms at the
bottom. Read down it shows what each layer depends on; read up from one node it shows what a
failure there takes with it. Driven by `LAYERS`, `NODES` (a layer index each; nothing has
coordinates), `LINKS` (`{ from, to }`, upper depends on the layer below), `FIGURES` and `STORY`
(which node fails, which is protected, which two are expected to be the crown jewels, checked by
`assertStory()`). Helpers: `orderLayers()` (barycentre sweeps), `layoutCascade()`, `reach()` and
`dependents()` (so counts are computed), `cascadeDown()`, `countBadges()`, `impactUp()`,
`protect()`, and the headline "Outcomes at risk from one failure: N of M".

## 4. Executive scenes

For leadership audiences: direction and funding, not mechanism. The question is "where are we
going and what does it buy us".

- One message per scene; 5 or 6 steps; 45 to 80 seconds in total.
- Few elements, and business names: "Card data", "Sign-in", "Detection", not `payments-api` or
  `IMDS`. Title 6 words or fewer; body one or two plain sentences of 24 words or fewer saying what
  changes and what it buys or costs.
- Numbers carry the point. A headline number is at least 44 px on the stage, sits in the same
  place throughout, and changes by counting (a tween on the value), never by cutting.
- Motion is calm: things grow, fill, slide and fade. Where something travels, the speed cap and
  the read-standing-still rules apply unchanged. A change to a quantity (a bar shrinking, a tile
  filling, a meter climbing) takes at least 1.2 s and its result holds for max(2.0 s, words x 0.35 s).
  Emphasis dimming applies to whatever the current step is about.
- **Figures are inputs, never invented silently.** Every number on the stage comes from one
  `FIGURES` object, each entry `{ value, unit, label, source }` with `source` `provided` or
  `illustrative`. Counts derived from the scene ("9 of 12 capabilities") are computed. While any
  illustrative figure is visible, a fixed chip "Illustrative figures" shows in the diagram area's
  top-right corner; it is part of the scene (it must appear in the film), is driven by the
  timeline, and no URL parameter turns it off.
- Use relative or indexed quantities for illustrative figures (an index out of 100, "1.6x", "9 of
  12"), not currency or dates. In the hand-over, list every figure with its source and say what a
  deck author must supply to make the scene real.
- On the custom seam, the figures rule and the chip are in the kit (section 3). For a page copied
  from a reference they stay yours.
- Starting files: the smallest flat reference is 03 (fixed panels for banner, legend and headline
  measure, the overlap hook, no camera); the isometric starting point is 02 (banner, scoreboard,
  zone slabs). Expose `rest` on every entry of `window.anim.steps`.

Reference 02 predates the figures rule: its containment times are invented and shown without the
chip. Add a `FIGURES` object and the chip before using it for a real audience.

## 5. Adapting a reference

For a scene not yet ported to the seam (02, 02b, 03, 05, 08b, 10). To port one, follow the roadmap
example: its data into pattern blocks and `figures`, its drawing and choreography into `build` and
`step`, and delete its stage, chrome, timing and contract code.

1. Copy the nearest `assets/patterns/*.html` into the working directory. Never edit the original.
2. Replace the scenario data block named in the comment at the top of its script (section 1 of
   the file). Keep the helpers; delete code the new scenario does not use. Write the copy in the
   same voice and within the limits of [rules.md](rules.md) part B.
3. Every number comes from a `FIGURES`-style object with a `source`; show the chip for illustrative
   ones. Derive counts from the data.
4. Make sure each `window.anim.steps[i]` has `rest` (02, 03 and 05 do not yet: add it, the time at
   which the step has finished moving with every label it relies on still shown).
5. `node $SKILL/scripts/build.mjs --inline page.html -o out.html` replaces any CDN tags with the
   vendored scripts (a no-op on the copies shipped here). Then `render-check` (console, network
   and seek must be `ok`; overlaps should be too), `frames.mjs ... steps` and look, then
   `export.mjs` as for any film.
6. These pages are not read by `check-story`, `check-layout` or the replay. If a replay is also
   wanted, write a story for it separately.

## 6. One custom beat inside a flow story

When a flow story needs one thing the vocabulary lacks, add one beat kind in a small file and build
with `--extra`:

```js
// note.extra.js
EXK.extra.beats.note = function (c, beat, t) {
  c.say(beat.lines, { node: beat.node, at: t, arr: t, mono: !!beat.mono });
  return t + 1.5;               // when the next beat may start
};
```

```json
{ "custom": "note", "node": "cdn", "lines": ["Rate limit: none"] }
```

```
node $SKILL/scripts/build.mjs story.json --style flat --extra note.extra.js -o film.html
```

The function receives the step context `c` (the primitives the built-in beats use: `c.say`,
`c.chain`, `c.hop`, `c.ring`, `c.card`, `c.mark`, `c.packet`, `c.colorOf`, `c.link`) and returns the
time the next beat may start. Rules: use only `c.*`; no second timeline (the build refuses
`gsap.timeline(` in the extra file and `render-check` catches state kept outside the master
timeline); durations come from `EXK.timing`; at most one custom kind per story. A second kind means
the kit lacks a beat: record it in the story's `_gaps` instead.

A whole scene that is not estate-based goes through section 3 instead.
