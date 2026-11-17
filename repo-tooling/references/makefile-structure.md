# Makefile structure

How a Makefile is laid out and kept small, in any repository, whatever the
language. The standard targets and their recipes are in `makefile.md`.

## Contents

- Preamble
- Files
- Variables
- Targets and recipes
- Parameters
- Help
- Names
- Gate lists, bundles and slices
- Order and parallel runs
- Audit

## Preamble

Every root Makefile starts with these lines:

```make
SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
MAKEFLAGS += --no-builtin-rules
.DELETE_ON_ERROR:
.DEFAULT_GOAL := help
```

- Without `pipefail`, `a | b` passes when `a` fails. With it, a pipe into
  `head` or `grep -q` can fail on a closed pipe; read the output into a
  variable first, or let the script do it.
- `-u` fails a recipe on an unset shell variable. A Make variable that is
  unset still expands to nothing.
- `.SHELLFLAGS` needs GNU Make 3.82 or later.

## Files

- The root `Makefile` holds the preamble, the project's identity, the
  variables the fragments read, the `include` lines and the bundles.
- An area's targets live in `mk/<area>.mk` (`mk/web.mk`, `mk/proto.mk`,
  `mk/release.mk`). Move an area out when the root passes about 150 lines or
  the area has more than about eight targets.
- Variables a fragment reads are set before its `include`. A fragment gives
  each a default with `?=`, and lists them in its header comment.
- A fragment vendored from another repository is owned by that repository
  and never edited in place. A project adds prerequisites to its targets,
  never a second recipe: `ci: my-check`.
- A fragment starts with one comment naming its area and its owner.

## Variables

- `?=` only for a value a caller or CI overrides on the command line. `:=`
  for everything else.
- `$(shell ...)` in a `:=` runs on every invocation, `make help` and each
  recursive `$(MAKE)` included. When only some targets need the value, use
  `=` so it runs when a recipe expands it, or compute it in the script.
- One comment line per variable says what it holds and who overrides it. How
  the subsystem works belongs in the project's docs, not above the variable.
- A variable that only one fragment uses is defined in that fragment.

## Targets and recipes

- Targets are commands, so they are phony. `go`, `pnpm` and `vite` cache
  their own outputs; add a file target only for a slow step with no cache.
- `.PHONY` sits on the line above its target, never in one list at the top.
  A list drifts from the targets it names.

  ```make
  .PHONY: web-lint
  web-lint: ## Check UI formatting, lint and types
  	$(call require_ui)
  	@$(PNPM) run lint
  ```

- A recipe is at most three commands. A loop, a trap, a background process,
  a branch or a `\` continuation of more than two lines moves to
  `scripts/<target>.bash` (or `.mjs`), named after the target. The recipe
  passes Make variables as arguments or environment and does nothing else.
- A script that has a self-test runs it from the same target, before the
  real run.
- A check a recipe repeats (a tool is installed, dependencies are present)
  is one `define` or function variable, called with `$(call ...)`. Its
  message names the target that fixes it: `Run: make tools`.
- A recipe is silent (`@`) and prints one line saying what it started. A
  failure prints the command that fixes it.

## Parameters

- A required parameter is checked first, and the message shows the form:

  ```make
  @test -n "$(DESIGN)" || { echo "set DESIGN=<design>"; exit 1; }
  ```

- Make reads the environment as variables, so a parameter named like an
  environment variable is never empty: on WSL `NAME` is the host name, and
  `test -n "$(NAME)"` passes. Never name a parameter `NAME`, `USER`, `HOME`,
  `HOSTNAME`, `SHELL`, `TERM`, `LANG` or `PATH`; use `DESIGN`, `TAG`,
  `SKILLS_REF`.
- An optional parameter becomes a flag with `$(if $(X),--x $(X))`.
- A target with more than three parameters passes them to its script in the
  environment, and the script validates them and prints its own usage.
- Parameter names are upper case. One name means one thing across targets
  (`PKG`, `BASE`, `SHARD`).

## Help

- Every target has a `## description` on its rule line. The description
  says what the target does in at most 80 characters. Parameters, reasons
  and caveats go in a comment above the target.
- A line that starts `## ` and ends with a colon is a section heading.
- One `help` recipe for every repository. It accepts digits in a name
  (`e2e-check`) and sizes the name column to the longest name:

  ```make
  .PHONY: help
  help: ## Show this help
  	@awk 'BEGIN {FS = ":.*## "} \
  		/^## .*:$$/ {row[++n] = "h" substr($$0, 4); next} \
  		/^[a-zA-Z0-9_-]+:.*## / {row[++n] = "t" $$1; desc[n] = $$2; if (length($$1) > w) w = length($$1)} \
  		END {for (i = 1; i <= n; i++) { \
  			if (substr(row[i], 1, 1) == "h") printf "%s\n", substr(row[i], 2); \
  			else printf "  %-" w "s  %s\n", substr(row[i], 2), desc[i]}}' $(MAKEFILE_LIST)
  ```

  `$(MAKEFILE_LIST)` covers the included fragments. A helper target that
  nobody runs by hand has no description and stays out of the list.

## Names

- `<area>-<verb>`: `web-build`, `proto-lint`, `release-snapshot`. The Go
  module, as the repository's main area, has no prefix (`test`, `lint`).
- `<thing>-check` reads and fails; it never writes to the tree. The target
  that fixes what it finds has the same name without `-check` (`fmt` and
  `fmt-check`, `generate` and `generate-check`).
- `<tool>-install` installs a pinned tool; `<tool>-env` fails when the
  installed version differs from the pin. `tools` and `env` depend on them.
- Bundles have fixed names: `check` (the fast gate before a commit), `ci`
  (everything CI runs), `pre-push` (what the pre-push hook runs).

## Gate lists, bundles and slices

A gate's name is written once, in a group variable. Bundles and slices are
built from the groups, so a gate added to a group reaches every bundle and
slice that uses it:

```make
GO_GATES     := tidy-check fmt-check lint docs-check generate-check
TEST_GATES   := test
UI_GATES     := web-lint web-test
CI_GO_GATES  := vuln secrets-check release-check
CI_UI_GATES  := web-build web-budget
PACK_GATES   := package-check

.PHONY: check
check: $(GO_GATES) $(TEST_GATES) $(UI_GATES) ## The fast gate: run before every commit

.PHONY: ci-go ci-test ci-web ci-pack
ci-go: $(GO_GATES) $(CI_GO_GATES) ## CI's Go slice
ci-test: $(TEST_GATES) ## CI's test slice
ci-web: $(UI_GATES) $(CI_UI_GATES) ## CI's UI slice
ci-pack: $(PACK_GATES) ## CI's packaging slice

CI_SLICES := ci-go ci-test ci-web ci-pack

.PHONY: ci
ci: $(CI_SLICES) ## Everything CI runs
```

- A target line never repeats a list of gate names that another line has.
- A group is a set of gates that always run together. Split a group when a
  slice needs part of it.
- `ci` is the union of its slices by construction, so no script has to prove
  it. A check stays only for what Make cannot see: that the workflow file
  runs every name in `CI_SLICES`.
- Where a vendored kit defines `check` and `ci`, the project attaches its
  groups as prerequisites (`check: $(UI_GATES)`), and the kit exposes its
  own gates as a variable for the slices to use.

## Order and parallel runs

- Prerequisites have no order under `make -j`. A step that needs another's
  output names it as a prerequisite; two steps that must not overlap run in
  one recipe, the second as `@$(MAKE) --no-print-directory <target>`.
- A recipe calls `$(MAKE)`, never `make`, so flags and the job server reach
  the child.
- A bundle that is safe in parallel says so in the comment above it, and its
  caller passes `-j<n> -O`.

## Audit

Run these on a Makefile before changing it; each is a finding:

- A target missing from `.PHONY`, or a `.PHONY` list at the top of the file.
- A target with a description that `make help` does not print, or a name
  that runs into its description.
- No `pipefail` in `.SHELLFLAGS`.
- A parameter named like an environment variable.
- A description over 80 characters.
- A recipe over three commands, or with a loop or trap in it.
- A gate name on more than one target line.
- A `:= $(shell ...)` that most targets do not use.
- A root Makefile over about 150 lines with no `mk/` fragments.
