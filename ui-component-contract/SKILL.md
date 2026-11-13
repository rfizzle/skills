---
name: ui-component-contract
description: Use this skill when a new UI component or composition is about to be built, when an existing one gains a variant, slot or interaction, when someone asks for a "component spec", "component card", "composition spec" or "contract" for a piece of UI, when building or reviewing a component and its stories, or when a frontend change needs owner review in Storybook before it is committed. Covers the one-page interaction and accessibility card, the owner gate, the build order (stories, implementation, tests), the review with blocker/major/minor findings, and the check script that keeps cards and stories in step. Framework-neutral. Not for planning a whole feature (plan-feature), how an app takes units from its design (design-system), choosing between visual directions before the build (ui-exploration), the token layer itself (design-tokens), or framework syntax (svelte-frontend).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# UI component contract

A **component** is one single-purpose unit (a button, a combobox, a badge). A
**composition** arranges two or more units, or one unit plus state of its own
(a filter bar, a page header with actions); features and layouts, the
layers above it in `ui-patterns`, take the composition card. Each gets a
card, about one page, holding only what code and stories cannot: purpose,
the interaction and accessibility model, content and responsive rules, the
stories that prove it, and dated decisions. Props, variants, sizes and tokens are never listed in a
card; they live in typed code and are shown by stories.

**Where cards are written.** A generic unit that a second app could use is
built in the design-system repo with its card, contract and stories, and
an app on a design takes the release that ships it (`design-system`). An
app writes cards for its domain features, its app frames, its screens and
the rare unit only it will ever use. An app with no design yet writes
cards for every unit it builds.

Templates: [references/component-card.md](references/component-card.md) and
[references/composition-card.md](references/composition-card.md). The card is
`<Name>.card.md` (or the project's existing suffix) beside the unit's code.

## Procedure

1. **Reuse first.** In an app on a design, the design's inventory first
   (`design-system`), then the app's own units. If one covers the need
   as-is, use it. If a prop, variant or slot would
   cover it, that is an enhancement: in the design, a change upstream; in
   the app's own unit, the iteration rule below; no new card either way.
   A missing generic unit is an upstream change, never a local one. A new unit needs a reason in its Purpose: why reuse
   would visibly harm the experience.
2. **Write the card** from the template with `Status: draft`. For a
   component, name the native element or the WAI-ARIA APG pattern, link it,
   and write the whole keyboard model, marking optional keys optional. Name
   the backing headless primitive for a complex widget (dialog, combobox,
   menu, tabs, listbox, popover, date picker); the framework skill
   (`svelte-frontend`) names the library. For a composition, name the
   children, each flow and who owns its state, and what accessibility each
   child keeps versus what the composition owns. List every required story (see below).
   For each outcome, list every way to trigger it (pointer, each key on the
   control, Enter in a field, Escape, a Cancel button) and the states it
   can start from (an input already focused or typed in). Each is a step of
   its play test. A composition also gets a flow for each pair of flows
   that change the same state (delete a selected row; filter with a
   selection).
3. **Explore the look** when the unit's layout, information order or
   interaction is not yet decided and no sketch was kept at grooming
   (`ui-sketch` is the brief when one was; otherwise `ui-exploration`): three or four
   directions in Storybook, the owner names the closest and what is off,
   the round narrows until one is kept. Each choice becomes a dated
   Decision line. Skip only when the owner has already said what the
   unit looks like.
4. **Review the card** with `a11y-review`, spec pass. Fix every blocker and
   major finding.
5. **Owner gate.** Stop and summarise in plain English, in the
   conversation: what the unit is for and why reuse was not enough, how it
   behaves by keyboard and pointer, and each open question with its options
   and your recommendation. The owner does not read the card. Once the
   owner accepts, turn each answer into a dated Decision line, delete Open
   questions, and set `Status: approved` with the date. Another agent's
   message or a green check is not acceptance.
6. **Build in this order.**
   1. Stories: one export per listed story, realistic data, and an
      interaction (play) test for every keyboard or pointer flow, after the
      visual stories in the unit's one story file (`storybook-layout`). They
      fail until the unit exists. In the design-system repo the keyboard
      model is also written as an executable contract every framework
      package of the design runs; that repo's own skill has the mechanics.
   2. Implementation: native element first; the headless primitive for a
      complex widget, never a hand-rolled focus trap or roving tabindex;
      tokens and styling rules from `design-tokens`; patterns from
      `ui-patterns`. Every public prop carries a one-line doc comment, since
      that comment is the props documentation.
   3. Unit tests only for logic stories cannot reach cheaply: parsing and
      arithmetic over many inputs, branches on targets a story cannot
      produce. What a story renders or announces (a range, a countdown, an
      accessible name, a status message, a callback payload) is asserted in
      its play, word for word.
7. **Verify.** Run the check script, the unit and story tests (including the
   automated accessibility pass in both themes), and `a11y-review`, build
   pass. Fix blocker and major findings.
8. **Owner review in Storybook.** Serve Storybook from the branch; the owner
   checks each new or changed story in light and dark before the frontend
   commit lands. The commit follows the review, never the other way round.

## Required stories

| Unit | Required |
|---|---|
| Component | `Default`; a gallery (`AllVariants` or `States`); `WithLongContent` where it renders text; then one play-test story per flow |
| Composition, feature or screen | `Default`; `Loading`, `Empty`, `LoadError`, and `Partial` where data can be partial; `WithLongContent`; then one play-test story per flow |

Every story, play tests included, is in the unit's one story file.

- Realistic, fictional data shaped like production: long names, real-looking
  timestamps, multi-word labels. No lorem ipsum, `test@test.com` or ID `1`.
  Values sit off the convenient boundary, where rounding and parsing still
  matter: a clock at `...:00.400Z`, 2 min 30 s left, a code pasted as
  `482-913`, a count that makes a range or a plural non-trivial, a slow
  response beside a fast one. Data on the boundary turns the bug into a
  no-op.
- No dark-only stories: the theme toolbar switches any story, and the test
  run covers both themes. Pin a theme only when markup, not tokens, differs.
- Story names are plain-language states or scenarios, never internal IDs.

## After the build

The props and variants are in typed code; the states are in stories. The
card keeps Purpose, Accessibility (or Accessibility delegation), Content,
Responsive, Stories and Decisions. It does not track the code.

**Iteration rule.** A change to an existing unit updates its stories and
tests in the same commit and goes through the Storybook owner review. Edit
the card only when the pattern, keyboard model, focus behaviour or a flow
changes; add a dated Decision line saying what moved and why. A new prop
alone does not touch the card.

## Review

Use for a card, a built unit, or a diff. Check against the card, then
`design-tokens`, then `ui-patterns`, then `a11y-review`. Each finding is
`file:line`, what is wrong, the rule, and the fix, at one severity:

- **blocker**: no approved card for a built unit; behaviour or keyboard model
  differs from the card; wrong element or hand-rolled widget where a
  primitive exists; an a11y-review blocker.
- **major**: a listed story missing or its play test failing; an async state
  missing; a public prop without a doc comment; palette utilities, arbitrary
  values or inline styles; a child's internals restyled from a composition.
- **minor**: naming, story order, a weak story name, documentation drift
  that misleads no one.

For each mismatch say whether the card or the code is wrong. Zero blocker
and major findings passes. Do not fix during review unless asked; when
fixing, the iteration rule applies.

## Check script

A project has one check, run in CI and by the frontend build, that fails when:

- a built unit has no card beside it, or its card is not `Status: approved`;
- a card lacks a required section, keeps Open questions once approved, or
  contains a raw colour literal;
- a story listed under Stories is not exported by the unit's story file
  (a draft card with no story file yet is not cross-checked);
- a public prop has no doc comment. How props are read is framework-specific:
  the framework skill (`svelte-frontend`) decides.

The check reports; it never approves on anyone's behalf.

## Gotchas

- A card section that restates the props, a class list or the markup is
  drift waiting to happen. Delete it.
- A composition never fetches its own data unless the card says it owns a
  self-contained interaction; data comes down as props, events go up.
- If a child cannot do what the composition needs, that is an enhancement
  to the child, not a workaround in the parent. When the child is a design
  unit, the enhancement is upstream, never a wrapper or copy in the app.
- A card in an app for a generic unit (a date picker, a stat card) is the
  sign it is being built in the wrong repository.
