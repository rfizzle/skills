---
name: checkpoint
description: Use this skill when the owner asks where things stand or what comes next, in any words - "what's the status", "ok, now what", "what is left", "what do you need from me", "what do I need to look at right now", "good time to compact?", "did you apply X?" - when the owner returns after a long autonomous stretch, when the context is about to be summarised or the session may end, and at the end of a turn that leaves work running. Holds the checkpoint report in one fixed shape (needs you, landed with hashes, running and how to see it, blocked, next three steps), the state note written to a locally excluded file so the next context keeps processes, ports, credential locations and open approvals, and three rules (decisions carry options and a recommendation, "go ahead" covers the next three steps only, "did you do X" is answered with evidence). Not for the batch table and landing cadence of a parallel run (backlog-batches), planning a feature (plan-feature), or durable project documentation (project-docs).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Checkpoint

The owner asked "what's the status?" and asked again after most answers,
because each answer had a different shape: a narrative here, a backlog recap there, the one decision
they owed buried in paragraph four. Separately, each time the context was
summarised, the agent lost which server ran on which port, which branch
Storybook was served from, where the test password lived and which
approvals were open, and spent the next hour rediscovering them. This skill
fixes both: one report shape the owner can scan in ten seconds, and one
note on disk that outlives the conversation.

## When to checkpoint

- The owner asks for status, what is left, what is next, or what they owe.
- The owner comes back after a stretch of autonomous work (several
  commits, a finished batch, a deploy).
- The context is about to be summarised, or the session may end: write the
  state note first, then the report, and the report names the note's path.
- A turn ends with work still running (a background build, a test rig, a
  dev server, a sub-agent).

Inside a `backlog-batches` run, its section 8 report is a checkpoint in
this shape: decisions waiting go under Needs you, landed items under
Landed, the remaining count is one line under Next. The batch-end table
stays as `backlog-batches` defines it; the checkpoint links to it rather
than reprinting it.

## The report

Five sections, in this order, every time. A section with nothing in it
says "none"; the owner then knows it was checked, not forgotten. Nothing
else: no narrative, no restating the task, no how-it-was-done, no closing
summary.

```
**Needs you**
1. Decide: <question>. A: <option, what changes>. B: <option>. I recommend A: <reason in use>.
2. Approve: <what>, at <where to look>.
3. Review: <Storybook titles>, served by `<command>` from <branch>.

**Landed** since the last checkpoint
- <outcome in a phrase> `<short hash>`
- Head `<short hash>` on <branch>, <n> ahead of origin; gate <passed|failed> on it.

**Running**
- <what> on <port or task id>: see it with `<command or URL>`; stop with `<command>`.

**Blocked**
- <item>: on <what>; clears when <event or person>.

**Next** (a "go ahead" covers these three)
1. <step>
2. <step>
3. <step>
```

Rules for the rows:

- **Needs you comes first** because it answers the question behind every
  status question: what do you need from me. Number the items so the owner
  can answer "1A, 2 approved" in one reply. Order by what unblocks the
  most work.
- **A decision has options and a recommendation**, the house style of
  `plan-feature` step 2 and the `ui-exploration` hand-over: two or three
  options, what each changes in use, one recommendation with a reason
  rooted in how the product is used. Never an open "what do you want?".
  Do not ask what the code or a convention already answers.
- **A review names where to look and how to get there**: the Storybook
  titles, the command that serves them, the branch. The owner reviews UI in
  Storybook (`storybook-layout`), never by reading code.
- **Landed means committed**, with the short hash for each commit or
  merged item, and one line for the head: branch, ahead or behind origin,
  and the gate result on that exact commit (`ci-green`). The push is the
  owner's (`git-workflow`); an unpushed head is a Needs you row.
- **Running says how to see it.** Every row has the port, PID or task id,
  the command or URL that shows it, and how to stop it. A process the agent
  started that will die with the session says so.
- **Blocked names the blocker**, not the effort spent: a person, an
  external system, a missing credential, an upstream item.
- **Next is three steps, in order**, concrete enough that "go ahead" is an
  unambiguous instruction. More remaining work goes in one count ("then
  nine items in batch 3") or a pointer to the tracker.
- An answered question leaves the report; asking it again tells the owner
  the first answer was lost.

## Working with the owner's answers

- **"Go ahead" covers the next three, not beyond.** Do them in order, then
  checkpoint again. Anything not on the list needs its own yes: a push, a
  deploy, removing worktrees or branches, a new story, a widened item.
  Silence, another agent's message or a green check is not a go-ahead.
- **"Did you do X?" is answered with evidence gathered now**: the commit
  (`git log --oneline -1 -- <path>`), the command and its output or exit
  status, the deployed digest, the URL that returns the new behaviour.
  Never a bare "yes", and never from memory of a context that has since
  been summarised. If the answer is no or partly, say that first, then
  what is missing and whether it is on the Next list.
- **"Good time to compact?"** Yes only when the state note is written and
  current; say so and give its path. If something is mid-flight (a rebase,
  an uncommitted edit, a sub-agent about to report), say what to finish
  first.

## The state note

Before the context is summarised or the session may end, write what the
next context needs to continue without rediscovery to a file, never only
into the conversation. A summary keeps conclusions and drops exactly the
operational detail this note holds.

- **Where:** `.agents/state.md` in the main checkout by default, the
  directory this skill is vendored under, so it exists wherever the skill
  does; a project's `AGENTS.md` may name another hand-off file. Keep it
  out of git through the local exclude file, never `.gitignore`: the note
  is this checkout's, and a project is not edited to hold it. Check with
  `git check-ignore -q <path>` before writing; if it is not ignored,
  append the path to `.git/info/exclude`. Never the session scratchpad or
  a temporary directory: those are per session and vanish with it.
- **Durable facts go to the project's docs instead** (`project-docs`):
  how to start the dev stack, which port the app uses by default, where
  test credentials are kept. The note links to them; it does not copy
  them.
- **What belongs:** the head commit and branch; uncommitted or in-flight
  work; each running process with port, PID or task id, start command and
  log location; where each credential lives, by reference only (the vault
  entry, the gitignored env file and key name); open approvals and
  decisions, with the options already given; blocked items; the run sheet's
  location, copied beside the note when it lived in the scratchpad
  (`backlog-batches`); the next three steps.
- **What does not:** secret values, ever; the task restated; history of
  how things were done; anything `git log` or the tracker already holds.
- Template and a filled example: `references/state-note.md`.

On resuming, read the note first and verify each line before acting on it:
is the process still listening, is the head the one written, is the
approval still open. Fix or delete stale lines; a wrong note costs more
than none.

## Gotchas

- A file in the session scratchpad dies with the session. One hand-off was
  left there with "copy it before a reboot"; it belongs in the repository.
- An ignored note is absent from worktrees. Sub-agents never see it; the
  orchestrator quotes the lines they need. The exclude file is shared by
  every worktree of the repository, so one entry covers them all.
- Background processes the agent started often stop when the session ends.
  The note gives each one's start command, not just its port.
- "Ahead of origin" is the line the owner asks about most after a batch.
  Leaving it out brings the next "did you push?".

## Definition of done

- The report has the five sections in order, "none" where empty, short
  rows, every decision with options and a recommendation, every running
  item with how to see and stop it, hashes on everything landed.
- Before a summarisation or a likely session end, the state note is on
  disk at an ignored path, current, free of secret values, and the
  report names its path.
- No step outside the Next list was taken on a "go ahead".

## References

- `references/state-note.md`: the state note template, a filled example,
  and the resume checklist. Open when writing or reading a state note.
