# Content

## Rules

- **Plain language**: short sentences, everyday words, active voice, the
  user's vocabulary rather than the system's. Sentence case for labels,
  headings and buttons. Buttons start with a verb and name the outcome
  ("Save changes", "Export CSV"), not "Submit" or "OK".
- **No internal terms**: no database IDs, enum values, codes or status
  machine names as labels. Map every enum to a human label in one place.
  Technical detail goes behind a disclosure for the users who need it.
- **Truncation**: truncate only where the full value is available another
  way: a tooltip that is reachable by keyboard and not the only copy, a
  detail view, or wrapping on focus. Prefer wrapping. Never truncate the
  part that distinguishes items (truncate the middle of long identifiers
  and paths, or the end of prose). Truncated text keeps its full value as
  the accessible name.
- **Long and unbroken content**: emails, URLs, hashes and file paths wrap
  (`break-words` or `break-all` where appropriate) instead of overflowing.
  Every unit that renders text has a `WithLongContent` story.
- **Numbers**: format with the platform's `Intl.NumberFormat` for the
  user's locale; units and percentages included. Right-align numbers in
  tables with tabular figures. Use compact notation ("1.2K") only where the
  exact value is one step away.
- **Dates and times**: the API sends RFC 3339 UTC; display in the user's
  time zone via `Intl.DateTimeFormat`, and say which zone when it matters.
  Relative time ("3 minutes ago") for recent events, with the absolute time
  in a `time` element's `datetime` and on hover or focus. Durations in words
  or a clear format ("1 h 5 min").
- **Plurals**: use `Intl.PluralRules` or the translation library's plural
  forms, never `count + "s"`.
- **i18n-ready**: all user-visible strings come from one place keyed by
  meaning, even with one language today. No string concatenation for
  sentences (word order differs); use placeholders. Leave room for text up
  to about 40% longer. Use logical CSS properties (`ms-`, `me-`, `ps-`,
  `start-`) so a right-to-left language does not need a redesign.
- **Accessible names match visible labels** (WCAG 2.5.3). Icon-only
  controls get a name in text; decorative icons are hidden from assistive
  technology.

## Checklist

- [ ] Labels are plain, sentence case, verb-first for actions; no internal IDs or enums.
- [ ] Truncated text has a full, keyboard-reachable value and keeps it as its accessible name.
- [ ] Long unbroken strings wrap; `WithLongContent` story exists.
- [ ] Numbers and dates use `Intl` formatting for the user's locale and time zone.
- [ ] Relative times carry the absolute time in a `time` element.
- [ ] Plurals use plural rules, not string concatenation.
- [ ] Strings come from one keyed source with placeholders; no sentence concatenation.
- [ ] Logical CSS properties used for direction-sensitive spacing and position.
- [ ] Icon-only controls have a text name; visible label is part of the accessible name.
