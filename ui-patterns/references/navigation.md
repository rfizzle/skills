# Navigation

## Rules

- **Links go places, buttons do things.** Anything that changes the URL is
  an `a` with an `href`, so it can be opened in a new tab and its
  destination is announced. Anything that acts in place is a `button`.
- **Landmarks**: one `header`, one `main`, `nav` elements each with a label
  when there is more than one ("Primary", "Breadcrumb"), `footer`. A skip
  link to `main` is the first focusable element.
- **Current location**: the active nav item has `aria-current="page"` and a
  non-colour indicator (weight, underline, marker). Breadcrumbs for
  hierarchies more than two levels deep, last item `aria-current="page"`.
- **Page titles**: each route sets a unique document title, most specific
  first ("Q3 access summary · Reports · <App>"). Exactly one `h1`, matching
  the title's first part; headings do not skip levels.
- **Focus on client-side navigation**: after a route change, move focus to
  the new page's `h1` (or the main region) and let the title change be
  announced. Do not leave focus on a link that no longer exists.
- **Back works**: every state worth returning to is in the URL (see the
  SKILL), so Back and reload restore it. Opening a record in a panel also
  updates the URL.
- **Tabs vs links**: APG tabs switch panels within one page and do not change
  the URL by default; if each section deserves its own URL, use links styled
  as a tab bar with `aria-current`, not the tabs pattern.
- **Menus**: a site navigation menu is a list of links with a disclosure
  button, not an APG `menu` (that is for application commands).
- **Consistent placement**: navigation and help appear in the same place and
  order on every page (WCAG 3.2.3, 3.2.6).
- **Mobile**: the primary nav collapses behind a labelled disclosure button
  with `aria-expanded`; it is a list of links, focus moves into it on open
  and Escape closes it.

## Checklist

- [ ] URL changes use links; in-place actions use buttons.
- [ ] Landmarks present and labelled; skip link to `main` works.
- [ ] Active item has `aria-current="page"` and a non-colour indicator.
- [ ] Unique document title per route; one `h1`; no skipped heading levels.
- [ ] Focus moves to the new page's heading after client-side navigation.
- [ ] Back and reload restore filters, tabs and open records.
- [ ] Tabs pattern only for in-page panels; URL sections use links.
- [ ] Navigation order and placement are consistent across pages.
- [ ] Mobile nav disclosure exposes `aria-expanded` and closes on Escape.
