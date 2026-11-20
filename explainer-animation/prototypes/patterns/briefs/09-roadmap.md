# Pattern 9: roadmap with risk burn-down

Reference scenario: **a three-horizon security roadmap and the risks it retires.** Style: flat.
Read `COMMON-exec.md` (and through it `COMMON.md`) first.

## What the pattern is

Time is the scene. Initiatives sit on a time axis in lanes; as time advances and each one lands,
the risks it addresses visibly shrink. The audience sees the order of work, what depends on what,
and what the organisation is left carrying at the end.

## Mechanism to build

- **Axis and horizons** from data: three horizons (`Now`, `Next`, `Later`) with a caption each
  (for example "0 to 6 months"); no calendar dates.
- **Lanes** (workstreams) and **initiatives** as bars placed by `{ lane, start, end }` in horizon
  units. A bar is outlined while planned, fills as the playhead crosses it, and is marked done
  when the playhead passes its end.
- **Dependencies** `{ from, to }` as arrows between bars, drawn when the step about dependencies
  runs; a bar that depends on another may not start before it ends (assert this at build time).
- **Playhead**: a vertical line that sweeps the axis on the master timeline, one horizon per step.
- **Risk panel** beside the roadmap: the top risks as horizontal bars on a 0 to 100 index with an
  **appetite line** each (or one shared line). Each initiative lists `reduces: [{ risk, by }]`.
  When an initiative lands, a link flashes from its bar to the risks it reduces and those bars
  shrink by that amount, leaving a faint ghost of where they started.
- **Headline measure**: "Risks above appetite: N of M", counting down.

## Scenario

Lanes: Identity, Platform, Detection and response, Data protection. Eight or nine initiatives
across the three horizons, for example: phishing-resistant sign-in (Now), privileged access
overhaul (Next), passwordless workforce (Later); network segmentation (Now into Next), paved-road
delivery pipelines (Next); central logging (Now), round-the-clock detection (Next); data
inventory (Now), tokenise card data (Later). Dependencies: central logging before round-the-clock
detection; data inventory before tokenising; phishing-resistant sign-in before passwordless;
segmentation before the privileged access overhaul.

Risks: Account takeover, Ransomware spread, Undetected breach, Customer data exposure, Supplier
compromise. Make the ending honest: one risk (Supplier compromise) is still above appetite after
all three horizons, because nothing on this roadmap addresses it; say so in the last step.

Steps: `today` (the five risks as they stand), `now`, `depends` (what unlocks what), `next`,
`later`, `left` (what remains above appetite and why). Phases: Today, The plan, What remains.
