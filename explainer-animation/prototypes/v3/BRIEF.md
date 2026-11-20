# Version 3 brief (flat style): fix cropping and motion readability

Start from `../v2/a-flat-attack-chain.html`. Read `../v2/BRIEF.md` and `../v1/BRIEF.md` first;
everything in them still applies unless this file changes it. Same scenario, same 11 steps, same
copy unless a change below needs it.

## Owner feedback on v2 (flat)

- "The cropped area is weird with weird cut-offs."
- "The speed is fast on some of the streaming elements."
- "Events like ListBuckets go very fast, you can't read them."
- Liked: the header showing the phase, and the narrative below. Keep both as they are.

## What is wrong (confirmed by rendering v2)

1. **Cropping.** The camera frames an aspect-ratio rectangle around the touched nodes, so it
   slices straight through containers: a label like "Private subnet" is cut off at the top edge,
   "ns: payments" is cut mid-word at the right edge, bypass lanes run off the bottom into nothing.
   The crop looks accidental.
2. **Long hops.** The estate is very wide and the account services sit far from the attacker, so
   a chip labelled `ListBuckets` crosses about 3,000 diagram units in 2.4s, at half scale, and is
   hidden the instant it arrives. Text that moves that fast and then vanishes is unreadable. The
   exfil stream has the same problem five times over, 0.6s apart.
3. **Small full view.** The whole-estate view runs at about 0.52 scale with a third of the height
   spent on three long bypass lanes; node labels are about 14px.

## Changes

### A. Layout that fits 16:9

Rearrange so the estate is closer to the diagram area's aspect ratio and the bypass is short:
keep the Internet -> Edge -> VPC run left to right along the top, and put the account services in
a row inside the account BELOW the VPC (not a column at the far right). The attacker's direct
route to the services then drops down and runs a short way along the bottom, clearly outside the
Edge and VPC. Tighten paddings where it does not hurt. Target a full-view scale of 0.7 or better;
report what you achieve.

### B. Camera frames that never slice

Replace "rectangle around touched nodes" with these rules:

- A frame is chosen by container: the smallest container (or pair of sibling containers) that
  holds the step's main action, plus a margin. Use the full view when that is the honest answer.
- No visible container border may be cut by the frame edge, with one exception: containers that
  enclose the whole frame (you are "inside" them). For those, show a breadcrumb fixed to the top
  left of the diagram area, for example `AWS account · prod  ›  VPC  ›  Private subnet`, so the
  viewer knows where they are without seeing the border.
- Neighbouring containers that would be partly in frame: either widen the frame to include them
  whole, or keep them fully out. Then soften all four edges of the diagram area with a short fade
  to the background colour (a mask or gradient overlay, about 60px), so whatever remains at the
  edge (fills, lanes) fades out instead of being chopped.
- **Off-frame endpoints become proxies.** When a step's flow starts or ends at a node outside the
  frame (typically the Attacker), do not widen the frame to reach it. Pin a small proxy badge for
  that node at the frame edge where the link leaves (icon + name, for example "Attacker", with a
  small arrow), fixed to the stage, and let packets enter and leave through it. The link's
  on-screen part runs from the proxy to the in-frame node. This is what makes steps 4 to 7 and 9
  readable: frame the services row (or the data path) at a comfortable scale, with the attacker
  as a proxy at the edge.
- Camera moves stay eased and at least 1.2s. Do not move the camera while text that must be read
  is on screen and unread.

### C. Motion that can be read

Hard rules, enforce them in code with helpers, not by hand-tuning each step:

- **Speed cap.** No packet moves faster than 320 px/s measured on the 1920x1080 stage (so hop
  duration = max(1.6s, on-screen path length / 320)). Compute the on-screen length from the path
  length and the camera scale at that time.
- **Text is read standing still.** A moving packet carries at most an icon or a 1 to 2 word tag.
  The thing being said (`s3:ListBuckets`, `GetSecretValue orders-db-pass`, a file name) appears as
  a stationary label: it shows next to the link or at the destination when the packet departs,
  and stays for at least max(2.5s, words x 0.4s) AFTER the packet arrives. Nothing with text is
  hidden on arrival.
- **Requests and responses read as a pair.** Request label holds, then the response label
  replaces it in the same place (for example `ListBuckets` then `-> customer-exports`), rather
  than two chips passing each other.
- **Streams.** At most 4 packets, at least 0.9s apart, plain (no text). The story is told by a
  stationary tally at the receiving end that counts up as each lands (for example
  `orders.csv`, `refunds.csv`, ... as a short list that grows, or `3 of 5 files`).
- **One thing at a time.** In the parallel step (5), stagger the two flows by at least 1.5s so
  the eye can follow both; "parallel" is conveyed by both links staying lit.

Total length will grow. That is acceptable; report it.

### D. Unchanged

Phase rail, narrative band, narration modes, presenter mode, mini-map (hide it when the frame is
the full view), blast-radius markers, the controls step, `window.anim` contract, `?capture=1`.

## You can now render and look

A headless browser works in this environment. Use it; do not report without having looked.

```
SMOKE=/tmp/claude-502/-Users-copierson-Projects-skills/3ce2e9a4-e16b-49d3-a076-4c76570a39ac/scratchpad/smoke
$SMOKE/run.sh frames.mjs <file.html> <outdir> steps          # 3 frames per step (30%, 60%, 95%)
$SMOKE/run.sh frames.mjs <file.html> <outdir> 46.0 47.5 49   # frames at given seconds
$SMOKE/run.sh smoke.mjs <file.html>                           # console errors + seek determinism
```
Write frames to a directory under `$SMOKE/../v3-a/`, then open the PNGs with your file-reading
tool and inspect them. Do not install anything and do not edit the files in `$SMOKE`.

Look specifically for: any container border or label cut by the frame edge; any label
overlapping another label, a node or a link; any text smaller than 22px on the stage that is
meant to be read at that moment; proxies sitting where the link really leaves; packets on their
links; the stationary labels present after arrival. Fix and re-render until the frames are clean.
Rendering all steps costs time, so iterate on the steps you changed, then do one full pass at the
end.

## Report (under 300 words)

File path, line count, total duration, full-view scale achieved, result of `smoke.mjs`; for each
of the three owner complaints, what you did and which frames show it fixed (file names); anything
you looked at and could not get clean.
