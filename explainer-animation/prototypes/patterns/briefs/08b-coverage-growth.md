# Pattern 8 over time: control coverage growth

Reference scenario: **three controls rolling out across the estate, quarter by quarter.**
Style: isometric. Read `COMMON-exec.md` (and through it `COMMON.md`) first.

## What the pattern is

A coverage overlay that changes with time. The estate is a fixed map; what changes is how much
of it each control covers. The audience sees progress as the map filling in, sees the meters
climb, and sees what stays uncovered at the end.

## Mechanism to build

- **Estate** from data: zones (slabs) holding systems (small blocks). About 20 systems in 4
  zones. Systems are deliberately unlabelled; only zones carry tags. This scene is about
  proportion, not individual systems.
- **Controls** from data: `controls: [{ id, label, colour }]`, three of them. Each block can
  show up to three thin coloured bands (one per control) on its top or side; a band appears
  when that control reaches that system.
- **Coverage schedule**: `coverage[quarter][control] = [system ids]`, six quarters.
- **Quarter ticker**: a fixed label ("Quarter 3 of 6") advancing on the master timeline; within a
  step, bands land system by system with a short stagger so the fill reads as a sweep across a
  zone, not a flash.
- **Meters**: a fixed panel with one meter per control: a bar and a percentage (covered systems
  / all systems, computed from the data), counting up as bands land, with a faint tick showing
  where it started.
- **Gap highlight**: at the end, systems still missing a control are outlined, and the zone that
  holds most of them is called out.

## Scenario

Zones: Workforce, Cloud platform, Data, Legacy. Controls: Strong sign-in, Central logging,
Segmentation. Roll-out order: strong sign-in sweeps Workforce and Cloud platform first, logging
follows across Cloud platform and Data, segmentation comes last. The Legacy zone gains almost
nothing: its systems cannot take the controls. The honest ending is that Legacy is the gap, and
the answer there is retirement, not more controls.

Steps: `today` (sparse coverage, meters low), `signin` (quarters 1 and 2), `logging` (quarters 3
and 4), `segment` (quarters 5 and 6), `gap` (what is still uncovered, and where), `ask` (meters
in full, with the legacy zone marked for retirement). Phases: Today, The roll-out, What is left.

Isometric specifics: use the width (zones left to right across the frame); blocks smaller than
in the references (about 60% of their footprint) since they carry no labels; the three bands
must be distinguishable at that size, so give each control a fixed position on the block as
well as a colour.
