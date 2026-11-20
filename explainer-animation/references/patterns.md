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
| 5b | One record, many viewers: the same record as each system that touches it sees it | custom scene `assets/examples/data-protection-views.scene.js` |
| 6 | Graph reachability: what an identity can reach, and what cutting one edge does | custom scene `assets/examples/privilege-escalation.scene.js` |
| 7 | Timeline with overlay | not built (the replay is a timeline of one incident, not this) |
| 7b | A deadline that has already started: a threat that arrives after the data was taken | custom scene `assets/examples/harvest-now-decrypt-later.scene.js` |
| 8 | Ownership overlay: who owns what, and where the gaps fall | custom scene `assets/examples/shared-responsibility.scene.js` (coverage over time is 8b; the `shields` beat on a flow's last step is a start) |
| 8b | Coverage over time (control roll-out) | reference `08b-coverage-over-time--control-rollout.iso.html` |
| 9 | Roadmap: time is the scene, with lanes, horizons, dependencies | custom scene `assets/examples/roadmap-risk-burn-down.scene.js` (reference page also kept) |
| 10 | Cascade: a hierarchy read down and up | reference `10-cascade--crown-jewels-impact.flat.html` |
| 11 | Quantities over time: bars, meters, flows | parts of 9 (risk bars) and 8b (meters); no dedicated page |
| 12 | Barriers between threats and consequences (a bow-tie): where the layers are thin and what adding one changes | custom scene `assets/examples/defence-in-depth.scene.js` |

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
| `ctx.area`, `ctx.timing`, `ctx.THEME`, `ctx.story`, `ctx.stepIndex`, `ctx.isLast`, `ctx.stepStart` | the diagram rectangle, the pacing constants (use `QUANTITY_MIN` for a change to a quantity, `resultHold()`), the colour tokens |
| `ctx.text.add(parent, str, attrs, key)` | an svg `<text>` registered with the text layer: it gets `data-ov` (so `__overlaps` sees it) and joins emphasis. `.also(els)` dims other elements with it, `.keep()` exempts it. `ctx.text.register({key, el, dim})` registers one you drew |
| `ctx.group(el \| els, key)` | a non-text thing that emphasis can dim: the elements move into an outer and an inner `<g>`; emphasis tweens the outer one (`item.outer`), the scene tweens `item.el` (the inner one) as it likes, so the two never fight. Use it for a card's shapes instead of `.also()` on its text. `.also`, `.keep` work as on text |
| `ctx.emphasise(items, t)` | the dimming rule: `items` stay at full, every other registered item goes to 45 % over 0.4 s; `'all'` restores. `items` may mix text items and groups, nested in arrays. Call it at each step start, in time order |
| `ctx.figure(key)` | `{ value, unit, label, source, shown(t0, t1) }` from `story.figures`; an unknown key throws |
| `ctx.shown(item, t0, t1)` | a figure or a story record is on screen from `t0` to `t1` (`Infinity` allowed) |
| `ctx.count(n, of)` | a computed count, `{ n, of, text: "9 of 12", derived: true }` |
| `ctx.block(name)` | `story[name]`, throws if absent |
| `ctx.atStepEnd(fn)` | `fn({t, rest, index})` runs once the step's length is known; `t` is the start of the next step. A mark or pill that stays "until the step ends" fades out at `t`, never before `rest` (`hud.banner(...).hideAtStepEnd()` does it for a pill). It is not called for the last step, which ends with everything on screen |
| `ctx.moment(name, t)` | adds a named moment to `window.anim.moments` |
| `ctx.hud.panel(rect)` | a panel in stage px; draw its content in `.body` at local coordinates; `.show/.hide/.border(color, t)` |
| `ctx.hud.measure({label, key \| value, of?, suffix?, sub?, color?, rect?})` | a 54 px headline that stays in one place; `.to(n \| ctx.count, t, dur)` counts (default 1.2 s); `.tint(color, t, dur)` changes the number's colour over time; `.show/.hide`. `value` is a `ctx.count(n, of)` ("3 of 9"; `of: false` shows just "3"), a `ctx.figure(key)` handle, or a number your scene computed. The build still warns for a bare literal (`value: 0`) |
| `ctx.hud.banner(text, color)` | a state pill |
| `ctx.hud.legend(rows, {title, rect, staged, direction, gap, swatchW})` | a legend panel. Rows are `{label, color, shape: 'dot' \| 'bar'}` or bring their own mark with `swatch` (an SVG fragment string, or a callback `(g, {w, h})` drawing in a `swatchW` x 30 box, default 46). `direction: 'row'` lays items left to right and wraps to a new line when the next does not fit `rect.w`; `rect.h` must hold the lines, and the error names the height needed (a single row in a taller `rect` is centred). `count: ctx.count(n, of)` on a row shows a number after the label (`countOf: true` adds " of M"; `countColor`); the row's handle changes it over time with `rows[i].count(ctx.count(n, of), t, dur)`. `staged` (also per row) hides rows until `rows[i].show(t)` |
| `ctx.hud.caption(rect \| panel)` | text that changes over time in one place: a small heading and a sentence in a panel. `.say(text, t, {head, last})` shows the panel if hidden and puts the text up; saying again fades the old text out and the new in after it (two `fromTo` tweens, never visible together, so the overlap check never sees both). It returns `{visible, hold, readyAt}`: a text stays for `ctx.timing.holdFor(text)` (`lastHoldFor` with `last: true`) after it is fully visible and may not be replaced or cleared sooner; an earlier call throws with the earliest time. Start the next beat at `readyAt`. `.clear(t)`, `.hide(t)` (clear and fade the panel), `.show(t)`, `.panel` **Rest rule (a property of the seam):** stills and the last frame of each clip are taken at the step's `rest`, so the last text said in a step stays through `rest` and is cleared at the start of the next step or replaced by its first `say`; a `clear(t)` or `hide(t)` asked for before `rest` waits for the step end, and a step that says nothing clears the old text and hides the panel at its start. Do not fade a caption at the end of a step yourself. `run()` throws at boot when a caption panel is on screen with no caption at some step's `rest` (and `scripts/seam-rest.test.mjs` seeks to every `rest` in a browser) |

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
and anything isometric.

**Graph reachability (6, flat; on the custom seam).** What an identity can reach from where it
stands, the one chain that turns a small grant into full control, and how much of the reach
disappears when one edge is cut. The scenario is a build bot that deploys a service and ends at
customer data through five hops. Driven by `nodes` (`id`, `name`, `kind`: identity, role or
resource, optional `crown`), `edges` (`id`, `from`, `to`, `kind`, `why`, optional `granted` for a
grant made on purpose), `start` (an identity id) and `cuts` (one control: `name`, `why`, `edges`
to remove); every record has a `source`. Nothing reachable is typed: reach is computed from the
graph. Edge kinds that move you are "member of", "can assume", "can change", "runs as" and "can
read"; "can list" does not (drawn dashed), any other kind is an error. The target is the one crown
node that is a resource; another crown node (Administrator) is passed on the way. Pure helpers,
unit-tested under Node (`scripts/reach.test.mjs`) through `EXK.graph`: `reach()` (hop distance,
cycles and unreachable nodes handled), `pathTo()` (shortest chain), `others()` (other identities
that reach the target), `given()` (reach over granted edges only) and `layout()` (columns by hop
with unreachable nodes in a muted last column, order chosen to reduce crossings, long edges
routed above the cards). A scene is one file, so these live in the scene file, before the part
that needs the page. Drawing helpers: `wave()` (one hop per beat, headline counting up),
`tracePath()` (the chain in the attacker colour, each `why` read standing still), `cutEdge()` (a
shield lands, the edge breaks, what is no longer reachable drains back and leaves a dashed ghost,
headline counting down) and `showOthers()` (a second measure, before and after). Build-time
assertions: a path to the target exists before the cut and not after; the granted reach is a
strict subset of the full reach; exactly one crown resource. It uses
`ctx.hud.caption` for the label that changes (a heading and the `why` of each edge, then the
before and after wording), a row `ctx.hud.legend` for the last step, and `ctx.group` to dim a
card's shape with its name. An edge that starts in the "Not reachable" column and runs to a
column further left is drawn as a short stub fading toward its target with the target's name in
a small tag, not as a line across the graph (that column gets a wider gap for it). The helper names, the `act` field on each step and the single scene file are the
pattern; the colours and copy are the scenario.

**Ownership overlay (8, flat; on the custom seam).** A fixed grid of things that need an owner,
coloured by who owns each: the audience sees the split between parties, then the cells nobody owns
or that two parties each assume the other owns, then what closing those gaps takes. The picture
does not move; the overlay does. The scenario is shared responsibility for a cloud service: three
parties, six layers and four duties. Driven by `parties` (`id`, `name`; three), `layers` (rows,
bottom up), `duties` (columns), `cells` (`layer`, `duty`, `owner`: a party id, `"none"`, or a list
of two ids for a disputed cell; `note` on a gap saying why it falls through) and `fixes` (per gap:
`party` and `takes`); every record has a `source`. A party is told apart by a colour, a fill
pattern and a mark, never colour alone; a gap is hatched in the warning colour and a disputed cell
is split down the middle. Pure helpers, unit-tested under Node (`scripts/ownership.test.mjs`)
through `EXK.ownership`: `counts()`, `gaps()`, `applyFixes()`, `coverage()`, `check()` (every
layer and duty pair has a cell, at least one unowned and one disputed cell, one fix per gap, no
gap left after the fixes) and `layout()`. Drawing helpers: `reveal()` (one party's cells fill in,
its count and the headline "Owned: N of M" tick up), `gapsOn()` (each gap's note read standing
still, the second measure counting up) and `fix()` (the cell takes its new owner's fill and a
"newly owned" mark, the measures count). Relation to 08b: coverage over time asks how much of a
fixed map each control covers, quarter by quarter, in isometric; this asks who is answerable for
each cell at one moment and what is left without a name, so there is no clock and the before and
after is a single set of fixes. Use 08b for a roll-out schedule and this for accountability. It uses
the same three seam helpers as the graph scene: `ctx.hud.caption`, a row `ctx.hud.legend` (the
parties with live counts, then the overlay marks, each drawn by the scene as a swatch) and
`ctx.group` (a cell's shapes dim on the group's outer element while the scene's own fade is on
the cell), and `hud.measure(...).tint()` turns the Gaps number from the warning colour to the
secure colour when it reaches zero. A disputed cell is split down the middle, one half per party
with its fill and mark, "Disputed" over the join. The helper names, the `act` field on each step and
the single scene file are the pattern; the colours and copy are the scenario.

**A deadline that has already started (7b, flat; on the custom seam).** Encrypted data copied today
cannot be read today, but if it must stay secret for longer than a capable quantum computer takes to
arrive, it is exposed already. One time axis shows how long each kind of data must stay secret (a lane
and a bar from now), how long migrating takes (a bracket ending at the earliest arrival, so its start
is the last safe start) and a window for when today's public-key encryption could be broken, drawn
with soft edges and labelled as a range, never a date. A padlock lands at "now" on each lane, a
playhead sweeps the axis, and where it passes into the window the part of each bar beyond it turns:
sparse hatching where exposure depends on the early end of the window, dense hatching where it holds
at both ends. The honest ending: migration protects data created from then on (a dotted bar,
numbered in plan order), not what was already copied. Driven by `axis` (`span`, `step`), `datasets`
(`name`, `secrecy`), `migration` (`lower`, `upper`), `threat` (`earliest`, `latest`) and `plan`
(`dataset`, `completes`); each of those fields holds a key into `figures`, so every number has a
`source`. Pure helpers, unit-tested under Node (`scripts/exposure.test.mjs`) through `EXK.exposure`:
`exposure()` (exposed at the earliest and latest ends, and by how many years), `exposedCount()`,
`lastStart()` (a range), `deadlines()` (the start each dataset needed, and whether it has passed),
`startNote()` (the lane's second line from the migration step on: "Safe without migrating", "Already copied: exposed", or "Start within N years"), `afterPlan()`, `ticks()`, `layout()` and `check()`. Build-time assertions: some data is exposed and
some is not, one dataset sits on the edge (exposed at the early end only, so the range matters), the
plan moves the longest-lived data first and still leaves data exposed, some start dates have passed
and some have not, and every figure is used. It uses `ctx.hud.caption` (with `readyAt`), a staged
row `ctx.hud.legend`, `ctx.group` (a lane's shapes dim as one) and `ctx.hud.measure` with `ctx.count`
for "Data types exposed if harvested today: N of M"; the second measure, a range of years, is a
`ctx.hud.panel` whose text the scene tweens. Relation to the roadmap (9): both put a playhead on a
time axis, but the roadmap shows work the owner controls landing and shrinking risks, while this
shows a deadline set by someone else, an estimate that is a range, and a cost that has begun to
accrue before any work starts; there are no dependencies and nothing is delivered, and the last
step says what the plan cannot undo. Use 9 for a plan that closes risks and this for a deadline.
The helper names, the `act` field on each step and the single scene file are the pattern; the
colours and copy are the scenario.

**One record, many viewers (5b, flat; on the custom seam).** Extends object transformation: the
subject is still one object that is changed, but the change is applied three ways side by side and
the question moves from "what happened to it" to "who can read it afterwards". The same record is
shown as each system that touches it sees it, and a thief with a copy of the store is one of the
viewers. The scenario is a payment record under tokenization, encryption and masking, seen by a
payment processor, an order service, an analytics team, a support agent and a thief. Driven by
`record` (fields: `name`, `value`, `kind`), `protections` (three, with a plain `define`, `reversible`
and `by`, a `transform` rule per field kind, `fits`, and for masking a `mode`), `viewers` and
`access` (per viewer: holds the key, can call the token vault, sees unmasked screens, or reads a
copy of the store); every record has a `source`. Nothing shown is typed: every view, readable
count and comparison cell is computed. Masking is shown as a display control, so the store keeps
the original and a thief reads every field; static masking, which overwrites the store, is a
`mode` away and the pure functions handle it. Pure helpers, unit-tested under Node
(`scripts/views.test.mjs`) through `EXK.views`: `standIns()` (tokens that keep the original's
shape and ciphertext as hex bytes, from a fixed seed built once), `view()` (per field what a viewer
sees and why), `counts()`, `recoverers()`, `matrix()`, `flipStart()` and `mix()` (the sweep as a
pure function of time), `check()` and `layout()`. Drawing helpers: `apply()` (a bar sweeps each
field left to right and each character changes as it passes), `lookAs()` (the viewer's chip lights
and all three cards change in one moment, a caption says why) and `steal()` (the thief's view, the
cards outlined as copies of the store). Build-time assertions: the thief reads no protected field
under tokenization or encryption, the stored value under masking is what `mode` says, reversibility
matches who holds a key or a vault, some viewer reads every field under each protection, and no two
protections look the same to every viewer. It uses `ctx.hud.caption` (with `readyAt`) and `ctx.count`:
"Fields readable N of M" stands in each card's footer, one line under the card, tinted for the thief, whose footer is the count alone (the other viewers' footers add why), and no legend. Every block stands at least 20 px from the next, the mask bullet is drawn as a dot the size of a lowercase letter, and the film runs under 80 s;
the viewer chips and the last step's three-row comparison (reversible, by whom, what a copy gives a
thief) are drawn by the scene from the same functions. The seam needed nothing more. Relation to
05: that page shows one transformation with its key travelling; this shows several side by side and
changes the audience instead of the object, so use 05 for how one protection works and this for
which protection fits which job. The helper names, the `act` field on each step and the single
scene file are the pattern; the colours and copy are the scenario.

**Barriers between threats and consequences (12, flat; on the custom seam).** A bow-tie: threats in a
column at the left, the one event to be avoided as the knot in the middle, consequences at the right.
Between each threat and the event stand prevention barriers; between the event and each consequence,
mitigation barriers. An attack is a path from a threat through its barriers; each barrier holds, is weak
or is missing today. The audience sees that no single control is the defence, where today's layers are
thin, and what one added barrier changes. The scenario is a data leak: four threats, six prevention and
four mitigation barriers (two prevention barriers weak, one missing, one mitigation barrier weak), two
additions. Driven by `threats`, `event` (a block of one), `consequences`, `barriers` (`id`, `name`,
`side`: prevent or mitigate, `on`: the threat or consequence ids it stands in front of, `state`: strong,
weak or missing, `owner`: a role; the array order is the order along a path), `attempts` (`threat`, the
`step` it is tried in, `when`: today or plan, `expect`: held or through) and `additions` (`barrier`,
`change`: new or stronger); every record has a `source`. Nothing counted is typed. A barrier stops an
attack only when it is strong: the first strong barrier on a path is where it stops, a weak one lets it
through with a visible mark, a missing one is not there. The rule of the pattern: a threat with no barrier
is an error naming the threat (a consequence with none is the same). A barrier is a bar on the line,
told apart by look and never colour alone (solid, thin dashed outline, empty outline), numbered. Barrier names
are longer than the lines have room for at 22 px, so only the barriers on the path being shown carry their name
beside the bar (`placeNames()` puts it clear of every line, bar, box and pill; it wraps to two lines when one
does not fit), the others stay as quiet numbered bars, the full numbered list stands in two columns in the top
strip in the first and the last step, and the legend is the key to the four looks on one line.
Pure helpers, unit-tested under Node (`scripts/barriers.test.mjs`) through `EXK.bowtie`: `pathOf()`,
`trace()` (where an attempt stops), `reaching()` and `unmitigated()` (threat paths that reach the event and
consequence paths with no strong barrier, before and after the additions), `describe()` (the caption
sentence), `slots()` (shared barriers line up in one column), `layout()` (fills the diagram area and
reports the least gap between bars), `placeNames()` and `check()`. Drawing helpers: `attempt()` (a slow unlabelled dot
travels the line, stops at the first strong barrier with "Held here" or passes with "Slips past" and "Not
there", the caption carries the words), `fanOut()` (the consequence lines light as far as their strong
barriers) and `land()` (a barrier turns strong with a "new" mark; replaying the attempt shows it held).
Build-time assertions: no threat or consequence without a barrier; at least one path reaches the event
today and none after the additions; no consequence left unmitigated after them; every attempt does what
its `expect` says. Headlines in one place each: "Threat paths reaching the event: N of M" and
"Consequences left unmitigated: N of M" (`ctx.count`). It uses `ctx.hud.caption`, a row `ctx.hud.legend`
(the three looks and the "new" mark, one line) and `ctx.group` (a line, its bars and its
box dim as one). The helper names, the `attempts` and `additions` blocks and the single scene file are
the pattern; the barriers and copy are the scenario.

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
