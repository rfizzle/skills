---
name: release
description: Use this skill when cutting, preparing or reviewing a release of a service or library, when the user says "cut a release", "tag vX.Y.Z", "bump the version", "update the changelog", "write release notes", or asks whether a change is breaking, which SemVer number comes next, or how an API version, a removed field or a destructive migration affects the version. Covers SemVer tags, a Keep a Changelog CHANGELOG.md built from Conventional Commits, the release checklist, and the breaking-change policy tied to API versions and migrations. The agent prepares the release commit and the local tag and stops; pushing and deploying are left to the owner. Not for CI or image build setup (use repo-tooling) or post-deploy health checks and runbooks (use service-operations).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Release

A release is an annotated SemVer tag on the default branch, a dated
CHANGELOG section, and the artifacts CI builds from that tag (image, archives, packages). The agent prepares
it locally. **The owner pushes and deploys.** The agent stops before any
`git push`, tag push, pipeline trigger or deploy step, and reports the exact
commands instead.

## Version numbers

Tags are `vMAJOR.MINOR.PATCH` (`v1.4.2`), annotated, on the default branch.
Pre-releases are `v1.5.0-rc.1`. Before `v1.0.0` a breaking change bumps
MINOR and anything else bumps PATCH.

| Bump | When the release contains |
|---|---|
| MAJOR | removal of an API version past its sunset; a removed or renamed config key, CLI flag or metric with no fallback; a migration that cannot run against the previous release's code |
| MINOR | a `feat`; a new API version beside the old; a deprecation; an expand migration; a new config key with a default |
| PATCH | only `fix`, `perf`, security fixes and internal changes |

## Breaking-change policy

- **HTTP API.** A breaking change (removed or renamed field, changed type
  or meaning, optional to required, changed error code or status) never
  ships in an existing version. It goes to a new API version (`/api/v2`, or a new proto package) for the affected
  resources; v1 stays, marked `deprecated: true` with a `Sunset` header.
  The API breaking check (`oasdiff breaking` or `buf breaking`) against the last tag must report nothing for
  existing versions (`api-contract`). Removing v1 after its sunset date is
  the MAJOR release.
- **Schema.** Renames, drops and type changes use expand and contract
  (`golang-database`): add, dual-write, backfill and switch reads in one
  release; drop in a later one. A release with a contract step lists it
  under **Removed** with an upgrade note. A destructive or long-locking
  migration goes to the owner before it is tagged.
- **Rollback.** Every migration in the release has a working down
  migration, and the previous release's code runs against the new schema.
  If either is false, the release is MAJOR and the notes say how to roll
  back.
- **Config and operations.** A renamed key reads the old one for a release
  and logs a deprecation; removing it is MAJOR.

## CHANGELOG.md

[Keep a Changelog](https://keepachangelog.com/en/1.1.0/): an
`## [Unreleased]` section at the top, then `## [X.Y.Z] - YYYY-MM-DD`
sections, newest first, with compare links at the bottom.

Draft it from the commits, then curate it for the reader:

```sh
git log --no-merges --format='%s' "$(git describe --tags --abbrev=0)"..HEAD
```

| Commit | Section |
|---|---|
| `feat` | Added |
| `feat` changing existing behaviour, `perf`, user-visible `refactor` | Changed |
| a deprecation | Deprecated |
| a removal, a contract migration | Removed |
| `fix` | Fixed |
| a security fix | Security |
| `test`, `ci`, `chore`, `build`, `docs`, internal `refactor` | omitted |

Rules: one line per change, written for an operator or API consumer; group
the commits of one epic into one entry; no story ids, hashes or author
names in entries (ids stay in commits and the tracker). A breaking entry
starts with **Breaking:** and says what to do. Template:
`references/checklist.md`.

## Procedure

1. Check the start: on the default branch, clean tree, up to date with its
   remote (`git fetch`, then compare; never pull or push without being
   asked).
2. `make ci` passes, the integration tier passes, and the API breaking check
   (oasdiff or `buf breaking`) against the last tag is clean or every finding is in a new API version.
3. Walk the release's migrations up, down and up again against a scratch
   database.
4. Pick the number from the bump table. If the release holds a destructive
   migration or a MAJOR change, stop and say in plain English what breaks
   or is destroyed, who is affected, the rollback, and your recommendation;
   continue only on the owner's go-ahead.
5. Move `[Unreleased]` into `## [X.Y.Z] - YYYY-MM-DD`, leave an empty
   `[Unreleased]`, update the compare links, bump any in-repo version
   source.
6. Commit `chore(release): vX.Y.Z` and create the annotated tag
   `git tag -a vX.Y.Z -m "vX.Y.Z"`.
7. **Stop.** Summarise the release in a few plain-English lines (what
   changed for users and operators, the bump and why, anything breaking),
   then give the commit, the tag, and the commands for the owner to run: `git push origin <branch>`,
   `git push origin vX.Y.Z`, and the deploy step. Do not run them.
8. After the owner deploys, the post-deploy checks are in
   `service-operations`.

## Definition of done

- The tag is annotated, SemVer, on the default branch's head, and local
  only.
- CHANGELOG has a dated section for it, curated, with no ids, and every
  breaking entry says what to do.
- The bump matches the table; any MAJOR or destructive change has the
  owner's go-ahead.
- `make ci`, the integration tier, the API breaking check and the migration walk passed.
- Nothing was pushed, triggered or deployed.

## References

- `references/checklist.md`: the CHANGELOG skeleton and the release
  checklist to paste into the report.
