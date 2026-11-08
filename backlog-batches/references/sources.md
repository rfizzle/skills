# Source adapters

Every adapter answers the same six questions. A new tracker gets a section
in this shape, written into the run sheet for that run and copied here once
it has worked.

| Question | Why it matters |
| --- | --- |
| Locate | how an agent opens item `<ID>` and reads its criteria, touches, overlaps, dependencies |
| Visible in a worktree? | a gitignored file is absent from a sub-agent's worktree checkout; a tracker is reachable from anywhere; an artifact only through the orchestrator |
| Mark done | the exact edit or command, and who runs it (agent or orchestrator) |
| Never committed? | a tracked backlog file is part of the commit; a gitignored one or a tracker is not |
| File a follow-up | the block format or the create command |
| Touches and overlaps | where they come from when the item does not carry them |

## Markdown file, gitignored

The project's agent instructions or the owner name the file. Never choose
or invent a path: a backlog file the project does not already have is a
backlog artifact (below), not a new file.

- **Locate**: the named file in the main checkout; the item is a heading block
  (`### S-153: ...` or `#### S-153: ...`) ending at the next heading of the
  same level. Criteria are `- [ ]` lines; status is a `**Status:**` line or a
  `[x]` on the heading, per the project. Read the file's preamble for its
  conventions.
- **Visible in a worktree?** No. The agent reads the main checkout's copy by
  absolute path and edits nothing else there.
- **Mark done**: the agent ticks its own criteria and status with a targeted
  edit to the main checkout's file, or, when the harness refuses, puts the
  exact tick text at the end of its report and the orchestrator applies it
  with an edit bounded to the block. Some projects have the orchestrator
  apply every tick; the run sheet says which.
- **Never committed?** Right: it is gitignored, and the tick is never staged.
- **File a follow-up**: a new block in the project's format, anchored on a
  stable line of the previous block, with the fields the project uses
  (status, depends on, description, tasks, acceptance criteria, tests, and
  touches or overlaps where the project lists them).
- **Touches and overlaps**: from the item's own lines where present;
  otherwise the orchestrator reads the description and lists the non-test
  files before building the queue.

## Markdown file, tracked

As above, except the file is visible in every worktree, and the tick must be
made in the agent's worktree and included in its commit, so two items that
tick the same file conflict on landing. Resolve by rebase (keep both ticks).
Prefer marking in the orchestrator after landing when the project allows.

## Backlog artifact

The backlog is a document the harness hosts for the owner (its artifact,
canvas or page feature), so it travels between machines and sessions
without a commit. The owner gives its link.

- **Locate**: the orchestrator reads it with the harness's own artifact
  tool, never a web fetch. Items are `### <ID>: <title>` blocks with
  `- [ ]` criteria and a `**Status:**` line; dependencies, touches and
  overlaps are lines in the block when the owner wrote them. Parked
  follow-ups go under a `## Later` heading at the end.
- **Visible in a worktree?** No. Sub-agents lack the artifact tool: the
  orchestrator pastes the item's criteria into the prompt at launch.
- **Mark done**: the orchestrator, after the fast-forward, re-reads the
  artifact (the owner may have edited it), ticks the criteria and sets the
  status from the agent's report, and publishes the edit. The agent never
  touches it.
- **Never committed?** Right. Nothing of it exists in the repository.
- **File a follow-up**: a new block in the same shape, inserted before
  `## Later` (or under it when parked), with the originating item named.
- **Touches and overlaps**: the block's own lines, or the run sheet's queue
  table.

## GitHub Issues

- **Locate**: `gh issue view <N> --json title,body,labels,comments`. Criteria
  are task-list lines in the body; dependencies are `Depends on #M` lines or
  a tracked-by relation; touches and overlaps are lines the orchestrator adds
  as a comment before launch when the body lacks them.
- **Visible in a worktree?** Yes.
- **Mark done**: `gh issue close <N> --comment "<commit hash and summary>"`,
  run by the orchestrator after the fast-forward, never by the agent.
  Criterion ticks: `gh issue edit <N> --body-file <edited body>` by the
  orchestrator from the agent's report.
- **Never committed?** Right. The commit may reference the issue in its body
  only if the project's commit rules allow it.
- **File a follow-up**: `gh issue create --title ... --body-file ... --label
  follow-up` with the originating item named in the body.
- **Touches and overlaps**: an orchestrator comment on the issue, or the run
  sheet's queue table.

## GitLab issues

Same shape with `glab issue view <N>`, `glab issue close <N>`, `glab issue
update <N> --description`, `glab issue create`. Merge requests are not part
of the recipe: landing is a fast-forward on the default branch, and the user
pushes.

## Jira, Linear, other trackers

Through the tracker's CLI or an MCP server available to the orchestrator.
Sub-agents usually lack the MCP server: the orchestrator reads each item at
launch and pastes the criteria into the prompt, and performs every mark and
follow-up itself. Say so in THE SOURCE paragraph.

## A list in the prompt

The owner pasted the items. Ask once whether they already live in an
artifact or a file; if so, that adapter applies. Otherwise the orchestrator
publishes them as a new backlog artifact in the shape above, gives the
owner its link in the first report, and runs the artifact adapter from
there. Only when the harness has no artifact feature does the list go to a
scratch file in the session scratchpad, edited by the orchestrator alone
and copied beside the state note (`checkpoint`) before the session may
end; the final state is reported back as text.
