---
name: go-project-layout
description: Use this skill when deciding where a file or package goes in a Go service's internal/ tree, when adding a business module or a platform capability, when adding a consumer-side port, a service or a constructor, when moving, splitting or merging packages, when wiring dependencies at the composition root, or when reviewing a change's import direction or writing the architecture-check that enforces it. Also use it when someone proposes a utils, helpers, common, shared or pkg/ package, a DI container, or a Clean/Hexagonal folder scaffold. Not for the base cmd/ and internal/ rule of a small repository or a library (project-docs), in-package design (golang-design-patterns), database code (golang-database), or identifier naming.
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Go project layout

The service-sized layout on top of the base rule in `project-docs` (official
module layout, `cmd/` and `internal/`, no `pkg/`). Dependencies point one
way, generated transport is quarantined, and an `architecture-check` target
proves both from the import graph. This skill is the procedure for placing a
change.

## The shape

```
cmd/<app>/main.go          thin: parse, call into internal/app or internal/cli
api/openapi.yaml           the HTTP contract (api-contract)
migrations/                numbered up/down SQL (golang-database)
internal/
  app/                     composition root: builds every concrete, owns start/stop
  cli/                     commands, if the binary has more than one
  api/<gen>/               generated transport; never edited
  controller/              the one implementation of the generated handler: mapping only
  domain/                  shared business types and errors; a leaf
  platform/<capability>/   infrastructure with no business meaning (config, database, http, observability)
  modules/<module>/        business capabilities, one noun each
```

`platform/` and `modules/` are grouping directories; Go files go in their
children. A new top-level group under `internal/` is a decision record (see
`project-docs`) and a change to the check, in one commit.

## Where does a new file go?

| The file is | It goes in |
|---|---|
| Config loading, env binding | `internal/platform/config/` |
| Pool, migration runner, test harness | `internal/platform/database/` |
| Logger, metrics, tracing setup | `internal/platform/observability/` |
| HTTP server, routing, middleware | `internal/platform/http/` |
| A capability's repository, rules and orchestration | `internal/modules/<module>/` |
| A type or business error two modules share | `internal/domain/` |
| Generated request/response to a domain call | `internal/controller/` |
| Constructing concretes, start and stop order | `internal/app/` |
| "Generic, used everywhere" | a `domain` type or a `platform` capability; never `utils`, `helpers`, `common`, `shared` or `pkg/` |

## Import rules (the check enforces these)

1. `internal/domain` imports no other internal package.
2. `internal/platform/...` imports neither `domain` nor `modules`.
3. `internal/modules/...` never imports `internal/api/<gen>` or `controller`.
4. Only `controller`, `app` and the HTTP server package import
   `internal/api/<gen>`.
5. A generated persistence package (sqlc output, if used) is imported only by
   the repositories that own it.
6. No package outside the accepted groups; no grab-bag directory name.
7. A sibling-module import is a reviewed edge listed in the check's allowlist,
   never an accident.

A violation is fixed by moving the type down (usually into `domain`) or by
adding a port. Never by widening the check.

## Rules the check cannot see

- **Ports belong to the consumer.** A module that needs another package's
  behaviour declares a small unexported interface for exactly the methods it
  calls, named for the behaviour (`objectReader`, `claimer`), 1 to 3 methods.
  The concrete satisfies it structurally and is injected from `internal/app`.
  Narrow at the seam even over a type you own, so a fake drives the unit test.
- **Return concrete types; never declare an interface beside its only
  implementation** "for mocking". Packages export structs; consumers decide
  what they need from them.
- **A shared exported interface is a vocabulary type, like `io.Reader` or
  `fs.FS`**: tiny (one or two methods), spoken by many independent packages,
  declared in the leaf package that owns the concept it describes (often
  `domain`), documented as a contract, and proven by a conformance suite in a
  `<pkg>test` package (the `fstest`/`iotest` pattern; see
  `go-conformance-suite`). Repository-shaped interfaces that list every
  method of one store are not vocabulary types; they stay consumer-side.
  Import cycles are never the reason: a consumer-side copy imports only the
  types in its signatures, so it cannot create a cycle.
- **Concretes are built only in `internal/app`** (or a command's setup in
  `cmd/`). Business code never calls a pool, SDK, storage or HTTP client
  constructor.
- **Wire by hand.** `New<Type>(deps...)` constructors with explicit
  parameters; functional options only where optional configuration earns
  them. No `wire`, `dig` or `fx`: visible, compile-checked, greppable wiring
  is the point.
- **The controller only maps**: generated request to domain call to generated
  response, expected business errors to the declared status. Business
  decisions live in the module.
- **A service exists only for orchestration** across several repositories or
  ports. A single-repository read is a repository call.
- **Data plus functions, not self-mutating models.** Domain structs are data
  with validating constructors; an atomic repository call
  (`Acknowledge(ctx, id, by)`) beats a read-modify-write on a rich model.
- **Persistence types stay in the adapter.** Generated rows and `pgtype`
  values are mapped to `domain` values inside the module.
- **Package name is one clear noun** matching the directory, no stutter
  (`orders.Repository`). If it cannot be named in one noun, split or merge it.
- **Tests live beside their subject.** Regrouping never separates them.

## Add a business module

1. Name it (one noun) and place it per the table. If it needs a contract,
   write the proposal first: `contract-spec`.
2. Create `internal/modules/<module>/doc.go` stating what it promises
   (`project-docs` owns the doc comment form).
3. Shared types and business errors go in `internal/domain/`.
4. Declare the ports it consumes as local interfaces.
5. Repository and queries per `golang-database`.
6. Construct it in `internal/app` and inject it; add it to the start/stop
   order if it owns a goroutine (`golang-concurrency`).
7. If it is exposed over HTTP, change `api/openapi.yaml` first
   (`api-contract`), regenerate, then map it in `controller`.
8. If it takes part in a capability other modules share, update the flow:
   `contract-spec`.

## The architecture check

`make architecture-check` runs a script that derives every rule above from
`go list`, never from grep over source text:

- Collect edges with `go list -f` over `.Imports`, `.TestImports` and
  `.XTestImports`. A boundary crossed only by a test is still crossed.
- Collect the graph twice, default tags and `-tags integration`, so
  integration-only packages are checked too.
- Fail on any edge matching a forbidden pattern, any package outside the
  accepted groups, and any directory named `utils`, `helpers`, `common`,
  `shared` or `pkg`.
- Print each violation as `importer -> dependency: rule`, exit non-zero, and
  include the target in `make ci`.

## Moving packages

A regroup is a large, low-risk diff the compiler checks. Land it as separate
revertible commits: fix mislabelled packages first, then move platform
packages, then modules, then update the `AGENTS.md` map (`project-docs`).
Run the check and tests after each.

Before adopting a Clean or Hexagonal scaffold: consumer-side ports plus
injected concretes already are dependency inversion. Do not add `ports/` and
`adapters/` folders on top.

## Definition of done

- The file sits where the table says, or a decision record says why not.
- No business package constructs or imports an infrastructure concrete.
- Every seam can be driven by a fake in a unit test.
- `make architecture-check` and `make ci` pass.
