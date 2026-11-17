# Deterministic story, component and browser tests

For a play function in Storybook, a component test in a real browser and a
Playwright flow. `browser-e2e` owns which flows get an end-to-end test and
its own no-sleep rules; `ui-component-contract` owns which stories exist.
A design-system repository adds its own helpers on top of these rules.

## A headless widget settles a frame later

A headless widget library (the one `svelte-frontend` names) applies focus,
the highlighted option, a popup's position and some ARIA attributes one
animation frame after the event. A test that acts or reads in that frame
passes on a quiet machine and fails on a starved one.

- After opening anything that takes focus, wait for focus inside it before
  the next key. A popup can be shown before it is placed and before it
  holds focus: wait for each as its own state when the test acts inside.
- After a key that moves focus or a highlight, wait for the specific
  target before the next key. Read the expected target from the fixture
  order before pressing.
- A one-shot `expect(x).toHaveFocus()` or an accessible-name assertion
  straight after a key or pointer step is wrapped in the runner's waiting
  form (`waitFor`, or an auto-retrying locator assertion).
- A wait for an absence (`not.toHaveFocus()`) is true before anything
  moves: wait for where focus lands instead.

```ts
// incorrect: the second key can beat the widget's frame; whatever is active is asserted
await userEvent.keyboard('{ArrowDown}');
await userEvent.keyboard('{ArrowDown}');
const active = document.getElementById(input.getAttribute('aria-activedescendant') ?? '');

// correct: options read first, each highlight awaited, the payload asserted
const [first, second] = options(canvas);
await waitFor(() => expect(input.getAttribute('aria-activedescendant')).toBe(first.id));
await userEvent.keyboard('{ArrowDown}');
await waitFor(() => expect(input.getAttribute('aria-activedescendant')).toBe(second.id));
await userEvent.keyboard('{Enter}');
await expect(args.onValueChange).toHaveBeenCalledWith([second.value]);
```

## "Nothing happened"

Assert a marker that is synchronous and that a closing element has already
lost, never visibility: an element leaving is still visible through its
exit animation.

```ts
// incorrect
await new Promise((r) => setTimeout(r, 200));
await expect(dialog).toBeVisible();

// correct
await expect(dialog).toHaveAttribute('data-state', 'open');
await expect(args.onCancel).not.toHaveBeenCalled();
```

A "does not open yet" check runs synchronously right after the event,
never after an awaited hover that a starved page stretches past the delay.

## When time is the behaviour

An auto-dismiss, a hover delay, a debounce. Prefer the runner's fake
timers where the unit's timers are reachable. Otherwise: await the unit's
own marker (`data-paused`), hold for the duration plus a margin, assert
the marker again, release, then wait for the outcome with a ceiling. The
sleep carries the lint's allow comment with that reason.

## Queries

- Overlays are portalled, and the previous test's may still be leaving.
  Find a popup through its trigger's `aria-controls`, never a page-wide
  `findByRole('dialog' | 'menu' | 'listbox' | 'option')` with no name.
- Match text whole (`'3'` also matches `13`).
- Index into `getAllBy*()` only where the fixture fixes the order.

## Geometry

A read of `getBoundingClientRect`, `scrollWidth` or an overflow state
waits for `document.fonts.ready` after render and, where the unit measures
itself, for the marker it sets in the frame it measures in. "Layout has
settled" is not a state; the marker is.

## Real input

A synthetic event library dispatches on the element it is given: it never
hit-tests a press, never applies the browser's focus rules, and models Tab
itself. A claim about Tab order, a press on a control with an icon inside
it, or a key whose default action matters is tested with real input
(Playwright's `page.keyboard` and `locator.click`, or the browser's
devtools input from a component test). Synthetic events stay for typing
and for keys the widget handles itself.

## State the runner should reset

Before each test: text size and reduced motion to default, scroll to the
top, the pointer parked off the page. After each: fail when a modal left
the page behind it interactive, and when the test made no assertion. A
test that changes other page state (a module store, a `console` spy, an
attribute on the document element) restores it in its own cleanup. When a
guard fails, fix the test that leaked, never the guard.

## The lint

A script over play and test bodies, run by the lint target, with a test of
its own. Rules worth having, each from an observed failure:

| Rule | Flags |
| --- | --- |
| `no-sleep` | `setTimeout`, `waitForTimeout`, a `pause(` helper in a test body |
| `waitfor-asserts` | a `waitFor` whose callback contains no `expect` |
| `key-then-key` | two key presses with no wait between |
| `key-before-focus` | a key after opening a menu, listbox or dialog with no focus wait between |
| `unwaited-settle` | a one-shot focus or accessible-name assertion right after an input step |
| `stale-reference-wait` | a wait compared against a value read before an earlier action |
| `truthy-state` / `attribute-presence` | `toBeTruthy()` or bare presence on a state attribute |
| `count-only-callback` | `toHaveBeenCalledTimes` with no `toHaveBeenCalledWith` for the same callback |
| `skip-loop` | a loop with `continue` and no asserted count of checks |
| `page-wide-overlay` | an unnamed page-wide query for an overlay role |

Opt out on the line or the comment lines above it, with the rule and a
reason of at least ten characters:

```ts
// test-lint-allow: key-then-key a native button activates synchronously on each key
```

## Stress

A script that takes a list of test files and runs them `RUNS` times, each
copy on one worker, `PARALLEL` copies on `CPUS` pinned cores, with the
page's main thread throttled through the devtools protocol
(`Emulation.setCPUThrottlingRate`):

```sh
make stress FILES=Combobox,Select            # 20 runs, 2 cores, 4x throttle, 2 pages
make stress FILES=DataTable THROTTLE=6       # harsher, for a heavy page
```

It takes a free block of cores with a lock file shared by every worktree
and pins with `taskset`, so several agents' sets run side by side without
starving each other; it prints `failed/runs` and the longest wait per
test, and fails on any failure, a crashed run, or a filter that matched
nothing. A non-timer wait over a second on a quiet machine is a bug in the
test or the unit: the ceiling is for a starved page, not a budget.

A test whose outcome depends on width, text size or positioning is also
repeated at twice CI's page density in whatever run renders it at narrow
width and enlarged text.
