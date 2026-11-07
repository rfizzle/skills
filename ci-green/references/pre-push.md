# The pre-push hook

Lives in `.githooks/pre-push` beside `pre-commit`; `make hooks` enables both
through `core.hooksPath`. It does two things, in order: refuses to pile a
push onto a red default branch, then runs the checks that only the CI
target runs and that finish in a few minutes. The full CI target stays the
rule for a batch's final head; this hook is the floor for a single push.

```sh
#!/bin/sh
# Pre-push gate. Enable once per clone with `make hooks`.
# 1. Refuse to push onto a red default branch unless this push says it is
#    the fix (a commit subject starting "fix(ci)", "ci:" or "revert").
# 2. Run the checks CI runs that the fast gate does not.
# Bypass only with care: `git push --no-verify` skips both.
set -eu

remote="$1"
default="${PUSH_DEFAULT_BRANCH:-master}"

# stdin: <local ref> <local sha> <remote ref> <remote sha> per pushed ref
while read -r local_ref local_sha remote_ref remote_sha; do
	case "${remote_ref}" in
	refs/heads/"${default}") ;;
	*) continue ;;
	esac

	if command -v gh >/dev/null 2>&1; then
		conclusion="$(gh run list --branch "${default}" --limit 1 \
			--json conclusion,status --jq '.[0] | .conclusion // .status' 2>/dev/null || echo unknown)"
		if [ "${conclusion}" = "failure" ]; then
			if ! git log --format=%s "${remote_sha}..${local_sha}" |
				grep -Eq '^(fix\(ci\)|ci:|revert)'; then
				echo "pre-push: the latest CI run on ${default} is red." >&2
				echo "pre-push: push a commit that fixes it (subject starting fix(ci), ci: or revert)," >&2
				echo "pre-push: or revert the commit that broke it. Nothing else lands on red." >&2
				exit 1
			fi
		fi
	fi

	# The CI-only checks that finish in minutes; the project lists them in
	# the pre-push target of its Makefile (web-binary-check, web-embed-check,
	# web-boot-check, units-check in this repository).
	make --no-print-directory pre-push >&2
done
```

Makefile wiring, beside `pre-commit`:

```make
pre-push: web-build web-binary-check web-embed-check web-boot-check units-check ## The CI-only checks a push must pass; pre-push hook

hooks: ## Enable the repository's git hooks (.githooks/pre-commit, .githooks/pre-push)
	@git config core.hooksPath .githooks
```

The hook needs `gh` signed in to read the run; without `gh` it still runs
the checks. `PUSH_DEFAULT_BRANCH` overrides the branch name for a repository
whose default is not `master`.

A project whose agent instructions forbid agents from editing `.githooks/`
has the owner add the file; the agent puts the exact content in its report.
