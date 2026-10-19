---
name: create-skill
description: Use when creating, scaffolding, or reviewing an Agent Skill (a SKILL.md-based capability) at the personal or project level, or when the user mentions the Agent Skills open standard, agentskills.io, or wants a reusable procedure turned into a skill. Guides correct placement under .agents/skills (mirrored into .claude/skills for Claude Code), SKILL.md frontmatter/naming rules, and description wording that triggers reliably. Not for one-off subagent definitions or slash-command-only files with no reusable procedure.
metadata:
  author: copierson
  standard: agentskills.io
---

Every skill created here follows the open [Agent Skills standard](https://agentskills.io) so it works across Claude Code, VS Code/Copilot, Codex, and other compatible agents — not just this tool.

## Canonical location

Skills live under `.agents/skills/`, never directly under `.claude/skills/`:

- **Personal** (all projects): `~/.agents/skills/<name>/SKILL.md`
- **Project** (this repo only): `<repo>/.agents/skills/<name>/SKILL.md`

Claude Code itself only scans `~/.claude/skills/` and `<repo>/.claude/skills/`, but it follows symlinks there ([docs](https://code.claude.com/docs/en/skills)). So after creating a skill under `.agents/skills/`, symlink it into the matching `.claude/skills/` directory:

```bash
# Personal
mkdir -p ~/.claude/skills
ln -s ~/.agents/skills/<name> ~/.claude/skills/<name>

# Project (relative symlink so it survives repo moves/clones-with-copy)
mkdir -p .claude/skills
ln -s ../../.agents/skills/<name> .claude/skills/<name>
```

`.agents/skills/<name>` is the source of truth; `.claude/skills/<name>` is just a discovery pointer. Never write skill content directly into the `.claude/skills` copy.

## Steps to create a new skill

1. **Pick a name**: lowercase letters, digits, hyphens only; 1-64 chars; no leading/trailing/consecutive hyphens; must match the directory name exactly.
2. **Scaffold the directory**:
   ```
   .agents/skills/<name>/
   ├── SKILL.md          # required
   ├── scripts/           # optional: executable helpers
   ├── references/        # optional: docs loaded on demand
   └── assets/             # optional: templates, static resources
   ```
3. **Write frontmatter** — `name` and `description` are required. See `references/specification.md` for the full field table (`license`, `compatibility`, `metadata`, `allowed-tools`) and exact constraints.
4. **Write the description to trigger reliably**: imperative ("Use this skill when..."), state user intent not implementation, list both obvious and non-obvious trigger phrases, and state what it's *not* for if there's a near-miss risk. Max 1024 chars. See `references/description-writing.md` before finalizing wording — description quality is the single biggest lever on whether the skill actually gets used.
5. **Write the body** for an agent that already knows general concepts — only include what it wouldn't already know (project conventions, gotchas, exact commands, non-obvious edge cases). Keep `SKILL.md` under ~500 lines / 5000 tokens; push detailed reference material, templates, and schemas into `references/` or `assets/` and tell the agent when to load each one. See `references/best-practices.md` for patterns (gotchas sections, templates, checklists, validation loops, plan-validate-execute).
6. **Symlink into `.claude/skills/`** as shown above so Claude Code discovers it (other tools may need their own equivalent — check their docs before assuming `.agents/skills/` is auto-discovered).
7. **Sanity-check**: read the finished `SKILL.md` back and ask "would an agent that has never seen this before know exactly when and how to use it?" Try 2-3 realistic prompts that should trigger it and 1-2 near-miss prompts that shouldn't.

## Gotchas

- `name` in frontmatter must match the parent directory name exactly — a mismatch is a spec violation even if the skill still loads in some clients.
- Don't skip the `.claude/skills` symlink step — a skill that only exists under `.agents/skills/` will not be discovered by Claude Code on its own.
- Don't duplicate the skill folder into `.claude/skills/` (copy instead of symlink) — that forks the content and the two copies will drift.
- A vague description ("Helps with X") is the most common reason a skill silently never triggers — always name concrete trigger phrases and use cases.
- Not every reusable instruction needs to be a skill — if it's a single fact or short preference, a memory or CLAUDE.md note may fit better than a whole skill package.

## Reference files

- `references/specification.md` — full SKILL.md frontmatter spec (fields, constraints, directory structure, progressive disclosure, validation).
- `references/best-practices.md` — how to scope a skill and write its body (gotchas sections, templates, checklists, validation loops).
- `references/description-writing.md` — how to write and test descriptions that trigger reliably, including an eval-query methodology.
