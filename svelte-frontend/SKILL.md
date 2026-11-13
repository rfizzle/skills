---
name: svelte-frontend
description: Use this skill when writing, reviewing or setting up Svelte or SvelteKit code in the web frontend - a .svelte component or .svelte.ts module, props and runes ($state, $derived, $effect, $bindable), snippets, event callbacks, a design unit import, a Zag.js widget, icons, the cn class helper, the web/src folder layout and which layer may import which, svelte.config.js, vite.config.ts, adapter-static, the dev proxy, Svelte story files, vitest or Storybook test setup, eslint, prettier or svelte-check failures, the web-lint, web-test or web-budget targets, bundle size, fonts or images. Also when an $effect syncs state, a unit fetches in onMount, or an each block has no key. Not for which design an app uses or a missing library unit (design-system), which UX pattern applies (ui-patterns), a unit's card and required stories (ui-component-contract), token values (design-tokens), story titles and order (storybook-layout), API calls and caching (frontend-api-client), or end-to-end tests (browser-e2e).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Svelte frontend

The UI skills say what a unit must do and stay framework-neutral; this one
says how it is written. Without it an agent mixes Svelte 4 syntax into a
runes project, syncs props with `$effect`, hand-rolls a menu and fetches in
`onMount`: each compiles and looks right in a screenshot, and each breaks
keyboard use, data flow or the next change.

Defaults, which a project's `AGENTS.md` or a decision record may override:
SvelteKit with `adapter-static` as a single-page app embedded in the Go
binary, TypeScript strict, pnpm, Tailwind 4 (`design-tokens`), Zag.js
(`@zag-js/svelte`), tailwind-merge, lucide icons, Storybook 10, vitest 4 in
browser mode.

An **app on a design** (its `AGENTS.md` names one, `design-system`)
imports its units from the design's Svelte package and builds only what
the product needs. The **design-system repo** builds those units; its
layers are under "Layout and the import rule". An app that names no design
yet builds and keeps its own units until it adopts one.

## Runes only

Runes mode is forced by the compiler options (`references/config.md`), so
Svelte 4 syntax fails the build.

| Need | Use | Never |
| --- | --- | --- |
| local mutable state | `$state` | a store, a plain `let` expected to update the view |
| a value computed from others | `$derived`, or `$derived.by` for a block | an `$effect` that assigns state |
| large data replaced whole (a page of rows) | `$state.raw`, reassigned on change | a deep `$state` proxy over thousands of objects |
| inputs | `$props()` typed by `interface Props` | `export let` |
| a value the caller writes back | `$bindable`, form-like values and an overlay's `open` only | binding anything else |
| content passed in | snippets: `{#snippet}`, `{@render}`, typed `Snippet<[T]>` | `<slot>` |
| reporting intent | a callback prop (`onSelect`, `onDismiss`) | `createEventDispatcher`, `on:` |
| behaviour on one element | an attachment, `{@attach fn}` | `bind:this` plus `$effect`; new `use:` actions |
| element ids | `$props.id()` | counters, `Math.random()` |
| syncing with something outside Svelte | `$effect` with a cleanup return | anything else |

- `$effect` is for talking to a non-Svelte thing: `localStorage`, a timer,
  an observer, a third-party widget. Never to derive state, never to fetch.
- An editable local copy of a prop is a writable `$derived`
  (`let draft = $derived(value)`, then assign `draft`); it resets when the
  prop changes. Never write to a prop that is not `$bindable`.
- No stores for component-local state. A `.svelte.ts` module holds only
  app-lifetime state (the session, the toast queue); one screen's shared
  state is a class instance the screen creates and passes down.

## Props, classes, primitives, icons

- `interface Props` is declared in the component's own script, never
  imported, and each member it declares has a one-line `/** */` comment:
  the cards check (`ui-component-contract`) reads exactly that. Members
  inherited from `svelte/elements` are exempt; spread `...rest` onto that
  element. Callbacks are `on` plus the intent (`onSelect`), typed.
- `class` is a prop, merged last through the one helper
  `cn = twMerge(clsx(...))`, so the caller wins. An app on a design imports
  `cn` from the design's core package; a project without one keeps it in
  `$lib/utils/cn.ts`.
- In an app on a design, units come from the design's Svelte package and
  are never wrapped, copied or restyled: `class` places a unit, it does not
  change its look. A unit the design lacks goes upstream (`design-system`).
- A widget with keyboard or focus semantics (dialog, menu, select,
  combobox, tabs, tooltip, popover) that the project must build itself
  uses a Zag.js machine (`@zag-js/<machine>` through `@zag-js/svelte`) in
  its own `lib/components/<Name>/`, never hand-rolled, as the design-system
  repo does. A project still on bits-ui wrappers keeps them until it adopts
  a design.
- Icons come one by one from `@lucide/svelte/icons/<name>`, rendered only
  through `Icon`, decorative unless given a `label`. In an app on a design
  it is the design's `Icon` with its size steps; a project's own `Icon`
  has `size` `sm` 16, `md` 20 or `lg` 24 px.

## Layout and the import rule

| Path under `web/src` | Storybook root | May import |
| --- | --- | --- |
| `lib/utils` | none | `lib/utils` |
| `lib/api` (data layer, `frontend-api-client`) | none | `lib/utils`; the client packages |
| `lib/components` | `Components` | `lib/utils`; `@zag-js/*` |
| `lib/compositions` | `Compositions` | components, utils |
| `lib/features` | `Features` | compositions, components, `lib/api`, utils |
| `lib/layouts` | `Layouts` | compositions, components, utils |
| `routes` | `Screens` | everything above; `$app/*` |
| `explorations` | `Explorations` | everything above; imported by nothing; in `.gitignore` (`ui-exploration`) |

In an app on a design every layer may import the design's packages, and
`lib/components` and `lib/compositions` hold only units no other app would
use, composed from the design's units; usually there are none. A unit a
second app could use goes upstream (`design-system`). The design-system repo has no `api`, `features` or `routes`: its
layers are `components`, `compositions`, `widgets`, `layouts`, `templates`,
`dashboards`, each importing only those before it, and templates and
dashboards stay out of the package entry because apps copy them.

This is the import rule `storybook-layout` refers to;
`scripts/check-imports.mjs` in `make web-lint` enforces it, and with domain
types in `lib/api` it enforces "no domain types" below features too.
Layouts take features through snippets. A unit is a directory
`lib/<layer>/<Name>/` (component, card, stories), imported by
`$lib/` path, never through a barrel. A route's `+page.svelte` stays thin:
it reads load data and the URL and renders `<Name>Screen.svelte` beside
it, the file `Screens/<Screen>` renders. Tree: `references/layout.md`.

## App shell

- `adapter-static` with `fallback: 'index.html'`; the root `+layout.ts`
  sets `export const ssr = false`. The Go binary embeds `web/build` with
  `//go:embed all:build` (plain `build` drops `_app`) and serves
  `index.html` for unknown non-API paths (`go-http-server`).
- Every route is its own chunk for free. A heavy library (charts, an
  editor) is imported only by the route that needs it, or with `import()`
  when it opens on demand, never from a layout or a shared component.
- `vite dev` proxies the API paths (the root-mounted Connect services and
  `/api`) to the Go port, so the browser sees one origin as in production:
  session cookies and the CSRF header work unchanged and nothing needs CORS.
- Screens get data from the data layer (`frontend-api-client`).

## Stories and tests

- Stories are Svelte CSF (`@storybook/addon-svelte-csf`): `defineMeta` in
  `<script module>`, `Default` first, then the order `storybook-layout`
  sets. One story file per unit: its play-test stories follow the visual
  stories in the same `<Name>.stories.svelte`.
- `pnpm test` runs vitest 4 in browser mode through Playwright: unit tests
  with `@testing-library/svelte`, and every story through
  `@storybook/addon-vitest` with the axe pass failing on violations, in
  light and dark.
- Unit tests: `ui-component-contract` step 6.3.

## Scripts, lint and performance

| `make` target | pnpm scripts | Runs |
| --- | --- | --- |
| `web-lint` | `check`, `lint` | `svelte-check --fail-on-warnings`; prettier check, eslint, the import, cards and class checks |
| `web-test` | `test` | vitest: unit tests and stories |
| `web-budget` | `build`, `check:budget` | `vite build`, then the bundle budget |

prettier runs the svelte and Tailwind class-sort plugins; eslint is
typescript-eslint plus eslint-plugin-svelte; a warning fails all three.

Performance: fonts self-hosted as variable `woff2`
with `font-display: swap`, the one above-the-fold file preloaded, no font
CDN; every `img` has `width` and `height`, `loading="lazy"` below the fold,
raster through `@sveltejs/enhanced-img`; `scripts/check-bundle.mjs` fails
`web-budget` when gzip size passes `bundle-budget.json`, which is the last
accepted build plus small headroom and rises only with a reason in the
commit. Config files and the script: `references/config.md`.

## Gotchas

- Mutating a prop (`items.push(x)`, `user.name = v`) changes the parent's
  data behind its back and warns `ownership_invalid_mutation`. Call back
  with the new value instead.
- An `$effect` that writes state it also reads loops until
  `effect_update_depth_exceeded`. If it computes state from state, it was a
  `$derived`.
- Only synchronous reads are tracked. In `$derived.by` or `$effect`, a
  value read after `await`, inside `setTimeout` or in a callback is not a
  dependency, and `const n = items.length` at script top level reads once:
  each goes stale silently.
- `{#each}` without a key, or keyed by index, moves row-local state (an
  open menu, a half-typed input) to another row after a sort or delete.
  Key by a stable id: `{#each servers as server (server.id)}`.
- `bind:` chained from a screen through a feature into a component hides
  who changes the value. One hop, then value and callback.
- `onMount(async () => { rows = await fetch(...) })` has no cancellation,
  no loading or error state, and a late response overwrites the next
  screen. Data comes through the data layer at the screen.
- Importing `@zag-js/*` outside `lib/components` skips the wrapper's
  tokens, focus ring and card. Extend the wrapper.
- A design unit copied into `lib/components` "to tweak it" stops receiving
  the design's fixes and token changes, and the next upgrade becomes a
  manual merge. The tweak is a prop or variant upstream.
- Component code copied from elsewhere (shadcn-svelte, a docs example) uses
  its own colour names (`bg-primary`, `text-muted-foreground`). Tailwind 4
  emits nothing for an unknown theme name and reports no error; rewrite
  them to `design-tokens` roles.
- A mutated `Set`, `Map`, `Date` or `URL` in `$state` never updates the
  view; use `SvelteSet`, `SvelteMap`, `SvelteDate`, `SvelteURL` from
  `svelte/reactivity`. `$state` values are proxies: hand
  `$state.snapshot(x)` to `structuredClone` or a chart library.

## Definition of done

- No Svelte 4 syntax; every `$effect` talks to something outside Svelte;
  every declared prop has a doc comment; focus widgets are the design's
  units or Zag.js wrappers; no design unit is wrapped, copied or restyled.
- `make web-lint`, `make web-test` and `make web-budget` pass with zero
  warnings; the axe pass is clean in both themes (`a11y-review`).

## References

- `references/units.md`: writing a component, a Zag.js wrapper, `Icon`,
  `cn`, an attachment, `.svelte.ts` state, or a story file with play tests.
- `references/layout.md`: creating a unit, route or screen, or setting up
  the import check.
- `references/config.md`: Svelte, Vite, vitest, Storybook, eslint,
  prettier, `package.json` scripts, fonts, the bundle budget.
- Related: `design-system` (which design, import or copy), `ui-patterns`, `ui-component-contract`, `design-tokens`,
  `storybook-layout`, `a11y-review`, `repo-tooling`, `frontend-api-client`
  (the data layer), `browser-e2e`.
