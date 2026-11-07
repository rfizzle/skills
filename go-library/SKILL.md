---
name: go-library
description: Use this skill when writing, reviewing or releasing a Go module other code imports - a library, an SDK or API client, a package split out of a service to share, or a tool published for go install - and for the questions only a library has - what to export, how a constructor takes a logger or options, whether a change breaks importers, how to deprecate, when to cut v1 or move to /v2, how to retract a bad version, whether a public API should be generic. Triggers include "publish this package", "make this reusable", "is this breaking for callers", "gorelease", "apidiff", "retract", "Deprecated:" and "major version bump". Not for a service's internal tree (go-project-layout), the tag and changelog procedure (release), constructor and option mechanics (golang-design-patterns), or test style (golang-testing).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Go library

A service can change any signature in one commit; a library cannot, because
its callers live in other repositories and upgrade on their own schedule.
Every exported name is a promise kept until the next major version. The
service skills assume `internal/app` and a composition root; a library has
neither. Base layout from project-docs: packages at the root, flat.

## Exported API

- Start unexported. Export a name when a second consumer needs it, not
  because one caller or a test would like it.
- What is not part of the contract goes under `internal/`. No
  `internal/app`; `cmd/` only for a tool the module ships.
- The package name is the import path's last element, one lowercase word
  that reads at the call site: `retry.Do(ctx, fn)`, not
  `retryutil.RetryFunc`.
- Constructors return the concrete type (`*Client`) with unexported
  fields. Accept the smallest interface you need; never return one.

## No globals, no hidden I/O

- No package-level logger, config or client. Take a `*slog.Logger` as a
  functional option (golang-design-patterns), defaulting to
  `slog.New(slog.DiscardHandler)`.
- Never read environment variables, flags or files the caller did not name.
- No `init()` with side effects: no registration, network or global state.
- A goroutine outlives the call that started it only on a type with a
  `Close` that stops it.

## Errors, context, panics

- `ctx context.Context` first on anything that blocks or does I/O.
- Errors a caller acts on are exported sentinels (`ErrNotFound`) or types
  (`*RateLimitError`) in the package, documented on each function that
  returns them; the rest wrap with `%w` (golang-error-handling). Error text
  is not API. No panic crosses the boundary on bad input.

## Documentation and hygiene

- `doc.go` holds the package comment. The `README` is that comment's first
  paragraph, the install line and one example, not a second manual.
- `Example` functions with `// Output:` for each entry point
  (golang-testing): `go test` runs them and pkg.go.dev shows them.
- `go vet` and `gofmt` clean; the project's linter passes.
- `go.mod`: the `go` line is the oldest version the code needs, and there
  is no `toolchain` line; both otherwise force callers to upgrade Go.

## Versions

| Tag | Means |
|---|---|
| `v0.x.y` | free to break; a break bumps MINOR with a **Breaking:** note |
| `v1.x.y` | the API is frozen; additions only |
| `v2.0.0`+ | `module .../v2` in `go.mod` and every internal import, in the commit the tag points at |

- Tags are `vX.Y.Z` on the default branch and nothing else, made by the
  release procedure (release). A published tag is never moved or deleted:
  the module proxy has cached it. A bad version gets a `retract` directive
  with a reason, shipped in the next patch.
- CI runs `gorelease -base=<last tag>` (or `apidiff`) and fails a change
  the planned version does not allow.
- Deprecate before removing: a `// Deprecated: use NewClient.` paragraph in
  the doc comment, kept at least one minor release; under v1, removal waits
  for v2.

## Generics

Only when two concrete types already need the same code: a type parameter
on an exported function is API too. Read how `slices`, `maps` and
`sync/atomic` shape theirs before inventing one (sound-patterns).

## Gotchas

- Exporting a struct for convenience freezes every field's name, type and
  meaning; a caller's unkeyed literal breaks on the next field added.
- A constructor returning an interface: adding a method breaks every other
  implementation, and callers cannot reach methods on the concrete type.
- Dependency sprawl: every `require` in a library's `go.mod` lands in every
  caller's build. A logging, config or assertion framework does not belong;
  copy a small helper instead.
- A `v2.0.0` tag without `/v2` in the module path: the go command will not
  resolve it as v2. The path change and the tag land together.

## Definition of done

- Every exported symbol has a doc comment; entry points have `Example`s.
- No globals, environment reads or `init()` side effects.
- `gorelease` against the last tag agrees with the planned version.
- `go.mod` has a minimal `go` line, no `toolchain` line and no new
  dependency without a reason.

## References

- [compatibility.md](references/compatibility.md): open when wiring the
  `gorelease` check into CI, deprecating or retracting, moving to `/v2`, or
  writing the first `Example`.
