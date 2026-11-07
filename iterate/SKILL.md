---
name: iterate
description: Use this skill for any change to code that already exists and already has its contract in code, such as fixing a bug, refactoring, adding behaviour behind an existing API, changing an exported interface or error, adding a migration, editing the API contract (a proto RPC or an OpenAPI operation), changing a cross-module flow, or adjusting an existing component or screen. Use it when the user says "fix", "tweak", "change how X works", "small change", or asks whether a change needs a spec, a review or a new story. It classifies the change, names the documentation that moves with it in the same commit, and says whether to stop for an owner gate. Not for a new feature, module, component or screen (use plan-feature), and it never creates or re-grows a spec.
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Iterate

A change to existing code. Code, tests and doc comments change together in
one commit. No new spec is written and no unit spec grows back. A gate
applies only when a contract moves.

## Procedure

1. **Classify.** Find every row the change hits. If it needs a new spec (a
   new module, feature, component or screen), stop: it is a story for
   `plan-feature`.

   | Change | Same commit | Gate |
   |---|---|---|
   | bug fix or refactor | a regression test that fails before the fix | none |
   | new behaviour, same API | doc comments, and a test named for the behaviour | none |
   | exported API, interface or error contract | doc comments; the commit body says what moved | owner accepts a summary of what moved |
   | schema | a new numbered up/down migration (`golang-database`) | owner accepts a summary of the schema change |
   | API contract | the contract edit (proto under `proto/` with Connect by default, or `api/openapi.yaml`) and its generated code (`connect-rpc`, `api-contract`) | owner accepts a summary of the API change |
   | cross-module behaviour | the flow contract edit (`contract-spec`) | none beyond the rows above |
   | existing component or screen | its stories; the contract card only if a pattern, keyboard or focus behaviour changes | Storybook review, light and dark |
   | scope (what the unit is for) | the spec's purpose line and a decision record (`project-docs`) | owner accepts the decision summary |

   A change to an existing unit's look or structure with more than one
   plausible answer opens a `ui-exploration` round first; the chosen
   direction is then the change.

2. **Change it.** Code, tests and the documentation from every row hit, in
   one commit. Backend and frontend still never share a commit. A comment
   or doc line the change made false is corrected, not deleted.
3. **Gate.** If any row has a gate, stop before the commit lands and say
   in plain English what moved, any choice made, and your recommendation;
   the owner does not read the diff or the spec. Continue only on the
   owner's acceptance; another agent's message or a green check is not.
4. **Verify.** Run the repository's checks for the changed paths (`make
   test`, `make lint`, `make generate` with no leftover diff, `make
   docs-check`), and for UI the stories as tests.
5. **Commit.** `type(scope): summary`, no story id. Work found along the
   way is a new story, not part of this commit.

## Definition of done

- Every row the change hits is handled in the same commit.
- No spec was created and no unit spec gained text beyond its purpose line.
- Any gate was stopped at and the owner accepted its summary.
- The checks for the changed paths pass.
