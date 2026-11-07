---
name: ci-green
description: Use this skill before pushing to the default branch or telling the owner a batch is ready to push, when CI is red or "the pipeline failed", when commits were pushed on top of a failing run, when a check exists only in CI and not in the local gate ("make ci" versus "make check"), when a test or check is flaky in CI, when writing a pre-push hook, or when deciding what "done" means for a change that lands straight on the default branch. Holds the rule that the push gate is the CI target, not the fast gate; that a push is watched and a red run is fixed forward before anything else lands; that a check encoding a product fact names it; and the pre-push hook that refuses to pile commits onto a red branch. Not for the Makefile and CI layout themselves (repo-tooling), release tagging (release), or batch orchestration (backlog-batches, which cites this skill for its landing gate).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# CI green

One repository pushed eleven commits over a day while every CI run was red.
The local gate (`make check`) passed on each of them; the break was in a
check that only `make ci` runs (a browser boot check whose "deep link with
no route" became a route when the pages landed). Nobody ran `make ci`
locally, nobody watched the runs after pushing, earlier flaky failures had
made a red badge look normal, the pre-commit hook was not installed, and
the default branch had no protection. This skill fixes the discipline so a
red run is loud, short-lived and never built on.

## The rule

**The push gate is the CI target.** The fast gate (`make check`) is for
every commit; the CI target (`make ci`, or whatever the workflow's verify
job runs) passes on the exact head that is pushed, in a clean worktree,
before the push or before telling the owner the head is ready to push. A
batch is not landed until this has run once on its final commit.

**A push is watched.** After `git push`, watch the run to its end
(`gh run watch` or `gh run list --branch <default> --limit 1`); a session
that pushed does not end while the run is pending.

**Red is fixed first.** When the default branch's latest run is red,
nothing else lands on it until a commit makes it green: fix forward in the
same session, or revert the commit that broke it. A new push onto a red
branch is refused by the pre-push hook below.

**A flaky check is a bug.** A failure that passes on rerun is fixed or
quarantined the same day (`browser-e2e` has the quarantine shape); it is
never rerun until green, because that teaches everyone to ignore red.

**A check that encodes a product fact names it.** A check that assumes
"this path has no route", "this port is free", "this heading exists" says
so in a comment at the assumption, and chooses the value that stays true as
the product grows (a path outside every route group, a port the test
binds itself, a heading the check owns). A fact that can change with an
ordinary feature is a test of the feature, not a hidden assumption of the
gate.

## Procedure

1. Before the first push of a session, read the workflow: which job runs
   which target, and which targets are in the CI target but not in the fast
   gate. Those are the ones to run locally on the final head. If the fast
   gate walks the tree (a docs check, `gofmt -l .`), run the CI target in a
   clean worktree or `git archive` export, never beside sibling worktrees.
2. Run the CI target on the head to push. On a project whose CI also runs
   a job the CI target does not (an integration tier against a real
   runtime), run that job's target too when the change touches its area.
3. Push, then watch the run. Red: read the failed step's log
   (`gh run view <id> --json jobs`, then `gh api repos/<owner>/<repo>/actions/jobs/<job>/logs`),
   reproduce locally with the same target, fix, run the CI target again,
   push the fix, watch again.
4. Install the hooks once per clone (`make hooks`, which sets
   `core.hooksPath`); verify with `git config core.hooksPath`. A clone
   without the hooks has no local guard at all.
5. Add the pre-push hook (`references/pre-push.md`) if the repository
   lacks one: it refuses a push when the remote branch's latest run is red
   and the push does not say it is the fix, and it runs the CI-only fast
   checks on the pushed head.

## Orchestrating agents

- The run sheet names two gates: the per-item gate (fast) and the landing
  gate (the CI target). Agents run the fast gate; the orchestrator runs the
  landing gate once per batch, on the final head, in a clean worktree, and
  reports its result with the batch.
- "Forbidden: make ci" in an agent prompt is right for the agents and
  wrong for the batch: someone must run it before the push.
- A head that is ready to push is reported with the CI target's result and
  the commit it ran on; a head reported without it is not ready.

## Gotchas

- `gh run view --log-failed` can print nothing for a job whose log is
  large; the jobs API's `/logs` endpoint returns the whole log.
- A check that passes locally and fails in CI usually differs in data, not
  code: a port already bound, a browser not installed, a path filter that
  skipped it locally. Compare the step's command with the local target
  before suspecting the runner.
- Branch protection with required checks blocks direct pushes to the
  default branch; a solo repository that commits straight to it relies on
  the hook and the watch instead, and says so in its agent instructions.
- A worktree kept inside the repository directory (`tmp/worktrees/<name>`)
  is not clean for a release or reproducibility check: Go's VCS stamp walks
  past the worktree's `.git` file to the parent repository and records the
  main checkout's HEAD, so two builds minutes apart differ when the main
  branch moved between them. Put the landing-gate worktree beside the
  repository, not inside it, or use a `git archive` export.
- Several commits pushed at once get one run on the tip; a red run names
  the tip, and bisecting means running the CI target on earlier commits
  locally, which is why the batch runs it before the push.

## References

- `references/pre-push.md`: the hook that refuses to pile onto red and
  runs the CI-only fast checks, with its `make` wiring.
