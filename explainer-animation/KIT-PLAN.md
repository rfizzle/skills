# Plan: the shared kit behind `explainer-animation`

Working document for the extraction; delete in P9 once `references/` carries what matters.
Amendments after review are at the end ("Amendments"); where they disagree with the text above,
they win.

Written 2026-11-20 against `explainer-animation/` as it stands (untracked, nothing committed). Rule
citations `P§n` are PATTERNS.md sections. Line numbers refer to `prototypes/v3/a-flat-attack-chain.html`
(flat), `prototypes/v3/b-isometric-attack-chain.html` (iso), `prototypes/replay/attack-chain.replay-v2.html`
(replay).

## 0. The shape in one paragraph

One **story** file (JSON, the STORY-SCHEMA shape plus a small closed vocabulary of per-step `beats`)
goes through one Node script, `scripts/build.mjs`, which concatenates: the inlined GSAP files, the
kit (plain scripts sharing one `EXK` namespace, in the order a manifest states), the story as a JSON
literal, and a one-line boot call, into one HTML page from a template. The same page is the preview
(controls) and the film source (`?capture=1`, read by `export.mjs`). The kit is **one renderer
interface with two painters**: a shared estate model (layout, routes, frames, proxies, in abstract
ground units), a shared scene core (shell chrome, timeline contract, timing rules, text placement
and emphasis, beats choreography), and a `flat` and an `iso` painter that only draw and apply the
camera. The replay is a separate template and module set that reads the same story (plus `events`)
and never loads GSAP. Patterns plug in as modules that turn story steps into beats; version 1 ships
`flow` (patterns 1+4) in both styles, the replay, and a `custom` seam for the seven pattern files
that stay hand-adapted. Every rule in P§5-§10 is enforced inside the core, once.

## 1. Modules and seams

All kit files live in `assets/kit/` as plain browser scripts (`'use strict'` IIFE, ES2020, no
`import`/`export`), each attaching one object to `window.EXK`. The pure ones (marked) must also run
under Node's `vm` for tests and the no-browser checks. `assets/kit/manifest.json` lists the files
in load order with `pure: true|false` and which `bundle` they belong to (`scene`, `replay`).

| File | Owns | Exposes (on `EXK`) | Must not know about |
|---|---|---|---|
| `00-ns.js` (pure) | namespace, `util` (`el`, `txt`, `clamp`, `words`, `textW`), `THEME` colours (P§4) | `EXK.util`, `EXK.THEME` | everything else |
| `story/validate.js` (pure) | schema and rule checks; `normalize` (defaults: `beats` from `uses`, `frame` from `touch`, `short` from `name`) | `validate(story) -> [{path, message, fix}]`, `normalize(story)` | styles, DOM, GSAP |
| `story/provenance.js` (pure) | which records are `illustrative`; the windows in which an illustrative record is visible, given step times | `illustrative(story)`, `chipWindows(story, steps)` | painters |
| `estate/layout.js` (pure) | tree layout from `zones`+`systems`: bottom-up measure, top-down place, row/col direction (default alternates by depth; `layout.dir` hint overrides), anchors (`main`), `dx`/`dy`, padding, container bounds from children (P§9) | `layoutEstate(story, sizes) -> {B, boxes, nodes, full}` in ground units | GSAP, DOM, which painter |
| `estate/route.js` (pure) | orthogonal routes for `links`: straight when end centres align, else L/Z through container gaps; parallel runs on separate lanes, never sharing a segment (P§11); `route` hints (`exit`, `corridor`, `lane`, `via`) | `routeLinks(estate, story) -> E[id] = {a, b, pts, d, len}`; `portsFor` (boundary crossings, merged < 36 px) | painters, timing |
| `estate/frame.js` (pure) | camera frames by held ids (`frame: 'full' | {hold:[ids], grow?}`), fitted to the diagram area's aspect (a parameter), "never slice" audit, breadcrumb, proxy entry points for off-frame endpoints (P§9) | `frameFor(estate, step, area)`, `frameAudit`, `crumbFor`, `proxyPoint` | GSAP, DOM |
| `scene/timing.js` (pure) | every constant and rule in P§6-§7: `SPEED_CAP`, `PACKET_EASE`, `hopDuration(onScreenLen)`, `holdFor`, `lastHoldFor`, `cardHold`, `stepEnd(...)`, `restOf(...)`, motion start delay (1.8 s after a camera move, else 1.0 s) | `EXK.timing` | DOM, painters |
| `scene/shell.js` | the 1920x1080 stage scaled to fit; chrome: phase rail, narrative band, controls bar, mini-map slot, breadcrumb slot, edge fades, "Illustrative" chip; narration modes, presenter mode, keys, `?capture=1`; publishes `window.anim` | `mountShell(opts) -> {area, rail, band, mountChip, ...}`, `publishAnim(tl, steps, phases, moments)` | estates, painters, beats |
| `scene/camera.js` | one tweened camera proxy `{x, y, w, h}` in scene px; `camTo`; on update calls `painter.applyCamera` and `text.sync`; drives mini-map and breadcrumb | `makeCamera(tl, painter, text, area)` | story contents |
| `scene/text.js` | the annotation layer in stage space (anchored to a scene point, counter-scaled, so 22/26 px are fixed, P§10); occupancy grid and free-space placer (port of iso `makeOcc`/`place`/`placeLabel`/`placeTag`, 359-519); text registry with `data-ov` keys; emphasis events -> `fromTo` tweens (port of flat `EMPH`, 794-830, P§8); tag-dodge (port of iso `tagDodge`, 875); hooks `__overlaps`, `__hops`, `__layout` | `makeText(...)` | which painter drew the boxes |
| `scene/beats.js` | per-step context `c` (hop, chain, exchange, stream, say, card, mark, proxy, tally, callout, shields, camera) built on painter primitives; interprets `beats`; registers emphasis; `finalizeLabels`; step-end rule; `rest`; title/body/rail tweens; focus dimming | `runSteps(story, pattern, painter, text, camera, shell) -> {steps, duration, moments}` | how a node or slab is drawn |
| `paint/flat.js` | rects, tabs, icons, rounded orthogonal paths, port rings, trails, markers, packets, proxy badges; camera = `transform` on the world group | the painter interface (below) | timing, emphasis |
| `paint/iso.js` | `iso(x,y,z)`, slabs by level, blocks, `route3D` lifting of the shared ground routes, port rings lit while crossing, depth order, label-visibility rule (only touched nodes), camera = zoom/pan with `ZMAX` | the painter interface | timing, emphasis |
| `patterns/flow.js` | story step -> beats (defaults), the controls step (`shields` from `story.controls`), `all` on the last step, `moments` (none) | `EXK.patterns.flow` | painters |
| `patterns/custom.js` | the seam for hand-adapted scenes: a `--scene` file supplies `build(ctx)` and `step(ctx, step) -> {end, rest}`; the kit still owns shell, timing constants, emphasis registry, contract and hooks | `EXK.patterns.custom` | nothing more than the interface |
| `replay/derive.js` (pure) | sort events; route each through the graph; per-event cumulative counts; phase spans; visibility tallies; piecewise clock (gap compression, breaks); every number on the page | `derive(story, clockOpts)` | DOM |
| `replay/graph.js` | the small purpose-built graph: zones collapsed to two levels, systems as cards on a grid (auto order from first-touched; `replay.layout` hints override), short links, ignition as a pure function of clock | `buildGraph`, `light(clock)` | GSAP, the scene |
| `replay/page.js` | masthead, player card, stat cards, panels, stream, chart, controls cards, footer; keyboard, hash, reduced motion; `window.replay` | `mountReplay(story, derived)` | GSAP, the scene |

**Painter interface** (the only thing `beats.js`, `camera.js` and `text.js` call):

```
painter.build(estate, story, layers)            // draws the static world once
painter.applyCamera(cam)                        // cam = {x, y, w, h} scene px
painter.pathEl(linkId) -> SVGPathElement        // for MotionPath and DrawSVG
painter.onScreenRange(linkId, cam, proxyW) -> {f0, f1, aOff, bOff}
painter.anchor(id, side) -> {x, y}              // node, container or link point in scene px
painter.stageRect(id, cam) -> {x0, y0, x1, y1}   // occupancy for the placer
painter.packet(spec) / .lightLink(id, range, color) / .ring(id, t) / .marker(id)
painter.trail(id) / .portLight(linkId, crossingIndex) / .proxyBadge(point, text)
painter.focus(sets, t, dur)                     // dim what the step is not about
painter.labelPolicy -> 'always' | 'touched'      // P§10 flat vs iso
```

Where the two references disagree today, the kit makes them uniform except where noted:

| Rule | Flat v3 | Iso v3 | Kit |
|---|---|---|---|
| Tags give way (P§6) | no | yes | uniform, in `text.js` |
| Ports lit while crossing (P§9) | static rings | yes | uniform, via `portLight` |
| Proxies for off-frame endpoints (P§9) | yes | no | uniform; iso attempted in P7, may be deferred (see §4) |
| Label visibility (P§10) | all nodes | touched only | **style rule**, stays different (`labelPolicy`) |
| Text size under zoom | font-size / zoom at build time | counter-scaled stage groups | uniform: stage-space layer |
| Camera | viewBox, 8:3 fit | zoom/pan, `ZMAX` | uniform: `{x,y,w,h}` proxy; `ZMAX` is a painter cap |
| Step-end constants | 1.0 / 0.3 / 3.5 wps | same names, trimmed differently | one set in `timing.js` (flat values; open question for the owner, see §9) |
| Camera moves mid-step | yes (`lead`) | one camera per step | flat yes; iso no in v1 (placement is per step camera) |

## 2. The authoring interface

### 2.1 The story file

JSON, one file per scenario, named `<slug>.story.json`. STORY-SCHEMA.md is the base; the kit adds
the fields below, all presentation, all ignored by the replay (so the gathering step never writes
them, the "write the film" step does). Keys starting with `_` are comments and skipped.

```jsonc
{
  "meta": { "id": "ssrf-chain", "title": "SSRF to cloud account compromise", "tagline": "...",
            "kind": "incident", "audience": "technical", "redaction": "...",
            "source": { "kind": "illustrative" } },

  "zones": [                                                  // trust boundaries; nesting by parent
    { "id": "internet", "name": "Internet", "source": {...} },
    { "id": "account", "name": "AWS account · prod", "short": "AWS account", "source": {...} },
    { "id": "vpc", "name": "VPC · 10.0.0.0/16", "short": "VPC", "parent": "account",
      "layout": { "dir": "row", "gap": 60 }, "source": {...} },          // layout: optional hint block
    { "id": "services", "name": "Services", "parent": "account", "layout": { "dir": "row", "below": "vpc" } }
  ],
  "systems": [
    { "id": "attacker", "name": "Attacker", "role": "outside party sending every hostile request",
      "zone": "internet", "icon": "attacker", "tint": "danger", "source": {...} },
    { "id": "imds", "name": "IMDS", "sub": "169.254.169.254", "role": "hands the node's keys to any caller",
      "zone": "cluster", "icon": "chip", "layout": { "dy": 94 }, "source": {...} }
  ],
  "links": [
    { "from": "attacker", "to": "cdn", "source": {...} },
    { "from": "attacker", "to": "s3", "route": { "exit": "bottom", "corridor": "below:vpc" }, "source": {...} }
  ],
  "phases": [ { "id": "initial", "title": "Initial access", "descriptor": "gets a foothold", "source": {...} } ],

  "steps": [
    { "id": "recon", "phase": "initial",
      "title": "A normal request comes in",                      // <= 6 words (validated)
      "body": "First, the attacker behaves like a shopper. ...", // <= 30 words (validated)
      "detail": "longer text for the replay's narrative panel",
      "touch": ["attacker", "cdn", "lb", "storefront"],
      "uses": [["attacker", "cdn"], ["cdn", "lb"], ["lb", "storefront"]],
      "frame": "full",                                           // or { "hold": ["services"], "grow": "down" }
      "callouts": [{ "target": "cdn", "text": "Firewall inspects traffic" }],   // 0-2, <= 6 words; placed by the kit
      "beats": [                                                 // the film's reading of the step; see 2.2
        { "chain": ["attacker", "cdn", "lb", "storefront"], "tag": "GET", "color": "accent", "says": "GET /products" }
      ],
      "source": {...} },
    { "id": "identity", "phase": "cred", "title": "Attacker logs in with stolen keys", "body": "...",
      "touch": ["attacker", "iam"], "uses": [["attacker", "iam"]],
      "frame": { "hold": ["services"], "grow": "down" },
      "beats": [ { "exchange": ["attacker", "iam"], "tag": "API call", "mono": true, "trail": true,
                   "req": "sts:GetCallerIdentity", "resp": "→ role: node-role", "mark": "iam" } ] },
    { "id": "exfil", "phase": "disc", "title": "Customer data streams out", "body": "...",
      "touch": ["attacker", "s3"], "uses": [["s3", "attacker"]],
      "frame": { "hold": ["services"], "grow": "down" },
      "beats": [ { "stream": ["s3", "attacker"], "items": ["orders.csv", "refunds.csv", "emails.csv", "cards.csv"],
                   "says": "s3:GetObject ×4", "mono": true, "tally": "received:" } ] },
    { "id": "controls", "phase": "detect", "title": "Where controls would have cut it", "body": "...",
      "touch": [], "uses": [], "frame": "full", "all": true,
      "beats": [ { "shields": "controls" } ] }
  ],

  "controls": [ { "id": "imdsv2", "name": "IMDSv2 hop limit", "why": "...", "on": ["storefront", "imds"], "source": {...} } ],
  "figures": {},
  "events": [ { "t": 0, "step": "recon", "from": "attacker", "to": "storefront", "action": "GET / → 200",
                "note": "...", "visibility": "logged", "actor": "attacker", "count": 1, "source": {...} } ],
  "replay": { "layout": { "attacker": [0, 1], "cdn": [1, 1] } }    // optional grid hints, only if the auto grid fails
}
```

Build commands (the whole surface an agent sees):

```
node scripts/check-story.mjs <story.json>                         # validate; prints one line per problem with a fix
node scripts/build.mjs <story.json> --style flat|iso [--pattern flow] [-o out.html]
node scripts/build.mjs <story.json> --replay [-o out.html]
node scripts/build.mjs <story.json> --style flat --pattern custom --scene <file.js>   # escape hatch
node scripts/build.mjs --inline <page.html> [-o out.html]        # replace the three CDN tags in a hand-adapted page
node scripts/check-layout.mjs <story.json> --style flat          # no browser: containment, siblings, frame audit, lanes
node scripts/render-check.mjs <page.html>                        # browser: errors, seek determinism, overlaps, hops, speed
node scripts/frames.mjs <page.html> <outdir> steps|<t...>        # look at frames
node scripts/export.mjs <page.html> [...]                        # the film (moved from prototypes/tools, uses `rest`)
node scripts/check-replay.mjs <replay.html>                      # browser: views agree with the clock, totals, lit set, overlaps
```

### 2.2 Beats: the closed vocabulary (version 1)

A step's `beats` run in order; each starts when the previous one ends unless it carries
`"parallel": true` (then 1.5 s after the previous one started, P§6) or an explicit `"at"` in
seconds after the step's motion start. Every beat obeys the speed cap, the holds and the emphasis
rules through `c.*`; an author cannot set a duration.

| Beat | Fields | What the core does |
|---|---|---|
| `chain` | `[ids...]` path of system ids (each adjacent pair must be a link), `tag` (1-2 words), `color`, `says` (string or lines), `sayAt` (`'dest'` default or an id), `trail`, `mark` | one packet along the hops at capped speed; lit links; rings; stationary label at `sayAt` shown at departure, held after arrival; marker on `mark` |
| `exchange` | `[from, to]`, `tag`, `req`, `resp`, `respTag`, `mono`, `trail`, `mark`, `at` | request and response on one link; the response label replaces the request label in the same box (P§6) |
| `stream` | `[from, to]`, `items` (<= 4), `says`, `tally` (heading), `mono` | up to 4 plain packets >= 0.9 s apart, tally at the receiving end (P§6) |
| `card` | `id`, `at` (system id), `rows`, `color`, `then` (`'fold'` to fold into the system) | a text card that holds `cardHold`; folds into its target if asked |
| `mark` | `id` | blast-radius marker (P§9) |
| `camera` | `{ hold: [...], grow? } | 'step' | 'full'` | mid-step camera move (flat only in v1); motion resumes 1.8 s later |
| `shields` | `"controls"` or a list of control ids | the summary step: trace, shields landing on `controls[].on`, fade of the chain (P§8 "summary returns to full") |
| `custom` | `kind`, free fields | calls `EXK.extra.beats[kind](c, beat)` from the `--scene`/`--extra` file |

Defaults when `beats` is absent: one `chain` per contiguous run in `uses`, no tag, no label. It
builds and passes the checks; the skill tells the author it is dull and to write beats.

### 2.3 An executive scene in version 1

No executive pattern module ships in v1 (§3). An executive scene is a `custom` pattern whose
scene file is adapted from the matching reference in `assets/patterns/`; the kit still supplies
the shell, the chip, timing, emphasis and the contract. What the author writes:

```jsonc
// roadmap.story.json
{ "meta": { "id": "roadmap-26", "title": "Three horizons, five risks", "kind": "plan", "audience": "executive",
            "redaction": "none", "source": { "kind": "provided", "ref": "FY26 security plan, p.4" } },
  "phases": [...], "steps": [ { "id": "now", "title": "Now: close the front door", "body": "...", "touch": [], "uses": [] }, ... ],
  "figures": { "risk.identity.start": { "value": 82, "unit": "index", "label": "Identity risk today",
                                        "source": { "kind": "illustrative" } }, ... },
  "horizons": [...], "lanes": [...], "initiatives": [...], "risks": [...]       // pattern block, free shape, validated only for `source`
}
```

```js
// roadmap.scene.js  (adapted from assets/patterns/09-roadmap--risk-burn-down.flat.html, sections 1 and 3)
EXK.scenes.roadmap = {
  build(ctx) { /* draw lanes, bars, risk panel into ctx.layers.world; register text with ctx.text.register(...) */ },
  step(ctx, step, t0) { /* runHorizon(...) using ctx.tl, ctx.timing, ctx.text; return { end, rest, co: [...] } */ }
};
```

`node scripts/build.mjs roadmap.story.json --style flat --pattern custom --scene roadmap.scene.js`.
`figures` with an illustrative source drive the chip automatically (`provenance.js`); the scene
file reads numbers only through `ctx.figure(key)`, which refuses a key that is not in `figures`
(a typed number is a build error, as COMMON-exec.md requires).

### 2.4 Keeping the escape hatch narrow

- A `custom` beat kind or a `--scene` file may use only `c.*` and `ctx.*`; the files run inside
  the same IIFE scope as the kit but `gsap` is reachable only as `ctx.tl` (the master timeline).
  Creating a second timeline or `gsap.to` outside `ctx.tl` is caught by `render-check` (seek
  determinism fails) and by a build-time grep that refuses `gsap.timeline(` in extra files.
- The skill rule: at most one `custom` beat kind per scenario. A second one is the signal that
  `flow.js` is missing a beat; file it against the kit instead.
- Hand-adapted pages (the seven `assets/patterns/` files) must go through `build.mjs --inline`
  before hand-off, so the "no network" rule holds for them too.

## 3. Patterns in version 1

| Pattern | v1 | Why |
|---|---|---|
| 1 + 4, flow with nested containment, flat and iso | **kit module `flow`** | the owner-approved pair; every rule in P§6-§10 lives here; the equivalence oracle |
| replay | **kit** (`replay/*`) | the second deliverable; pure function of a clock; well specified by BRIEF-v2 |
| executive scaffolding | **kit**, inside the core | `figures` validation, `ctx.figure`, the Illustrative chip, HUD primitives (banner, headline measure, legend) are shared by 2, 2b, 3, 8b, 9, 10; cheap once |
| `custom` seam | **kit** | the structured path for everything below; costs a registry lookup |
| 2 two outcomes (iso) | reference, hand-adapt | runs + rewind + ghosts + rising zones + scoreboard: a flow extension worth a module (v1.1 first candidate, the "why fund this" visual) but another full sitting |
| 3 state morph (flat) | reference, hand-adapt | needs two estate layouts and a morph; the shared `layout.js` makes it the cheapest second module (v1.1 second candidate) |
| 2b, 5, 8b, 9, 10 | reference, hand-adapt | not estate-based (board, object cards, meters, lanes/axis, layers); each is its own drawing; the mechanism is already isolated in each file's header |

Honest capacity: flat flow + replay + checks + docs is the real v1 (nine packages). Iso flow is
the first thing to defer if time runs out (§8). No pattern module beyond `flow` is affordable in v1.

## 4. Flat and isometric: what is shared

One renderer interface, two painters (§1). Shared: estate layout in ground units (the iso v3
hand-typed `NODES.x/y` become the output of `layout.js`; its `computeLayout` from kids + `PAD` is
the same algorithm as the flat `measure`/`place`), ground routes (`route3D` lifts the shared
polyline to slab heights), frames, proxies, text placement, emphasis, timing, beats, shell.

Iso will **not** support in v1: `camera` beats mid-step; `grow` frame hints (warning, ignored);
more than one `card` per step; the `lead` close-up idiom. Proxies in iso are attempted in P7; if
they fight the per-step placement they are deferred and iso keeps framing wide, as the v3 file
does. The depth-order trap (slabs by level then x0+y0, blocks by x+y) is kept and documented, and
`check-layout --style iso` warns when two blocks share x+y within 8 units or a route skims a block.

## 5. Assembly

`scripts/lib/assemble.mjs` reads `assets/page.html` (or `assets/replay.html`), which has four
markers, and replaces them:

```
<!--@vendor-->   assets/vendor/gsap-3.13.0/{gsap,MotionPathPlugin,DrawSVGPlugin}.min.js, each in its own <script>, plus LICENSE as a comment   (scene only)
<!--@kit-->      the manifest's files for the bundle, concatenated in order, one <script>
<!--@story-->    <script>EXK.STORY = <json>; EXK.BUILD = {style, pattern, builtAt, kitVersion};</script>
<!--@extra-->    the --scene / --extra file, if any
<!--@boot-->     <script>EXK.boot();</script>
```

Concatenation of plain scripts in one namespace is the whole build. A bundler would buy module
scoping, minification and tree-shaking; none is needed (GSAP, ~98 KB, dominates; a page is
~250 KB), and it would add an install the environment cannot promise. There is no fallback to
plan because there is nothing to fall back from. The build refuses to write a page whose output
contains `src="http` or `url(http`, and `render-check` fails on any `requestfailed`/network event,
so "no network" is checked twice.

Preview and film do not drift because they are the same file: `shell.js` reads `?capture=1`,
`?narration=`, `?present=1` exactly as the v3 pages do, and `export.mjs` is unchanged in its
contract (it now finds `steps[].rest` and `anim.moments`). `EXK.BUILD.kitVersion` is written into
the page and into `manifest.json` by `export.mjs`, so a film can be traced to a kit version.

The GSAP files exist today only in the scratchpad (`gsap-dl/`, 72 KB + 22 KB + 4 KB); P0 copies
them into `assets/vendor/` with the GSAP standard licence text. The build never downloads.

## 6. Directory layout

```
explainer-animation/
  SKILL.md                      # < 150 lines: when, the procedure (gather -> story -> confirm -> build -> check -> look -> export), commands, gotchas
  references/
    story.md                    # STORY-SCHEMA.md + beats + hints + validation messages (replaces STORY-SCHEMA.md)
    rules.md                    # PATTERNS.md §2-§12 condensed to the rules the kit enforces and the ones the author still owns (callout count, copy limits, business names)
    patterns.md                 # catalogue (P§13), which are kit modules, how to adapt a reference through `custom`, executive rules (COMMON-exec.md)
    checks.md                   # the browser harness (EXPLAINER_BROWSER_DIR), what each check prints, the equivalence test and its intended differences
    history.md                  # one page: v1 -> v3 -> patterns -> replay v2, the owner's verdicts, what was dropped and why (from the BRIEF/NOTES files)
  scripts/
    build.mjs  check-story.mjs  check-layout.mjs  render-check.mjs  frames.mjs  export.mjs  check-replay.mjs  equivalence.mjs
    lib/assemble.mjs  lib/load-kit.mjs (vm loader for pure files)  lib/browser.mjs (playwright via EXPLAINER_BROWSER_DIR, launch args)
    *.test.mjs                  # node --test, no browser
    testdata/                   # invalid stories with expected messages; tiny estates for layout/route tests
    testdata/oracle/            # the three approved prototypes, used only by equivalence.mjs: a-flat-attack-chain.html, b-isometric-attack-chain.html, attack-chain.replay-v2.html
  assets/
    page.html  replay.html      # templates with the four markers
    kit/manifest.json  kit/**/*.js
    vendor/gsap-3.13.0/*.min.js + LICENSE.txt
    examples/ssrf-attack-chain.story.json           # the reference story (flat v3 scenario + replay v2 events and cards)
    patterns/*.html             # the seven hand-adapt references, unchanged apart from a header line pointing at references/patterns.md
```

`prototypes/`: `v3/*.html` and `replay/attack-chain.replay-v2.html` move to `scripts/testdata/oracle/`;
`v3/*.md` code maps fold into `references/history.md` (their "traps" tables are the most useful
part; keep those). `tools/` moves to `scripts/` (P5). `patterns/*.html` move to `assets/patterns/`;
`patterns/briefs/*.md` fold into `references/patterns.md` (they carry scratchpad paths and a
session id that must not ship). `v1/`, `v2/`, `split/`, `replay/attack-chain.replay.html`,
`replay/BRIEF*.md`, `out/` are dropped. Since nothing is committed, dropping loses history; the
owner should decide whether to commit the full tree once (tag `prototypes-archive`) before P9
deletes it (§9).

Repository files touched outside the skill: one line in the root `Makefile` `test` target adding
`explainer-animation/scripts/*.test.mjs`; README's table (a new row or the Security architecture
row). `make validate` only lints SKILL.md: keep the word "Claude" (PATTERNS.md §1 has it) out of
SKILL.md; it may stay in `references/history.md`.

## 7. Work packages

Each is one sitting for a Sonnet implementer from its brief plus the files it names. "Browser"
means the harness directory in `EXPLAINER_BROWSER_DIR` (playwright + chromium; today the scratch
`smoke/` directory). DoD commands are run from the repository root. Order and parallelism:

```
P0 ─┬─ P2 ──┐
P1 ─┤       ├─ P4a ─ P4b ─┬─ P6
P5 ─┴─ P3 ──┘             ├─ P7
    └─ P8 ────────────────┴─ P9
```

### P0 Skeleton, vendor, assembler, validator (no browser)
- Goal: the build pipeline exists end to end with an empty scene.
- Inputs: this plan §1-§2, §5; `prototypes/tools/package.json`; scratchpad `gsap-dl/*.min.js`; `api-topology/scripts/render.mjs` (CLI style to match).
- Outputs: `assets/kit/manifest.json`, `assets/kit/00-ns.js`, `assets/kit/story/validate.js`, `assets/kit/story/provenance.js`, `assets/page.html`, `assets/replay.html` (markers only, chrome HTML from flat v3 lines 60-85 and replay v2 lines 1-300 CSS), `assets/vendor/gsap-3.13.0/*`, `scripts/build.mjs`, `scripts/check-story.mjs`, `scripts/lib/assemble.mjs`, `scripts/lib/load-kit.mjs`, `scripts/validate.test.mjs`, `scripts/assemble.test.mjs`, `scripts/testdata/invalid/*.story.json` (one per rule: unknown id in `touch`, title > 6 words, body > 30 words, missing `source`, `uses` pair that is not a link, `events` without `step`, `controls.on` not a link, illustrative figure typed as provided count, `camera` beat with `--style iso`).
- DoD: `node --test explainer-animation/scripts/*.test.mjs` passes; `node explainer-animation/scripts/check-story.mjs <each invalid>` exits 1 and prints exactly the message in the fixture's `_expect`; `node explainer-animation/scripts/build.mjs <minimal valid story> --style flat -o /tmp/x.html` writes a file with no `http` in a `src`/`url(` and containing `gsap.registerPlugin` and `EXK.boot()`; `--inline` on `prototypes/v3/a-flat-attack-chain.html` produces a page that opens offline (checked in P5).
- Deps: none. Parallel with P1, P5.

### P1 The reference story
- Goal: `assets/examples/ssrf-attack-chain.story.json`: the flat v3 scenario (TREE 120-169, PHASES, STEPS copy and callouts 171-238, SHIELDS, edge list from `buildEdges` 287-312 as `links` with `route` hints, IMPL 1052-1240 transcribed into beats), plus replay v2 `EVENTS` (311-430), `CARDS` (as `systems[].role`/`detail`), `INCIDENT` (as `meta`). Every record `source: {kind:'illustrative'}` except derived counts.
- Outputs: the story; `references/story.md` first draft (schema + beats as in §2).
- DoD: `check-story.mjs` prints `ok: 11 systems, 11 zones, 13 links, 5 phases, 11 steps, N events, 5 controls`; every v3 step has beats; the `creds` step uses `camera` + `card` + `chain`.
- Deps: the schema in this plan (not P0's code). Parallel with P0, P5.

### P2 Estate model (pure)
- Goal: `layout.js`, `route.js`, `frame.js`, `check-layout.mjs`, tests.
- Inputs: flat v3 241-412 (`measure`/`place`/`layoutTree`, `buildEdges`, `roundedPath`, `portsFor`, `FRAME_RULES`, `fitFrame`, `frameAudit`, `crumbFor`), `prototypes/tools/flat-check.mjs`, iso v3 153-257 (`computeLayout`, `route3D`, `MARKERS`), §1 table.
- Outputs: the three files; `scripts/estate.test.mjs`; `scripts/check-layout.mjs`.
- DoD: tests: every child inside its parent and no sibling overlap for the example story and for three synthetic trees; no two routes share a segment; frame for each example step has `cut == []` except where the step says `grow`; node centres of the example story, after normalising to the oracle's full view, lie within 24 stage px of the oracle's (`new Function` on the oracle's `//<core>` block gives `buildModel().B`, as `flat-check.mjs` does); `node scripts/check-layout.mjs assets/examples/ssrf-attack-chain.story.json --style flat` prints `full-view scale 0.7x` or better and `containment and sibling checks passed`.
- Deps: P0 (loader), P1 (story). **Stronger model**: the router with lane assignment is the one algorithm in the kit with no prototype to port; give P2 to Opus, or split the router out and give only it to Opus.

### P3 Scene core without a painter
- Goal: `timing.js`, `shell.js`, `camera.js`, `text.js`, the `window.anim` contract (`duration, fps, steps[{id,time,rest,title,body,phase}], phases, moments, seek(t, {camera?}), play, pause`).
- Inputs: flat v3 511-546, 663-760 (bootstrap), 794-830 (EMPH); iso v3 359-519 (placer), 851-897 (emphasis, tagDodge), 1176-1369 (stage fit, rail, minimap, hooks).
- Outputs: the four files; `scripts/timing.test.mjs` (hold, lastHold, hopDuration, stepEnd, rest rules with the numbers from P§6-§7); a `stub` painter inside `scripts/testdata/` that draws two rects and one path.
- DoD: timing tests pass; browser: a page built with the stub painter publishes `window.anim` with `rest` on every step; `render-check.mjs` reports `errors=0 seek-deterministic=true`; `__overlaps()` exists and returns `[]`.
- Deps: P0. Parallel with P2, P8.

### P4a Flat painter and the first beats
- Goal: `paint/flat.js` (`buildWorld` 548-631, `ring`/`mkChip`/`mkFile`), `beats.js` with `chain`, `say`, `mark`, `camera`, focus, the step loop (1241-1311 assembly) and `patterns/flow.js` (defaults only).
- DoD: build the example story `--style flat`; `render-check.mjs` prints `errors=0 seek-deterministic=true overlaps=0 hops=N/N speed<320 PASS` for steps 1-3 (the others run with default beats); `frames.mjs ... steps` written and looked at; duration within 20% of 151 s once P4b lands (not yet).
- Deps: P2, P3. **Stronger model**: the step loop and emphasis composition is the most delicate port; Opus for P4a is justified.

### P4b The rest of the beats
- Goal: `exchange`, `stream`+`tally`, `card`, `proxy` (flat 991-1020), `shields`/trace (1183-1240), callouts via the placer, trails, tags give way in flat, `custom`.
- DoD: full example passes `render-check.mjs`; duration 130-165 s; `window.anim.steps.every(s => s.rest)`; `frames.mjs` contact sheet reviewed; `check-story` + `build` round trip for a story with no beats also passes.
- Deps: P4a.

### P5 Checks and export (browser tooling)
- Goal: move `prototypes/tools/*` to `scripts/`: `render-check.mjs` merges `smoke`, `iso-overlaps`, `iso-hopcheck`, `flat-speed`/`iso-speed` and degrades with a named message when a hook is missing; `frames.mjs`; `export.mjs` (reads `rest`, writes `kitVersion`); `lib/browser.mjs`; `references/checks.md`.
- DoD: `EXPLAINER_BROWSER_DIR=... node scripts/render-check.mjs prototypes/v3/b-isometric-attack-chain.html` (after `--inline`) prints the five results; on the flat v3 file it prints `overlaps: hook missing (window.__overlaps)` and still exits on the other four; `export.mjs --only stills --range 0,12` writes two stills and a manifest.
- Deps: P0 for `--inline`. Parallel with P1-P3.

### P6 Equivalence, flat
- Goal: `scripts/equivalence.mjs`: for each step id present in both pages, seek the oracle to its end − 0.7 s and the kit page to `rest`, screenshot, diff (channel delta > 24), write a side-by-side contact sheet; compare step ids and order, per-step duration (±20%), total (±15%), node centres (24 px), hop sets per step (`__hops` vs the oracle's beats transcription). Document intended differences in `references/checks.md`.
- Intended differences to list up front: label and callout positions (free-space placer vs hand `spot*`/`off:`), route lane geometry where hints differ, no hover tooltips, tags give way (new), ports lit while crossing (new), breadcrumb timing (no per-step special cases), text rendering of stage-space labels, the "Illustrative" chip (the scenario is invented), uniform step-end constants.
- DoD: `node scripts/equivalence.mjs assets/examples/ssrf-attack-chain.story.json --style flat` prints `structural: PASS` and a per-step pixel-diff table; the numeric visual threshold is set from the first passing run (recorded value × 1.5) and the contact sheet is in the report for the owner. Structural PASS is the gate; the pixel number is a regression guard, not acceptance.
- Deps: P4b, P5.

### P7 Iso painter
- Goal: `paint/iso.js`: slabs, blocks, lifted routes over the shared ground routes, rings lit while crossing, depth order, `labelPolicy: 'touched'`, zoom/pan camera with `ZMAX`, proxies (attempt). Validator rules for iso-unsupported fields.
- Inputs: iso v3 103-257, 604-660, 789-947, the §4 list.
- DoD: `build --style iso` of the example passes `render-check.mjs`; `equivalence.mjs --style iso` structural PASS against the iso oracle (durations ±25% here: the oracle was trimmed differently) and a contact sheet; `check-layout --style iso` warnings reviewed.
- Deps: P4b. Parallel with P6. **Stronger model** optional: depth order and lifted routes are the traps the code map lists.

### P8 Replay
- Goal: `replay/derive.js`, `graph.js`, `page.js`, `assets/replay.html`, `scripts/check-replay.mjs`, `scripts/replay.test.mjs` (pure derivations: counts, phase spans, clock mapping, break detection, "what would have stopped it").
- Inputs: replay v2 whole file (data 300-430 becomes story input; 442-598 graph; 647-1240 derive and page), BRIEF-v2 §Page and §Checks.
- DoD: `build --replay` of the example; `check-replay.mjs` prints views-agree forward/back at 12 sampled clocks, `network=0 errors=0`, displayed totals equal computed, lit set equals touched-by-events set, no graph text < 11 px at 1440, no overlapping cards, page height ≤ 2000 at 1440; `window.replay.state()` at three clocks equals the oracle page's state (same fields) within one event.
- Deps: P0, P1. Parallel with P2-P4.

### P9 Skill, moves, deletions
- Goal: `SKILL.md`, `references/*.md` finished, `assets/patterns/` moved with header lines, `scripts/testdata/oracle/` populated, `prototypes/` deleted, Makefile and README lines, `make check` green.
- DoD: `make validate` passes; `make test` passes; `SKILL.md` ≤ 150 lines; every path named in SKILL.md exists; the two near-miss descriptions ("Not for a static diagram (use ui-sketch)…") present; the three realistic prompts from `create-skill` step 7 recorded in the PR body.
- Deps: all. Needs the owner's archive decision (§9).

### Later (not v1): P10 `two-outcomes` module (iso), P11 `state-morph` module (flat), P12 `export.mjs --stills-camera full` using `seek(t, {camera})`.

## 8. Risks, most likely to sink it first, and what to cut

1. **Automatic routing looks worse than the hand routes** (crossing lanes, routes through nodes). Check: P2 tests and `check-layout`; the P6 contact sheet. Cut: lane assignment, keep explicit `route.via` waypoints in ground units in the reference story (the escape hatch for layout).
2. **Free-space placement puts labels somewhere worse than the hand spots**, and the owner rejects the film. Check: P6 contact sheet step by step. Cut: add `says.spot` hints (`'below:<id>'`, `'corridor'`, a stage rect) and use them in the example.
3. **Scope**: two painters plus replay plus checks. Cut first: P7 (iso stays a hand-adapt reference until v1.1; the painter seam is still proven by the stub and flat). Cut second: tags-give-way in flat.
4. **Seek nondeterminism** from the generalised emphasis and tag-dodge (overlapping tweens on one property). Check: `render-check` determinism at every package; rule in `beats.js`: every tween is `fromTo` with `immediateRender: false`, emitted in time order after sorting.
5. **No browser in the implementer's environment**: P3-P8 cannot be declared done. Mitigation: pure tests carry layout, routing, timing and derivations; `references/checks.md` states the harness; a package without a browser run is reported as "built, not verified", never "done".
6. **Replay auto-grid reads badly** for estates unlike the example. Cut: require `replay.layout` hints when zones > 5 or systems > 12, with the validator saying so.
7. **Story schema churn** once agents use it. Mitigation: the validator is the contract and every message names the fix; `beats` is a closed set; `_` keys for notes.
8. **GSAP redistribution**: inlining is permitted under the standard licence; include `LICENSE.txt`; note that anime.js v4 is the swap if that changes (P§2).

## 9. Open questions for the owner

- Step-end pacing: flat and iso v3 were trimmed differently; the kit uses one set of constants (flat's). Which pause length should be the standard?
- The reference scenario is invented, so the rebuilt film and replay show the "Illustrative" chip the v3 pages never had. Accept, or exempt `meta.kind: 'incident'` stories marked as training examples?
- Archive `prototypes/` in git (one commit, tag) before P9 deletes it, or drop it outright?
- Where does the browser harness live on the machines that will run the checks (the plan uses `EXPLAINER_BROWSER_DIR`)?

## Also noticed

- `v3/NOTES.md` says 13 nodes; the flat file has 11 systems. PATTERNS.md §9 repeats "13 nodes".
- PATTERNS.md §1's "Explorer adds" table and §14's first bullet describe the dead explorer; fold into `references/history.md`.
- `b-isometric-attack-chain.html` line 105 refers to a node check script that no longer exists.
- The pattern briefs embed absolute scratchpad paths and a session id; they must not ship as they are.
- `prototypes/tools/README.md` documents `npm install` in that directory; the kit's `references/checks.md` replaces it with the harness-directory convention, since nothing may be installed system-wide.

## Amendments

- **GSAP source.** The scratchpad `gsap-dl/` directory no longer exists. P0 fetches the three
  3.13.0 files once from `https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/` into
  `assets/vendor/gsap-3.13.0/` (with the licence header comments intact and a `LICENSE.txt`
  pointing at https://gsap.com/standard-license). After that the build never downloads.
- **Browser harness.** `prototypes/tools/setup-headless-archarm.sh <dir>` builds the harness
  directory on this kind of machine (private libraries and fonts, playwright, ffmpeg-static, a
  `run.sh`). Scratch directories are wiped between sessions, so packages must not assume one
  exists: check for `$EXPLAINER_BROWSER_DIR/run.sh` and say so plainly if it is missing.
- **Step-end pacing.** Use the flat reference's constants unless the owner says otherwise.
- **The "Illustrative" chip on the example.** Accepted: the example scenario is invented, so its
  film and replay show the chip.
- **Deleting `prototypes/`.** Not before the owner has decided whether to commit it first. P9
  moves and copies; it deletes nothing until that decision is recorded here.
- **Paths in this plan** that start with `scripts/`, `assets/` or `references/` are relative to
  `explainer-animation/`.
- **Hooks `scripts/render-check.mjs` reads (P5, built).** The scene core (P3, P4) must expose
  exactly these: `window.anim = { duration, seek(t), steps: [{ id, time, rest }] }` (required);
  `window.__overlaps()` returning an array (empty when clean); `window.__hops()` returning
  `[{ step, rid, mid, ends: [nodeId] }]` with node labels marked `data-ov="label:<nodeId>"`;
  packets as the children of an element with `data-layer="packets"`; the stage element with
  `id="stage"`; `window.EXK.BUILD.kitVersion`. `--allow-cdn` exists only for the old prototypes.
- **Decisions after P1 (the reference story, built).**
  - `mark` is both a beat kind (`{ "mark": id }` alone) and a field on `chain` and `exchange`.
    A beat's kind is the first of `chain, exchange, stream, card, camera, shields, pulse, custom,
    mark` present as a key; `mark` beside another kind key is that beat's field, not a second kind.
  - Vocabulary additions for v1: `mono` on `chain`; `respColor` on `exchange`; `stream` takes a
    path of two or more ids (each adjacent pair a link); a new beat `pulse` (`{ "pulse": id }`:
    a ring on a system, no packet). `at` (seconds after the step's motion start) is valid on any
    beat, as section 2.2 already says.
  - Not added; accepted as intended differences from the v3 film: link-anchored labels with
    their own timing, an alert badge beat, a recap beat separate from `shields`, timed callouts,
    hand-set shield and label spots, a stream counter. The story's `_gaps` array records each.
  - Extra fields the story uses and the validator accepts: step `color`, `short`; system `tag`,
    `short`, `sub`, `icon`, `tint`, `detail` (string or `{ what, did }`); link `kind`; control
    `stops` (step ids); `meta.accent`, `meta.incidentRef`; zone `layout` keys `dir`, `gap`, `pad`,
    `below`, `belowGap`, `caps`, `main`, `dx`, `dy`. Unknown fields on records other than beats
    are ignored with no error; unknown keys inside a beat are an error.
  - The example has 12 links and 11 zones (not 13 and 11 as the P1 entry guessed).
- **Scene core interfaces as built (P3).** These replace the sketches in section 1 where they
  differ. All attach to `EXK`.
  - `mountShell({ story, search? }) -> shell` with `shell.stepChrome(tl, i, t0, tEnd, { bodyAt })`,
    `shell.mountChip(tl, steps, duration)`, `shell.area { x, y, w, h, el }`,
    `shell.layers { world, text }`, `shell.reserved`, `shell.onTick(fn)`.
  - `publishAnim(tl, steps, phases, moments, { onTick: [fn] })` returns `window.anim`.
  - `makeCamera(tl, painter, text, area, { shell, minimap, fade, crumb, full })` ->
    `{ cam, set(f), setFull(f), camTo(t, f, dur, ease) -> endTime, frameAt(t), scale(),
    crumb(tl, t0, t1, parts), render() }`.
  - `makeText({ story, tl, painter, area, layer, reserved })` -> `plan(cam, { t0, step, active,
    full, routes })` (one placement session per step); `label(id, lines, { at, until })`;
    `say({ lines, node | anchor, at, until, mono, color })`; `callout({ text, target, ... })`;
    `card({ title, rows, node, ... })`; `tag({ packet, label, color }).hop({ path, f0, f1, rev, t,
    dur })`; `register({ key, el | els, node | tab | target | edges | shield, at, until })`;
    `appear(item, t)`; `vanish(item, t)`; `emphasis(t, edgeId, nodeIds, shields)`;
    `logHop({ step, rid, t0, t1, ends })`; `sync(cam)`; `finish()` (boot calls it after the runner).
  - A painter is `EXK.painters[style](ctx)` and provides `build(estate, story, layers)`,
    `applyCamera(cam)`, `pathEl(id)`, `onScreenRange(id, cam, proxyW) -> { f0, f1, aOff, bOff }`,
    `anchor(id, side)` (`'top'` for node labels; `'side'` = the block's top-right corner, for
    says, callouts and cards), `stageRect(id, cam)`, `packet(spec)`, `focus`. Packets are direct
    children of `[data-layer="packets"]`; blocks carry `data-block`.
  - A step runner is `EXK.runSteps(ctx) -> { steps: [{ id, time, rest, title, body, phase }],
    duration, moments }` with `ctx = { story, tl, painter, text, camera, shell, area, timing }`;
    all times absolute.
  - `EXK.boot` lives in `scene/shell.js` (the stub in `00-ns.js` remains for the replay bundle and
    the vm tests). Boot currently passes `estate = null` to `painter.build`; P4a wires the estate in.
  - A working example of a painter and runner using all of this: `scripts/testdata/stub/stub.js`.
- **Estate model as built (P2).** `EXK.layout.layoutEstate(story, 'flat' | 'iso' | sizes)` ->
  `{ B, boxes, nodes, root, world, full, sizes, problems }`; each box `{ id, type, x, y, w, h, cx,
  cy, depth, parent, kids, label, short, a, dir, pad, tab, caps }`.
  `EXK.route.routeLinks(estate, story)` -> `E['from-to'] = { id, a, b, pts, d, len, shape, rule,
  axis, lane, lanes, exit, entry, ports: [{ x, y, box, side, s, f }], issues }`, plus `findLink`,
  `checkRoutes`, `markers`, `pointAt`. `EXK.frame.frameFor(estate, step | spec, area)` ->
  `{ x, y, w, h, zoom, full, hold, grow, cut, enclosing, inside, crumb, widened, issues }`, plus
  `frameAudit`, `crumbFor`, `proxyPoint(route, f, 'a' | 'b')`. The reference story lays out within
  0.71 stage px of the flat prototype at full-view scale 0.708, with no route issues.
  Known limits: iso uses the flat tree algorithm (it does not reproduce the iso prototype's hand
  placement, and its frames are in ground units, not projected); tall narrow holds widen to the
  full view; interleaved crossings are reported, not removed.
