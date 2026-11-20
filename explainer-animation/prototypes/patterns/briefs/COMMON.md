# Common brief for pattern reference prototypes

You are building one reference prototype for a recurring visualization pattern. Read, in order:

1. `/Users/copierson/Projects/skills/explainer-animation/PATTERNS.md`: the rules. Sections 3 to
   10 and 12 are requirements, not suggestions. They were learned from the owner rejecting
   earlier versions; do not relearn them.
2. Your pattern brief (named in your prompt).
3. The v3 reference file for your style, which you start from:
   `prototypes/v3/a-flat-attack-chain.html` (flat) or
   `prototypes/v3/b-isometric-attack-chain.html` (isometric). The owner approved both. Copy it to
   your output path and replace the scenario and choreography; keep the stage, phase rail,
   narrative band, controls, narration and presenter modes, timing rules, speed-capped hop
   helper, stationary labels, text emphasis, camera rules and `window.anim` contract. Remove
   code your scenario does not use.

## Output

One self-contained HTML file at the path in your prompt. Allowed external loads are only the
three pinned GSAP scripts already in the v3 file. Create only that file in the repository.
Do not modify anything else under `explainer-animation/`, do not install anything, do not commit.

## What "reference" means here

The owner will reuse this pattern for other topics by swapping the scenario data. So:

- The pattern's mechanism (what makes it this pattern and not just another flow) is implemented
  as named helpers driven by scenario data, with a comment block at the top of the script
  saying what the pattern is, which data fields drive it, and which helpers implement it.
- Keep the scenario small enough to read in the full view without a camera where you can. These
  references are about the new mechanism, not about stress-testing size.
- Write the narrative copy yourself, in the voice the v3 files use: a security architect talking
  a mixed audience through it, saying what happens and why it matters.

## Render and look

A headless browser works here. Rendered frames are the test; arithmetic is not.

```
SMOKE=/tmp/claude-502/-Users-copierson-Projects-skills/3ce2e9a4-e16b-49d3-a076-4c76570a39ac/scratchpad/smoke
$SMOKE/run.sh frames.mjs <abs file.html> <abs outdir> steps          # 3 frames per step
$SMOKE/run.sh frames.mjs <abs file.html> <abs outdir> 46.0 47.5 49   # frames at given seconds
$SMOKE/run.sh smoke.mjs <abs file.html>                               # console errors + seek determinism
```
`run.sh` changes into the smoke directory, so pass absolute paths. Scripts of your own that need
playwright must live in or be copied into `$SMOKE/..`'s sibling directory named in your prompt
and import playwright via `createRequire($SMOKE + '/package.json')`. Do not edit files in
`$SMOKE`. Put frames and scratch files in the scratch directory named in your prompt.

Before reporting: `smoke.mjs` clean; an in-page overlap check (`window.__overlaps()`, as in the
isometric v3 file; add the same hook if you are building flat) at zero across the run; peak
packet speed under the cap; and you have looked at frames from every step after your last change.

## Report (under 300 words)

File path, line count, duration, check results; how the pattern mechanism is implemented (helper
names and the data that drives them); frame file names that best show the mechanism; what did
not come out clean; and one or two honest sentences on whether this style suits this pattern.
