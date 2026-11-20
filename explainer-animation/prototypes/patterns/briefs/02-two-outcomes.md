# Pattern 2: same scene, two outcomes

Reference scenario: **blast radius of one stolen credential, without and with segmentation.**
Style: isometric.

## What the pattern is

The same starting event is played twice on the same scene. The only difference is one control.
The audience must be able to hold the first outcome in mind while watching the second, and end on
a direct comparison. This is the "why are we funding this" visual.

## Mechanism to build

- **Two runs over one scene**, declared in data: `runs: [{ id, label, controls: [...] }]`, with
  each step tagged with its run. The scene geometry is shared.
- **Run banner**: a fixed strip in the diagram area's top-left naming the current run
  ("Without segmentation" in danger colour, "With segmentation" in secure colour). The phase
  rail still shows phases.
- **Rewind**: between runs, the scene visibly returns to the starting event: the timeline of run
  A's damage un-plays quickly (markers and trails retract in reverse order over about 2.5s) while
  a "rewind" indicator shows. It is an animation on the master timeline, not a jump.
- **Control lands**: after the rewind, the control is installed on the scene as a visible change
  (see scenario), with its own step.
- **Ghost of the first outcome**: during run B, run A's final blast radius stays as a faint
  dashed danger outline on every node it reached, so the difference is visible while B plays.
- **Scoreboard**: a small fixed panel with one row per run: systems compromised (count of
  total), data lost (yes/no), time to contain. Run A's row fills during run A and stays; run B's
  fills during run B.
- **Comparison step**: the final step shows both outcomes at once: ghost outlines for A, solid
  for B, scoreboard complete, full view.

## Scenario

Corporate network, seven systems: Laptop (the entry point: a phished employee), File server,
HR app, Build server, Domain controller, Finance DB (the crown jewel), Backup server.

- Run A, flat network with a shared local admin password: Laptop -> File server -> Build server
  -> Domain controller, then with domain admin everything at once: HR app, Finance DB, Backup
  server. Data leaves; backups are encrypted too. 7 of 7.
- Control: segmentation plus unique local admin passwords. Show it as zone slabs rising under the
  systems (User zone: Laptop; Server zone: File server, HR app, Build server; Restricted zone:
  Domain controller, Finance DB, Backup server), with allowed flows between zones drawn as the
  only routes that cross a zone edge.
- Run B, same phish: the laptop is compromised; the lateral move to the File server is refused at
  the zone edge (a shield lands, the packet stops and drops); the reused password fails on a
  second attempt; the denied attempts raise an alert; the laptop is isolated. 1 of 7.

Phases: The breach, Without segmentation, Rewind and segment, With segmentation, Side by side.
About 10 steps. In run A the scene is one slab (a flat network) so the zones rising is a real
change of the scene.

Isometric specifics: with seven systems the full view should hold every node label, so show all
labels (the relevance rule in PATTERNS.md section 10 is for crowded scenes); keep emphasis
dimming. Use the width: arrange the systems left to right across the frame, not as a square.
