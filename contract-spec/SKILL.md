---
name: contract-spec
description: Use this skill before building, reimplementing or behaviourally refactoring a Go business module (a package under internal/modules), or a capability that spans two or more modules such as a pipeline, queue hand-off, multi-step workflow, reconciliation loop or delivery path. Triggers include "spec a module", "write a module proposal", "design the contract", "write the interface first", "spec the flow", "what happens if step N crashes", and stating an exactly-once, ordering or idempotency guarantee across modules; also when a module's exported API, interface or error contract changes, when modules change how they hand work to each other, and when reviewing a built module or flow against its contract. Not for the HTTP contract (api-contract), file placement (go-project-layout), doc comment form (project-docs), or planning a feature into stories (plan-feature).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Contract spec

Contract before code. One method, two scopes:

| Scope | File | After the build |
|---|---|---|
| One module | `internal/modules/<module>/<module>.spec.md` | moved into code; the file is cut to its purpose |
| A flow across modules | `docs/flows/<name>.flow.md` | stays prose; no single package owns it |

A path one module owns is a module spec. A cross-module change updates the
flow first, then each participant's module spec.

## 1. Draft

Write the proposal with `Status: draft`, from the template:

- Module: [module-proposal.md](references/module-proposal.md). Purpose and
  Non-goals; Contract (the real exported Go signatures, one line of intent
  each); Invariants `I1..` (testable behaviour: where a fresh implementation
  would go wrong, most of the value); Errors (when returned, retryable or
  not); Collaborators (the consumer-side ports, `go-project-layout`); Test
  scenarios; Open questions.
- Flow: [flow.md](references/flow.md). Capability and success criterion;
  Participants; Sequence (where it goes asynchronous or durable); State
  transitions and their owners; Guarantees `G1..` (only the whole path can
  make them: delivery semantics, dedup key, ordering); Failure and recovery
  per step; Test scenarios; Open questions.

No SQL, struct dumps or algorithms; a module proposal past a page means split
the module. A flow names modules, not symbols, which drift silently
(`project-docs`); list it in `docs/README.md`.

## 2. Owner gate: the summary, not the file

The owner does not read the spec file. Present one plain-English summary (a
flow with its module proposals) in the conversation and **stop**:

- what the module or flow is for, and what it will not do;
- each decision that shapes the contract (an error being retryable, a lease
  length, who owns a transition), with the options and your recommendation;
- each open question, with the option you recommend.

The owner accepts, modifies, rejects or steers; silence is not approval. On
acceptance, record it: the header becomes `Status: approved · Approved:
YYYY-MM-DD by <owner>`, and each open question becomes a dated line under
**Decisions**; an approved spec has no open questions. If the owner changes
the contract, revise and summarise again.

New HTTP operations have their own gate and commit (`api-contract`: they
answer 501 until the backend lands); link to it, do not repeat it.

## 3. Build, and move the contract into code

Build a flow leaves first, wired only in the composition root
(`go-project-layout`); past about four new modules, ship in slices. The
commit that lands a module carries its whole contract, in code:

| Spec section | Moves to |
|---|---|
| Purpose | `doc.go` package comment: what it promises, what it refuses to know |
| Contract | doc comments on each exported symbol: what it returns, mutates or guarantees |
| Invariants | one test each, named for the behaviour (`TestLease_ExpiredLeaseIsReclaimable`), plus the guarantee in the doc comment |
| Errors | doc comments on each sentinel and returning method; one test per case |
| Collaborators | the port interfaces with doc comments; fakes in tests |
| Usage | an `Example` test with `// Output:` for the main entry point |

An interface with 2+ implementations gets a conformance suite instead
(`go-conformance-suite`).

A flow gets one test per guarantee and per recovery path, named for the
behaviour (`TestFulfilment_RedeliveredJobSendsOneShipment`), on real
PostgreSQL behind the `integration` tag where the guarantee is a database one
(`golang-database`). Code that enforces a guarantee cites it:
`// See docs/flows/<name>.flow.md#guarantees.`

## 4. Cut the module spec

In the same commit, delete everything from a module spec except the header,
Purpose and Non-goals; the code says the rest. It never grows again: a page
of new contract is a new module. Flow specs are never cut; they are the one
place cross-module behaviour is written.

## Decision records

A choice a reviewer would plausibly reverse, with a real alternative, goes
to the decision log (`project-docs`). Not a decision record: anything the
code, a test or a doc comment already states; an owner's answer to an open
question (that is a Decisions line, cut with the spec); a convention another
skill already sets.

## Review

Each is a fail condition. Report `file:line`, what is wrong, and whether the
code or the document is wrong.

- [ ] A module spec holds only header, Purpose and Non-goals; `doc.go`
      states the promise; every exported symbol has a doc comment.
- [ ] Every invariant, error, guarantee and recovery path has a
      behaviour-named test that fails when it breaks (mutate one to check).
- [ ] Business code imports no infrastructure concrete; the behaviour still
      fits the Purpose.
- [ ] A flow's participants, hand-off order and transition owners match the
      document; nothing unnamed takes part.

## Later changes

No new module spec; code, tests and doc comments change together:

| Change | What else moves | Gate |
|---|---|---|
| Bug, refactor, new behaviour behind the same API | a named test, doc comment if needed | none |
| Exported API, interface or error contract | commit body says what moved | owner: plain-English interface summary |
| A hand-off, transition, guarantee or recovery path | the flow document, same commit | owner: summary of the flow change |
| Scope | the Purpose line and a decision record | owner |

## Definition of done

Owner accepted the summary before implementation; every invariant, error,
guarantee and recovery path has a named test; `make ci` passes; module spec cut.
