# Version 3 brief (isometric style): declutter static text, slow the flows

Start from `../v2/b-isometric-attack-chain.html`. Read `../v2/BRIEF.md` and `../v1/BRIEF.md`
first; everything in them still applies unless this file changes it. Then read `BRIEF.md` in this
directory (the flat style's v3 brief): its sections B (camera frames that never slice, edge fade,
proxies for off-frame endpoints), C (motion that can be read) and "You can now render and look"
apply to this file too, word for word, with `v3-b` as your scratch directory name. Section A
(relayout) does not apply as written; see below. Same scenario, same 11 steps.

## Owner feedback on v2 (isometric)

- "A bit better [than the flat one], but static text is a bit cluttered."
- "Animated flow items move a bit fast."
- Liked in the flat version, and present here too: the phase header and the narrative below.

## What is wrong (confirmed by rendering v2)

- Skewed container labels painted on the slabs ("Public subnet", "namespace: web", "EKS cluster",
  "ACCOUNT SERVICES", "AWS ACCOUNT prod") collide with node labels, with each other, and with
  callouts. Examples: "payments-api" sits on top of "namespace: web"; "Orders DB" touches "Public
  subnet"; a callout box covers "EKS cluster"; "ACCOUNT SERVICES" and "AWS ACCOUNT" overlap.
- Dimmed nodes keep their labels, so every frame carries about 13 node labels and 12 container
  labels whether or not they matter to the step.
- The scene runs underneath the narrative band and off the left and bottom of the stage.
- Packets cover long routes quickly.

## Changes

### Text: show less, and never overlapping

- **Diagram area.** The scene is confined to the region between the phase rail and the narrative
  band. Nothing from the scene draws under either; use a clip plus the edge fade from the flat
  brief's section B.
- **Node labels by relevance.** A node's label is shown at full strength when the node is part of
  the current step, and hidden (opacity 0, not dimmed) otherwise. Exception: in the full view,
  show all node labels only if they fit without overlap; otherwise show none and let the
  container labels carry the full view.
- **Container labels: upright tags, by relevance.** Stop painting skewed text on slabs. Each
  container gets a small upright tag (the same visual family as node labels, but with a subtle
  outlined pill and smaller weight) anchored at one consistent corner of its slab (pick the
  corner that is nearest the viewer and least likely to be covered). Show tags only for: the
  containers on the path from the root to the step's active nodes (the "you are here" chain),
  and, in the full view, the top two nesting levels. Everything else is hidden.
- **One naming scheme.** Use short names: "ns: web", "ns: payments", "Services", "AWS · prod".
- **Callouts** are placed in free space found by test, not by hand offsets: choose among
  candidate positions around the target (above, right, left, below, at two distances) the first
  whose box overlaps no visible label, node, tag or other callout in that step's frame.
- **A collision test you run in the browser.** Add a small debug hook, `window.__overlaps()`,
  that returns pairs of currently visible text-bearing elements (node labels, container tags,
  callouts, stationary flow labels, proxies) whose on-screen boxes intersect, using
  `getBoundingClientRect()` and ignoring elements with computed opacity below 0.05. Write a
  script next to your frames (it may import playwright the way `frames.mjs` does; run it with
  `run.sh` from the smoke directory by passing its absolute path) that seeks to 3 points in every
  step and prints the overlaps. Get it to zero, then confirm by eye on the frames.

### Motion

Apply section C of the flat brief exactly: 320 px/s on-stage speed cap, text read standing still
(stationary labels that outlast the packet's arrival), request and response as a pair in one
place, streams of at most 4 plain packets at least 0.9s apart with a tally, parallel flows
staggered by at least 1.5s.

### Framing

Apply section B of the flat brief: frames chosen by container, nothing sliced at the frame edge,
breadcrumb when inside enclosing containers, soft edge fade, and proxies pinned at the frame edge
for off-frame endpoints so long-distance steps (4 to 7, 9) can be framed close. Leave the slab
arrangement alone unless a small move removes a collision; if the full view still cannot hold
readable container tags, say so in the report.

## Report (under 300 words)

As the flat brief asks, plus: the overlap count from your script before and after, and which
label decisions (hidden, moved, shortened) you made.
