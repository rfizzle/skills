# Prototype brief: one scenario, three visual styles

You are building ONE of three prototypes of the same explainer animation. The owner will open all
three side by side in a browser and say which style works. Visual quality and legibility are the
point: this is a design exercise as much as a coding one. Read the whole brief.

## Output

One self-contained HTML file (path given in your prompt). No build step, no other files. It must
work when opened from `file://` and when served over http.

Allowed external loads, pinned exactly:
- `https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js`
- `https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/MotionPathPlugin.min.js`
- `https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/DrawSVGPlugin.min.js`
- Three.js only if your prompt says so: import map with
  `three` -> `https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js` and
  `three/addons/` -> `https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/`

No web fonts. Use `system-ui, -apple-system, "Segoe UI", sans-serif` and
`ui-monospace, "SF Mono", Menlo, monospace`.

## Scenario: "A token-authenticated request through a service mesh"

Actors (nodes): Browser, Identity Provider (IdP), API Gateway, Orders service, Payments service,
Orders DB.
Trust zones: Internet (Browser), Edge / DMZ (Gateway, IdP), Internal mesh (Orders, Payments, DB).
Zone boundaries must be visible; crossing one is part of the story.

Steps (each is a labelled point on the timeline, with a one-line caption on screen):
1. `login`: Browser sends credentials to the IdP.
2. `token`: IdP returns a signed JWT. Show the token as an object with three visibly distinct
   parts (header . payload . signature) and a couple of readable claims (`sub`, `aud`, `exp`,
   `scope`).
3. `request`: Browser sends `GET /orders/42` to the Gateway with the token attached. It crosses
   the Internet -> Edge boundary.
4. `verify`: Gateway checks the signature against the IdP's public key (JWKS). Make the check
   visible: the signature part lights up, a key appears, a tick lands.
5. `mtls`: Gateway forwards to Orders over mTLS. The link visibly becomes an encrypted channel and
   the packet travelling on it reads as ciphertext, not plaintext.
6. `exchange`: Orders calls Payments with a down-scoped token (scope shrinks from
   `orders:read payments:read` to `payments:read`). Show the token getting narrower.
7. `data`: Orders reads the DB; the response travels back through the Gateway to the Browser.

Total length 18 to 24 seconds at normal speed. Pace it for a presenter talking over it: things
move, then hold long enough to read.

## Theme (dark)

```
--bg:       #0b0f17   page and stage background
--panel:    #121826   node fill
--panel-2:  #18202f   raised surfaces, zone fills (use low alpha)
--line:     #2a3447   borders, idle edges
--text:     #e6edf7
--muted:    #8b98ad
--accent:   #4cc9f0   active edge, plaintext request
--token:    #f5b941   tokens
--identity: #a78bfa   IdP, keys
--secure:   #3ddc97   encrypted channel, verified
--danger:   #ff5d6c   reserve; not needed in this scenario
```
Restraint: most of the frame is neutral, colour marks what is active or what kind of thing it is.
Text must be readable when the stage is shown on a projector: nothing below 22px at 1920x1080
stage size, captions 34px or more.

## Stage and layout

- A fixed logical stage of 1920x1080 (16:9), scaled uniformly to fit the window, centred.
- Caption for the current step in the lower part of the stage, with a small "3 / 7" step counter.
- A controls bar BELOW the stage, outside the 16:9 area: play/pause, previous step, next step, a
  scrubber spanning the whole timeline with a tick per step, and a speed select (0.5x, 1x, 2x).
- Keyboard: Space toggles play, Left/Right go to previous/next step, Home restarts.
- Hovering a node shows a small tooltip with one or two lines about its role (interactive only).
- With `?capture=1` in the URL: hide the controls bar and tooltips, do not autoplay, and make the
  stage fill the window exactly. Without it, autoplay once and stop at the end (no loop).

## Timeline contract (required; the video exporter will rely on it)

- All motion is driven by ONE paused-capable master `gsap.timeline()` with a label per step.
- Expose:
  ```js
  window.anim = {
    duration,            // seconds
    fps: 30,
    steps,               // [{ id, time, caption }]
    seek(t),             // jump to t seconds, paused, and render that exact frame
    play(), pause(),
  };
  ```
- `seek(t)` must produce the same picture every time for the same `t`, whatever was shown before
  (seek forwards, backwards, or straight to the middle). That means: no CSS transitions or CSS
  keyframe animations, no `setTimeout`/`setInterval`/`requestAnimationFrame` loops that advance
  visual state on their own, no `Date.now()`/`performance.now()` in drawing code, no unseeded
  `Math.random()`. Caption text, step counter, colours and visibility are all functions of
  timeline time (set them with timeline tweens/`set` calls or in an `onUpdate` that reads
  `tl.time()`), never side effects of callbacks that only fire when playing forwards.
- For Three.js: render inside the timeline's `onUpdate` and inside `seek`, not in a free-running
  loop.

## Quality bar

- No overlapping labels, no text clipped by its box, packets travel along the drawn edges, nothing
  pops in without a reason.
- Easing with intent (`power2.inOut` for travel, short `back.out` or `power3.out` for arrivals).
  No bouncing for its own sake.
- Write the file so that a different scenario could reuse the scaffolding: keep stage/controls/
  timeline-contract code clearly separated from the scenario's nodes, edges and steps (data near
  the top of the script).

## Checks before you report

- You cannot open a browser. Do not install anything. Extract the script and run `node --check`
  on it (for an ES module script, save it as `.mjs` in the scratchpad directory this brief lives
  in), and re-read your file once for layout arithmetic (label positions inside the stage, nothing
  off-canvas).

## Report back (under 200 words)

File path and line count; the layout approach in two sentences; anything in this brief you did
not do and why; and the two things you think are visually weakest, so the reviewer knows where to
look first.
