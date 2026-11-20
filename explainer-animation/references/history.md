# How the design got here

One page, so that a rule that looks arbitrary can be traced to the review that produced it. The
owner's words are quoted where the notes quote them. This page may name tools and products that
`SKILL.md` leaves out.

## Contents

Rounds one to three; film and interactive; the replay; the kit; traps from the hand-built films.

## Round 1: three styles, 3D dropped

The same scenario (a token-authenticated request through a service mesh, seven steps) was built in
three styles: flat 2D (SVG and GSAP), isometric 2.5D (SVG and GSAP with a hand-rolled projection),
and full 3D (Three.js, GSAP as the clock). The owner liked all three and ranked them isometric,
then flat, then 3D. Pacing was "a bit fast"; level of detail was fine; nothing was visibly broken.
They wanted a narrative mechanism that explains what is going on without taking much away from the
visual, and asked for a stress test with much deeper nesting and more complex flows. Full 3D was
dropped because it ranked last; the stack is SVG with GSAP, and isometric is the
same stack with a projection function (`iso(x, y, z)`). Not run headless and not exported in this
round, so `seek(t)` determinism was untested.

## Round 2: the stress test

Scenario: SSRF to cloud account compromise, 13 nodes nested 5 levels deep. Owner on flat: weird
cropped cut-offs, streaming too fast, and "ListBuckets goes very fast, you can't read it"; they
liked the phase header and the narrative below. On isometric: static text cluttered, flows a bit
fast. Out of that came the motion rules (speed cap, text read standing still, streams capped and
spaced), the slower pacing, the narrative band and phase rail, and the framing rules (frame by
container, never slice a border, breadcrumb, fade edges). The cropping complaint came from framing
a rectangle around the active nodes instead of a container.

## Round 3: the approved pair

Flat (151 s) and isometric (128 s), 11 steps in 5 phases. Verdict: "Both look good. Keep them as
references." Earlier in the round: "I love both"; "Pace is right, just that last pause between
each step is a little slow" (then shortened); "Fixed labels and growing tallies read well";
"dim the non-active text items (the ones that are not in the path at the moment)" (done: dimming
to 45%); and a question about the "random squares" on isometric routes, which were upright gate
panels and were replaced by flat port rings. The two pace differently because the end-of-step trim
cut more from the isometric one; the owner has not said which pause length to standardise on, so
the kit uses the flat constants. Seven more scene files were then built as references for other
patterns (two outcomes, three outcomes, state morph, object transformation, coverage over time,
roadmap, cascade), the executive ones under a common brief (figures are inputs, never invented
silently).

## Film and interactive are different jobs

Two deliverables came out of one scenario: an animation for slide decks (shown while presenting,
also over a screen share; MP4 master, GIF fallback, a clip and a still per step; the owner wants
the narrative on screen, with a title-only cut available) and an interactive piece read alone
from a link. The slide tool and host are not fixed, and sharing must not depend on any vendor's
artifact feature, so the interactive piece is one self-contained HTML file. Four layers came from
this: scene, film, replay, preview. The controls and keys are the review tool and never ship; the
stage never responds to the mouse.

## The explorer, then the replay

The first interactive attempt was an "explorer": the animation with step navigation. The owner:
"Not the biggest fan of the attack chain explorer layout. What can we do to mix it up a bit?"
Four layouts were built (stacked, full-bleed tour, scrollytelling, timeline). They preferred the
timeline but wanted "a bit more like an artifact than just an interactive version of the
animation", pointing to a public incident replay page ("Anatomy of a frontier-lab agent intrusion"
from Hugging Face): summary numbers, playback with a running clock, stat cards, a graph that
ignites, phase bars, a live action stream and a volume chart. The explorer layouts were dropped in
favour of the replay.

Replay version 1 embedded the film's diagram scaled to about 0.6; the owner called it "very busy
and squashed". Spreading it into a long scroll fixed the squash but not the real problem, and
separated views that are read together. Compared with the reference page it was weaker in four
ways, which became version 2: a small purpose-built graph (compact system cards in a few trust-zone
frames, short links, nodes that ignite) instead of the film's diagram; hierarchy (one loud
headline with an accented phrase, a kicker line, summary chips, big coloured values); density with
order (player card, three stat cards, then rows of two panels; about 1,600 px tall in the
reference, kept to 2,000 here); and phases as rows (name, descriptor, count, bar) with two-line
stream entries. The structure was taken, not the colours, typefaces or wording. The approved page
is `scripts/testdata/oracle/attack-chain.replay-v2.html`.

## The kit and its equivalence test

Each prototype carried its own copy of stage, narrative, timing, emphasis and camera code, with
the layout and routes hand-typed. The kit extracted that once: a story file (JSON with a small
closed vocabulary of beats), one build script that concatenates GSAP, the kit and the story into
one HTML page, a shared estate model (layout, routes, frames in abstract ground units), a scene
core, and a flat and an iso painter that only draw. The replay is a separate template that reads
the same story plus `events` and never loads GSAP. The extraction was held to the approved flat
film by `scripts/equivalence.mjs`: structural rows decide (step order, durations, node centres,
frame scale, hop sets) and a contact sheet per step is read by eye; the intended differences are
listed in [checks.md](checks.md). The approved isometric film and the replay are kept beside the
flat one as oracles in `scripts/testdata/oracle/`.

## Traps in the hand-built films

What stayed hand-tuned for one scenario in each approved file. The kit replaced most of these
with computed layout, hints and the free-space placer; the table says what bit.

Flat:

| Trap | Why it bit |
|---|---|
| Lane order in the edge builder | chosen so lanes never cross: farthest target on the highest lane, stems left to right in the same order; a new target order needs a re-think |
| Frame rules | the services frame extends downward past the account border because the strip is too short for 8:3; the other rules assumed this tree |
| Label spots and shield positions | absolute coordinates in free corners of that layout |
| Callout offsets | tuned by eye; removing a callout was cheaper than moving it |
| The proxy badge | assumed the link enters from the left, one proxy per step, text fixed to "Attacker" |
| The creds close-up | a pop-up placed above one node inside the cluster |
| Breadcrumb timing | special-cased for two steps |
| A camera pull-back | used the plain hold, ignoring the last-label hold |
| Width estimates | label boxes sized by characters times font size; another font can overflow |

Isometric:

| Trap | Why it bit |
|---|---|
| Depth order is by layer, not geometry | slabs sort by level then x0+y0, blocks by x+y, packets above everything; a route that skims a block corner, or two blocks that overlap in x+y, draws in the wrong order |
| Hand-placed bypass lane and control points | typed ground coordinates on links |
| Step 11 was index 10 in several places | the controls builder read shields, cards and marks by index |
| Card holds hard-coded | `detect` assumed an 11-word card, `creds` its own timing |
| Marker merge distance of 36 / 0.49 | 0.49 was that estate's full-view zoom |
| `ZMAX` 1.3 and fit boxes | leave room for the mini-map at the top right; one step overrode the margin |
| A second packet lifted by an extra 56 | so two lanes did not stack |
| The mini-map dot starts on the attacker | assumed |
| Full view shows no node names except shield targets | labels do not fit that estate |

Known rough spots at approval, for context: the flat services close-up showed the account border
as a faded line and an old trail across one node; isometric step 9 was crowded and used only the
left half of the frame, and the diamond-shaped scene is height-limited (about 0.5 scale with empty
sides); dimmed nodes at 35% are see-through, so links ending at a node centre show through.
