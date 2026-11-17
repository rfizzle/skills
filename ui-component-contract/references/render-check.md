# The render check

Run on every new or changed story before the owner review (step 8), and on
every direction before an exploration is shown. It exists because the owner
kept finding, by eye, defects no test looked for: two scrollbars on a
create screen, a page-size select overflowing its box, list items drawn
over each other, a search input and a select at different heights in one
toolbar, tabs with a scrollbar, a copy button with no effect, a card that
looked clickable and was not.

Two parts. Neither replaces the other: the script finds what has a
number, the look finds what does not (cramped padding, a missing
separator, weight in the wrong place).

## 1. The script

One helper, called at the end of every story's play or by the story test
runner after each story, at three widths (320, 768 and 1280 CSS px) and in
both themes. It returns findings; any finding fails the story.

| Check | Fails when | Declared exception |
| --- | --- | --- |
| Sideways overflow | an element's `scrollWidth` exceeds its `clientWidth` by more than 1 px: content spills out, or a sideways scrollbar appears that nobody declared (a tab list, a toolbar) | `data-scroll="x"` on a region meant to scroll (a wide table's wrapper) |
| Nested scroll | an element showing a scrollbar on an axis has an ancestor, below the document, showing one on the same axis | none: one of the two is wrong |
| Clipped text | a text element's content box is smaller than its scroll box and it has no truncation (`text-overflow: ellipsis` or a line clamp) | truncation, with the full value reachable (`ui-patterns`, content) |
| Sibling overlap | two siblings in a list, grid, toolbar or table row have intersecting boxes | `data-overlap` on a deliberate stack (avatars, badges on an icon) |
| Row alignment | form controls and buttons that share a flex or grid row differ in height by more than 1 px | `data-size` differs on purpose |
| Looks interactive, is not | an element has `cursor: pointer` or a hover rule and no interactive role, or an enabled button, link or `role="button"` has no handler and no `href` | none |
| Does nothing | a story's enabled control is neither exercised by a play step that asserts its outcome nor marked `data-inert-in-story` with the reason | the marker, for a control whose action belongs to the app |

```ts
// render-check.ts: framework-neutral, runs in the story's page.
export type Finding = { check: string; element: Element; detail: string };

// True when the element shows a scrollbar on the axis now, not only when it may.
const scrolls = (el: Element, axis: 'x' | 'y') => {
  const o = getComputedStyle(el)[axis === 'x' ? 'overflowX' : 'overflowY'];
  const over = axis === 'x' ? el.scrollWidth > el.clientWidth + 1 : el.scrollHeight > el.clientHeight + 1;
  return (o === 'auto' || o === 'scroll') && over;
};

export function renderCheck(root: Element): Finding[] {
  const out: Finding[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.display === 'inline' || cs.visibility === 'hidden') continue;

    for (const axis of ['x', 'y'] as const) {
      if (!scrolls(el, axis)) continue;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (scrolls(p, axis)) out.push({ check: 'nested-scroll', element: el, detail: axis });
      }
    }
    if (scrolls(el, 'x') && el.getAttribute('data-scroll') !== 'x') {
      out.push({ check: 'undeclared-scroll-x', element: el, detail: `${el.scrollWidth} > ${el.clientWidth}` });
    }
    if (el.scrollWidth > el.clientWidth + 1 && !scrolls(el, 'x') && cs.overflowX !== 'hidden') {
      out.push({ check: 'overflow-x', element: el, detail: `${el.scrollWidth} > ${el.clientWidth}` });
    }
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
    const truncates = cs.textOverflow === 'ellipsis' || cs.getPropertyValue('-webkit-line-clamp') !== 'none';
    if (ownText && cs.overflowX === 'hidden' && el.scrollWidth > el.clientWidth + 1 && !truncates) {
      out.push({ check: 'clipped-text', element: el, detail: el.textContent?.trim().slice(0, 40) ?? '' });
    }

    const row = cs.display.includes('flex') && !cs.flexDirection.startsWith('column');
    const kids = [...el.children].filter((k) => getComputedStyle(k).position !== 'absolute');
    if (row) {
      const controls = kids.filter((k) => k.matches('input, select, button, [role="combobox"], [role="button"]'));
      const heights = new Set(controls.map((k) => Math.round(k.getBoundingClientRect().height)));
      if (controls.length > 1 && heights.size > 1 && !controls.some((k) => k.hasAttribute('data-size'))) {
        out.push({ check: 'row-alignment', element: el, detail: [...heights].join(' / ') });
      }
    }
    if (!el.hasAttribute('data-overlap')) {
      const boxes = kids.map((k) => k.getBoundingClientRect()).filter((b) => b.width && b.height);
      for (let i = 1; i < boxes.length; i++) {
        const a = boxes[i - 1], b = boxes[i];
        const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (x > 1 && y > 1) out.push({ check: 'sibling-overlap', element: el, detail: `child ${i}` });
      }
    }
    const interactive = el.matches('a[href], button, input, select, textarea, summary, [role], [tabindex]');
    if (cs.cursor === 'pointer' && !interactive && !el.closest('a[href], button, label, summary, [role]')) {
      out.push({ check: 'looks-interactive', element: el, detail: el.tagName.toLowerCase() });
    }
  }
  return out;
}
```

Wait for `document.fonts.ready` and the unit's own measured marker before
calling it (`deterministic-tests`, browser reference): geometry read before
layout settles is the flaky version of this check. The "does nothing" row
is a count, not geometry: the story test compares the enabled controls a
story renders with the controls its plays acted on.

The long-content story is where clipping and overlap show; a unit that
renders text has `WithLongContent` for that reason, and its data includes
one unbroken long word, one long multi-word label and one large number.

## 2. The look

For each new or changed story, take a screenshot at 320 and 1280 px in
light and dark, open it, and answer before reporting:

- Is anything touching an edge it should not: text against a border, a
  popup on its trigger's border, content against the hover area above it?
- Does every group that the neighbouring units separate (logo from
  navigation, header from body, actions from content) have the same
  separation here?
- Is there a control with no visible state for hover, focus or pressed?
- At 320 px, can every control still be reached and operated?
- Does it look like the same product as the units beside it?

A defect found here that could have had a number is added to the script,
with its test, in the same change.

## Reporting

The review hand-over (step 8) lists the stories checked, the widths and
themes, the script's result, and what the look found and fixed. "Verified
in Storybook" without that list is not a render check.
