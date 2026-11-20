# Render checks

Scripts that load a prototype in headless Chromium with `?capture=1` and drive it through
`window.anim.seek(t)`.

```
npm install && npx playwright install chromium     # once, in this directory
node smoke.mjs <file.html>...                        # console errors, one frame per step, seek determinism
node frames.mjs <file.html> <outdir> steps           # frames at 30%, 60%, 95% of every step
node frames.mjs <file.html> <outdir> 46.0 47.5 49    # frames at given seconds
```

`QUERY='narration=off' node frames.mjs ...` adds query parameters.

## Export

```
node export.mjs <file.html> [--out <dir>] [--narration full|caption|off] [--fps 30] [--gif-width 1280] [--gif-fps 15] [--only full|steps|stills|gif ...] [--range <startSec>,<endSec>]
```

Produces the slide-deck deliverables in `../out/<html basename>/` (git-ignored): `full.mp4`
(H.264, yuv420p, 1920x1080, `+faststart`, CRF 16), `steps/NN-<id>.mp4` (one clip per step, from
its start to its rest frame, held 0.5 s), `stills/NN-<id>.png` (the rest frame of each step, for
PDF decks), `full.gif`
(two-pass palette, 1280 wide at 15 fps) and `manifest.json`. Default narration is `full`: the
film carries the phase rail, the step title and the narrative body text. `--narration caption`
keeps the title only; `off` shows the diagram alone.

Every frame is captured once (seek, two animation frames, screenshot) into a temp directory that
is removed at the end; all outputs are built from those frames. Expect roughly 13 frames per
second of capture, so a 150 s timeline takes about six minutes. `--range 10,20` exports only that
window (steps are clipped to it) and is meant for development. `ffmpeg` is taken from PATH, else
from the `ffmpeg-static` package. The export fails on any page console error or if `window.anim`
does not appear.

Per-style checks written while building v3 (`overlaps`, `hopcheck`, `speed`) are in this directory
too; each file's header says what it asserts and which page hooks it needs.

## Linux without system browser libraries

Headless Chromium needs NSS, X11, GBM, ALSA and fontconfig libraries plus at least one font. On a
machine where those cannot be installed system-wide, unpack the distribution packages into a
private directory and run node with `LD_LIBRARY_PATH=<dir>/usr/lib` and `FONTCONFIG_FILE=<a
fonts.conf that lists the font directory>`. Without fonts Chromium aborts at start-up with
`SkFontMgr_FontConfigInterface ... Not implemented`. The prototypes use the system UI font stack,
so headless renders use whatever font `system-ui` resolves to (Inter in the v3 checks); glyph
widths differ slightly from macOS.

A step's rest frame is where it has finished moving and its title and labels are still on screen.
The page may give it as `window.anim.steps[i].rest`; otherwise the tool uses 0.7 s before the
step's end, which is before the v3 pages start fading the title out.
