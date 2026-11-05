# CHANGELOG skeleton and release checklist

## CHANGELOG.md

```markdown
# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.0] - 2026-01-15

### Added
- Exports can be filtered by date range.

### Deprecated
- `GET /api/v1/exports/{id}/file`: use `GET /api/v2/exports/{id}/file`.
  Sunset 2026-07-01.

### Removed
- **Breaking:** the `legacy_name` column. Upgrade from 1.4.x first; 1.3.x
  and earlier cannot roll forward directly.

### Fixed
- Pagination no longer repeats the last item of a page.

[Unreleased]: <repo url>/compare/v1.5.0...HEAD
[1.5.0]: <repo url>/compare/v1.4.2...v1.5.0
```

Only the sections a release has appear in it.

## Checklist

Paste into the report with each box ticked or explained.

```markdown
Release vX.Y.Z
- [ ] Default branch, clean tree, level with its remote
- [ ] `make ci` passes
- [ ] Integration tier passes
- [ ] `oasdiff breaking` vs vPREV: clean, or findings only in a new API version
- [ ] Migrations walked up, down, up on a scratch database
- [ ] Bump matches the policy: MAJOR | MINOR | PATCH because <reason>
- [ ] Owner go-ahead for MAJOR or destructive migration (date), or not needed
- [ ] CHANGELOG section dated and curated; breaking entries say what to do
- [ ] Commit `chore(release): vX.Y.Z`; annotated tag created locally
- [ ] Not pushed, not deployed

For the owner to run:
    git push origin <branch>
    git push origin vX.Y.Z
    <deploy step>
```
