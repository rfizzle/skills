# Responsive

## Rules

- **Mobile-first**: base styles are the narrow layout; breakpoint prefixes
  add the wider arrangement. Breakpoints come from the content (where the
  layout breaks), using the project's configured breakpoint scale, not from
  device names.
- **Reflow at 320 CSS px** (WCAG 1.4.10): at 320 px wide, which is 1280 px at
  400% zoom, nothing needs horizontal scrolling except content that is
  inherently two-dimensional (data tables, maps, code), and that scrolls in
  its own labelled, focusable region.
- **Container queries for reusable units**: a component or composition that
  can sit in a sidebar or full width adapts to its container (`@container`
  and `@sm:`/`@md:` variants), not to the viewport. Viewport breakpoints are
  for page-level layout in views.
- **No forks**: one unit adapts; do not build separate mobile and desktop
  components or hide duplicate markup per breakpoint.
- **Order**: DOM order is reading and focus order at every width. Visual
  reordering (`order`, grid placement) must not make focus jump around.
- **Targets**: interactive targets are at least 24 by 24 CSS px, or have
  enough spacing that a 24 px circle around each does not overlap another
  (WCAG 2.5.8). Aim for 44 px on primary touch actions.
- **Text**: rem-based sizes, line length around 45 to 75 characters, and
  text that survives 200% resize and increased letter and line spacing
  (WCAG 1.4.12) without clipping. No fixed heights on text containers.
- **Hover is an enhancement**: nothing is reachable only on hover; touch and
  keyboard users get the same information and actions.
- **Orientation**: work in both portrait and landscape (WCAG 1.3.4).
- **Motion and data**: respect `prefers-reduced-motion`; lazy-load heavy
  media below the fold.

## Checklist

- [ ] Base styles are the narrow layout; breakpoints added only where content breaks.
- [ ] No horizontal scroll at 320 px except labelled, focusable 2D regions.
- [ ] Reusable units use container queries; views use viewport breakpoints.
- [ ] No duplicate mobile/desktop markup.
- [ ] Focus and reading order follow the DOM at every width.
- [ ] Targets at least 24 by 24 px or spaced per WCAG 2.5.8.
- [ ] Text survives 200% resize and text-spacing overrides; no fixed text heights.
- [ ] Nothing depends on hover alone.
- [ ] Stories include a narrow viewport and `WithLongContent`.
