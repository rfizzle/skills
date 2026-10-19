# Run sheet

Filled once per run, quoted in every prompt. Keep it in the session
scratchpad and paste the relevant lines into each addendum.

```
Project:             <name and main checkout path>
Source:              <adapter> at <location>; visible in worktree: yes/no
Read an item:        <command or file convention>
Mark done:           <edit or command>; by <agent|orchestrator>; committed: yes/no
File a follow-up:    <format or command>
Finish line:         <the items or milestone that end this run>
Parked list:         <where non-qualifying follow-ups go>
Default branch:      <master|main>
Gate:                <exact command>; tools present on this host: yes/no
Forbidden:           <commands agents must not run>
Commit rules:        <types, scopes, subject rules, body rules, trailers>
Attribution:         <trailer lines>
Models:              session Opus; backlog-implementer sonnet (small, medium) / opus (large); diff-reviewer Sonnet; design briefs to architect (Fable)
Standing grants:     <user permissions to quote, verbatim, with date>
Shared conflicts:    <file: resolution> ...
Sizes:               <id: small|medium|large> ...
Queue:               batch 1: <ids>; batch 2: <ids> ...; per item: files, overlaps, depends on
Status cadence:      every 5 landings
Push:                only on request (ask in the first report)
```

## Example (astimate, 2026-09-29)

```
Project:             astimate, /Users/copierson/Projects/astimate
Source:              gitignored markdown at /Users/copierson/Projects/astimate/.backlog.md; visible in worktree: no
Read an item:        block "### S-NNN:" to the next "### "; **Status:** line; - [ ] criteria
Mark done:           orchestrator sets **Status:** done and ticks criteria from the report; committed: no
File a follow-up:    new ### block before "## Later", fields Status/Depends on/Description/Tasks/Acceptance Criteria/Tests
Finish line:         S-153, S-155, S-156, S-157, S-159 landed; S-154 and S-161 are the user's; S-158, S-146, S-160 wait on them
Parked list:         one-line notes under "## Later" in .backlog.md
Default branch:      master
Gate:                make check (actionlint tidy fmt vet lint test selfcheck readme-check); golangci-lint installed 2026-09-29
Forbidden:           calibration/rebuild run --live; replaying corpora; anything that clones or downloads
Commit rules:        Conventional Commits per AGENTS.md; scopes from the story tags; no story ids in messages; SPEC.md updated in the same change
Attribution:         Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Models:              session Opus; backlog-implementer sonnet (small, medium) / opus (large); diff-reviewer Sonnet; design briefs to architect (Fable)
Standing grants:     "For future sub-agent reference: you are allowed to use `git merge --ff-only master` and `git rebase master` inside worktrees" (2026-09-27)
Shared conflicts:    CHANGELOG.md Unreleased: keep both; SPEC.md: rebase; testdata goldens: regenerate with -update; internal/config/default.yaml and its goldens: rebase
```
