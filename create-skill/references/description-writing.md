# Writing descriptions that trigger reliably (condensed)

Full source: https://agentskills.io/skill-creation/optimizing-descriptions

The `description` field is the *entire* basis for whether an agent decides to load a skill — at startup, agents see only `name` + `description` for every skill. Get this wrong and the skill is dead weight, whether too narrow (never fires) or too broad (fires on unrelated tasks and pollutes context).

Note: agents generally only reach for a skill when the task needs specialized knowledge beyond what they can already do — a trivially simple request may not trigger a skill even with a perfect description, because the agent just handles it directly.

## Principles

- **Imperative phrasing**: "Use this skill when..." not "This skill does...". You're telling the agent when to act, not describing internals.
- **User intent, not implementation**: describe what the user is trying to achieve, since that's what the agent matches against.
- **Err pushy**: explicitly enumerate trigger contexts, including ones where the user won't name the domain directly ("even if they don't say 'CSV' or 'analysis'").
- **Concise**: a few sentences to a short paragraph. Hard limit 1024 characters.
- **Name the boundary** when there's a plausible near-miss (e.g. "not for X, which is handled by Y") — this is what keeps a broad-sounding skill from over-triggering.

Before/after example:

```yaml
# Before
description: Process CSV files.

# After
description: >
  Analyze CSV and tabular data files — compute summary statistics,
  add derived columns, generate charts, and clean messy data. Use this
  skill when the user has a CSV, TSV, or Excel file and wants to
  explore, transform, or visualize the data, even if they don't
  explicitly mention "CSV" or "analysis."
```

## Testing methodology (for skills worth the investment)

1. Write ~20 eval queries: 8-10 that *should* trigger, 8-10 that *should not*.
   - Should-trigger: vary phrasing/formality/typos, some name the domain explicitly, some don't, mix terse and detail-heavy, mix single-step and buried-in-a-larger-task.
   - Should-not-trigger: prioritize **near-misses** — queries sharing keywords/concepts but needing something genuinely different (weak negatives like "what's the weather" test nothing).
2. Run each query 3x against the real agent, observe whether the skill was consulted (tool-call trace, verbose logs). Compute a trigger rate per query; pass threshold is typically rate > 0.5 for should-trigger, < 0.5 for should-not-trigger.
3. Split queries 60/40 train/validation up front and keep the split fixed. Only look at train-set failures when revising the description; check validation separately to catch overfitting.
4. Revise by generalizing the *category* a failing query represents — don't just paste in its literal keywords.
5. Repeat ~5 iterations; pick the version with the best validation pass rate, which may not be the last one.

For a lower-effort skill, skip the formal eval and just sanity-check manually: try 2-3 prompts that should trigger it and 1-2 near-misses that shouldn't, before finalizing.
