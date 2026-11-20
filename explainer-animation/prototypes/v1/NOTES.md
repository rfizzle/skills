# Version 1 prototypes (2026-11-19)

Same scenario in three styles: a token-authenticated request through a service mesh, seven steps.
`BRIEF.md` is the brief all three were built from.

| File | Style | Stack |
|---|---|---|
| `a-flat-2d.html` | Flat 2D | SVG + GSAP |
| `b-isometric.html` | Isometric 2.5D | SVG + GSAP, hand-rolled projection |
| `c-three-3d.html` | Full 3D | Three.js, GSAP as the clock |

## Owner feedback

- Likes all three. Preference order: B (isometric), then A (flat), then C (3D).
- Pacing is a bit fast.
- Level of detail is fine.
- Wants a narrative mechanism: explain what is going on without taking much away from the visual.
- Nothing visibly broken.
- Next: stress test with much deeper nesting and more complex flows.

## Status

Opened and reviewed by the owner in a desktop browser. Not run in a headless browser and not
exported to video; `seek(t)` determinism is untested.
