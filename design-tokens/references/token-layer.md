# Token layer: worked shape

## The CSS file

One file holds the whole layer, in this order: `@theme` (the default
scheme), one `[data-theme]` block per other scheme, then `@layer base`
element styles. In the design-system repo each scheme may be its own file
imported by the token file; an app on a design has only its domain roles
here, after the design's stylesheet.

```css
@import "tailwindcss";

@theme {
  --color-surface: oklch(99% 0.003 260);        /* page background */
  --color-surface-raised: oklch(100% 0 0);      /* cards, popovers */
  --color-surface-sunken: oklch(96% 0.005 260); /* wells, table headers */
  --color-fg: oklch(22% 0.02 260);              /* primary text */
  --color-fg-muted: oklch(45% 0.02 260);        /* secondary text */
  --color-fg-on-solid: oklch(99% 0 0);          /* text on solid fills */
  --color-border: oklch(70% 0.01 260);          /* control boundaries */
  --color-brand: oklch(50% 0.13 168);
  --color-focus: oklch(55% 0.18 250);
  --color-danger: oklch(52% 0.19 25);
  --color-danger-muted: oklch(95% 0.03 25);
  --color-danger-fg: var(--color-fg-on-solid);  /* alias: same role */

  --font-body: 'Inter Variable', system-ui, sans-serif;  /* added; font-sans stays Tailwind's */
  --font-code: 'JetBrains Mono Variable', monospace;     /* added; font-mono stays Tailwind's */
  --text-2xs: 0.6875rem;                                 /* added below text-xs */
  --transition-duration-fast: 120ms;
  --ease-snappy: cubic-bezier(0.2, 0, 0, 1);             /* added; ease-out stays Tailwind's */
}

[data-theme="dark"] {
  color-scheme: dark;
  --color-surface: oklch(18% 0.01 260);
  --color-surface-raised: oklch(22% 0.012 260);
  --color-surface-sunken: oklch(15% 0.01 260);
  --color-fg: oklch(94% 0.01 260);
  --color-fg-muted: oklch(75% 0.015 260);
  --color-border: oklch(48% 0.015 260);
  --color-brand: oklch(70% 0.12 168);
  --color-focus: oklch(72% 0.15 250);
  --color-danger: oklch(68% 0.17 25);
  --color-danger-muted: oklch(28% 0.06 25);
  /* --color-fg-on-solid: scheme-invariant */
}
```

`setTheme` (or any switcher) sets `data-theme` on the root element; the
`@theme` values apply when it is absent or names the default scheme. A
design whose default is dark writes its light schemes the same way, with
`color-scheme: light`.

Values above are illustrative; the validator, not this file, decides whether
they pass.

## The contrast config

A JSON file beside the validator. Names are without the `--color-` prefix.

```json
{
  "requiredThemes": ["dark"],
  "pairs": [
    { "fg": "fg",          "bg": "surface",        "level": "text" },
    { "fg": "fg-muted",    "bg": "surface-sunken", "level": "text" },
    { "fg": "fg-on-solid", "bg": "brand",          "level": "text" },
    { "fg": "danger",      "bg": "danger-muted",   "level": "text" },
    { "fg": "border",      "bg": "surface",        "level": "ui" },
    { "fg": "focus",       "bg": "surface-raised", "level": "ui" },
    { "fg": "fg-subtle",   "bg": "surface",        "level": "text",
      "exempt": "disabled-control text only (WCAG 1.4.3 exception)" }
  ]
}
```

A `note` field may say where the pair is used, so a reviewer can find it.

## Validator requirements

A zero-dependency script (Node or Go) wired to a `make` target and CI:

0. In an app on a design, first read the design's token file and the
   scheme files it `@import`s (from `node_modules`) as the base, then the
   app's file on top; `requiredThemes` lists the design's scheme ids.
1. Read the CSS file; strip comments; collect declarations from `@theme`
   and `:root` as the base scope, and from `[data-theme=...]` blocks as
   scheme overlays.
2. For each scheme (base plus each overlay on top of base), resolve each
   pair's colours through `var()` chains, with fallbacks; fail on a cycle or
   an unresolved name.
3. Convert `oklch()`, hex, `rgb()` and `hsl()` to sRGB, clamp, and compute
   WCAG relative luminance and the contrast ratio.
4. Compare against the level (`text` 4.5, `large` 3, `ui` 3). A failure with
   a non-empty `exempt` reason prints as EXEMPT and does not fail.
5. Fail if a scheme in `requiredThemes` is missing from the CSS.
6. Print one table row per scheme and pair (scheme, pair, level, required,
   ratio, status); exit non-zero on any failure.

Test the validator itself: a passing file, a failing pair, an exempt pair,
a `var()` cycle, and a missing required scheme.

## Class lint requirements

Over unit and screen sources (not the token file):

- palette utilities: `(bg|text|border|ring|fill|stroke|from|to|via|outline|shadow|decoration|accent|caret)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+`;
- arbitrary values: a utility followed by `-[...]` containing a colour or a
  length, unless the line carries a reviewed allow comment;
- raw colour literals (`#rgb`, `oklch(`, `rgb(`, `hsl(`) and inline `style`
  with visual properties;
- in the token file, a declaration of a name Tailwind defines
  (`--font-sans`, `--font-mono`, `--ease-out`, `--text-sm` and the rest of
  its default theme).
