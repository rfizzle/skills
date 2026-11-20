# Layout troubleshooting

Run `node $SKILL/scripts/check-layout.mjs story.json --style flat` (and `--style iso`) before a
build. It needs no browser and prints one line per finding, each with a fix. Hints go in the story:
`layout` on zones and systems, `route` on links ([story.md](story.md) section 1). Add a hint only
when a line below asks for one. Every output in this page was printed by the script on
`assets/examples/ssrf-attack-chain.story.json` or on a story in `scripts/testdata/stories/`
(`cold-ai-flows`, `cold-phishing`, `cold-supply-chain`); a line marked "invented estate" was printed
on an estate made for this page.

## Contents

1. Every kind of line. 2. The full-view scale is below 0.70. 3. A link has no clean route, or a hint
made it worse. 4. The isometric estate is refused. 5. The summary step is crowded. 6. Hints that
read differently in isometric.

## 1. Every kind of line

| Line starts with | Means | What to do |
|---|---|---|
| `containment and sibling checks passed` | boxes nest and no two siblings overlap | nothing |
| `FAIL ...` | a real failure (a frame slices a container, a route passes under a box, containment is broken); exit 1 | apply its `Fix:` |
| `warn layout <path>: ... Fix: ...` | a hint names something that is not there or cannot apply (`below` a non-sibling, `cols` with `dir "col"`) | correct the hint |
| `layout: zone <id> is laid out as a row/column (it has no dir; ...)` | the zone has two or more children and no `dir`, so the kit tried both directions and kept the one that fills the diagram area better | nothing, or set `dir` yourself to choose; the line names the key |
| `world WxH  full-view scale S at 1920x720` | the estate size and the scale of the full view; 1.0 is one ground unit per stage pixel | below 0.70 see section 2 |
| `advice: ...` | one hint change, tried with a full layout, that raises the scale; at most three, best first | apply the first one and run again |
| `routes N: ...` | how many links are straight, L, Z or U shaped; the links that use `corridor` or `via` | read once |
| `warn <link>: ...`, `info <link> crosses <link>` | a route runs along a border, skims a block, or crosses another link; `info` is allowed (crossings are drawn) | `warn`: its `Fix:` |
| `FAIL <link>: no clean route ...` then `  advice <link>: ...` | section 3 | |
| `<step>  full` or `zoom 1.30  cut: ...  \| enclosing: ...  \| crumb: ...` | the frame audit, one line per step and per `camera` beat | `cut:` must be `-` unless it says `(grow)` |
| `  why <step>: a frame around ... would cut the border of ...` | the hold you wrote would have sliced a container, so the kit added that container to the hold, and the frame grew (often to the full view) | write `frame "full"` if that is what you want; else hold one container that holds them all, or `grow` |
| `warn <step>: ...` | a frame problem (a `hold` names an unknown id, a `grow` that is not `down` or `up`) | its `Fix:` |
| `note: ...` | explains how links are drawn, or how iso frames; no action | |
| `iso full-view zoom Z (a block is B px wide)` | iso only: the zoom of the projected full view | below 0.55 gets `advice:`; below 0.45 is refused (section 4) |
| `warn iso ...`, `note iso ...` | iso only: a name with no clear spot, or a flat hint honoured differently (section 6) | `warn`: its `Fix:` |
| `REFUSED iso: ...` | iso only: the estate cannot be drawn cleanly; exit 1 | section 4 |

Last line is `frame and route checks passed`, or `N check(s) failed`. Exit 0 only when nothing failed.

## 2. The full-view scale is below 0.70

Symptom, from `cold-ai-flows` in flat:

```
world 1754x1130  full-view scale 0.637 at 1920x720  (below 0.70: text gets small; the estate is taller than the area (1.55 against 2.67), so the full view uses only the middle of the frame)
advice: remove zones[2].layout.below (ext beside corp instead of under it) raises the full-view scale to 0.837
```

Cause: the diagram area is wide (2.67 : 1) and the estate is not. A `below` stacks a zone under its
sibling and makes the estate taller; a long column does the same. Text is drawn at a fixed size, so
a small scale means the nodes and gaps shrink while the text does not, and labels crowd.

Fix: the hint the `advice:` line names. Removing `layout.below` from `zones[2]` (the `ext` zone) and
running again prints `world 2272x860  full-view scale 0.837`. The other advice forms are
`set zones[i].layout.dir "row"` (a column that would sit better as a row) and, in iso,
`layout.iso.cols n`. When the line says `no single dir/below/cols change helps; regroup systems
into fewer, squarer zones, or split the story`, no one hint is enough: merge thin zones, move a
system into a zone with room, or tell two stories. Do not chase 0.70 on a story whose full view is
used once: close-ups (`frame.hold`) carry the detail and the full view is the establishing shot.
`cold-phishing` is 0.702 and `ssrf-attack-chain` 0.708, both acceptable.

## 3. A link has no clean route, or a hint made it worse

Symptom, from the example with `links[3].route` changed to `{"exit":"top","corridor":"above:imds"}`:

```
warn storefront-imds: exit top cannot be honoured with corridor above:imds, ignored. Fix: change exit or the corridor.
FAIL storefront-imds: no clean route; the best passes under payments. Fix: add route.corridor (below:<id> of a box beside the gap to use) or route.via waypoints in ground units.
  advice storefront-imds: the hint {"exit":"top","corridor":"above:imds"} makes it worse: without route hints the router finds a clean route; remove links[3].route
```

Cause: the hint asks for a side or corridor that does not exist for those two boxes, or that
runs under an unrelated box. The kit then ignores the hint (`warn`) and routes as well as it can,
and the result fails.

Fix, by what the `advice` line says:

- `makes it worse ... remove links[i].route`: delete the hint. The router alone is clean.
- `set links[i].route = {...} (routes it cleanly)`: the check tried each `exit` and each corridor
  next to a zone or an end, and this single hint works. Paste it in.
- `no single exit/corridor hint routes it cleanly; give it route.via waypoints, or move one end`: write
  `via` (ground units, last resort) or change the layout (`gap`, `dir`, `below`) so the gap exists.

Other route lines: `lane N is taken or outside the M lanes of its bundle, reassigned. Fix: give each
link in the bundle a distinct lane 0..M-1` (two links in one corridor asked for the same lane; the
farthest target gets the highest lane); `the gap holds N lanes less than 8 units apart. Fix: widen
the gap (layout gap/pad/belowGap)` (invented estate); `runs along the border of <zone>` (a run
hugs a container edge: `route.corridor` into the gap, or more padding).

## 4. The isometric estate is refused

`--style iso` checks that the projected full view can be read before you build. Symptom, on an
invented estate (25 systems in one row, in one zone):

```
advice: set zones[1].layout.iso.cols 5 (account) raises the iso zoom to 0.651
iso full-view zoom 0.314 (a block is 37 px wide)
REFUSED iso: the isometric full view is at zoom 0.31 (below 0.45): a block is 37 px wide and its name crowds onto its neighbours. Fix: make the ground plan smaller and squarer for iso: layout.iso {"dir": "row"|"col"} or {"cols": n} on the zone with the most children, or build with --style flat.
this estate cannot be drawn cleanly in isometric; build it with --style flat, or apply the fixes above and check again
```

Cause: a diamond-shaped scene is limited by height, and a long row or column projects to a thin
diagonal. The other refusal is `blocks A and B overlap when projected (one hides the other)`: fix
with `layout.iso` `gap` on their zone or `dx`/`dy` on one of them.

Fix: put `"layout": {"iso": {"cols": 5}}` on the zone (`cols` wraps its row into a grid and
implies a row, so leave `dir` out) or fewer systems per zone. With `cols 5` the same estate
prints `iso full-view zoom 0.706 (a block is 83 px wide)` and passes. `layout.iso` replaces `layout`
for iso, so copy any flat hints you still want into it. If nothing works, flat is the fallback:
`build.mjs ... --style flat`. A refusal exits 1; a build is not blocked, but the page would be
unreadable.

## 5. The summary step is crowded

The `shields` beat puts one shield per control on that control's own link and names it. This is
placed by the kit; it has no hints. When names do not fit, the page logs (in the browser console,
and `render-check` shows no failure):

```
step "summary": the name of control <id> does not fit beside its shield; shields are lettered and named in a legend
step "summary": 8 controls (more than 6); shields are lettered and named in a legend
```

and the film shows letters on the shields and a "Controls" panel listing `A  name  (steps)`. That is
the intended degrade, not a defect. To get numbered shields with names beside them: fewer than
seven controls, shorter control `name`s (two or three words; names fold onto two lines), and
`stops` that are real step ids (the number on a shield is computed from them). Several controls
on one link are fine: the kit staggers their shields along it. Look at the summary frame with
`frames.mjs ... steps`; see [rules.md](rules.md) section A, "The summary step".

## 6. Hints that read differently in isometric

| Hint | Flat | Isometric |
|---|---|---|
| `layout` | read as written | replaced, key for key, by `layout.iso` when the zone has one; copy what you want to keep |
| `below` | starts at the parent's left plus `dx`; the parent grows downward | starts under its sibling (x of the sibling plus `dx`) and the sibling's slot widens; `check-layout` prints `note iso zones[i].layout.below: honoured in iso as "under <id>, starting at its x + dx"` |
| `cols` | ignored (`warn layout ...cols: cols is read in iso only`) | wraps a row into n columns; implies a row; ignored when the zone is `dir "col"` or a child uses `below` |
| `dir` absent | the kit picks row or column | the same, and the line is `layout: zone ...` |
| `route` | read | replaced by `route.iso`; `"iso": {}` is "no hints in iso" |
| `frame.grow` | extends the frame downward | ignored |
| `camera` beat | close-up inside a step | skipped (`skipped (iso: no camera beats in version 1 ...)`); the step keeps its frame |
| second `card` beat in a step | shown | skipped |

`check-story --style iso` lists each skipped item as a warning.
