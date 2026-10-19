# The per-agent prompt

## Launch

Launch the implementer role from the run sheet in its own worktree, at the
tier for its size (routine for small and medium, capable for large),
through the mechanism the run sheet's "Worktree launch" line names. The
agent definition carries the rules that never change between runs (worktree
discipline, no stash, rebase on "head moved", refusals, one item only, the
report shape). The prompt below carries the item and the run's facts.

## Fixed prompt

Use verbatim, filling the angle-bracket placeholders from the run sheet.

> Open <SOURCE LOCATE> and implement item <ID>. Read <PROJECT INSTRUCTIONS>
> and applicable skills first. Preserve unrelated worktree changes and never
> edit generated files directly. Follow the project's standards on how work
> items are documented. Satisfy the item's acceptance criteria, run its
> verification plus the repository gate, stage only related repository
> files, and create the listed conventional commit. This item is sized
> <SIZE>: small needs no review; medium, review your own diff inline before
> committing; large, spawn the reviewer sub-agent <REVIEWER AGENT> to review the diff
> against the criteria and fix what it evidences. Then <MARK DONE>. If
> verification fails or you become blocked, and cannot work through it or
> need input, do not commit or mark it complete; report the evidence and
> stop. Do not begin another item. At the end, produce a summary and a table
> of all the work you have done and the files you have changed.

## Addendum

One labelled paragraph each, after the fixed prompt. Only the facts the
agent definition cannot know.

- **SIZE**: small / medium / large, restated, and what that means for
  review (so the agent does not re-decide it).
- **THE SOURCE**: where the item lives, whether it is visible in the
  worktree, how to read it, and who marks it done. For a gitignored file:
  read the main checkout's copy by absolute path, tick with a targeted edit
  there (or put the exact tick text in the report if refused), never stage
  it.
- **VERIFICATION**: the gate command exactly, the commands that are
  forbidden (full CI, evaluations, integration tiers, live experiments),
  whether the gate is known to pass clean on this host, and any shared lock
  or `-p` limit the host needs.
- **GOLDENS AND GENERATED FILES**: the project's regenerate command. Name
  every shared constant to bump and its current value.
- **SIBLINGS**: who is running now, which files each owns, and which later
  item will consume what this one defines (so it leaves a named seam).
- **COMMIT**: the project's commit rules (types, scopes, no item ids where
  the project says so) and the attribution trailers the session uses.
- **DEFAULT BRANCH AND GRANTS**: the default branch name for the first
  fast-forward and for rebases, and any standing permission the user has
  granted for those commands, quoted verbatim with its date.
- **FOLLOW-UPS**: cite the project's scope-and-restraint rule if it has one;
  the agent already knows findings go in the report, not the tree.
- **Project paragraphs** as needed: a spec only the orchestrator edits (the
  agent returns the exact text), a driven capture and its host quirks, a
  benchmark to record.
