# <Name>

> Status: draft · Owner: <name> · Pattern: <native element or APG pattern> · Source: <URL> · Primitive: <native | headless primitive | manual, with reason> · Approved: <YYYY-MM-DD>

## Purpose
What it is, when to use it, when not to (and what to use instead).
Reuse: which existing units were checked and why none fits.

## Accessibility
- Element / role: e.g. native `<button>`; `role="dialog"` via the primitive.
- Keyboard (from the source; optional keys marked):

  | Key | Behaviour |
  |---|---|
  | | |

- Focus: initial focus, containment, where focus returns on close.
- Announced: name, role, state, value; live announcements, if any.
- Target size at least 24 by 24 CSS px; behaviour with reduced motion.
- Anything a reader could not infer from the code.

## Content
Label and copy rules, truncation, pluralisation, number and date formatting,
text direction.

## Responsive
Behaviour per breakpoint or container width, or "None of its own".

## Stories
- `Default`: what it shows.
- `AllVariants`: ...
- `WithLongContent`: ...
- Flows (`<Name>/Flows`): one story per flow, named for it (`OpenWithKeyboard`), and what its play test performs.

## Open questions
Draft only; deleted at approval.

## Decisions
- YYYY-MM-DD: decision and its reason.
