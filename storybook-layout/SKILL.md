---
name: storybook-layout
description: Use this skill when adding, renaming or moving a Storybook story file, when choosing a story's title or its stories' names and order, when setting up or reorganising a Storybook sidebar, when a gallery, "all together", kitchen-sink, screen or page story is about to be written, when the owner says the sidebar is cluttered, inconsistent or hard to review, or when reviewing a UI branch in Storybook and the grouping gets in the way. Holds the one sidebar shape every project uses: fixed roots in a fixed order, one entry per unit by its code name with Default first, extra files only as Flows, Examples or a named part, and every screen under Screens. Framework-neutral. Not for what a unit's stories must prove or its card (ui-component-contract), nor for tokens or themes (design-tokens).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Storybook layout

The sidebar is the owner's review surface: they find a unit by its code
name, open its states in a known order, then look at whole screens. One
project grew five title shapes in a week ("X/Flows", "X flows", "X parts/Y",
"X/Y", "All together: X" in every layer, the same screen three times) and the
owner could not review it. This skill fixes the shape so nobody chooses it
again. Storybook's own guidance and the large design-system Storybooks
(GitHub Primer, IBM Carbon) use the same idea: one scheme, the same shape
under every component, docs first, combinations last.

## The shape

**Roots, in this order and no others:**

| Root | Holds |
| --- | --- |
| `Docs` | the welcome or reviewing page, the theme toolbar, anything that is not a unit |
| `Foundations` | tokens shown as pages: palette, type scale, spacing, state colours, icons, motion, logos |
| `Components` | single-purpose units with no domain types |
| `Compositions` | reusable groups of components with no domain types |
| `Features` | units that know the domain |
| `Layouts` | frames with slots and no domain logic |
| `Screens` | whole screens, composed at the highest layer available |

A project with fewer layers drops roots; it never adds a root or renames one.
Order them with `storySort` in the preview (below); import order is not an
order.

**One entry per unit, titled `<Root>/<UnitName>` with the unit's code
name**: `Components/StateDot`, `Layouts/DashboardLayout`, never
`Components/State dot` or `Layouts/Dashboard layout`. The name the sidebar
shows is the name the code, the card and the test output use.

**Stories inside a unit, in this order:** `Default` first, always; then the
states in the order the project's cards use (loading, empty, error,
unreachable, long content, phone and other sizes); then variants; then
`Playground` with controls where a unit has variants worth exploring. Story
names are PascalCase exports; the card lists them in the same order.

**Extra files only as a child of the unit, with one of three names:**

| Child | Holds | Example |
| --- | --- | --- |
| `<Unit>/Flows` | the play-test stories: every keyboard and pointer flow | `Compositions/DataTable/Flows` |
| `<Unit>/Examples` | the unit combined with others, short of a whole screen | `Compositions/FormField/Examples` |
| `<Unit>/<Part>` | a part the unit is built from, by its code name | `Compositions/DataTable/Pagination` |

When a `Flows` file would pass the project's line limit, split by topic and
title the second `<Unit>/Flows: <topic>`. Nothing else goes under a unit: no
"paging", "scrolling", "opening", "remote results" files; those are flows or
examples.

**Every whole screen goes under `Screens`, once:** `Screens/Servers`,
`Screens/Sign in`, titled by what the person calls the screen, with its
desktop and phone stories and their play tests in one file. A screen is
composed from the highest layer that has the pieces (features in layouts).
Lower layers never carry a copy of a screen: a components-only version of a
page is either an `Examples` child of the unit it mostly shows or deleted
once the screen story makes its checks. Keep every check: move the
assertion, do not drop it.

**Files stay beside their units.** The title decides the sidebar; a screen
story file lives in the directory of its highest layer, where the import
rule already allows it. Never move a story file across layer directories to
suit the sidebar.

## Procedure

1. Print every title: `grep -rh "title:" --include='*.stories.*' src .storybook`.
   Each must match `Docs/…`, `Foundations/…`, `<Root>/<UnitName>`,
   `<Root>/<UnitName>/Flows`, `<Root>/<UnitName>/Flows: <topic>`,
   `<Root>/<UnitName>/Examples`, `<Root>/<UnitName>/<Part>` or `Screens/<Screen>`.
2. Fix titles and story order; rename exports only when `Default` is not
   first, and mirror every rename in the unit's card and in any story that
   imports it.
3. Fold stray files into `Flows` or `Examples`; move galleries to `Screens`.
4. Set the root order in the preview:

   ```js
   options: { storySort: { order: ['Docs', 'Foundations', 'Components', 'Compositions', 'Features', 'Layouts', 'Screens'] } }
   ```

5. Run the card check and the story tests; the story count may fall only by
   the galleries proved redundant, and the report says which checks moved
   where.

## Gotchas

- A unit title and its children coexist: `Components/Button` and
  `Components/Button/Flows` both show, as Primer's `Button` and
  `Button/Features` do. Do not invent a `Button parts` or `Button flows`
  sibling to avoid nesting.
- Single-story hoisting: a file whose only story's name equals the title's
  last segment collapses into its parent. Name a lone story `Default` so it
  does not.
- A card check that verifies story exports does not read titles; a wrong
  title fails only the owner's review. Step 1 is the check until the project
  automates it.
- Dark and light are the theme toolbar's job: no `Dark` stories, no theme in
  a title.
