# Incident replay page, version 2

## Where this stands

`BRIEF.md` in this directory describes the page and its data model; read it first. Version 1
(`attack-chain.replay.html`) implements it. The owner's reference is Hugging Face's "Anatomy of a
frontier-lab agent intrusion" replay page; a full-page screenshot of it, taken mid-playback at
1440 wide, is at
`/tmp/claude-502/-Users-copierson-Projects-skills/3ce2e9a4-e16b-49d3-a076-4c76570a39ac/scratchpad/hf/04-full-playing.png`.
Open it and study it before designing anything.

The owner called the first layout of version 1 "very busy and squashed". It was then spread out
into a long scrolling page, which fixed the squash but not the real problem. Compared with the
reference, version 1 is weaker in four ways:

1. **The graph.** Version 1 reuses the film's architecture diagram: eleven nodes inside eleven
   nested containers with long routed links, drawn for a 1920-wide stage and shown here at 0.6
   scale. The reference draws a small purpose-built graph: a handful of compact node cards
   grouped in a few coloured trust-zone frames, short links, and nodes that ignite. It reads in a
   glance; ours has to be studied.
2. **Hierarchy and identity.** The reference has one loud headline with an accented phrase, a
   mono kicker line above it, summary chips, and big coloured values in its stat cards. Version 1
   is uniform: similar sizes and weights everywhere, nothing leads.
3. **Density with order.** The reference is dense, but on a strict grid: a player card, three
   stat cards, then two rows of two panels. The whole page is about 1,600px tall at 1440 wide.
   Version 1's long scroll is about twice that and separates views that are meant to be read
   together.
4. **Phase activity and stream.** The reference lists phases as rows (name, descriptor, count,
   bar), which is easier to read than marks on a timeline; its stream entries are two lines, the
   command and an annotation.

Take the reference's structure and principles. Do not copy its colours, typefaces, wording or
exact arrangement: this page keeps this project's dark theme and tokens (`../../PATTERNS.md`
section 4) and must look like its own thing.

## Start from

Copy `attack-chain.replay.html` to `attack-chain.replay-v2.html` and rebuild the page around the
parts worth keeping: `INCIDENT` and `EVENTS` and everything derived from them, the clock model
(incident time mapped piecewise to a replay clock of about 96s, the compressed gap shown as a
labelled break), play/pause/restart/speed, scrubbing, the visibility model and marks, filters,
the "what would have stopped it" computation, the URL hash, keyboard control, reduced motion,
`window.replay`, and zero network requests.

**Drop the embedded film scene entirely** (its layout engine, routing, camera, master timeline
and choreography). The graph below replaces it. Keep GSAP inlined only if you use it for tweens;
plain SVG attribute updates driven by the clock are enough and are preferred, since every view
must be an exact function of the clock value.

## Page (centred column, max about 1240px; target total height 2,000px or less at 1440 wide)

A consistent grid: 16px gaps between panels, 20 to 24px padding inside, one panel style.

1. **Masthead.** A mono kicker line in small caps (replay, incident id, "reconstructed from N
   actions", computed), with the "Illustrative data" chip at its right. A large headline (about
   56px, heavy) with one phrase in the attacker colour. The tagline. A row of summary chips
   (span, actions, systems reached, time to first alert).
2. **Player card.** Play, Restart, speed buttons at the left; the incident clock, large and
   mono, at the right with the day readout under it. Across the card's full width, the scrubber:
   a single track with the phase bands faintly behind it, axis labels in incident time, the
   hatched break with its label, and the playhead. Dragging scrubs. When this card scrolls out of
   view, a slim sticky bar (play, clock, mini scrubber) appears at the top of the window.
3. **Three stat cards.** Attacker actions replayed (the big number in the attacker colour, "of N
   total" under it); Active phase (name large, one-line descriptor); Blast radius (a word or
   short phrase large, for example "account services", and one line under it: "N of M systems
   reached").
4. **Row of two panels**, about 62 / 38:
   - **Attack chain across trust boundaries** (caption at the right of the header: "systems
     ignite as the attacker reaches them"). A purpose-built graph for this panel, generated from
     data: the ten systems as compact cards (name in 13 to 14px semibold, a one-line role in
     11 to 12px muted), grouped in four or five trust-zone frames with a small mono label each
     (Internet; Edge; the network with the public tier, the cluster and the data tier; Account
     services), each frame in its own restrained hue. Lay the zones out to fit the panel (about
     740 x 430) with short, mostly straight links; do not nest more than two levels of frame. A
     node is dim until an event reaches it, then ignites (outline and soft glow) and stays lit;
     the link an event travels pulses once in the attacker colour and stays faintly lit; the
     event under the clock is marked on its target node. Three or four short link labels name the
     key moves when they happen ("SSRF", "stolen keys", "direct from outside", "sideways"). All
     of it is a function of the events at or before the clock, so scrubbing back un-lights
     things. Clicking a node filters the stream to it and shows its one-paragraph card as a
     popover.
   - **Phase activity** (caption: "first seen to last seen"). One row per phase: the phase name
     in its hue, a short mono descriptor of what the attacker does in it, the count of actions so
     far at the right (counting up), and under them a thin track on the replay axis filled from
     the phase's first to its latest action so far. Rows the clock has not reached are dim. Add
     this page's own dimension as a second, thinner track per row split by visibility (blind,
     logged, alerted), with the legend for those marks once in the panel's header. Clicking a row
     jumps to that phase's start.
5. **Row of two panels**, about 62 / 38:
   - **Live action stream** (caption: "representative actions, as recorded"). Two-line entries:
     incident time, a small phase tag, the action in mono, the visibility mark at the right; and
     on the second line an arrow glyph and the note in muted text. Newest at the top, fixed
     height with its own scroll, visibility filter chips in the header, the node filter as a
     removable chip.
   - **Activity over time** (caption computed, for example "two bursts; 347 actions unrecorded").
     The stacked bar chart on the replay axis with the break and the playhead; under it a dashed
     rule and the narrative line for the current step (step title in normal weight, body in
     muted text).
6. **What would have stopped it.** A row of five compact cards (this page's addition; keep it
   tight): control name, one short sentence, "stops it at attacker action N of M" with a thin
   bar. Cards light as the clock passes their point.
7. **Footer.** One or two sentences: what is illustrative, how to read the marks.

Hierarchy rules: one loud thing per region (the headline; the clock; each stat card's value;
each panel's title). Meta text is mono, small, muted, letter-spaced. Numbers are tabular.
Colour: neutral panels; the attacker colour for attacker activity and the headline accent;
distinct muted hues for the phases, used only in the Phase activity rows, the stream's phase
tags and the scrubber bands; the secure colour for controls and alerts.

At 900 wide the two-panel rows stack and the stat cards wrap; nothing clips or overflows.

## Checks

As in `BRIEF.md`, adapted: copy version 1's check script from
`/tmp/claude-502/-Users-copierson-Projects-skills/3ce2e9a4-e16b-49d3-a076-4c76570a39ac/scratchpad/replay/check.mjs`
into your scratch directory and update it. Keep the assertions that every view agrees with the
clock at sampled times going forwards and backwards, that the page makes no network requests and
reports no console errors, that nothing moves before Play, and that displayed totals equal
computed totals. Add: the graph's lit nodes equal the set of systems touched by events at or
before the clock at each sampled time; no text in the graph is under 11px at 1440 wide; no two
graph labels or cards overlap; page height at 1440 wide. Run with:
```
SMOKE=/tmp/claude-502/-Users-copierson-Projects-skills/3ce2e9a4-e16b-49d3-a076-4c76570a39ac/scratchpad/smoke
$SMOKE/run.sh <abs script> <args...>
```
Take a full-page screenshot at 1440 mid-playback (the same moment and framing as the reference
screenshot, so the two can be laid side by side), one at rest, one at the end, one at 900 wide,
and close-ups of the graph at three moments. Put your mid-playback screenshot next to the
reference and compare them honestly: where yours is weaker, fix it or say so.

## Constraints

Create only `attack-chain.replay-v2.html` in the repository. Do not modify version 1, either
brief, or anything else under `explainer-animation/`. Do not install anything. Do not commit.

## Report (under 300 words)

File path and size, page height at 1440, check results, screenshot names; how the graph is laid
out and what data drives it; an honest side-by-side verdict against the reference (what is now
as good, what is still weaker, what this page has that the reference does not); what did not
come out clean.
