---
name: git-workflow
description: Use this skill whenever a change is about to be staged, committed, amended, rebased or pushed, when writing a commit message, when deciding how to split work into commits, when the tree holds untracked or unrelated changes, when a hook fails, when history that already left the machine needs a fix, when a branch, worktree or tag is created or moved, or when the user says "commit this", "clean up the history", "squash", "push", or "why did that end up in the commit". Holds the staging rule (name the paths; never -A, . or -a), Conventional Commits with a body that says why and no tracker ids, one change per commit, fix forward after a push, fast-forward landing, worktrees beside the repository, and the rule that the push is the owner's. Not for the push gate and the CI watch (ci-green), release tags and the changelog (release), or the batch landing protocol (backlog-batches).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Git workflow

One `git add -A` committed a worktree, a `.env` and a build directory in
the same commit as a one-line fix. One day of pushes landed eleven commits
on a red default branch (`ci-green` has that story). One amend after a push
forked the history a second session had already built on. Each was a
capable agent doing the obvious thing. This skill names the less obvious
thing to do instead, once, so every repository gets the same history: small
commits that each say why, a default branch that only moves forward, and a
push that is a decision, not a reflex.

## Staging

- **Name the paths.** Never `git add -A`, `git add .`, `git add -u` or
  `git commit -a`. Stage the files the subject line describes, with
  `git add -p` when a file holds two changes.
- **Decide every untracked file** `git status --short` shows: commit it,
  ignore it (in `.gitignore`, in the same commit) or delete it. Nothing
  stays untracked across a commit by accident.
- **Read the cached diff** (`git diff --cached`) in full before committing.
  Every hunk belongs to the subject; a hunk that does not is unstaged.
- **Never commit** secrets or `.env` files with values, build output,
  `node_modules`, coverage files, editor state, or a worktree. The scanner
  in the hook (`repo-tooling`) is the last line, not the first.
- **Generated code** lands in the same commit as the contract or schema
  change that produced it, produced by `make generate` and nothing else
  (`plan-feature`).

## The message

```text
type(scope): what the change does, imperative, under 72 characters

Why the change exists: the behaviour an operator or user notices, the
constraint that forced the shape, the alternative that was rejected.
Wrapped at 72. No story, ticket or plan id; the tracker links here.
```

Types are the Conventional Commits set (`feat`, `fix`, `refactor`, `perf`,
`test`, `docs`, `build`, `ci`, `chore`, `revert`). The three that get
confused here: `build` is the Makefile, dependencies, Dockerfile and
generators; `ci` is workflows and hooks; `chore` is a release or
housekeeping that fits nothing else, never a disguised `feat` or `fix`.

Rules:

- The scope is the package, skill or area, lower case; omit it when the
  change spans the repository.
- A subject that needs "and", "also" or "plus" is two commits.
- A breaking change carries the `BREAKING CHANGE:` footer saying what to
  do; `release` reads it for the bump.

## The shape of a commit

- One change per commit. A story is one or a few commits, never two
  stories in one (`plan-feature`).
- Backend and frontend never share a commit; schema, contract, backend and
  frontend land in that order as separate commits.
- A rename, move or format-only change is its own commit, so the logic
  diff reads clean.
- A document, runbook or decision record that moves with the change lands
  in the same commit (`project-docs`).
- The fast gate (`make check`) passes before every commit, and the hooks
  run. Never `--no-verify`; a failing hook is a finding to fix or report,
  not a flag to skip. The CI gate belongs to the push, not the commit
  (`ci-green`).

## History

- **Amend and rebase only a hash nobody else holds**: not pushed, not
  told to another session or agent (`backlog-batches`). Otherwise fix
  forward with a new commit. The one exception is a branch of your own
  that nobody has pulled, and then `--force-with-lease`, never `--force`.
- **The default branch moves forward only.** Land by fast-forward after a
  rebase onto its head; no merge commits, no force-push, ever
  (`backlog-batches` has the landing protocol).
- **No stash.** Commit a work-in-progress on the branch and amend it
  before it leaves, or use a worktree. A stash is state nobody can see.
- **Worktrees sit beside the repository**, never inside it (`ci-green`
  has why).
- **Look before destroying.** `git clean -n` before `git clean -f`;
  `git status` before `git reset --hard` or `git checkout -- .`; never
  discard changes you did not make. Do not remove another session's
  worktree or branch; report it.

## Pushing

- **The push is the owner's.** The agent commits locally and reports the
  head; the owner pushes, unless the owner said in this conversation to
  push. "Commit this" is not "push this".
- **When told to push**, `ci-green` applies: the CI target on the exact
  head, then push, then watch the run to its end.
- Read what the push will send first: `git log --oneline origin/<default>..HEAD`.
- Push the branch before its tag. Tags are annotated and come from
  `release`; a published tag is never moved or deleted.
- Start from the remote: `git fetch` and compare before the first commit
  of a session. `git pull --rebase` only on your own clean branch; never a
  `git pull` that creates a merge commit on the default branch.
- Hooks are installed once per clone with `make hooks`; a clone without
  them has no local guard (`ci-green`).

## Gotchas

- `git add -A` stages the whole tree from any directory: a worktree inside
  the repository, the `.env`, the build output you were about to ignore.
- `git commit -a` misses new files and includes the unrelated edit you
  forgot about.
- `git add .` after a generator or install run stages lockfile churn you
  did not mean to ship.
- An amend after a push leaves CI, the other session and the owner's clone
  on a hash that no longer exists.
- A diff that touches every line of a file is a line-ending or formatter
  change, not the change you meant; keep `core.autocrlf` off and commit
  a reformat on its own.
- A story id in a subject, body or branch name outlives the tracker; the
  tracker links to the commit, never the reverse.

## Definition of done

- Every commit stages named paths, its cached diff was read, it holds one
  change, its subject is conventional and under 72 characters, its body
  says why, the fast gate passed and the hooks ran.
- Nothing was amended or rebased after it left the machine; the default
  branch received only fast-forwards.
- Nothing was pushed without the owner's word, and every push went
  through `ci-green`'s gate and was watched.
