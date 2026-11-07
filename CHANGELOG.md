# Changelog

All notable changes to this repository. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `storybook-layout`: the one Storybook sidebar shape: fixed roots in a fixed order, one entry per unit by its code name with `Default` first, extra files only as `Flows`, `Examples` or a named part, and every screen under `Screens`.

## [0.2.1] - 2026-11-05

### Fixed

- docscheck follows `include`, `-include` and `sinclude` lines, so `make` targets defined in a vendored `mk/gates.mk` count as the project's own.
- CI names the Node test files, which Node 22 needs.

## [0.2.0] - 2026-11-05

### Added

- `skillscheck -sum <file>` verifies a lock file other than `shared.sum`, and hashing accepts a single file, so a project can vendor go-scaffold's gate kit and check it the same way. Existing sums are unchanged.

### Changed

- PostgreSQL, OpenAPI-first HTTP, a container image and the `internal/modules` layout are defaults a project's `AGENTS.md` may override, not rules. `golang-database` allows SQLite through `database/sql`; `repo-tooling` and `release` cover GoReleaser/systemd packaging and `buf breaking`; `go-project-layout` and `contract-spec` accept a flat `internal/`.

## [0.1.1] - 2026-11-05

### Changed

- `backlog-batches` run-sheet example, `project-docs` sources and docscheck test strings no longer name local paths or other repositories.

## [0.1.0] - 2026-11-05

First tagged release.

### Added

- `plan-feature`: one plain-English plan the owner accepts (outcome, decisions with recommendations, per-layer stories in landing order: schema, API contract, backend, components, view, end-to-end) before anything is filed.
- `contract-spec`: draft a module or cross-module flow contract, get it accepted as a summary, then move the contract into code and cut the module spec to its purpose.
- `iterate`: the small path for changing existing code; no new spec, a gate only when a contract moves.
- `api-contract`: spec-first OpenAPI, additive changes in `/api/v1`, breaking changes in a new version with `Sunset`, `oasdiff` in CI, RFC 9457 errors.
- `golang-database`: pgx/v5 repositories, transactions and queue claims, reversible migrations with expand/contract.
- `go-project-layout`: `cmd/`, `internal/app` composition root, `domain` and `platform` leaves, modules, consumer-side interfaces.
- `repo-tooling`: Makefile targets, pinned toolchain, multi-stage Dockerfile on rfizzle/images, Compose, CI and Renovate.
- `release`, `service-operations`: SemVer releases and changelogs; health, logs, metrics, flags, runbooks and restore drills.
- `ui-patterns`, `ui-component-contract`, `design-tokens`, `a11y-review`: framework-neutral UI development and UX patterns.
- `scripts/sync -r <tag>` vendors a release tag instead of the working tree.
- `scripts/validate-skills.mjs`, a Makefile with `make check`, and CI.

### Changed

- `project-docs` is reorganised around contracts living in code; it absorbs the former `repo-align` as `references/align.md` and uses date-slug decision ids.
- `golang-spf13-cobra`, `golang-spf13-viper` and `golang-design-patterns` are cut to the rules a model would not follow unprompted.
- `golang-testing` names tests for the behaviour they prove.
- `create-skill` says when a skill is worth writing and how to keep it small.

### Removed

- `repo-align` (now part of `project-docs`).
