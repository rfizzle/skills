---
name: ui-patterns
description: Use this skill when designing, building or reviewing any user-facing screen or UI unit and a common UX pattern is involved, even if no pattern is named - forms and validation, lists, tables, filters, sorting and pagination, loading/empty/error states, success and error feedback, toasts, delete or other destructive actions, undo, confirmation dialogs, navigation and breadcrumbs, responsive and mobile layouts, truncation, dates, numbers and translatable copy. Also when deciding where UI state lives (URL or local), how to split a screen into components, or how plain an everyday page should be. Holds the cross-cutting rules and one reference per pattern, each ending in a checklist. Framework-neutral. Not for the token layer (design-tokens), the WCAG audit itself (a11y-review), or planning a feature (plan-feature).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# UI patterns

Rules that hold for every screen, plus one reference per recurring pattern.
Load the references the work touches; each ends with a checklist that is its
definition of done. They are framework-neutral: where mechanics differ, the
framework skill (`svelte-frontend`) decides.

| Reference | Load when the work involves |
|---|---|
| [forms.md](references/forms.md) | inputs, validation, submit, multi-step entry |
| [lists-and-tables.md](references/lists-and-tables.md) | collections, tables, filters, sort, pagination, selection |
| [async-states.md](references/async-states.md) | anything that loads, saves or can fail |
| [feedback.md](references/feedback.md) | telling the user something happened; toasts; live regions |
| [destructive-actions.md](references/destructive-actions.md) | delete, revoke, overwrite, anything hard to reverse |
| [navigation.md](references/navigation.md) | menus, tabs, breadcrumbs, page titles, routing, focus on navigation |
| [responsive.md](references/responsive.md) | layouts across widths, touch, zoom |
| [content.md](references/content.md) | labels, copy, truncation, dates, numbers, translation |

## Layers

On the tokens (`design-tokens`), build up through five layers, which are
also the `storybook-layout` sidebar roots after Docs and Foundations:

1. **Components**: single-purpose units with no domain types.
2. **Compositions**: reusable arrangements of components, possibly with
   local state, still with no domain types.
3. **Features**: units that know the domain (a server, a permission) and
   arrange compositions and components for it.
4. **Layouts**: frames with slots and no domain logic.
5. **Screens**: routes. They fetch data, own URL state, and put features
   into a layout.

A unit never imports one from a layer above it, and a layout takes features
through its slots rather than importing them. Domain vocabulary appears in
features and screens only. A small project may skip features and layouts;
its domain types then stay in screens.

## Reuse before create

Use as-is, then extend (a prop, variant or slot), then compose existing
units, and only then create. Compose, never clone: copying a unit to tweak
it forks its behaviour and accessibility. A unit that cannot do what is
needed gets an enhancement, not a workaround in its parent. A new unit goes
through `ui-component-contract`.

## Data down, events up

- Data enters a unit through its props; the unit reports user intent
  through callbacks or events (`onSelect`, `onDismiss`). Name callbacks for
  the intent, not the DOM event.
- Only screens fetch; every other layer gets data through its props.
  The exception, a self-contained interaction such as inline edit-and-save,
  is written in the unit's card.
- No global stores or context for data a prop can carry. Shared state is a
  named, justified exception in the feature brief.
- Two-way binding is for form-like values and an overlay's open state only.

## Plain language and progressive disclosure

- Everyday pages are simple: one primary task per screen, one primary
  action, plain words a new user understands. Advanced options, bulk tools
  and configuration go behind a disclosure, an Advanced section, or the
  Settings area, which is the one place allowed to be dense.
- Show the common case first; reveal detail on request (a disclosure, a
  details panel, a drill-down page), never by default.
- Never use internal terms, IDs or codes as labels; see `content.md`.

## Five async states

Everything that loads has five states, and each is designed and has a story:
**loading**, **empty**, **error**, **partial** (some data, some failed or
still loading) and **success**. A screen designed only for success is not
done. Rules in `async-states.md`.

## URL is state

Anything a user would bookmark, share, reload or go Back to lives in the
URL: filters, search text, sort, page cursor, selected tab, the open record.
Reading the URL is how the screen initialises. Typing in a search box replaces
history; committing a new filter set pushes it. Transient UI (an open menu,
a hovered row) stays local.

## Native first

Use native elements for native behaviour: `button`, `a`, `input`, `select`,
`details`, `dialog`, `form`, `fieldset`, `table`. For a complex widget
(combobox, menu, tabs, listbox, date picker, popover) use the project's
headless primitive and its WAI-ARIA APG keyboard model; never hand-roll
focus traps or roving tabindex. A `div` with a click handler is a defect.

## End-to-end hooks

Every async screen's root exposes a stable `data-page="<slug>"` and
`data-loaded="true|false"`. End-to-end tests wait for
`[data-page="<slug>"][data-loaded="true"]`, never for a timeout, a spinner
disappearing, or network idle.

## Definition of done (any screen)

- Layer and reuse rules hold; no cloned unit.
- All five async states exist and have stories.
- URL-worthy state is in the URL and survives reload and Back.
- The checklist of every reference the work touched passes.
- `a11y-review` has zero blocker and major findings.
