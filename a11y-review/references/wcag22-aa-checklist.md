# WCAG 2.2 AA checklist and APG routing

Baseline: WCAG 2.2 Level A and AA. Verify behaviour that is version-sensitive
against the W3C sources before approving a new interaction pattern.

## Perceivable

- [ ] Text contrast at least 4.5:1; large text (24px, or 18.66px bold) at least 3:1 (1.4.3).
- [ ] Control boundaries, state indicators, icons and focus indicators at least 3:1 against adjacent colours (1.4.11).
- [ ] Colour is not the only way information or state is conveyed (1.4.1).
- [ ] Images and icons that carry meaning have text alternatives; decorative ones are hidden (1.1.1).
- [ ] Structure is in the markup: headings, lists, tables, labels, landmarks (1.3.1).
- [ ] Content reflows at 320 CSS px without loss (1.4.10); works in both orientations (1.3.4).
- [ ] Text resizes to 200% (1.4.4) and survives text-spacing overrides (1.4.12).
- [ ] Hover or focus content is dismissible, hoverable and persistent (1.4.13).
- [ ] Input purpose is identified with `autocomplete` for personal data fields (1.3.5).

## Operable

- [ ] Everything works with the keyboard; no keyboard trap (2.1.1, 2.1.2).
- [ ] Single-character shortcuts can be turned off or remapped, or only work on focus (2.1.4).
- [ ] Skip link or landmarks let users bypass repeated blocks (2.4.1).
- [ ] Each page has a descriptive title (2.4.2); link purpose is clear in context (2.4.4).
- [ ] Focus order follows meaning (2.4.3); focus is visible (2.4.7).
- [ ] Focused element is not fully hidden by sticky headers, footers or overlays (2.4.11).
- [ ] Dragging has a single-pointer alternative (2.5.7).
- [ ] Targets at least 24 by 24 CSS px, or spaced per the exception (2.5.8).
- [ ] Moving or auto-updating content can be paused; motion respects `prefers-reduced-motion`; nothing flashes more than three times a second (2.2.2, 2.3.1).
- [ ] Time limits can be extended or turned off (2.2.1).

## Understandable

- [ ] Page language is set; parts in another language are marked (3.1.1, 3.1.2).
- [ ] Focus or input does not trigger an unexpected change of context (3.2.1, 3.2.2).
- [ ] Navigation and help appear consistently across pages (3.2.3, 3.2.6).
- [ ] Errors are identified in text, tied to the field, with a correction suggestion when known (3.3.1, 3.3.3).
- [ ] Inputs have labels or instructions (3.3.2).
- [ ] Legal, financial or data-deleting submissions are reversible, checked or confirmed (3.3.4).
- [ ] Information already entered is not asked for again in the same process (3.3.7).
- [ ] Authentication does not require a cognitive test; paste and password managers work (3.3.8).

## Robust

- [ ] Native HTML before ARIA; no ARIA that contradicts native semantics.
- [ ] Every control exposes correct name, role, state and value (4.1.2).
- [ ] The accessible name contains the visible label (2.5.3).
- [ ] Status messages are announced without moving focus (4.1.3).
- [ ] IDs and ARIA references stay unique when several instances render.

## Manual evidence (record each, or mark it unverified)

- [ ] Every flow completed with the keyboard only.
- [ ] Screen-reader smoke test with at least one supported screen reader and browser.
- [ ] Reduced-motion preference turned on.
- [ ] 320 px viewport and 200% zoom checked.
- [ ] Right-to-left checked, only when the product supports it.

## APG routing

Do not treat a row below as the full keyboard contract. Open the pattern,
separate required keys from optional ones, and write the model the unit
needs into its card with the URL.

| Need | Pattern | Review note |
|---|---|---|
| Action | [Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/) | Native `button`: Enter and Space. Toggle buttons use `aria-pressed`. |
| Modal | [Dialog (modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Initial focus, contained Tab, Escape, focus return. |
| Confirm that interrupts | [Alert dialog](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/) | For destructive confirmations; focus on the safest control. |
| Show/hide | [Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Native `button` with `aria-expanded`, or `details`/`summary`. |
| Stacked sections | [Accordion](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/) | Arrow, Home and End keys are optional. |
| In-page panels | [Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) | State orientation and automatic versus manual activation. |
| Command list | [Menu button](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/) | Not for site navigation; that is links in a disclosure. |
| Pick from a list | [Listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/) | Single or multi select; selection follows focus or not; type-ahead. |
| Type to filter | [Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) | Differs for editable vs select-only and autocomplete mode. |
| On/off setting | [Switch](https://www.w3.org/WAI/ARIA/apg/patterns/switch/) | Space required, Enter optional; `aria-checked`. |
| Choice | [Checkbox](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/), [Radio group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) | Prefer native inputs; define mixed state if used. |
| Range | [Slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) | Touch assistive technology needs manual checking. |
| Hint | [Tooltip](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/) | Focus stays on the trigger; Escape dismisses; never the only copy. |
| Interactive cells | [Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Only for spreadsheet-like navigation; otherwise a plain table. |
| Location trail | [Breadcrumb](https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/) | `nav` with a label; last item `aria-current="page"`. |

Sources: [WCAG 2.2](https://www.w3.org/TR/WCAG22/),
[quick reference](https://www.w3.org/WAI/WCAG22/quickref/),
[APG patterns](https://www.w3.org/WAI/ARIA/apg/patterns/).
