---
name: storybook-layout
description: Use this skill when adding, renaming or moving a Storybook story file, when choosing a story's title or its stories' names and order, when setting up or reorganising a Storybook sidebar, when a gallery, "all together", kitchen-sink, screen or page story is about to be written, when the owner says the sidebar is cluttered, inconsistent or hard to review, or when reviewing a UI branch in Storybook and the grouping gets in the way. Holds the one sidebar shape every project uses: fixed roots in a fixed order (the design-system repo's and an app's), one entry per unit by its code name with Default first and play tests after the visual stories in the same file, extra files only as Examples or a named part, every screen under Screens, and library units never re-storied in an app. Framework-neutral. Not for what a unit's stories must prove or its card (ui-component-contract), the round that chooses between directions (ui-exploration), nor for tokens or themes (design-tokens).
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

**Roots, in this order and no others.** The design-system repo and an app
on a design have different roots, because the library builds generic units
and pages while the app builds what knows its domain:

| Root | Holds | Design-system repo | App |
| --- | --- | --- | --- |
| `Docs` | the welcome or reviewing page, the scheme toolbar, anything that is not a unit | yes | yes |
| `Foundations` | tokens shown as pages: palette, schemes, type scale, spacing, icons, motion, logos | yes | only with no design |
| `Components` | single-purpose units with no domain types | yes | only a unit no other app would use |
| `Compositions` | reusable groups of components with no domain types | yes | only a unit no other app would use |
| `Widgets` | self-contained cards, data in through props | yes | no |
| `Features` | units that know the domain | no | yes |
| `Layouts` | frames with slots and no domain logic | yes | the app's own frames only |
| `Templates` | generic whole pages that apps copy | yes | no |
| `Dashboards` | whole dashboard pages built from widgets | yes | no |
| `Screens` | the app's whole screens, composed at the highest layer available | no | yes |
| `Explorations` | the open exploration's directions, one story each (`ui-exploration`); gitignored, never on the default branch | while a round is open | while a round is open |

An app never re-stories a library unit: the design's own Storybook shows
it, and a copy there drifts. An app with no design yet uses the app column
with `Foundations`, `Components` and `Compositions` for its own units. A
project with fewer layers drops roots; it never adds a root or renames
one. `Explorations` is empty on the default branch. Order them with
`storySort` in the preview (below); import order is not an order.

**One entry per unit, titled `<Root>/<UnitName>` with the unit's code
name**: `Components/StateDot`, `Layouts/DashboardLayout`, never
`Components/State dot` or `Layouts/Dashboard layout`. The name the sidebar
shows is the name the code, the card and the test output use.

**Stories inside a unit, in this order:** `Default` first, always; then the
states in the order `ui-component-contract` names them (`Loading`, `Empty`,
`LoadError`, `Partial`), then `WithLongContent`, phone and other sizes;
then variants; then `Playground` with controls where a unit has variants
worth exploring. Story
names are PascalCase exports; the card lists them in the same order.

**One story file per unit.** The play-test stories, every keyboard and
pointer flow, follow the visual stories in the unit's own file, so every
unit is one sidebar entry. A separate `Flows` child turned some units into
folders and others into leaves, and the owner could not scan the sidebar.
A story file past the project's line limit moves its data into fixtures;
it is not split.

**Extra files only as a child of the unit, with one of two names:**

| Child | Holds | Example |
| --- | --- | --- |
| `<Unit>/Examples` | the unit combined with others, short of a whole screen | `Compositions/FormField/Examples` |
| `<Unit>/<Part>` | a part a caller arranges, by its code name | `Components/Tabs/TabPanel` |

Nothing else goes under a unit: no "flows", "paging", "scrolling",
"opening", "remote results" files; those are play stories or examples.

**Every whole screen goes under `Screens`, once:** `Screens/Servers`,
`Screens/Sign in`, titled by what the person calls the screen, with its
desktop and phone stories and their play tests in one file. A screen is
composed from the highest layer that has the pieces (features in layouts).
Lower layers never carry a copy of a screen: a components-only version of a
page is either an `Examples` child of the unit it mostly shows or deleted
once the screen story makes its checks. Keep every check: move the
assertion, do not drop it. In the design-system repo the whole pages are
`Templates` and `Dashboards`, under the same rules.

**Files stay beside their units.** The title decides the sidebar; a screen
story file lives in the directory of its highest layer, where the import
rule (the framework skill, `svelte-frontend`, defines and checks it)
already allows it. Never move a story file across layer directories to
suit the sidebar.

## Procedure

1. Print every title: `grep -rh "title:" --include='*.stories.*' src .storybook`.
   Each must match `Docs/…`, `Foundations/…`, `<Root>/<UnitName>`,
   `<Root>/<UnitName>/Examples`, `<Root>/<UnitName>/<Part>`, `Screens/<Screen>`
   or `Explorations/<UnitName>`, with a root this project has.
2. Fix titles and story order; rename exports only when `Default` is not
   first, and mirror every rename in the unit's card and in any story that
   imports it.
3. Merge each `Flows` file into its unit's story file, play stories after
   the visual ones; fold other stray files into the story file or
   `Examples`; move galleries to `Screens`. In an app on a design, delete
   stories of library units.
4. Set the root order in the preview:

   ```js
   options: { storySort: { order: ['Docs', 'Foundations', 'Components', 'Compositions', 'Widgets', 'Features', 'Layouts', 'Templates', 'Dashboards', 'Screens', 'Explorations'] } }
   ```

   One list for every project; roots a project does not have are skipped.

5. Run the card check and the story tests; the story count may fall only by
   the galleries proved redundant, and the report says which checks moved
   where.

## Gotchas

- A unit title and its children coexist: `Components/Tabs` and
  `Components/Tabs/TabPanel` both show, as Primer's `Button` and
  `Button/Features` do. Do not invent a `Tabs parts` or `Tabs flows`
  sibling to avoid nesting.
- A play story placed before the visual stories makes the unit open on an
  interaction run instead of its `Default`; play stories go last.
- Single-story hoisting: a file whose only story's name equals the title's
  last segment collapses into its parent. Name a lone story `Default` so it
  does not.
- A card check that verifies story exports does not read titles; a wrong
  title fails only the owner's review. Step 1 is the check until the project
  automates it.
- Schemes are the toolbar's job: no `Dark` stories, no scheme in a title.
