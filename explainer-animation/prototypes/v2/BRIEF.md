# Version 2 brief: stress test, slower pacing, narrative

Version 1 lives in `../v1/` (three HTML prototypes, `BRIEF.md`, `NOTES.md`). Read `../v1/BRIEF.md`
first: its output rules, allowed CDN loads, theme, stage, controls, keyboard, `?capture=1` mode,
timeline contract, quality bar, checks and report format ALL still apply unless this file changes
them. Then read the v1 file for your style and start from its scaffolding; the owner saw it run
and found nothing broken, so keep what works.

The owner's feedback on v1: likes the styles (isometric most, flat second), pacing was a bit
fast, detail level is right, wants a narrative mechanism that explains what is going on without
taking much away from the visual, and wants a stress test with much deeper nesting and more
complex flows. Version 2 answers all four.

## 1. Scenario: "SSRF to cloud account compromise" (attack chain)

### Structure (nesting is the point; five levels deep)

```
Internet
  Attacker
AWS account "prod"
  Edge
    CDN / WAF
  VPC
    Public subnet
      Load balancer
    Private subnet
      EKS cluster
        namespace: web
          storefront (pod, vulnerable to SSRF)
        namespace: payments
          payments-api (pod)
      Instance metadata service (IMDS, 169.254.169.254; on the node, outside the namespaces)
    Data subnet
      Orders DB
  Account services (in the account, outside the VPC)
    IAM / STS
    S3 bucket "customer-exports"
    Secrets Manager
    CloudTrail + GuardDuty (detection)
```

Every container above is drawn as a container with a label; children sit visibly inside their
parent. Compute container bounds from their children plus padding (do not hand-type container
rectangles), so adding a node does not mean re-doing arithmetic.

### Steps, grouped into phases

Initial access
1. `recon`: a normal request: Attacker -> CDN/WAF -> Load balancer -> storefront. Establishes the
   legitimate path.
2. `ssrf`: the attacker sends a crafted `?url=http://169.254.169.254/...` parameter along the same
   path; storefront makes a server-side request to IMDS.

Credential access
3. `creds`: IMDS returns the node role's temporary credentials. Show them as an object
   (`AccessKeyId`, `SecretAccessKey`, `SessionToken`, `Expiration`) that travels back out to the
   attacker along the response path.
4. `identity`: the attacker uses the credentials from outside, calling IAM / STS directly. This
   flow enters the account WITHOUT passing the WAF, load balancer or VPC; make that bypass obvious.

Discovery and exfiltration
5. `enumerate`: two flows at once: list S3 buckets, list secrets (parallel fan-out from the
   attacker).
6. `exfil`: objects stream from the S3 bucket to the attacker (a run of several packets, not one).
7. `secret`: the attacker reads the Orders DB password from Secrets Manager.

Lateral movement
8. `pivot`: back in through storefront, then sideways from namespace `web` to `payments-api` in
   namespace `payments` (no network policy stops it).
9. `db`: payments-api connects to Orders DB with the stolen password; rows flow out to the attacker.

Detection and controls
10. `detect`: CloudTrail + GuardDuty raises a finding (credentials used from outside the account),
    late. Show how much of the chain had already happened.
11. `controls`: the whole chain is shown at once as a traced route, then shield markers land on
    the links where a control would have broken it, each with a short label: WAF rule (2), IMDSv2
    hop limit (2/3), least-privilege node role (5), S3 bucket policy / VPC endpoint condition (6),
    network policy (8). Everything after the first shield fades to show the chain is cut.

Attacker-controlled flows use `--danger`. Legitimate traffic uses `--accent`. Stolen credentials
use `--token`. Controls and detection use `--secure`. A node the attacker has compromised or
abused gets a persistent danger-coloured marker from that point on, so the picture accumulates the
blast radius.

## 2. Handling complexity

About 13 nodes and 12 containers will not all be readable at once at 1920x1080 with the 22px text
minimum. Use these, driven by the master timeline:

- **Camera.** The stage has a camera (pan and zoom of the diagram layer; for SVG, tween the
  `viewBox` or a wrapping group's transform). Open on the whole estate, then for each step frame
  the region where the action is, with eased moves of 1.2s or longer. Return to the full view for
  step 11. Text minimums apply at the zoom level where the text is meant to be read; in the full
  view, container labels must be readable but node detail may be small.
- **Focus.** Nodes, containers and edges not involved in the current step dim to roughly 35%.
- **Persistent trail.** Links the attacker has used stay faintly marked in the danger colour.
- **Mini-map.** A small outline of the whole estate in a stage corner with a rectangle showing the
  camera's current frame and a dot for the active node. Hide it when the camera is at full view.

Narrative UI (captions, phase rail, mini-map) is fixed to the stage and does NOT move with the
camera.

## 3. Pacing

Slower than v1 throughout:
- Packet travel 1.6s to 2.4s per hop; camera moves 1.2s to 1.8s.
- After the last motion in a step, hold for the longer of 2.5s and (words in the step's narrative
  body / 3) seconds, before the next step starts.
- Expect a total of 80 to 110 seconds. That is fine.

## 4. Narrative

Each step in the scenario data carries:
```js
{ id, phase, title,        // title: 6 words or fewer
  body,                    // one or two sentences, 30 words or fewer, plain language
  callouts: [{ target, text }] }   // 0 to 2 per step; text 6 words or fewer; target is a node or edge id
```
Write this copy yourself; it should read like a security architect talking a mixed audience
through the incident, saying what happens AND why it matters. No jargon without a reason.

Presentation:
- **Phase rail** along the top of the stage: the five phase names with the current one
  highlighted, and one dot per step under its phase (done / current / upcoming).
- **Narrative band** in the lower part of the stage, reserved so it never covers the diagram's
  active region: step title, then body. The body appears after the step's first motion has
  started, not before.
- **Callouts**: small labels with a leader line, anchored to their target in diagram space (they
  follow the camera), appearing when the thing they name becomes relevant and leaving at the end
  of the step.
- **Narration modes**, cycled with the `N` key and a control in the controls bar, and settable
  with `?narration=full|caption|off` (default `full`): `full` shows everything; `caption` shows
  the phase rail and step title only; `off` shows the diagram alone. Modes change visibility
  only: timing and `window.anim` are identical in all three.
- **Presenter mode**, toggled with `P` and settable with `?present=1`: playback pauses by itself
  at the end of each step and the Right arrow continues. Implement the pause from timeline time
  (for example in `onUpdate`, comparing `tl.time()` with the next step's time while playing), so
  `seek(t)` is unaffected.

Add `phases` to `window.anim` (`[{ id, title, firstStep }]`) and `title`, `body` to each entry of
`steps`.

## 5. Checks and report

As in the v1 brief. You still cannot open a browser, so also write a small node script (in the
scratchpad directory, not the repo) that loads your scenario data and layout functions and
asserts: every child's box is inside its parent container's box, no two sibling boxes overlap, no
two node labels overlap in the full view, and every step's camera frame contains all nodes that
step touches. Report what it checked and its result.

In the report, also say plainly where this style struggled with the complexity; the owner is
using this version to decide whether the style scales.
