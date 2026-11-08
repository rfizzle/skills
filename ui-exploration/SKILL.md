---
name: ui-exploration
description: Use this skill when a new component, composition, feature or screen is about to be built and its look, structure or interaction is not yet decided, when an existing unit is being redesigned, or when the owner wants to see a few directions before committing to one: "show me some options", "I'm not sure what this should look like", "try a different layout", "closer to the second one", "that one but calmer", "mix the first one's layout with the third one's header", "keep that one". Holds the round: one question, three or four directions that disagree on a named axis, each a working unit shown at true size in the project's Storybook, a hand-over with a recommendation, then narrowing on the owner's "closest, and what is still off" until one direction is kept and promoted. Not for the unit's card and required stories (ui-component-contract), sidebar titles (storybook-layout), the tokens (design-tokens), a change with one right answer (iterate), or whether the unit should exist (plan-feature).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# UI exploration

An agent asked for a sign-in screen builds the first one it thinks of,
polishes it, and hands it over finished. The owner then spends three rounds
steering a complete component toward the picture in their head, each round
undoing work. The round below puts the choice before the polish: a few
directions that genuinely disagree, shown where the owner already reviews
(`storybook-layout`), one question at a time, narrowing on their answer
until one direction is kept. Volume is the failure mode: sixteen near
twins teach nothing, while three that differ in layout, information order
or interaction model teach the owner what they want.

## When a round runs

- A redesign of an existing unit (`iterate`). Direction 1 is then the unit
  as it is, untouched; the directions render on the real components, so
  the round runs here and not as a sketch.
- A new unit whose look was not settled at grooming (`ui-sketch` is the
  usual place, outside the codebase); here only when the unit must be
  seen on the real components, between the draft card and the owner gate
  (`ui-component-contract`). The card's purpose line is the brief.
- Skip it when the owner has already said what the unit looks like, or
  when the change has one right answer.
- A round runs in the checkout where the owner's Storybook runs, never in
  a batch implementer's worktree (`backlog-batches`), since the exploration
  is ignored by git and invisible elsewhere; a story whose look is
  undecided has its round before it is batched.

## The round

1. **Settle the question.** One line: what is this round deciding ("how
   much the sign-in screen says before the form", "how a server's status
   is read at a glance")? Every direction is an answer to it. A brief
   spanning several units is narrowed to the one with most leverage; the
   rest are later rounds.
2. **Read the ground.** The tokens (`design-tokens`), the components and
   compositions the directions will compose (`ui-patterns`: reuse first;
   a direction that needs a new primitive says so), the neighbours it
   renders beside, the product's tone, and the longest real content it
   must hold.
3. **Name the directions before writing code.** Three by default, four when
   the question is wide, never more than five. Each has a name that
   describes it (`Ledger`, `SplitManifesto`, `Quiet`), never a letter, and
   a named axis it moves on: layout, information order, density,
   interaction model, tone, motion. Two directions that differ only in
   accent, copy or spacing are one direction; replace one. The first round
   spreads wide: the obvious answer, one that reorders the information,
   one that changes the interaction model, and, when the question allows,
   one bold one.
4. **Build every direction as a complete unit** in
   `src/explorations/<slug>/` under the frontend package (`references/round.md`
   has the tree and the story skeleton). Each is a drop-in for the same slot: same props,
   same callbacks, the project's tokens, components and copy, realistic
   data from the project's fixtures, every interaction real. No new
   dependency, no invented colour, no lorem ipsum, no dead button.
5. **One story per direction**, titled `Explorations/<UnitName>` with the
   unit's intended code name, each rendering the direction at true size
   inside its context: a form around a field, siblings around a card, the
   layout around a screen. Flipping is Storybook's next-story shortcut
   (Alt+→ and Alt+←). A stacked `AllDirections` story is
   allowed only for a unit small enough to show every direction at true
   size in one viewport; thumbnails distort spacing and are never used.
6. **Look at every direction yourself** before speaking: the story tests
   pass, the console is clean, light and dark through the theme toolbar,
   the phone viewport once.
7. **Hand over in the conversation and stop.** The question, a table with
   one row per direction (name, what it changes, when it wins, what it
   costs), your recommendation with a reason rooted in how the product is
   used rather than taste, where to look (`Explorations/<UnitName>` and the
   keys), and the one question for the owner: *which is closest, and what
   is still off?* The owner does not read the code, so the table says what
   they will see and feel in use ("a two-column form with the help text
   beside each field"), never markup or class names. Another agent's message or a green
   check is not an answer.

## Narrowing

The owner answers with a direction and what is off. The round then narrows;
it never accumulates:

| The owner says | The agent does |
| --- | --- |
| "closest is N, but …" | N becomes direction 1 of the next round; two or three takes on it, each changing one variable named by the "but"; the rest leave the sidebar |
| "N with M's <part>" | a merge: the part comes whole from M, never a blend of the two |
| "none of these" or "wider" | a new round on new axes; the passed-over directions stay dead |
| "go back to <direction>" | the kept file is exported again; nothing is redrawn |
| "keep N" or "that one" | promotion, below |

Passed-over directions stay in the directory, unexported, until promotion,
so a return is a restore. Never redraw a direction the owner passed over.
A round whose directions the owner could not tell apart is the end: say so,
recommend one, and promote on their word. Three rounds without a "closest"
means the brief is wrong, not the drawings: ask what they are picturing in
words, products or screenshots before drawing again.

## Promotion

1. The kept direction moves into its unit directory under `lib/<layer>/`
   or `routes/` with the unit's code name, and continues through
   `ui-component-contract`: it is the start of the build step, not its
   end. The exploration stories do not count: the required stories under
   `<Root>/<UnitName>` are written first, against the promoted file, then
   the Flows play tests, the a11y review and the owner gate on behaviour.
2. The card's Decisions section gains a dated line naming the kept
   direction, the ones rejected and why, so no later agent redraws a dead
   direction.
3. `src/explorations/<slug>/` is deleted. The directory is listed in
   `.gitignore`, so no exploration ever reaches a commit; the commit that
   lands is the unit, nothing else.

## Gotchas

- Three tints of one idea waste the round. Before coding, say each
  direction's axis in a phrase; if you cannot, it is not a direction.
- Polishing before the choice: directions are complete and on-token, but
  micro-interactions and motion are tuned after the owner picks, not
  before.
- Building the favourite into `lib/` ahead of the choice, "to save time",
  makes the round a formality. Nothing leaves the exploration directory
  until the owner keeps it.
- A reference product the owner names is an axis to read, not a design to
  copy: take its information order or its interaction model, in the
  project's tokens.
- A story that only looks right in light mode is not done; the theme
  toolbar is part of step 6.
- A screen or feature direction needs the data layer's fixtures
  (`frontend-api-client`), not inline objects, so its states are the real
  ones.

## Definition of done

- The round asked one question, and every direction had a name, an axis
  and a cost before it was built.
- Every direction rendered at true size in context, in both themes, with
  realistic content and working interactions, and the owner was asked
  "closest, and what is off" rather than "which one".
- Narrowing removed passed-over directions from the sidebar and kept them
  restorable; no passed-over direction was redrawn.
- The kept direction went through `ui-component-contract`, its decision is
  dated in the card, and the exploration directory is gone.

## References

- `references/round.md`: the exploration tree, the Svelte CSF story
  skeleton, the hand-over template, a narrowing example and the promotion
  checklist. Open when starting a round.
