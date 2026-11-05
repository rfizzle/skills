# skills

The skills shared by every one of my repositories, in the
[Agent Skills](https://agentskills.io) shape: one directory per skill with a
`SKILL.md`. Status: the source of truth; projects vendor copies.

Defaults unless a project's `AGENTS.md` names another choice: PostgreSQL with
pgx, OpenAPI-first HTTP, a container image from
[rfizzle/images](https://github.com/rfizzle/images). Always: Go, Linux,
Renovate, a Makefile as the command interface, Tailwind CSS 4 when there is a
UI. Frontend skills are
framework-neutral; Svelte and React mechanics belong to framework skills.

## Skills

| Area | Skills |
| --- | --- |
| Planning and process | `plan-feature`, `contract-spec`, `iterate`, `backlog-batches`, `release` |
| Repository and docs | `project-docs`, `go-project-layout`, `repo-tooling`, `service-operations`, `create-skill`, `sound-patterns` |
| API and data | `api-contract`, `golang-database` |
| Go | `golang-testing`, `go-conformance-suite`, `golang-concurrency`, `golang-context`, `golang-error-handling`, `golang-design-patterns`, `golang-observability`, `golang-security`, `golang-performance`, `golang-benchmark`, `golang-troubleshooting`, `golang-spf13-cobra`, `golang-spf13-viper` |
| UI | `ui-patterns`, `ui-component-contract`, `design-tokens`, `a11y-review` |

A skill exists because something went wrong without it. It holds what a
capable model would not do unprompted; a rule a machine can check becomes a
check in the project instead. `create-skill` has the bar.

## Use

A project copies the skills it uses and records what it copied, pinned to a
release tag:

    ../skills/scripts/sync -C . -r v0.1.0 project-docs sound-patterns

That writes a copy of each skill under the project's `.agents/skills/`, the
checkers under its `scripts/` (skillscheck always, docscheck with
project-docs), and a lock file, shared.sum, beside the skills, naming the tag
(or, without `-r`, this repository's HEAD commit) and a content hash per path.
The project's Makefile gets two targets, and `ci` includes the second:

    skills-sync:  ../skills/scripts/sync -C . -r <tag>
    skills-check: go run ./scripts/skillscheck

`skills-check` needs nothing but the project, so CI runs it. A vendored copy
edited in place fails it: shared skills are edited here, committed, released
and synced out. A repository that needs to differ writes a small skill of its
own saying what differs and why.

On this machine `~/.agents/skills/<name>` links here for personal use, and
client-specific skill directories link to that; `create-skill` has the rules.

## Changing and releasing

    make check    # go vet, Go and Node tests, and the skill validator

The validator checks frontmatter, size, links, that description pointers like
`(api-contract)` name a skill that exists, and that skills stay client-neutral
(the few whose subject is client discovery are allowlisted in the Makefile).

Releases are SemVer tags with an entry in [CHANGELOG.md](CHANGELOG.md):
removing or renaming a skill is MAJOR (after 1.0), a new skill MINOR, a
wording fix PATCH. Projects move by re-running `skills-sync` with the new tag.

MIT licence.
