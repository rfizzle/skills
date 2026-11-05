# UI inventory

Take this only when the feature has UI. It feeds the plan's Reuse line and
the frontend stories; it is not a file the owner reads.

## Elements

List every UI element the feature needs and search the existing tokens,
components, compositions and views for each. Classify, in this order of
preference:

- **Exists**: reuse as-is; note its path.
- **Enhance**: an existing unit gains a prop, variant or slot
  (`ui-component-contract` iteration rule).
- **New component** or **new composition**: only where reuse or enhancement
  would visibly harm the experience. Write that reason; "faster to write"
  is not one.

Missing token roles are dependencies for `design-tokens`, never given values
here. Cross-cutting UX rules come from `ui-patterns`; cite, do not restate.

## Data

For each piece of data: the API operation that serves it and whether it is
fetched, derived or user input. An operation that does not exist yet becomes
an API-contract story ahead of the view.

## Interaction map

Every user action: trigger, effect (request, navigation, local change),
resulting state, and the feedback the user sees, including on failure and
by keyboard alone.

## State location

Each piece of state lives in exactly one place:

- **URL**: anything a user would bookmark, share, reload or go Back to
  (filters, sort, page cursor, selected tab, open record).
- **Local**: transient UI state (an open menu, a field being edited).
- **Shared**: only state two sibling compositions must both read; name the
  owner and why props cannot carry it.

## Scenarios

Name each as the story or end-to-end test that proves it: the golden path,
loading, empty, error, partial and success, long content, narrow viewport,
keyboard-only, deep link via URL.
