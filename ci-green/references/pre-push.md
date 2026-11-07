# The pre-push hook

Lives in `.githooks/pre-push` beside `pre-commit`; `make hooks` enables both
through `core.hooksPath`. It does two things, in order: refuses to pile a
push onto a red or still-running default branch, then runs the checks that
only the CI target runs and that finish in a few minutes. The full CI
target stays the rule for a batch's final head; this hook is the floor for
a single push.

The CI query below is GitHub Actions through `gh`; another CI system
replaces that one block with its own "is the pushed-onto commit green"
call and keeps the rest.

```sh
#!/bin/sh
# Pre-push gate. Enable once per clone with `make hooks`.
# 1. Refuse to push onto a default branch whose head is red or still
#    running, unless this push is the fix: a commit carrying a
#    `Fixes-CI: <run url>` trailer, or a revert.
# 2. Run the checks CI runs that the fast gate does not.
# `git push --no-verify` skips both; an agent never uses it (git-workflow).
# The owner uses it only when the CI query itself is broken.
set -eu

remote="$1"

# The default branch is the remote's HEAD. A clone that never recorded it
# (`git remote set-head <remote> --auto`) must say it in PUSH_DEFAULT_BRANCH;
# a hook that cannot name the branch guards nothing, so it refuses.
default="${PUSH_DEFAULT_BRANCH:-$(git symbolic-ref -q --short "refs/remotes/${remote}/HEAD" 2>/dev/null | sed "s|^${remote}/||")}"
if [ -z "${default}" ]; then
	echo "pre-push: no ${remote}/HEAD; run 'git remote set-head ${remote} --auto' or set PUSH_DEFAULT_BRANCH" >&2
	exit 1
fi

# stdin: <local ref> <local sha> <remote ref> <remote sha> per pushed ref
while read -r local_ref local_sha remote_ref remote_sha; do
	case "${remote_ref}" in
	refs/heads/"${default}") ;;
	*) continue ;;
	esac

	# A new branch has no commit to be red.
	case "${remote_sha}" in *[!0]*) ;; *) continue ;; esac

	if command -v gh >/dev/null 2>&1; then
		# The check runs on the commit this push lands on, not the newest run
		# of any workflow on the branch (a green scheduled job hides a red
		# verify). "red" when any check concluded failure, "pending" when any
		# is still running.
		state="$(gh api "repos/{owner}/{repo}/commits/${remote_sha}/check-runs" \
			--jq 'if any(.check_runs[]; .conclusion == "failure" or .conclusion == "timed_out") then "red"
			      elif any(.check_runs[]; .status != "completed") then "pending"
			      else "green" end' 2>/dev/null || echo unknown)"
		case "${state}" in
		red)
			if ! git log --format=%B "${remote_sha}..${local_sha}" | grep -Eq '^Fixes-CI: ' &&
				! git log --format=%s "${remote_sha}..${local_sha}" | grep -Eiq '^revert'; then
				echo "pre-push: the CI run on ${default}'s head is red." >&2
				echo "pre-push: push the fix with a 'Fixes-CI: <run url>' trailer, or revert the commit that broke it." >&2
				echo "pre-push: nothing else lands on red." >&2
				exit 1
			fi
			;;
		pending)
			echo "pre-push: the CI run on ${default}'s head has not finished; watch it first (gh run watch)." >&2
			exit 1
			;;
		unknown)
			echo "pre-push: could not read CI for ${remote_sha}; is gh signed in? Continuing with the local checks." >&2
			;;
		esac
	else
		echo "pre-push: gh not installed; the red-branch guard is off. Running the local checks." >&2
	fi

	# The CI-only checks run on the working tree, so it must be the head
	# being pushed: clean, and at local_sha.
	if ! git diff --quiet || ! git diff --cached --quiet || [ "$(git rev-parse HEAD)" != "${local_sha}" ]; then
		echo "pre-push: the working tree is not the pushed head; commit or discard, then push from it." >&2
		exit 1
	fi
	if ! make -n pre-push >/dev/null 2>&1; then
		echo "pre-push: no 'pre-push' target in the Makefile; add one (ci-green)." >&2
		exit 1
	fi
	make --no-print-directory pre-push >&2
done
```

Makefile wiring, beside `pre-commit`:

```make
# The prerequisites are the targets the CI target runs and `make check` does
# not, kept to the ones that finish in minutes (a build of the embedded
# frontend, a boot check, a unit-file check); the rest stays in `make ci`.
pre-push: <ci-only check> <ci-only check> ## The CI-only checks a push must pass; pre-push hook

hooks: ## Enable the repository's git hooks (.githooks/pre-commit, .githooks/pre-push)
	@git config core.hooksPath .githooks
```

The fix trailer goes in the body of the commit that repairs the run:

```text
fix(web): route the boot check at a path outside every route group

The deep-link check used /nowhere, which became a route when the pages
landed. The check now owns a path no route group can claim.

Fixes-CI: https://github.com/<owner>/<repo>/actions/runs/<id>
```

A project whose agent instructions forbid agents from editing `.githooks/`
has the owner add the file; the agent puts the exact content in its report.
