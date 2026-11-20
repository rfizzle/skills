# Code map: `b-isometric-attack-chain.html` (isometric reference)

Starting a new isometric animation from this file? Design rules live in `../../PATTERNS.md` (cited
as P§n). This page says where this file implements them. Line numbers are for the file as of
2026-11-19 (1390 lines); grep the name if they drift. The checks are in `../tools/iso-*.mjs`.

## 1. Sections in order

| Lines | Holds |
|---|---|
| 7-64 | CSS: stage, rail, band, mini-map, `#scene` (the clipped diagram area), `.edge` fades, `#crumb`, controls |
| 69-98 | Body: stage div, scene `<svg>`, edge fade divs, breadcrumb, rail, mini-map, band, tooltip, controls bar |
| 103-519 | Section 1, `//#region pure`: data, projection, layout, routes, camera frames, all text placement. No DOM, no gsap |
| 103-151 | `COL`, `iso`, sizes, `NODES`, `CONT` |
| 153-257 | `computeLayout`, `ROUTE_SPEC`, `route3D`, `ROUTES`, `MARKERS`, `CTRL` (shields) |
| 258-324 | `PHASES`, `STEPS` (copy, touch, routes, frame, callouts, says, card) |
| 326-357 | Diagram-area constants, `camFor`, `CAM_FULL`, `CAMS` |
| 359-519 | Stage-space placement: `makeOcc`, `place`, `placeLabel`, `placeTag`, `layoutStep`, `SHIELD_LAY` |
| 521-557 | Section 2: `el`, `text`, `clamp`, `pathD` (rounded 3D polyline), `invEase`, `mixHex` |
| 558-603 | Section 3 start: params, layers `L`, `tl`, `fade`, timing constants, `annG`, `leader`, `pillBox` |
| 604-660 | `buildSlabs`, `buildRoutes` (port rings), `buildNodes` |
| 661-788 | `mkPacket`, `buildSay`/`sayOn`/`sayStep`/`sayOff`, `buildCard`, `buildShields`, `buildCallout`, `buildLabel`, `buildTag` |
| 789-947 | Camera proxy (`camMove`), `activeAt`, helpers: `durFor`, `show`, `hide`, `light`, emphasis, `tagDodge`, `hop`, `chain` |
| 948-1094 | `stepBuilders()`: one function per step (`recon` 953 ... `detect` 1059, `controls` 1071) |
| 1095-1175 | `buildTimeline`: intro, per-step loop, step-end rule |
| 1176-1325 | Section 4: stage fit, rail, mini-map, `sync`, `tick`, narration, tooltips, controls, `goStep` |
| 1326-1390 | `window.anim`, `__hops`, `__layout`, `__overlaps`, boot |

Ground units: `iso(x, y, z)` (113) maps a point on the ground plane (+x down-right, +y
down-left, +z up) to scene px. Slabs and blocks are drawn from it; one ground unit along an axis
is about one scene px.

## 2. Scenario data shapes

```js
// NODES (124): x, y = centre on the ground plane; h = block height; parent = a CONT id
store: { label: 'storefront', x: 1210, y: 300, h: 70, color: '#c9d6ea', parent: 'nsweb', tip: ['title', 'hover text'] }
// CONT (138): bounds are computed from kids + PAD (computeLayout 153), never typed
nsweb: { label: 'ns: web', kids: ['store'] }            // roots are 'internet' and 'account' (setLv call, 156)
// ROUTE_SPEC (176): node ids or [x, y] waypoints; ends are trimmed HALF+12 from the node
'atk-iam': ['atk', [NODES.atk.x, BUS_Y], [NODES.iam.x, BUS_Y], 'iam']
// STEPS (267)
{ id: 'recon', phase: 'initial', title, body,           // title <= 6 words, body <= 30 (P§5)
  touch: ['atk','cdn','lb','store'],                     // nodes involved: get labels, stay undimmed
  routes: ['atk-cdn','cdn-lb','lb-store'],               // routes undimmed; chip lane for placement
  frame: ['atk','edge','pub','nsweb'],                   // node/container ids the camera must hold; 'full' = whole estate
  fm: [240, 220, 300],                                   // optional camera margins (x, top, bottom), only step 10 uses it
  callouts: [{ target: 'cdn', text: 'WAF inspects every request' }],   // target: node id or route id
  says: [{ key: 'req', at: 'store', mode: 'swap', texts: ['GET /products'], color: COL.accent }],
  card: 'creds' }                                        // optional floating card, key into CARDS (467)
// say modes: 'swap' (texts[i] replaces texts[i-1] in place) | 'list' (a tally, lines appear one by one)
// CTRL (249): shield for the summary step; route -> the protected node is ROUTES[route].to
{ n: '2', step: 2, route: 'atk-cdn', at: [x, y] /* ground point on the link */, label: 'WAF rule' }
// CARDS (467): { w, h, target, targets: [nodes the card is about], color }
```

## 3. Helpers a scenario author calls or changes

| Name (line) | Takes | Guarantees | Rule |
|---|---|---|---|
| `iso` (113), `poly` (116), `pathD` (534) | ground x, y, z; polylines | One projection; rounded corners on routes | P§2 |
| `computeLayout` (153) | `NODES`, `CONT`, `PAD` | Container boxes grown from kids; `nodeZ` and `zAt` (z of the slab under a point) | P§9 containers computed |
| `buildSlabs` (607) | `BOX`, levels | One slab per container, one shade per level; no text on slabs | P§10 |
| `buildNodes` (637) | `NODES` | Blocks sorted by x+y, plates, "!" marker per node (shown by `mark`) | P§9 blast radius |
| `route3D` (197), `ROUTES` (224) | polyline | Pieces lifted to the slab they cross; crossing list `gates`; `slen` = screen length | P§6 speed |
| `MARKERS` (232), `ringPts` (622), `light` (827) | crossings | One flat ring per crossing, crossings under 36px merged; ring lights only while a packet crosses | P§9 boundary crossings |
| `camFor` (344), `CAMS` (354) | ids, fit box, margins | Zoom and pan that hold the ids; `frame` = visible scene rect | P§9 frames |
| `encloses` (364), `crumb` in `layoutStep` | cam | Containers around the whole frame go to the breadcrumb (`#crumb`, set in `sync`) | P§9 |
| `.edge` divs (22-25), `#scene` (20) | CSS | Scene clipped to the diagram area; 56px fades on all four edges | P§3, P§9 |
| `hop` (898) | packet, route id, reverse?, start time | Duration from the speed cap (`durFor` 811, sine ease so the peak stays at or under 320 px/s); glide across a node between routes; lights the route and rings; records the hop for emphasis and checks | P§6 |
| `chain` (941), `pin` (935), `show`/`hide` (817/821) | legs, time | Several hops in a row; park a chip; fade it in or out | |
| `mkPacket` (665) | `{label,color}`, optional second face, scale, token ring | A dot plus an optional tag above it (the tag has `data-ov`); `PKS` registry | P§6 |
| `tagDodge` (875), `tagHit` (871) | packet, path | Tag fades (dot stays) while it would touch any placed text; stays hidden if it stops on text | P§6 tags give way |
| `buildSay` (690), `sayOn`/`sayStep` (704/706), `sayOff` (711) | say layout | Stationary pill; swap or tally; hold max(2.5s, words x 0.4) after arrival, last one in a step max(1.4s, words x 0.35); sets `SAYEND` | P§6, P§7 |
| `applyEmph` (851), `hopEmph` (862) | time, predicate | Text off the current hop dims to `EMDIM` (0.45) on an inner box group; ends, containers, the hop's pill and its target stay full. Called only from `hop` (and `controls`) | P§8 |
| `makeOcc` (369), `place` (402) | anchor, size, occupancy | First free spot: clear of active blocks, markers, chip lane, other text, leaders; relaxes in steps; `force` always returns one | P§10 |
| `placeLabel` (421), `placeTag` (447), `leaderClear` (390) | node or container id | Above the block, else beside; tag at the nearest corner; leaders do not cross text or other blocks | P§10 |
| `layoutStep` (472) | step index | Placement order: card, node labels, tags, says, callouts | P§10 |
| `SHIELD_LAY` (503) | `CTRL` | Names only protected nodes; a name that will not fit is folded into the shield label | P§8 |
| `annG` (591) | parent, scene anchor | Text group anchored in the scene, drawn in stage px, counter-scaled in `sync` (line 1222) so size never depends on zoom | P§10 |
| `buildTimeline` (1096) | all of the above | Step start = `ts`; motion starts `T` (1.8s after a camera move, else 1.0); next step = latest of motion end + `PAUSE_AFTER_MOTION`, `SAYEND` + `PAUSE_AFTER_LABEL`, body time; last step + `FINAL_HOLD` | P§7 |
| Timing constants (576-581) | numbers | `PAUSE_AFTER_MOTION`, `PAUSE_AFTER_LABEL`, `BODY_WORDS_PER_S`, `LAST_SAY_MIN`/`PER_WORD`, `FINAL_HOLD`, `EMDIM`; speed cap `SPEED` (810) | P§6, P§7 |
| `window.__overlaps` (1339) | none | Visible `data-ov` boxes that intersect (opacity is the product up the tree, so 45% text counts); leader lines (`data-ld`) against other boxes and non-target blocks | P§12 |
| `window.__hops` (1336), `window.__layout` (1337) | none | Hop log for the hop check; placement report (forced/dropped items) | P§12 |
| `window.anim` (1326-1335) | | Contract: `duration, fps, steps, phases, seek, play, pause` | P§3 |

`data-ov` goes on a group holding only text-bearing content (pill rect plus text), never the
leader. Keys: `label:id`, `tag:id`, `say:key`, `callout:target`, `card:key`, `shield:n`, `pkt:text`.

## 4. To reuse this for a different scenario

Replace:
- `NODES`, `CONT`, `ROUTE_SPEC`, `PHASES`, `STEPS` copy, `CTRL`, `CARDS` and `CRED_ROWS` (718-747 card bodies).
- The per-step functions in `stepBuilders` (953-1094): they hold the story timing (who hops when, what swaps).
- `tip` texts, `COL` mapping of colours to meaning (P§4).

Leave (generic): `iso`, `computeLayout`, `route3D`, the placement block (359-519), `camFor`, `hop`,
`tagDodge`, emphasis, `sayOn/Step/Off`, `buildTimeline`'s step loop, Section 4, `__overlaps`.

Hand-tuned for this scenario (the traps):
- **Depth order is by layer, not by geometry.** Slabs sort by level then x0+y0 (607), blocks by x+y
  (637), packets sit above everything (`L` order, 569). It works because slabs have gaps and
  routes run on slab tops. A route that skims a block's corner, or two blocks that overlap in x+y,
  will draw in the wrong order.
- `BUS_Y` (121) and the waypoint routes: the bypass lane is placed by hand through the account
  services slab; `CTRL.at` points are typed ground coordinates on links.
- Step 11 is index 10 in several places: `STEPS[10]` (`fullTags` 1101, `SHIELD_LAY`), `i === 10`,
  `i < 10` in `buildTimeline`; the `controls` builder reads `shields`, `cards.finding`, `marks`.
- `detect` hard-codes `cardWords = 11` for the card hold; `creds` hard-codes the card timing.
- `MARKERS` merges at `36 / 0.49`: 0.49 is this estate's full-view zoom. Recompute for another size.
- `ZMAX` 1.3 (343), `FIT` boxes (327-328) leave room for the mini-map at the top right; `fm` is a
  per-step margin override (only step 10).
- `enumerate` lifts its second packet by `LIFT + 56` so the two lanes do not stack.
- `dotPrev` (798) starts the mini-map dot on `atk`.
- `FULL_LABELS_FIT` (437) is false here, so the full view shows no node names except shield targets.
- Comment at line 105 says "the node check script runs this block": that script no longer exists.

## 5. Known rough spots

- Step 9 is crowded (the "order rows" pill over dimmed blocks, "ns: payments" over the payments-api
  block) and uses only the left half of the frame (v3/NOTES.md).
- No proxies for off-frame endpoints (P§9): steps 4-7 and 9 stay zoomed out (0.5-0.7) so the
  attacker stays in frame.
- Step 10's finding card sits over two blocks.
- Node labels drift beside their block when the space above is taken; shield leaders can still cross
  a block in the full view.
- Moving chips can pass over leader lines; the leader test ignores packets on purpose.
- Frame edges still cut neighbouring slabs and the Internet strip; the fade hides it. The breadcrumb
  is implemented but no step currently encloses its frame, so it never shows.
- The diamond-shaped scene is height-limited, so the full view is about 0.5 scale with empty sides.
- Placement widths are estimates (`textW`, 0.62 em); the browser check is the real test, and glyph
  widths differ on macOS.
