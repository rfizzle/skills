# Version 3 prototypes (2026-11-19): the reference pair

Scenario: SSRF to cloud account compromise, 11 steps in 5 phases, 13 nodes nested 5 levels deep.

| File | Style | Length |
|---|---|---|
| `a-flat-attack-chain.html` | Flat 2D | 151s |
| `b-isometric-attack-chain.html` | Isometric | 128s |

Owner's verdict: "Both look good. Keep them as references." Earlier in the round: "I love both";
"Pace is right, just that last pause between each step is a little slow" (then shortened);
"Fixed labels and growing tallies read well"; asked for non-active text to be dimmed (done); asked
what the "random squares" on isometric routes were (gate panels, replaced by flat port rings).

The two files pace differently because the end-of-step trim cut more from the isometric one. The
owner has not said which pause length to standardise on.

## How they got here

- `../v2/` is the first build of this scenario (kept for comparison). Owner on flat v2: weird
  cropped cut-offs, streaming too fast, `ListBuckets` unreadable; liked the phase header and the
  narrative below. On isometric v2: static text cluttered, flows a bit fast.
- `BRIEF.md` (flat) and `BRIEF-isometric.md` are the v3 briefs. Later rounds (shorter step-end
  pause, text emphasis, port rings, moving tags give way to labels) were given as follow-ups and
  are recorded in `../../PATTERNS.md`.

## Known rough spots

- Flat: in the services close-up (steps 4 to 7) the account border shows as a faded line at the
  left and bottom, and an old trail line is drawn across the IAM / STS node. In step 2 a leader
  line runs through the "INTERNET" tab.
- Isometric: step 9 is crowded (the "order rows" pill over dimmed blocks, "ns: payments" over the
  payments-api block) and uses only the left half of the frame; there are no proxies, so
  long-distance steps stay zoomed out. Step 10's finding card sits over two blocks.

## Status

Both load with no console errors and `seek(t)` is deterministic (headless Chromium, 1920x1080).
Not exported to video.
