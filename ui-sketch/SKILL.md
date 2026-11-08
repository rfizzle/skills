---
name: ui-sketch
description: Use this skill when a new screen, feature, composition or component is being groomed and its look, structure or information order is not yet decided, when the owner wants to see directions before anything is built in the codebase ("show me some options", "sketch it", "what would this page look like", "mock it up", "closer to the second one", "that one but calmer"), or when a plan-feature story for a new UI unit reaches grooming. Holds the sketch round outside the codebase: three or four directions that disagree on a named axis, each a static HTML fragment on the project's tokens with real copy, in one page with direction tabs, desktop and phone widths, the five async states, both themes, the round table and a recommendation, narrowing on "closest, and what is still off" until one is kept as the brief for ui-component-contract. Not for redesigning a shipped unit (ui-exploration, in Storybook), the card and stories (ui-component-contract), the tokens (design-tokens), or the API shape (api-topology).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# UI sketch

Deciding what a new screen should be by building three Svelte components in
the codebase costs a dev server, a Storybook, a checkout the owner can see,
and three complete implementations before the first question is answered.
The `ui-exploration` round is the right rigour for redesigning a unit that
ships; for a unit that does not exist yet, the choice comes first and the
code later. A sketch round is the same round, outside the codebase: static
fragments on the project's tokens, one page the owner opens anywhere, the
same table and the same question. The kept direction is a brief, never
code to promote.

## When a round runs

- A `drafted` story for a new component, composition, feature or screen,
  at grooming (`groom`), before `ui-component-contract` writes the card.
- The owner asks to see options for something that does not exist yet.
- Skip it when the owner has said what the unit looks like, or when the
  change has one right answer; a redesign of a shipped unit goes to
  `ui-exploration` in Storybook, where it renders on the real components.

## Procedure

1. **Settle the question.** One line: what this round decides. If the
   epic has a flow map, the screen's steps and states come from it; the
   sketch shows the screen at those moments.
2. **Read the ground.** The tokens (`design-tokens`), the components the
   unit will compose (`ui-patterns`), the neighbours it renders beside,
   the product's tone and copy, the longest real content it must hold.
3. **Name the directions before drawing.** Three by default, four when the
   question is wide, never more than five. Each has a descriptive
   PascalCase name and an axis: layout, information order, density,
   interaction model, tone. The check refuses letters as names and warns
   when two directions share an axis.
4. **Write the round** under `.agents/sketches/<slug>/`, from
   [references/round.md](references/round.md): `sketch.json`, `tokens.css`
   copied from the project's token layer as plain `:root` declarations with
   a `.dark` or `[data-theme="dark"]` override, and one fragment per
   direction. A fragment is HTML and CSS only, uses token variables and
   never a literal colour, carries the product's real copy and realistic
   data, and marks its async variants with `data-state="loading"`,
   `empty`, `error`, `partial` beside the `filled` default. The directory
   is excluded through `.git/info/exclude`; nothing here is committed.
5. **Check and render.** `node .agents/skills/ui-sketch/scripts/check.mjs
   <sketch.json>`, then `render.mjs` for the page and `render.mjs --text`
   for the hand-over table.
6. **Look at every direction yourself**: desktop and phone, every state,
   light and dark. A direction that only works filled on desktop is not
   finished.
7. **Hand over and stop**, as `ui-exploration` does: the question, the
   table (name, what it changes, when it wins, what it costs), one
   recommendation with a reason from how the product is used, where to
   look, and "which is closest, and what is still off?".

## Narrowing and keeping

The owner's answer narrows the round as `ui-exploration` lays out: the
closest direction stays, two or three takes on it change one variable each
(`from` names the parent), passed-over directions get `status: passed` and
stay on disk, a merge takes the part whole from the other direction. On
"keep N": `status: kept`, a dated `decisions` entry naming what was passed
over and why, one last render, and the story's reference gains the kept
direction's row of the table, the decision line and the page's location.
`ui-component-contract` then writes the card from that brief; the sketch
directory is deleted once the card exists.

## Gotchas

- A fragment with a `<script>` is a prototype, not a sketch; hover and
  open states are CSS, anything else is a sentence in `changes`.
- Loading a font or an image from the network makes the page depend on it;
  inline or omit.
- Three tints of one idea waste the round; the axis says what differs.
- A sketch that ignores the longest real content (a 60-character product
  name, a 12-line address) settles nothing; put the hard case in.
- Do not polish the favourite; micro-interactions come after the choice,
  in the real component.

## Definition of done

- The round asked one question; every direction had a name, an axis and a
  cost before it was drawn.
- Every direction rendered at both widths, in every state, in both themes,
  on the project's tokens with real copy.
- The owner answered "closest, and what is off", the kept direction is
  recorded in the story and in `decisions`, and the sketch directory is
  gone once the card exists.

## References

- [references/round.md](references/round.md): the directory, `sketch.json`
  field by field, the fragment rules and the example round
  (`scripts/example/`).
