# The state note

Written before the context is summarised or the session may end, at the
hand-off path (`.agents/state.md` by default, listed in
`.git/info/exclude`). Rewritten whole each
time, not appended to: it describes now, not the history. Every line is
something the next context would otherwise have to rediscover.

## Template

```markdown
# State, <YYYY-MM-DD HH:MM UTC>

## Repository
- Branch <name>, head `<short hash>` <subject>; <n> ahead of origin; gate <passed|failed> on it.
- Uncommitted: <paths and what they are, or "none">.
- In flight: <a rebase, a half-applied edit, a sub-agent due to report, or "none">.
- Worktrees: <name: branch, landed or not>, or "none".

## Running
- <what>: port <n> | PID <n> | task <id>; started with `<command>` in <directory>; logs at <path>; stop with `<command>`. Dies with the session: yes/no.

## Where things are
- Run sheet: <path> (copied here from the scratchpad if it lived there).
- Tracker: <source and location>.
- Credentials, by reference only: <purpose>: <vault entry | gitignored file and key name>.
- Durable how-tos: <links into AGENTS.md or docs/>.

## Waiting on the owner
1. Decide: <question>. A: <...>. B: <...>. Recommended A: <reason>. Asked <date>.
2. Approve: <what>, at <where>; serve with `<command>` from <branch>.

## Blocked
- <item>: on <what>; clears when <...>.

## Next
1. <step>
2. <step>
3. <step>
```

## Filled example

```markdown
# State, 2026-11-08 16:40 UTC

## Repository
- Branch master, head `4be91c2` feat(servers): show the restart countdown; 6 ahead of origin; `make ci` passed on it.
- Uncommitted: none.
- In flight: none.
- Worktrees: ui-refinement (branch ui-refinement, not landed; waits on the review below).

## Running
- Storybook for ui-refinement: port 6006; started with `pnpm --dir web run storybook` in the ui-refinement worktree; logs at .agents/storybook.log; stop with `kill $(lsof -t -i :6006)`. Dies with the session: yes.
- Seeded local instance: port 8080; started with `make dev` after `make seed`; logs at .agents/run.log; stop with `make dev-down`. Dies with the session: yes.

## Where things are
- Run sheet: .agents/run-sheet.md.
- Tracker: GitHub Issues, milestone "1.2", label `batch-3`; batch 3 of 4.
- Credentials: seeded admin login: `.env.local`, keys APP_SEED_USER and APP_SEED_PASSWORD. Deploy token: the vault, entry "ci deploy".
- Durable how-tos: AGENTS.md "Local stack"; docs/runbooks/deploy.md.

## Waiting on the owner
1. Decide: dark-theme control borders. A: quiet edge at rest, 3:1 on hover and focus (calmer; some audits flag it). B: 3:1 at rest (passes every audit; busier). Recommended B: the dashboard is read in a dim room and the edge is how a field is found. Asked 2026-11-08.
2. Approve: seven draft cards on ui-refinement, Storybook `Components/Badge` through `Layouts/TabbedPageLayout`.
3. Push master (6 ahead).

## Blocked
- Restart policy item: on the host's network script, which the owner runs.

## Next
1. Land ui-refinement by fast-forward once item 2 is approved.
2. Start batch 4, first three items from the run sheet's queue.
3. Re-run `make ci` on the new head and checkpoint.
```

## Resume checklist

Run before acting on anything in the note.

1. `git status --short`, `git log --oneline -1`, `git worktree list`: does
   the Repository section still hold? If the head moved, the owner or
   another session worked here; read the new commits first.
2. For each Running row: is it listening (`ss -ltnp | grep :<port>`) or is
   the task alive? Restart only what the Next list needs, with the written
   command.
3. For each Waiting row: has the owner answered in the conversation, the
   tracker or a commit? Move answered items out.
4. Fix or delete every stale line, then continue with Next.
