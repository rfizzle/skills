---
name: a11y-review
description: Use this skill to audit UI against WCAG 2.2 AA and the WAI-ARIA Authoring Practices - after a component or composition card is drafted (spec pass), after it is built or changed (build pass), and whenever keyboard support, focus, contrast, screen-reader output, target size, reflow or reduced motion is in question, or someone asks "is this accessible", for an "a11y review", an "accessibility audit" or an axe check. Produces a redline of findings tagged blocker, major or minor; zero blocker and major findings is the gate. Framework-neutral. Not for choosing token values (design-tokens) or general UX pattern rules (ui-patterns), though it checks their accessibility outcomes.
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Accessibility review

The WCAG 2.2 Level A and AA gate for every UI unit and view. It runs twice:
against the **card** before building (cheap; catches design gaps) and
against the **build** (catches implementation gaps). Both must pass. AAA
criteria are advisory unless the product adopts them.

Load [references/wcag22-aa-checklist.md](references/wcag22-aa-checklist.md)
for every review; it holds the criteria and the APG pattern routing.

## Spec pass (against the card)

1. **Component card**: it names the native element or APG pattern and links
   the source; the keyboard model is complete for this unit, with optional
   keys marked; focus on open, containment and return are stated; the
   accessible name, role, state and value are stated; target size and
   reduced-motion behaviour are stated. A complex widget names a headless
   primitive; a manual implementation carries a reason and gets the
   strictest build review.
2. **Composition card**: each child's widget behaviour is delegated to it
   by name; the card states reading order, focus order across children,
   landmark and heading level, and what is announced when results change.
   A composition does not need one APG pattern for the whole.
3. Check the card's stories cover every state and flow the checklist needs
   evidence for (keyboard flows as play tests, error and empty states).

## Build pass (against the code and running stories)

1. **Element**: the declared native element or primitive is used; no
   clickable `div`/`span`; no ARIA where native semantics exist.
2. **Suppressions**: any suppressed framework or linter accessibility
   warning is a finding unless the card records a reviewed reason.
3. **Automated**: run the story tests with the axe pass enabled, in every
   theme. Zero WCAG A/AA violations; impact orders the fixing, it never
   waives a violation.
4. **Keyboard**: complete every flow with the keyboard only. Focus is always
   visible, never trapped, not hidden behind sticky content, and returns to
   the trigger when an overlay closes.
5. **Screen reader**: smoke-test with at least one screen reader and browser
   pair the product supports: names, roles, states, and live announcements.
6. **Visual**: contrast for every pair in every theme (`design-tokens`
   validator for token pairs, review for anything else); reflow at 320 CSS
   px; 200% text resize; text-spacing override; reduced motion on.
7. **Pointer**: targets at least 24 by 24 CSS px or spaced per 2.5.8;
   dragging has a single-pointer alternative; hover content is dismissible,
   hoverable and persistent.

**Unverified is not a pass.** If the browser for story tests, a screen
reader, or any other runtime is not available, list each affected check as
`unverified` in the report, with what is needed to run it. The gate is not
met until it has run.

## Findings

A redline: one line per finding, ordered by severity.

```
[blocker] CloseButton:42  Icon-only close has no accessible name (WCAG 4.1.2). Fix: add a text label.
```

- **blocker**: a user cannot complete the task or perceive essential
  content: no keyboard access, keyboard trap, missing name on a control,
  focus lost on close, content hidden from assistive technology, an axe
  A/AA violation that does this.
- **major**: a WCAG 2.2 A or AA failure that does not block the task:
  insufficient contrast, invisible focus in one theme, colour-only state,
  missing error association, target too small, unannounced status change,
  reflow failure.
- **minor**: best practice or AAA: verbose names, redundant ARIA, heading
  polish, optional APG keys missing.

Each finding names the criterion (WCAG SC number or APG rule), the location
(`file:line`, or the card section), and the fix.

## Gate

- Zero blocker and major findings, in both passes.
- Axe reports zero WCAG A/AA violations across every story in every theme.
- Every manual check ran, or is listed as unverified and the gate stays open.

## Gotchas

- Axe finds perhaps a third of real failures; a clean axe run with no
  keyboard pass is not a review.
- Reframing a failure as out of scope is not allowed; log it with its
  severity. If it needs the owner's call, say in plain English who is
  blocked and how, the options, and your recommendation.
- 2.4.12 (focus not obscured, enhanced) and 2.4.13 (focus appearance) are
  AAA; report them as minor, not major.
- Duplicate IDs appear only when two instances render; test a story with
  two instances of any unit that generates IDs.
