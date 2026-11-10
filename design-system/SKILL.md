---
name: design-system
description: Use this skill in an app's frontend when setting up its UI, choosing or changing the design it uses, adding a screen or feature UI, when a component, prop, variant or state seems to be missing, when colour schemes, dark mode, theming or the code font come up, when installing or upgrading @rfizzle packages, or for asks like "copy the settings page", "start from the list page template", "use the overview dashboard". Holds where designs come from (the rfizzle/templates repository, published as @rfizzle packages), what an app imports and what it copies, the install, schemes and fonts, the rule that a gap goes upstream instead of into a local fork, upgrades, and what an app may add itself. Not for building units inside the design-system repository (its own skills), Svelte syntax and the import rule (svelte-frontend), token values and contrast (design-tokens), or a feature's card and stories (ui-component-contract).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Design system

Every app used to build its own button, dialog and shell. The same unit was
written four times, drifted four ways, and a focus fix landed in one app.
Now an app's look and its generic units come from one repository, versioned
like any dependency. Left alone, an agent asked for a dialog still writes
one in `lib/components`, or copies the library's file and edits it, and
the app stops receiving fixes from that day.

This skill is the only one that names the repository and the package
scope; the other UI skills say "the design" and "the design-system repo".

## Where designs live

[rfizzle/templates](https://github.com/rfizzle/templates) is a pnpm
monorepo with one package set per design (the first is Technical),
published to GitHub Packages:

| Package | What it is | An app |
| --- | --- | --- |
| `@rfizzle/<design>-svelte` | components, compositions, widgets, layouts for Svelte 5 | installs it |
| `@rfizzle/<design>` | `theme.css` tokens and schemes, fonts, recipes, data types | installs it beside the first |
| `@rfizzle/core` | `cn`, `setTheme`, `restoreTheme`, `setCodeFont`, `restoreCodeFont`, shared names | installs it beside the first |

pnpm lets an app import only packages it added itself, so all three are
direct dependencies even though the first depends on the other two.

Its `docs/consuming.md` is the long form of steps 2 to 4; open it when
something here does not match what you see.

## 1. Choose a design

One design per app, recorded in the app's `AGENTS.md`, which is how every
other UI skill knows the app is on a design:

```markdown
## Design

- Design: Technical (`@rfizzle/technical-svelte`, `@rfizzle/technical`, `@rfizzle/core`)
- Default scheme: the design's default; code font: the design's default
```

Choose by viewing each design's Storybook: `make storybook` in a checkout
of the repository, or the Storybook build its release CI run keeps as an
artifact. Changing an
app's design later is a decision record and one change across the app.

## 2. Install

1. `.npmrc` points the scope at GitHub Packages:
   `@rfizzle:registry=https://npm.pkg.github.com` and
   `//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}`. Locally a token with
   `read:packages`; in CI the workflow token with `packages: read`.
2. `pnpm add @rfizzle/<design>-svelte @rfizzle/<design> @rfizzle/core @lucide/svelte`,
   with `tailwindcss` and `@tailwindcss/vite` as dev dependencies.
3. In the app's main stylesheet, after Tailwind:
   `@import 'tailwindcss';` then `@import '@rfizzle/<design>-svelte/styles.css';`.
4. Fonts once, in the root layout: `import '@rfizzle/<design>/fonts.css';`.
5. Units come from the package entry:
   `import { AppShell, PageHeader, Button } from '@rfizzle/<design>-svelte';`.

## 3. What to import, what to copy

| Layer (Storybook root) | In an app | Why |
| --- | --- | --- |
| Foundations | imported: `styles.css`, `setTheme`, `motion` | the look every unit shares |
| Components, Compositions, Widgets | imported | generic, driven by props and snippets, versioned |
| Layouts | imported; the app fills their slots | every app shares one shell |
| Templates, Dashboards | copied into a screen and adapted | a page carries product decisions: fields, copy, flow, metrics |

Templates and dashboards are not in the package entry. To copy one:

1. Take the `.svelte` and `.ts` files of
   `packages/<design>-svelte/src/lib/templates/<Name>/` (or `dashboards/`)
   from the release tag of the version the app has installed (Changesets
   tags `@rfizzle/<design>-svelte@<version>`), not from the default
   branch, so they match the units they import. Leave its story file and
   card: they import the repository's private fixtures and contracts, and
   the screen gets its own.
2. Rewrite its relative unit imports to `@rfizzle/<design>-svelte`; recipes
   stay imported from `@rfizzle/<design>`.
3. Replace fixture data with the app's data layer (`frontend-api-client`)
   and make it the screen file beside its route (`svelte-frontend`), with
   the screen's own card and stories under `Screens` (`storybook-layout`,
   `ui-component-contract`).

From then on it is the app's screen: a later release of the template is a
reference to compare against, not a migration.

## 4. Schemes and fonts

```ts
// root +layout.ts, before anything renders
import { restoreTheme, restoreCodeFont } from '@rfizzle/core';
import { themes, defaultTheme } from '@rfizzle/<design>';

restoreTheme(themes.map((t) => t.id), defaultTheme);
restoreCodeFont();
```

The library's `ThemeSwitcher` calls `setTheme` and `setCodeFont` and
remembers the choice; call them yourself only from a control of your own.
A scheme is a `data-theme` attribute on the root. Code font options need
`@import '@rfizzle/core/code-fonts.css'` after the design's stylesheet,
and each offered font's package (the `package` field of `codeFonts`)
installed and imported. Never add `.dark` classes or a second set of
colour values in the app.

## 5. Gaps go upstream

A missing prop, variant or state of a library unit, or a missing generic
unit, is a change in the design-system repo, never in the app. The test
for a new unit: if a second app could use it, it is generic and goes
upstream; if only this app ever will, it is the app's own (section 7).

1. Check the inventory: `docs/inventory/components.yaml` and the design's
   `inventory.yaml`. `planned` means it is coming; say so and wait or ask.
2. Make the change there: the inventory item first, then the unit with its
   card, contract and stories, released as a minor version. With no
   checkout of the repository in reach, stop and give the owner the
   inventory id and the request instead.
3. The app takes that release. To try it before release, build there and
   `pnpm add ../templates/packages/<design>-svelte`, then return to the
   registry version before committing.

Never fork a library unit, copy its file, wrap it to restyle it, or reach
into its internals with `class`. `class` places a unit (margin, width, grid
position); it never changes the unit's look.

## 6. Upgrades

Patch and minor releases are taken freely. A major names what to change in
its changelog entry; do those steps in one change. Renovate groups the
scope with a package rule `{ "groupName": "design", "matchPackageNames":
["@rfizzle/**"] }` and needs a `hostRules` entry with a token for
`npm.pkg.github.com`, as for a private Go module host (`repo-tooling`).

## 7. App-only additions

- Domain colour roles (chart series, a severity ramp) under new token names
  in the app's stylesheet after the design import, registered in the app's
  contrast config in every scheme the design ships (`design-tokens`).
- Domain features in `lib/features`, app frames that fill the library's
  layouts in `lib/layouts`, screens in `routes` (`svelte-frontend`).
- A unit only this app will ever use, with no domain types, in
  `lib/components` or `lib/compositions`, composed from the design's units,
  with its card (`ui-component-contract`). Rare; most such units turn out
  to be generic.
- Never redefine a library role or a Tailwind default (`text-sm`,
  `font-sans`, `ease-out`); add a new name.

React apps follow the same import and copy split once a design ships a
`-react` package; until then a design is Svelte only.

## Gotchas

- Importing `@rfizzle/<design>/theme.css` instead of the Svelte package's
  `styles.css` misses the classes written inline in the units' markup,
  since only `styles.css` tells Tailwind to scan them: parts of units
  render unstyled and nothing errors.
- A 401 from `pnpm install` is a missing or scope-less token, not a missing
  package.
- A copied template with a relative import left in it builds in the
  library and fails in the app; search the copy for `'../` before running.
- Re-storying library units in the app's Storybook duplicates the design's
  Storybook and drifts from it; the app's Storybook shows only what the app
  builds.
- A `link:` or file path to a local build left in `package.json` or the
  lock file passes locally and fails CI.
