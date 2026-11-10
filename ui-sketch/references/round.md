# A sketch round

## The directory

```text
.agents/sketches/order-page/       # one per open round; excluded from git
├── sketch.json                    # the round: question, directions, recommendation
├── tokens.css                     # the project's tokens as plain CSS (see below)
├── Banner.html                    # one fragment per direction, named for it
├── Timeline.html
├── Quiet.html
└── order-page.html                # the rendered page (render.mjs)
```

`scripts/example/` in the skill holds a complete round to copy.

## sketch.json

| Key | Required | Meaning |
|---|---|---|
| `title` | error | the unit in the owner's words (`Order page`) |
| `unit` | error | the unit's code name (`OrderPage`) |
| `layer` | | `component`, `composition`, `feature`, `layout`, `screen` |
| `round` | | 1, 2, 3; the hand-over says "Round N" |
| `question` | error | the one thing this round decides |
| `tokens` | warning | the tokens file, relative to the JSON |
| `directions` | error | two or more live, or one kept; at most five live |
| `recommendation` | warning | `direction` (an id) and `reason` |
| `decisions` | | `{ date, kept, over, why }` per round concluded |
| `viewports` | | default desktop 1280, tablet 820, phone 390 |
| `states` | | default `filled`, `loading`, `empty`, `error`, `partial` |

A direction: `id` (PascalCase, descriptive, never a letter), `axis`,
`changes`, `wins`, `costs` (all required), `file`, `status` (`candidate`
by default, `kept`, `passed`), `from` (the direction it narrows).

## tokens.css

The project declares tokens in Tailwind 4's `@theme`, which a browser does
not read. In an app on a design, the source is the design's `theme.css`
and its scheme files, plus any domain roles the app adds. Copy the
declarations as plain CSS: a light scheme (the default or another) under
`:root`, a dark one under `[data-theme="dark"]`:

```css
:root { --color-bg: oklch(99% 0 0); --color-text: oklch(20% 0.01 260); /* every token */ }
:root[data-theme="dark"] { --color-bg: oklch(16% 0.01 260); /* a dark scheme */ }
```

The viewer sets `data-theme="dark"` (and, for older token files,
`class="dark"`) on the fragment's root in dark mode. A project with a
`make tokens-css` or similar export uses it; otherwise copy by hand and say
so in the hand-over, since a drifted copy mis-sells a direction.

## A fragment

```html
<style>
  .page { padding: var(--space-6) var(--space-4); font-family: var(--font-body); color: var(--color-text); }
  .banner { background: var(--color-danger-soft); border: 1px solid var(--color-danger); border-radius: var(--radius); }
</style>
<div class="page">
  <h1>Order #A-10422</h1>
  <section class="banner" data-state="filled partial">This order was cancelled on 5 Nov …</section>
  <div data-state="loading"><div class="skeleton"></div></div>
  <p data-state="error">We could not load this order. <a href="#">Try again</a>.</p>
  <p data-state="empty">There is no order with this number.</p>
</div>
```

- HTML and CSS only; no `<html>`, `<head>` or `<body>`; no script.
- Colours, type, spacing and radii come from the token variables; a
  literal colour is a warning because the direction then shows something
  the project cannot build.
- Real copy and realistic data from the product; `lorem ipsum` is an
  error. Put the longest real content in.
- `data-state` lists the states an element belongs to, space-separated;
  an element without it shows in every state. `filled` is the default
  view; `loading`, `empty`, `error` and `partial` are the other four from
  `ui-component-contract`.
- Every direction fills the same slot: same page, same data, same copy;
  only the axis differs.

## The hand-over

`render.mjs --text` prints it:

```text
Round 1 on OrderPage asks: how a cancelled order reads at a glance, and where the refund stands

| Direction | Axis | What it changes | When it wins | What it costs |
| --- | --- | --- | --- | --- |
| Banner | information order | a full-width status banner above the order … | the person came to check one thing … | pushes the items below the fold on a phone |
| Timeline | interaction model | a vertical timeline beside the items … | support and repeat customers … | more to read for a one-off buyer |
| Quiet | density | a status pill in the header and one refund sentence … | cancellation is rare … | easy to miss that the refund is pending |

Recommendation: Banner; a person opens a cancelled order to find out about the refund

Which is closest, and what is still off?
```

Add where to look: the page hosted by the harness when it can host one,
else the rendered file's absolute path. Alt+→ and Alt+← flip directions.

## Narrowing

The owner: "Banner is closest, but it shouts; and I want the timeline's
refund line."

Round 2: `Banner` stays; `BannerCalm` (tone: the banner in the surface
colour with a red rule) and `BannerLedger` (information order: the banner
holds the timeline's refund line) are added with `from: "Banner"`;
`Timeline` and `Quiet` get `status: passed`. The merge takes the refund
line's markup whole from `Timeline.html`. Re-render to the same path,
republish to the same link, hand over with the new table.

## Keeping

On "keep BannerCalm": its `status` becomes `kept`, `decisions` gains
`{ "date": "2026-11-08", "kept": "BannerCalm", "over": "Banner (too loud), Timeline (history nobody asked for), Quiet (refund easy to miss)", "why": "the owner wants the refund first, calmly" }`,
one last render, and the story's reference gains the kept row, the
decision line and the page's location. `ui-component-contract` writes the
card from it; delete the sketch directory once the card exists.
