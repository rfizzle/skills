# Contracts in code, skills, and Go layout

## The contract lives in the code

A unit's contract is what it promises its callers: what it returns, what it
refuses, what errors mean, what is safe concurrently. That belongs where the
compiler and `go test` keep it honest, not in a separate document that
drifts:

- **`doc.go`**: the package comment states what the package promises and
  what it refuses to know.
- **Doc comments** on every exported identifier whose name does not say what
  it returns, costs or mutates. A full sentence that begins with the name
  ("Resolve returns ...", "Empty reports whether ..."), saying what is
  returned, mutated or guaranteed (zero value, concurrency), never how it is
  implemented.
- **`Example` functions with `// Output:`**: the usage a reader would copy,
  checked by `go test`.
- **Behaviour-named tests**: `TestClaim_ReturnsErrLeaseHeld_WhenAnotherWorkerOwnsIt`
  is a sentence of the contract that fails when it stops being true. A test
  name says what the unit does, never which ticket asked for it.

Nothing in `docs/` restates any of these.

## Unit specs are cut down after the build

A spec written before a unit is built (a module proposal, a component card)
is a working file for the build. When the code lands, every promise in it
moves into the forms above, and the spec is cut, in the same commit, to its
purpose and its non-goals: the two things the code cannot say. What remains
is a few lines a reader opens to learn why the unit exists and what it will
refuse to become. The `contract-spec` skill has the procedure for Go modules.

A spec that still lists signatures, error tables or test cases after the
build is a second copy of the contract, and the copy is the one that will be
wrong.

## Skills

A skill is a procedure that matters only for some tasks: how to add a view,
how to change the proto, how a release is cut. It loads on demand, so it can
be detailed where `AGENTS.md` cannot. The mechanics (location, symlinks,
frontmatter, description wording) are the `create-skill` skill.

- **Something is a skill when it is a procedure a tool or a reviewer acts
  on.** A fact is a line in `AGENTS.md`; a reason is a section in `docs/`; a
  rule that must hold every time is a check. None of those is a skill.
- **An effective skill is a procedure with a definition of done**: the
  steps, the choice points with the rule for each, and the command that
  proves it was followed.
- **A skill that restates the language's conventions is noise.** A skill
  earns its place with what this repository does differently and why.
- `docs/` never describes a procedure.

## Go repository layout

Follow the official module layout guide (`go.dev/doc/modules/layout`), not
`golang-standards/project-layout`. The latter is not a standard: its own
README says so, the Go team objected to its name and to `pkg/`, and no major
Go repository follows it wholesale.

- A command: `cmd/<name>/main.go`, thin, assembly only. Main wires
  dependencies and parses flags; nothing else does either.
- Everything the command needs: `internal/`, dependencies pointing down.
  Keep packages internal as long as possible. A piece another module wants
  is split into its own module, not moved to `pkg/`.
- A library: packages at the root, flat, no `cmd/` or `internal/` until a
  command or a private helper exists.
- `docs/`, `scripts/`, and non-Go siblings (`App/`, `web/`, `proto/`) sit at
  the root. No empty placeholder directories.
- Each package has a `doc.go`.

Placement inside a service's `internal/` tree is the `go-project-layout`
skill.
