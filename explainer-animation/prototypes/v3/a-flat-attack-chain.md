# Code map: `a-flat-attack-chain.html`

For someone starting a new animation from this file. The design rules are in `../../PATTERNS.md`
(cited as P§n); this lists where and how the file implements them. Line numbers are for the file
as saved with this map (1320 lines). Checks: `../tools/flat-speed.mjs`, `../tools/flat-check.mjs`,
`../tools/smoke.mjs`, `../tools/frames.mjs`.

## 1. Sections in order

| Lines | What |
|---|---|
| 1-90 | `<head>` CSS and the stage HTML: `#fade` (edge fade), `#rail`, `#band`, `#mm`, `.crumb`, `.px` (proxy), `.tally`, `#controls` |
| 92-98 | CDN scripts (GSAP, MotionPath, DrawSVG), `registerPlugin` |
| 100-484 | **1. Scenario data + layout** between `//<core>` and `//</core>`: pure code, no DOM or gsap; node scripts load exactly this block |
| 104-118 | colours `C`, geometry and timing constants |
| 120-169 | `N()`, `K()` constructors and `TREE` (the estate) |
| 171-238 | `PHASES`, `STEPS` (copy, callouts, frames), `SHIELDS`, `TRACE` |
| 241-366 | `measure`/`place` layout, `buildEdges`, `roundedPath`, `portsFor` |
| 370-412 | camera: `FRAME_RULES`, `fitFrame`, `frameAudit`, `crumbFor` |
| 414-450 | callout and shield geometry |
| 453-483 | `buildModel()` assembles `MODEL` (boxes, edges, ports, frames) |
| 486-509 | `ICONS` (inline SVG paths), `KIND` (container styles per kind) |
| 511-546 | **2. Scaffolding**: helpers `el`/`txt`/`clamp`, `fit()` (scale stage), narration mode, `MODEL = buildModel()` |
| 548-631 | `buildWorld()`: SVG layers, container rects and tabs, edges + port circles, trail paths, node groups with markers and tooltips, mini-map |
| 633-661 | `ring`, `mkChip` (moving tag), `mkCred` (credential card) |
| 663-760 | `bootstrap()`: master timeline, `renderState`, `seek/play/pause`, step nav, presenter pause, `window.anim`, controls, keys |
| 762-1311 | **3. Choreography** (`choreograph(tl, w)`), see section 3 below |
| 1313-1320 | **4. Go**: `bootstrap(choreograph)` |

## 2. Data shapes

```js
// node: N(id, lines, icon, tint, tooltip, opts)         lines.length 2 = second line muted
N('imds', ['IMDS', '169.254.169.254'], 'chip', C.text, 'tooltip text', { dy: 94 })
//   opts: main:true  anchor line for the parent (rows align children on it; cols use the main child)
//         dy: shift down inside a row   dx: shift right inside a col   gapBefore: override gap
// container: K(id, kind, label, dir, kids, opts)        kind picks the style in KIND
K('vpc', 'vpc', 'VPC · 10.0.0.0/16', 'row', [ ...kids ],
  { gap: 60, padOver: { l: 50 }, crumb: 'VPC' })
//   hidden:true  layout-only group (no border, no tab, not in model.boxes)   caps:true  tab in capitals
//   padOver: {l,r,t,b} replaces PAD/TOPPAD   crumb: short name for the breadcrumb
// edge: built in buildEdges() from computed coordinates, never typed as numbers
def('byp_s3', 'attacker', 's3', [[A.cx, Y], [A.cx, LA[1]], [dS, LA[1]], [dS, s3.cy]]);
//   orthogonal waypoints; first and last point sit inside the nodes (hidden under them)
// step
{ id: 'exfil', phase: 'disc', color: C.danger, title: '...', body: '...',   // P§5 copy limits
  callouts: [],                       // [{ target: nodeId|edgeId, text, side:'up|down|left|right', at: seconds, off:[dx,dy] }]
  touch: ['attacker','s3'],           // nodes the step involves (focus dimming, ancestors lit)
  edges: ['byp_s3'],                  // links the step uses (focus)
  frame: { rule: 'svc' },             // 'full' | { rule: key of FRAME_RULES }
  proxy: ['byp_s3'],                  // documentation only; the IMPL calls c.proxy itself
  lead: { rule: 'cluster' },          // optional close-up shown first (creds, detect)
  all: true }                         // last step: no dimming
// frame rule: returns bounds in diagram units; fitFrame adds the 8:3 aspect
svc: function (B) { return { x0, y0, x1, y1, grow: 'down' }; }   // grow:'down' extends only downward
// shield: edge + point on it (seg, t); at:[x,y] puts the label in free space with a leader, else side:
{ n: '2/3', edge: 'store_imds', seg: 1, t: 0.50, label: 'IMDSv2 hop limit', at: [2330, 664] }
```

## 3. Helpers

`c` is the per-step context made by `makeCtx(st, t0)` (872). Times passed to `c.*` are seconds
relative to the step start; `t0` makes them absolute.

### Layout, routing, camera (inside `//<core>`)

| Helper (line) | Takes / gives | Guarantees | Rule |
|---|---|---|---|
| `measure` / `place` / `layoutTree` (243/273/279) | `TREE` to boxes with x, y, w, h | container size = children + padding + label tab; rows align on anchors; nothing hand-placed | P§9 containers computed |
| `buildEdges(B)` (287) | boxes to `E[id] = {a, b, pts, d, len}` | orthogonal, rounded, parallel runs on separate lanes | P§11 |
| `portsFor` (346) | edge points + boxes to border-crossing points | one ring per container border crossed; drawn static in `buildWorld` (578) | P§9 boundary crossings (static only, see section 5) |
| `fitFrame` (384) | bounds to a frame with the 8:3 aspect | never narrower than the bounds; `full` if it reaches 97% of the width | P§9 |
| `frameAudit` (392) | model + frame to `{cut, enclosing, inside}` | classifies every container against the frame edge | P§9 never slice (check tool) |
| `crumbFor` (403) | frame to breadcrumb names | outer to inner, containers holding the frame centre and not wholly in view | P§9 breadcrumb |
| `calloutGeom` / `shieldGeom` (434/443) | step + callout / shield to box and anchor | callout font = 26 stage px at the frame's zoom | P§10 |
| `buildModel` (453) | `MODEL` with `frames[stepId] = {main, lead, zoom, crumb, leadCrumb}` | crumb empty at full view | P§9 |

### Timeline helpers (inside `choreograph`)

| Helper (line) | Takes / gives | Guarantees | Rule |
|---|---|---|---|
| `c.camTo(r, frame, dur)` (880) | eased viewBox tween; updates `c.frame`, `c.z` | later hops use the new zoom | P§9, P§6 |
| `c.range(id)` (887) | edge to `{f0, f1, aOff, bOff}` fractions on screen | an endpoint outside the frame is clipped to where the proxy sits | P§9 proxies |
| `c.dur(id, minD)` (898) | hop duration | `max(1.6, 1.176 * onscreenLen / 315)`; 315 so the peak stays under 320 | P§6 speed cap |
| `c.hop(p, id, rev, r, color, o)` (902) | packet, edge, direction, start, colour; `o`: `noLine noRing trail hide minDur` | moves along the drawn path with a trapezoid ease (`PACKET_EASE`, 768); draws the lit link; rings and the minimap dot on arrival unless it ends off-frame; registers the emphasis event; returns the arrival time | P§6, P§8 |
| `c.chain(p, hops, r, color, o)` (923) | several hops in a row | one packet; hides after the last | P§6 |
| `c.say(lines, o)` (937) | label text and position (`x,bottom` / `cx,y` / `cx,cy`), `at`, `arr` + `arrText` or `until`, `P` for the leader | stationary box that fades in at `at` and holds after arrival; width estimated at 0.6 x font size per character (`mono` 0.62); registers its text for emphasis | P§6 text standing still, P§10 |
| `c.spotAttacker / spotBelow / spotCorridor` (964-975) | position presets | known free spots in this layout | P§10 free space |
| `c.exchange(id, o)` (977) | request and response on one edge | request label held 2.5 s+, the response label replaces it in the same box; two hops | P§6 pairs |
| `c.proxy(ids, rIn)` (991) | edges whose start is off-frame | HTML badge pinned to the stage at the point where the first edge enters; returns `{left, bottom}` | P§9 proxies |
| `c.tally(px, items, times, head)` (1008) | lines and arrival times, under a proxy | each line fades in as its packet lands; counts as a label for holds | P§6 streams |
| `c.finalizeLabels()` (1022) | called after the step's `IMPL` | the LAST label (or tally) gets `max(1.4, words x 0.35)`, earlier ones `max(2.5, words x 0.4)` (`holdFor`, 783; `lastHoldFor`, 784); creates the fade-outs | P§7 |
| `c.callout(cd, r)` (1032) | step callout | leader and pill, fades at step end | P§5 |
| `c.mark(id, r)` (931) | node id | persistent danger marker (blast radius); `NM` groups built in `buildWorld` (604) | P§9 |
| `ring` (634) / `setActive` (864) | node id | arrival ring; moves the minimap dot | P§9 |
| `focusTo(t, st, dur, all)` (842) | step | dims nodes, containers and links not in `touch`/`edges` to `DIM` 0.35 | P§9 focus |

### Emphasis (P§8), one place

`EMPH` (794) collects text items (node lines `NT`, tabs `BT`, labels, tallies, proxies, callouts, shield labels) and
events (`emphEvent`, 798; called from `c.hop` and from the shield loop at 1218). `buildEmphasis` (811)
runs once at the end (1308): sorts events by time and writes `fromTo` opacity tweens
(`DIM_TEXT` 0.45, `DIM_DUR` 0.4). `emphActive` (803) is the rule: node end points, ancestor tabs, labels whose window holds the event,
callouts targeting those nodes, proxies on that edge, shield labels listed in the event.

### Assembly (1241-1311) and shields (1183-1240)

Per step: `focusTo`, `IMPL[id](c)`, `finalizeLabels`, callouts, then the length
`max(end + END_AFTER_MOTION, label end + END_AFTER_LABEL, body shown words / BODY_WPS)`
(113-118), final step plus `FINAL_HOLD`. Then the breadcrumb, narrative band, phase rail and dots,
fade-outs, trail promotion. `IMPL` has one function per step (1052-1240); `controls` draws the
trace, lands `SHIELDS` and fades the chain after the first.

## 4. To reuse for a different scenario

**Replace:** `TREE`, `PHASES`, `STEPS` copy, `SHIELDS`, `TRACE`, the edge definitions in
`buildEdges`, the colours in `C` only if meanings change (P§4), `ICONS`, and the whole `IMPL` table
(one function per step, composed from `c.hop`, `c.exchange`, `c.say`, `c.proxy`, `c.tally`).

**Leave:** `measure`/`place`, `roundedPath`, `portsFor`, `fitFrame`, `frameAudit`, `crumbFor`,
`buildWorld`, `bootstrap`, the assembly loop, the emphasis machinery, `c.hop/dur/range/say/
exchange/finalizeLabels`, the CSS, and all constants in 104-118.

**Still hand-tuned for this scenario (the traps):**

| Where | Trap |
|---|---|
| `buildEdges` lanes (287-312) | lane order is chosen so lanes never cross: farthest target on the highest lane, stems left to right in the same order; a new target order needs a re-think |
| `FRAME_RULES` (370) | `svc` extends downward past the account border because the strip is too short for 8:3; the other rules assume this tree |
| `c.spot*` (964) and `SHIELDS[].at` | label positions are absolute coordinates in free corners of THIS layout |
| `calloutGeom` offsets and `off:` in `STEPS` | tuned by eye; removing a callout is cheaper than moving it |
| `c.proxy` | assumes the link enters from the LEFT (`PROXY_W` reserved on the left only), one proxy per step, badge text fixed to "Attacker" |
| `IMPL.creds` (1072) | close-up uses `M.credPop`, placed above `imds` inside the cluster (`buildModel` 462) |
| assembly crumbs (1258) | per-step crumb timing is special-cased for `creds` and `detect` |
| `IMPL.detect` pull-back | uses `holdFor` directly for the camera pull-back, so it ignores `lastHoldFor` |
| width estimates | label boxes are sized by characters x font size; a different font can overflow a box |

## 5. Known rough spots

- Services close-up (steps 4-7, and the step 10 lead): the account border shows as a faded line at
  the left and bottom (the frame is cut by it; `flat-check.mjs` lists `account` as cut), and an old
  trail line is drawn across the IAM / STS node. Step 2: a leader line runs through the "INTERNET" tab.
- Dimmed nodes are see-through at 35%, so links that end at a node centre show through it.
- Moving tags do not fade for labels and port rings are static, so the P§6 "moving tags give way"
  rule and the P§9 lit-while-crossing port rule are NOT in this file.
- Two flows in step 5 overlap in time, so both labels count as active (emphasis windows, not
  flow ids).
- Step lengths are derived (about 151 s); `window.anim.steps[].time` changes whenever copy or
  holds change, so do not hard-code times.
- Fonts: headless renders use whatever `system-ui` resolves to; label boxes were sized against Inter.
