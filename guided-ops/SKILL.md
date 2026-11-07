---
name: guided-ops
description: Use this skill when the work needs the owner's hands on something the agent cannot drive itself, a device's admin console, a router's settings page, a vendor dashboard, a media server's setup wizard, a NAS, a device's front panel, reset button or power, while the agent works over SSH, an API or a CLI on the other side. Triggers include "walk me through it", "I'm on the router, where do I go?", "tell me where to put it", "do I need any of these?", "should I change it?", "is the reset the power button?", "why do I need SSH enabled?", the owner replying "done", numbered answers or screenshots of an admin page, and setting up an appliance with the owner at the keyboard. Holds the step block, who does what, verifying, the secrets handoff, screenshots and the closing device record. Not for rotating a secret that leaked (credential-rotation), choosing how a service is exposed (cloudflare-edge), deploying a release to a host the agent already reaches (deploy), or an alert's runbook (service-operations).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Guided operations

When the agent cannot click, the owner becomes its hands, and every unclear
step costs a round trip. Setting up a NAS, a router and a media server with
the owner at the console, the misfires were the agent's: a step asked them to paste a script the console could not hold
("Maximum script length is 8192"), a reset step left them asking "Is the
reset the power button?" and then "I accidently turned it off", "Did all
three" came back with nothing the agent could check, "Why do I need SSH
enabled?" came back because the reason was missing, and a claim token and
a key were pasted into the chat. This skill fixes the shape of each message
so the owner never has to guess.

## Before the first block

1. **Survey from the agent's side.** List what the agent reaches (SSH, an
   API token, a CLI) and read what already exists: users, containers,
   shares, firmware version, current settings. Ask the owner to create
   nothing that the survey shows is already there.
2. **Split the work.** The agent does everything its access allows; the
   owner gets only what needs a hand, an eye, or a session the agent lacks
   (a web console login, a front panel, a vendor account). Never ask the
   owner to type a command the agent could run.
3. **Ask for the missing access once, up front**, one line per item:
   "Enable SSH on the NAS so I can run the container setup myself; the
   alternative is twelve console steps for you." The owner approves
   readily; a "why?" back means the reason was missing. Ask for exactly
   what is lacking, not a broader grant.

## The step block

At most three steps per message. Each step names where (the menu path with
labels as the screen shows them), what to do, what the owner should see
when it worked, and what to do if they see something else.

```text
Block 2 of 4: the share for backups. Afterwards I check from here that the
share mounts.

1. Storage > Shares > New share.
   You should see: a form titled "New share", step 1 of 3.
   Something else: send a screenshot and stop there.
2. Name: `backups`. Leave "Hide this folder" off. Click Next.
   You should see: the encryption step.
3. Leave encryption off (the backup tool encrypts). Click Next, then Apply.
   You should see: `backups` in the folder list.

Reply "done", or the step number and what you saw.
```

- **Numbered so answers come back by number.** Questions in a block are
  numbered too, each with its default: "3. Is there a second disk? Default
  if you don't know: no."
- **A value to copy goes in its own code block**, one value per block.
  Nothing longer than the field can hold: a script or config the console
  would take goes onto the device as a file over SSH, and the console step
  points at the path.
- **A wizard's choices are listed in advance** for every screen the agent
  knows: "On the setup type screen, choose Manual, not the web assistant."
- **A physical action gets its own message, with nothing else in it**: the
  exact control by position and label ("the pinhole marked RESET on the
  back, next to the network port, not the round power button on the
  front"), how long to hold it, the lights or beeps that mean it worked,
  what it erases, and what the wrong control does. A factory reset or a
  pulled drive is not undoable; get a "yes" to what it erases first.

## Waiting and verifying

After a block, stop and wait. Do not send the next block in the same
message. On "done", check from the agent's side before moving on: the port
answers, the container is healthy, the DNS record resolves, the API returns
the new setting. Then say what was verified, in one line ("Verified: the
share mounts from the host and is writable"). "Did all three" or "1 + 2 + 3
all done" gets the same check, step by step. Where the agent has no way to
check, ask for one screenshot of the screen that proves the last step, not
of every step. On numbered answers, answer every number back before the
next block.

## Screenshots

Name what the screenshot shows before directing: "The screenshot shows the
Firewall tab with three rules and an Add button at the top right; click
Add." A misread surfaces in that sentence, not three steps later. When the
screenshot is not the screen the step expected, say so and route from what
is there; do not carry on as if it were. A different firmware version
moves menus: when the labels differ from the agent's expectation, ask for a
screenshot of the menu before writing the next step instead of guessing.

## Decisions in the UI

"Do I need any of these?" and "Should I change it?" get an answer for every
item on the screen: the setting, what to set it to, and why in a clause.
The default when nothing argues otherwise is the conservative one: leave it
as it is, off, not exposed. Never "it depends". If the answer turns on a
fact the agent lacks, check it from its side, or ask that one fact as a
numbered question with the default stated. A setting the owner does not
remember making gets the same treatment: keep or change, and why.

A step that would open an inbound port on the router stops: the default
is no inbound port and a tunnel instead (`cloudflare-edge`).

## Secrets

Tokens, keys, claim codes, passwords and recovery codes never pass through
the chat, in either direction.

| Direction | How |
| --- | --- |
| Owner to agent | The owner writes it into a file the agent reads (the env file on the host, mode 0600, or a path they name) and replies "done". The agent names the file and the variable. |
| Agent or owner to a vendor UI | The owner pastes it into the vendor's field themselves; the agent names the page and the field, never the value. |
| Agent to owner | The agent points at the file that holds it; it never prints one. |

A private key never travels at all: the agent generates the pair where it
will be used and the owner installs the public half. A secret that lands in the chat, from either
side, is exposed: say so in the next message and rotate it before the
session ends (`credential-rotation`); a claim code that expires in minutes
still gets a fresh one. Screenshots carry secrets too: when one shows a
token, a revealed password, a QR code for a login or a recovery key, say
so, and treat it as landed in the chat.

## The closing

The session ends with a written record of what changed on the device, in
the project's docs: `docs/runbooks/<device-role>.md`, one page per device,
beside the alert pages (`project-docs` names the home, `service-operations`
the runbook voice). Where no project holds it, ask the owner once where
records live. It names hosts and devices by role, lists every setting
changed by hand and by the agent with its old and new value, the versions,
where each secret lives (the file or vault, never the value), how to check
it works, and what to do if it breaks, in steps the owner can follow
alone. Template: `references/device-record.md`. Tell the owner the path in
the last message.

## Gotchas

- An admin console's script or text box has a length limit and may strip
  line endings. Anything over a few lines goes onto the device as a file.
- "Done" for three steps is one claim, not three. Verify each.
- A "why?" from the owner is an approval waiting on a reason. Give it in one
  line ("a host firewall still guards the box when the network one is
  misconfigured or a neighbour on the LAN is compromised"), then go on.

## Definition of done

- Every owner step was one the agent could not do, and every access request
  was asked once, with its reason.
- Every block had at most three steps, each with where, expected result and
  what to do otherwise; every physical action had a message of its own.
- Every "done" was verified from the agent's side where it could be, and
  the message said what was verified.
- No secret crossed the chat; any that did is rotated, and the owner knows.
- The device record is written, and the owner has its path.

## References

- `references/device-record.md`: the device page template and its rules.
  Open it at the closing, or when a device page already exists and the
  session changed the device.
