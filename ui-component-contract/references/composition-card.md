# <Name>

> Status: draft · Owner: <name> · Epic: <epic id> · Approved: <YYYY-MM-DD>

## Purpose
What it does, where it appears, and when to arrange the children inline in a
screen instead. Reuse: which existing compositions (the design's inventory first) were checked and why none fits.

## Children
| Child | Path | Data in / events out |
|---|---|---|
| | | |

## Flows
| Flow | Effect | State, and who owns it | Story |
|---|---|---|---|
| | | caller via URL / local | `<FlowName>` play test |

## Accessibility delegation
- Landmark and heading level, if it is a page region.
- Reading order and focus order across children (they match the DOM).
- What each child owns (its own widget keyboard model) versus what this owns
  (moving focus between children, announcements of result changes).

## Responsive
Behaviour per breakpoint or container width, or "None of its own".

## Stories
- `Default`: realistic data.
- `Loading`, `Empty`, `LoadError`, `Partial`: ...
- `WithLongContent`: ...
- Play tests, after the visual stories: one story per flow.

## Open questions
Draft only; deleted at approval.

## Decisions
- YYYY-MM-DD: decision and its reason.
