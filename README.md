# skills

The skills shared by every one of my repositories, in the
[Agent Skills](https://agentskills.io) shape: one directory per skill with a
`SKILL.md`. Status: the source of truth; projects vendor copies.

## Use

A project copies the skills it uses and records what it copied:

    ../skills/scripts/sync -C . project-docs sound-patterns

That writes a copy of each skill under the project's `.agents/skills/`, the
checkers under its `scripts/` (skillscheck always, docscheck with
project-docs), and a lock file, shared.sum, beside the
skills, naming this repository's commit and a content hash per path. The project's Makefile
gets two targets, and `ci` includes the second:

    skills-sync:  ../skills/scripts/sync -C .
    skills-check: go run ./scripts/skillscheck

`skills-check` needs nothing but the project, so CI runs it. A vendored copy
edited in place fails it: shared skills are edited here, committed, and
synced out. A repository that needs to differ writes a small skill of its
own saying what differs and why.

On this machine `~/.agents/skills/<name>` links here for personal use, and
`~/.claude/skills/<name>` links to that; `create-skill` has the rules.

MIT licence.
