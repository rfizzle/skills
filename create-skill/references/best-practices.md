# Skill authoring best practices (condensed)

Full source: https://agentskills.io/skill-creation/best-practices

## Start from real expertise, not generic LLM knowledge

Skills generated purely from an LLM's general training produce vague procedures ("handle errors appropriately"). Ground skills in real expertise:

- **Extract from a hands-on task**: do the real task in conversation first, note what worked, what corrections were needed, the actual input/output formats — then extract the reusable pattern.
- **Synthesize from existing artifacts**: runbooks, incident reports, API specs, code review comments, git history of fixes. Project-specific material beats generic best-practice articles.

## Refine with real execution

Run the skill on real tasks, feed results (not just failures) back in. Read execution traces, not just outputs — wasted steps usually mean instructions were too vague, didn't apply but were followed anyway, or presented too many options without a clear default.

## Spend context wisely

- **Add what the agent lacks, omit what it knows.** Don't explain what a PDF is; do explain which library to use and why, and the exact API calls.
- **Design coherent units.** Scope like a function: not so narrow that a task needs many skills loaded at once, not so broad it's hard to activate precisely.
- **Aim for moderate detail.** Concise stepwise guidance with a working example beats exhaustive documentation. Let the agent's own judgment handle most edge cases; only call out the ones that actually trip agents up.
- **Use progressive disclosure for large skills.** Keep `SKILL.md` under ~500 lines / 5000 tokens. Tell the agent exactly when to load each reference file ("Read references/api-errors.md if the API returns non-200"), not just "see references/ for details."

## Calibrate control to fragility

- **Give freedom** when multiple approaches are valid — explain *why*, not just *what*, so the agent can adapt.
- **Be prescriptive** when operations are fragile or order-dependent — give an exact command, say "do not modify."
- **Provide defaults, not menus** — pick one tool/approach as default, mention the alternative briefly for the edge case, don't list four options as equals.
- **Favor procedures over declarations** — teach "how to approach this class of problem" (read schema → join on convention → apply filters → aggregate), not "the answer to this one instance."

## Reusable content patterns

- **Gotchas section**: concrete, environment-specific corrections the agent would otherwise get wrong (field name mismatches across systems, misleading health-check semantics, soft-delete filters). This is often the highest-value part of a skill. Keep gotchas in `SKILL.md` itself, not a reference file the agent might not think to open.
- **Templates for output format**: a concrete template beats a prose description of the format. Short ones inline in `SKILL.md`; long or conditional ones in `assets/`.
- **Checklists** for multi-step workflows with dependencies/validation gates.
- **Validation loops**: do the work → run a validator → fix → repeat until it passes.
- **Plan-validate-execute**: for batch/destructive operations — build a plan file, validate it against a source of truth, only then execute. The validator's error messages should give the agent enough info to self-correct (e.g. "Field 'x' not found — available fields: a, b, c").
- **Bundle scripts** when you notice the agent reinventing the same logic every run (parsing a format, building a chart) — write it once, tested, in `scripts/`.

## Iterating on a correction

When an agent makes a mistake you have to correct, add that correction to the skill's gotchas section immediately — this is one of the most direct ways to improve a skill over time.
