---
name: design-tokens
description: Use this skill when adding, renaming or reviewing design tokens, colours, colour schemes, themes or dark mode in a Tailwind CSS 4 project; when a Tailwind default (font, type size, easing) is about to be changed; when a component or an app needs a colour role that does not exist; when someone asks about OKLCH values, contrast ratios, a contrast check, the @theme block or semantic colour names; and when reviewing component class strings for palette utilities, arbitrary values, inline styles or class merging. Covers the flat semantic OKLCH layer with [data-theme] colour schemes, adding names instead of redefining Tailwind defaults, what an app on a design may add, role naming, intents, registered contrast pairs, the validator a project should have, and the styling rules every component follows. Framework-neutral. Not for installing a design or switching schemes in an app (design-system), nor component behaviour or accessibility of interactions (ui-component-contract, a11y-review).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Design tokens

One flat semantic layer, declared in Tailwind 4's `@theme` with inline OKLCH
values, is the only source of colour and named visual decisions. The
`@theme` values are the default colour scheme; every other scheme is a
`[data-theme="<id>"]` block redefining the same roles (and `color-scheme`),
so component code never changes per scheme. There is no primitive ramp
(`blue-500`) underneath: the role name is the abstraction. Layout, spacing,
type size, radius and breakpoints use Tailwind's scales; they get no
semantic aliases, only added steps. Wherever a skill says "both themes" or
"light and dark", it means the default scheme and one of the opposite
brightness.

**Never redefine a Tailwind default; only add.** `text-sm` is 14px,
`font-sans` and `font-mono` are Tailwind's stacks and `ease-out` is
Tailwind's curve in every project, so code reads the same whichever
project or design it is in. A step that is needed gets a new name:
`text-2xs`, `font-body`, `font-code`, `ease-snappy`.

**Two modes.** The design-system repo owns the whole layer for each design.
An app on a design (`design-system`) takes the layer and its schemes from
the design and adds only domain roles under new names, each with a value
in every scheme the design ships and its pairs in the app's own contrast
config; it never redefines a library role. The class lint runs in both. An
app with no design yet owns its layer as below.

The worked CSS, the contrast config shape and the validator requirements are
in [references/token-layer.md](references/token-layer.md).

## Vocabulary

Name by role, never by appearance (`danger`, not `red`; `surface-raised`,
not `gray-50`).

| Group | Roles |
|---|---|
| Surface | `surface`, `surface-raised`, `surface-sunken`, `surface-overlay` |
| Foreground | `fg`, `fg-muted`, `fg-subtle`, `fg-on-solid` (text on any solid fill) |
| Border | `border`, `border-strong` |
| Brand | `brand`, `brand-emphasis`, `brand-muted`, `brand-subtle` |
| Focus | `focus` |
| Intents | `danger`, `warning`, `success`, `info`, each with `-muted` (tinted background) and `-fg` (text on the base fill) |
| Domain | product roles the app genuinely needs (a severity ramp, chart series), each fill with its `-fg` partner |
| Non-colour | font families (`font-body`, `font-code`), added type, radius or shadow steps, motion durations and easings, z-index, each a new name beside Tailwind's |

Use Tailwind 4's documented namespaces: `--color-*`, `--radius-*`,
`--shadow-*`, `--ease-*`, `--animate-*`, and `--transition-duration-*` for
named `duration-*` utilities.

## Adding a token

1. **Name the need.** What role is missing? If an existing role with an
   opacity modifier (`bg-brand/10`) or a configured scale (`p-4`) expresses
   it, stop: no token.
2. **Pick the OKLCH value.** Keep one hue per intent and vary lightness and
   chroma, not hue. Compute contrast; lightness intuition is not proof.
3. **Declare it** in `@theme`, and its override in every
   `[data-theme]` scheme. A value that is deliberately the same in every
   scheme gets a comment saying so. A name Tailwind already defines is
   never reused.
4. **Intents come in threes**: base, `-muted`, `-fg`. A domain fill comes
   with its `-fg` partner.
5. **Register every pairing** the token will be used in (foreground on
   background, with level `text`, `large` or `ui`) in the contrast config.
   A token with no registered pairing is an ungoverned decision.
6. **Run the validator.** A failing pair is a design problem: change the
   value, never the level or the threshold. An exemption needs a written
   reason (for example, a disabled control, which WCAG exempts).

## Contrast levels (WCAG 2.2 AA)

- `text`: 4.5:1, body text and anything under 24px regular or 18.66px bold.
- `large`: 3:1, large text only.
- `ui`: 3:1, borders that identify a control, focus rings, icons and state
  indicators against what they sit on.
- Every pair is checked in every scheme, including values a scheme inherits.

## Styling rules for components

- Colour and domain meaning only through semantic utilities: `bg-surface`,
  `text-fg-muted`, `border-border`, `ring-focus`, `bg-danger-muted`.
- No palette utilities (`bg-slate-900`, `text-blue-500`), no arbitrary
  values (`p-[13px]`, `bg-[#1e40af]`, `text-[oklch(...)]`), no inline visual
  styles. A missing role is a token request, not an arbitrary value.
- The caller's class input is merged last through the project's class-merge
  helper (clsx plus tailwind-merge or equivalent), so a caller override
  wins. The framework skill (`svelte-frontend`) decides how the class input
  is spelled.
- Variants are a small typed lookup from variant name to class string, kept
  in the unit. Add a variant library only if the project already has one.
- The prettier Tailwind class-sort plugin is required, so class order is
  never a review comment or a noisy diff.
- No `@apply` inside units: a repeated class string becomes a unit or a
  variant. `@utility`, in the token file, only for a pattern used in three
  or more places.
- No `dark:` utilities for colour: the roles already switch, and a design
  may ship several light and dark schemes. A unit never assumes a light or
  dark background.
- Every focusable element shows a `focus-visible:` ring using `ring-focus`;
  never remove an outline without that replacement.
- Every transition or animation has a `motion-reduce:` alternative; nothing
  needed to understand or operate the UI depends on motion.
- Opacity modifiers on text or borders are allowed only where the result is
  still a registered, passing pair.
- Mobile-first: base classes for the narrow layout, breakpoints added where
  the content needs them; container queries (`@container`, `@md:`) for
  reusable units that sit in both narrow and wide slots. See `ui-patterns`.

## Checks a project should have

- **Contrast validator** (a `make` target in CI): parses `@theme`, `:root`
  and scheme overrides, resolves `var()` chains, computes WCAG contrast for
  every registered pair in every scheme, fails below threshold, and fails if
  a required scheme is missing. An app on a design validates its own domain
  pairs against the design's schemes.
- **Class lint** over component sources: fails on palette utilities,
  arbitrary colour or length values, inline `style` with visual
  properties, and a redefined Tailwind default in the token file. The
  contrast validator does not read class strings, so without this lint the
  rule is review-only.

## Definition of done

- The token has a role name that Tailwind does not already define, a value
  in every scheme (or a comment saying it is scheme-invariant), and its
  pairs registered.
- The validator passes in every scheme without a weakened level.
- No component uses a palette utility, arbitrary value or inline style.
- No token duplicates another's role, except an explicit, commented alias.

## Gotchas

- `fg-muted` on `surface-sunken` is the pair that usually fails first in
  light mode; register it if it is used.
- A `/50` opacity on a muted text colour almost always drops below 4.5:1.
- Redefining `--font-sans` or `--ease-out` in `@theme` raises no error and
  silently changes every `font-sans` and `ease-out` already written,
  including in code copied from another project. Add a name instead.
- A `.dark` class block left over from a two-theme setup is not a scheme:
  the validator and the scheme switcher read `[data-theme]`. Move it.
- Migrating from Tailwind 3: `@import "tailwindcss"` replaces the
  `@tailwind` directives, theme config moves into `@theme`, and palette
  utilities are replaced with roles before the class lint is switched on.
  A Tailwind 3 config that overrode `fontFamily.sans` becomes `font-body`.
