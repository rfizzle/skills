# A round, end to end

## The tree

```text
src/explorations/                # under the frontend package; in .gitignore
└── sign-in-screen/              # one per open exploration: the unit name, kebab-case
    ├── plan.md                  # the question, one line per direction
    ├── Ledger.svelte            # one complete unit per direction, named for it
    ├── SplitManifesto.svelte
    ├── Quiet.svelte
    ├── fixtures.ts              # realistic data, or a re-export of the project's
    └── SignInScreen.stories.svelte   # title: Explorations/SignInScreen
```

Every direction file takes the same props and emits the same callbacks as
the slot it will fill, imports only from `$lib` and the project's
dependencies, and uses the tokens (`design-tokens`). A passed-over
direction keeps its file until promotion; only its story export goes.

## plan.md

```markdown
# Sign-in screen: how much does it say before the form?

| Direction | Axis | What it changes | What it costs |
| --- | --- | --- | --- |
| Ledger | information order | form first, product line beneath | no welcome moment |
| SplitManifesto | layout | two columns, the product's promise beside the form | collapses to one column on a phone |
| Quiet | density and tone | the form alone, centred, system type | least memorable |

Recommendation: Ledger; people sign in daily and the form is the task.
```

Two rows that change the same thing are one direction. Write the table
before the first file; it is the hand-over's table too.

## The story file

```svelte
<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Ledger from './Ledger.svelte';
  import SplitManifesto from './SplitManifesto.svelte';
  import Quiet from './Quiet.svelte';
  import { signInProps } from './fixtures';

  const { Story } = defineMeta({
    title: 'Explorations/SignInScreen',
    parameters: { layout: 'fullscreen' },
  });
</script>

<!-- One story per direction, named for it; each renders at true size in context.
     asChild makes the children the story; without it they go to the meta component. -->
<Story name="Ledger" asChild>
  <Ledger {...signInProps} />
</Story>

<Story name="SplitManifesto" asChild>
  <SplitManifesto {...signInProps} />
</Story>

<Story name="Quiet" asChild>
  <Quiet {...signInProps} />
</Story>
```

A component rather than a screen renders inside the context it will live
in: the form around a field, the list around a row, the toolbar around a
button, using the project's existing compositions. For a redesign, the
first story is `AsItIs`, rendering the unit from `$lib` unchanged.

`AllDirections`, stacking every direction at true size in one story, is
allowed only when the whole stack fits one viewport: a badge, a button, a
small card. Nothing is scaled down.

## The hand-over

```text
Round 1 on the sign-in screen asks: how much does it say before the form?
Open Storybook at Explorations/SignInScreen; Alt+→ and Alt+← flip
between them. Light and dark are in the toolbar.

| Direction | What it changes | When it wins | What it costs |
| --- | --- | --- | --- |
| Ledger | form first, product line beneath | people sign in every day | no welcome moment |
| SplitManifesto | the promise beside the form | first impressions matter here | one column on a phone |
| Quiet | the form alone, centred | the product is a tool, not a brand | least memorable |

I would keep Ledger: sign-in is a daily task and the form is the point.
Which is closest, and what is still off?
```

No markup, no class names, no file names. One recommendation, with a
reason from how the product is used.

## A narrowing round

The owner: "Ledger is closest, but the product line feels like an
afterthought, and I want the logo to carry more weight."

Round 2 keeps Ledger as its first story and adds two takes that each change
one variable the owner named:

| Direction | Changes from Ledger |
| --- | --- |
| Ledger | as kept |
| LedgerMasthead | the logo and product line become a masthead above the form |
| LedgerFooterLine | the product line moves below the form as a quiet footer |

`SplitManifesto` and `Quiet` leave the story file and stay in the
directory. The hand-over repeats the shape above with the new table and the
same closing question. "LedgerMasthead with SplitManifesto's promise copy"
is a merge: the promise copy comes whole from `SplitManifesto.svelte`, not
a rewrite in its spirit.

## Promotion checklist

1. Move the kept file to `lib/<layer>/<UnitName>/<UnitName>.svelte` (or the
   screen file beside its route) and rename the component to the unit's
   code name; fix the imports.
2. Continue `ui-component-contract` from its build step, stories first:
   the required stories under `<Root>/<UnitName>` against the promoted
   file, then the play tests after them in the same file, doc comments on every
   public prop, the a11y review, the owner gate on behaviour.
3. Add to the card's Decisions: `YYYY-MM-DD: kept Ledger over
   SplitManifesto (one column on a phone) and Quiet (no product
   presence); the owner wants the form first with a masthead.`
4. Delete `src/explorations/<slug>/`. Confirm `git status --short`
   shows only the unit's files; the exploration directory is ignored and
   must leave no trace.
5. Commit the unit as a normal change (`git-workflow`); the message's
   body says why this direction, not that there was a round.
