# Lists and tables

## Rules

- **Table or list**: a `table` when users compare values across rows by
  column; a list of cards or rows when each item is read on its own. Never a
  grid of `div`s pretending to be a table.
- **Table semantics**: a `caption` (visible or visually hidden), `th` with
  `scope`, and no layout tables. Use the APG grid pattern only if cells are
  individually interactive and keyboard-navigated like a spreadsheet;
  otherwise a plain table with links and buttons in cells.
- **Columns**: the identifying column first; numbers right-aligned with
  tabular figures; units in the header, not every cell. Keep columns to
  what the task needs; extra detail goes to a detail view.
- **Row actions**: one primary action is the row's link (on the name, not
  the whole row as a click target); other actions go in a menu button per
  row with an accessible name that includes the row ("Actions for
  Ana Pereira").
- **Sort**: sortable headers are buttons inside the `th`; the active column
  has `aria-sort`. Sort, filters, search text and the page cursor live in
  the URL.
- **Filters**: show active filters as removable chips with a "Clear all".
  Announce the new result count in a polite live region after filtering.
  Filtering resets the cursor.
- **Pagination**: cursor-based, matching the API (`cursor`, `limit`,
  `nextCursor`). Prefer "Next / Previous" or "Load more" with a stable
  page size; avoid page numbers you cannot compute. Infinite scroll only
  with a reachable footer and a "Load more" fallback.
- **Selection**: checkboxes in the first column with a select-all header
  that states its scope ("Select all 50 on this page"). A bulk action bar
  shows the count and appears without moving focus.
- **Empty is two cases**: no data yet (say what will appear and how to add
  it) and no results for this filter (say so and offer "Clear filters").
- **Narrow screens**: either reflow rows into stacked label/value cards, or
  keep the table in a horizontally scrolling region that is focusable and
  labelled. Never shrink text to fit.

## Checklist

- [ ] Table vs list chosen by whether users compare across rows.
- [ ] `caption`, `th scope`, `aria-sort` on the sorted column.
- [ ] Sort, filters, search and cursor are in the URL and survive reload.
- [ ] Row action names include the row; no whole-row-only click target.
- [ ] Result count change is announced politely after filtering.
- [ ] Cursor pagination matches the API; filter change resets it.
- [ ] Both empty cases are distinct and each offers the next step.
- [ ] Narrow layout reflows or scrolls in a labelled, focusable region.
- [ ] Stories: `Default`, `Loading`, `Empty`, `NoResults`, `LoadError`, `WithLongContent`, `ManyRows`.
