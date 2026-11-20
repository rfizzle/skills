# The story file

One JSON file per scenario, named `<slug>.story.json`. It describes what happened (or what the
architecture is) once; the film and the replay page are both built from it, so nothing on screen
can say more than the story does. The worked example is
`assets/examples/ssrf-attack-chain.story.json`: open it beside this page. Every snippet below is
cut from it.

Keys that start with `_` are notes and are skipped by every tool. Use them freely
(`"_note"`, `"_gaps"`).

Where this page says "the kit" it means the build scripts and validator; where they disagree with
this page, the validator wins and this page needs the fix.

## Contents

1. Shape, field by field. 2. Presentation fields. 3. Beats. 4. Provenance. 5. How the two outputs
read it. 6. Gathering, whatever the source. 7. Pattern blocks and what is not there yet.

## 1. Shape, field by field

Legend: **R** required, **O** optional. Ids are lower-case, unique inside their list, and are the
only way records refer to each other.

### `meta` (R)

| Field | | Notes |
|---|---|---|
| `id` | R | slug, used in file names |
| `title` | R | page and film title |
| `tagline` | O | one sentence for the replay masthead |
| `kind` | R | `incident`, `architecture` or `plan` |
| `audience` | R | `technical` or `executive` |
| `redaction` | R | one or two sentences: what was removed or generalised (`"none"` is allowed) |
| `accent` | O | words of `title` to highlight in the replay masthead |
| `summary` | not yet | see section 7: the replay does not read it |
| `incidentRef` | O | the case or ticket id, shown in the replay masthead |
| `startsAt` | O | ISO 8601 time of the first event (`"2026-03-09T14:02:00Z"`); the replay's banner then shows dates (UTC). Without it the banner shows the span. A value that is not a date is a warning |
| `source` | R | see section 4 |

### `zones` (R, may be empty): trust boundaries, nested by `parent`

`{ id, name, short?, parent?, layout?, source }`. `short` is the breadcrumb and replay label
(default `name`). Order matters: siblings are laid out in list order. `layout` hints (all O):
`dir` (`row`|`col`; default alternates by depth, but a zone with two or more children and no `dir`
gets whichever direction fills the diagram area better, chosen by the kit and reported by
`check-layout` as `layout: zone <id> is laid out as ...`; write `dir` to take it over), `gap` (between children, ground units), `pad`
(`{l,r,t,b}` overrides), `main` (this box is the anchor line its parent aligns on), `caps`
(tab in capitals), `below` (place this box under the named sibling instead of beside it),
`belowGap`, `dx`.

`layout.iso` (O, on zones and systems) replaces the `layout` block for `--style iso` only; the flat
hints are written for a wide flat frame, an isometric diamond wants a compact ground plan. Same
keys, with two differences in iso: a `below` child starts under its sibling (x = the sibling's x +
`dx`; flat starts at the parent's left + `dx`) and the sibling's slot widens to hold it; `cols: n`
wraps a row into a grid of n columns and implies a row (with `dir: "col"` it is ignored and
`check-layout` says so). A zone with `layout.iso` gets none of its flat `layout`, so copy what you
keep. What to do when `check-layout` complains: [layout.md](layout.md).

```json
{"id":"services","name":"Services","short":"Account services","parent":"account","layout":{"dir":"row","below":"vpc","belowGap":118,"gap":50,"dx":230,"pad":{"b":62}}, "source":{"kind":"illustrative"}}
```

### `systems` (R)

`{ id, name, short?, sub?, role, tag?, detail?, zone, icon, tint?, layout?, source }`.

| Field | | Notes |
|---|---|---|
| `name` | R | the long name (`Secrets Manager`) |
| `short` | O | what tight places use (`Secrets`); default `name` |
| `sub` | O | muted second line under the name (`169.254.169.254`) |
| `role` | R | one plain-language line, the card text |
| `tag` | O | two or three words for a small graph card (`web firewall`); replay only. The card grows to fit it (to 150 units), wraps it to two lines, then cuts it with an ellipsis; without a tag the card shows the name alone |
| `detail` | O | `{ "what": "...", "did": "..." }`: what it is, what happened to it here; replay panels |
| `zone` | R | a zone id; the system sits directly in that box |
| `icon` | R | `attacker cdn lb store payments chip db iam bucket lock eye` |
| `tint` | O | `danger`, `identity`, `secure`; default neutral |
| `layout` | O | `main: true` (anchor line), `dy` (shift down in a row), `dx` (shift right in a column) |

### `links` (R): what can talk to what

`{ from, to, label?, kind?, route?, source }`. A link is undirected for checking; `from`/`to`
only say which way the first packet usually goes. `kind: "audit"` marks log and detection feeds
(drawn quieter, and used for "what the defenders could see"). `label` is a two-word replay caption.
`route` (O) is a set of hints; without it the router goes straight, or L/Z-shaped through the
gaps between containers:

| Hint | Meaning |
|---|---|
| `exit` | side the link leaves its first system: `top` `bottom` `left` `right` |
| `corridor` | where the long run goes: `below:<zone or system id>` is the gap under that box |
| `lane` | which parallel lane in that corridor, 0 nearest the box; links in one corridor never share a lane |
| `via` | explicit waypoints in ground units (last resort) |

```json
{"from":"attacker","to":"s3","label":"direct from outside","route":{"exit":"bottom","corridor":"below:vpc","lane":1},"source":{"kind":"illustrative"}}
```

Choose lane order so lanes never cross: the farthest target gets the highest lane.

`route.iso` (O) holds the same four hints and replaces the link's `route` for `--style iso` only
(the flat build never reads it). Use it when `layout.iso` moves systems so the flat hints no
longer fit; `"iso": {}` means "no hints in iso". Any other key in `route` or `route.iso` is an error.

```json
{"from":"attacker","to":"s3","route":{"exit":"bottom","corridor":"below:vpc","lane":1,"iso":{"exit":"bottom","corridor":"above:services"}},"source":{"kind":"illustrative"}}
```

### `phases` (R) and `steps` (R)

`phases`: `{ id, title, short?, descriptor?, source }`. `descriptor` is a few words for the replay.

`steps` (the chapters of the film, in order):

| Field | | Limit / notes |
|---|---|---|
| `id`, `phase` | R | `phase` is a phase id |
| `title` | R | at most 6 words |
| `body` | R | at most 30 words; two short sentences read best |
| `short` | O | 2-3 word label for the replay's step strip |
| `detail` | O | longer text for the replay narrative panel |
| `color` | O | `accent` `danger` `token` `secure` `identity`: the step's default colour |
| `touch` | R | system ids the step involves (dims the rest); `[]` for a summary |
| `uses` | R | `[from, to]` pairs, each a link (either direction); `[]` for a summary |
| `frame` | O | camera, see below; default `"full"` |
| `callouts` | O | 0 to 2 of `{ target, text }`, text at most 6 words, `target` a system id; placed by the kit |
| `beats` | R for a good film | see section 3; absent means one plain chain per run in `uses` |
| `all` | O | `true` on the last step: nothing is dimmed |

`frame`: `"full"`, or `{ "hold": [ids], "grow": "down", "zoom": 2 }`. The camera shows the smallest
8:3 view that holds those zone or system ids whole (never slicing a container border). `grow:
"down"` extends only downward, for strips that are too flat for 8:3 (flat style only). `zoom` is
stage px per ground unit and is optional: without it a close-up is no tighter than 1.3; set it
when a small hold should fill the frame (the example's creds close-up uses 2). `camera` beats take
the same `zoom`.

### `controls` (R, may be empty) and `figures`

`controls`: what would have cut the chain, and where: `{ id, name, why, on: [from, to], stops?, source }`.
`on` must be a link. `stops` lists the step ids the control would have prevented; the shield
number on the summary step is derived from it (never typed). `figures` is `{}` for a technical
incident; executive scenes put every number they show there (section 4).

**Replay: the "What would have stopped it" cards.** Every control in the story gets a card (never
dropped; controls that share a cut point all show, in story order). The cut point is computed from
the events, not typed:

1. A control sits on its `on` link. Its cut is the first attacker action that crosses that link at
   or after the earliest step in `stops` (no `stops`: from the start). The card reads "stops it at
   attacker action N of M" and counts that action and every later one as prevented.
2. If the link is only crossed before those steps (a gate upstream of what it protects), the cut is
   the last attacker action across the link before them, and the card adds "its link is last used
   before the steps it stops". Write `stops` as the steps that would not have happened.
3. If no attacker action crosses the link, the card stays, dimmed, and says "Not placed on the event
   log: ..." with the reason. Fix by pointing `on` at a link an event uses, or adding the event.

Attacker actions are events whose `actor` is not `defender`, and not a `system` event with
`visibility: "alerted"` (that is a detection raising an alert).

### `events` (O; required for a replay)

`{ t, step, from, to, action, note, count, visibility, actor, source }`

| Field | Notes |
|---|---|
| `t` | seconds from the first event; keep the original timestamp in `source.ref` when it exists |
| `step` | a step id. Events are ordered by `t`, not by list order. `step` need not follow step order, but the replay's narration and "step N of M" follow the step of the latest event, so an event whose step comes earlier than the previous event's makes the narration jump back: keep steps non-decreasing in time |
| `from`, `to` | system ids |
| `action` | the call or request, as the log shows it |
| `note` | one plain sentence for the replay stream |
| `count` | how many identical calls this record stands for (1 by default) |
| `visibility` | `blind` (nothing recorded), `logged`, `alerted` |
| `actor` | `attacker`, `defender`, `system` |

Totals, spans, "N of M" and time to detect are derived from these. Never type them.

**No events, no replay.** A replay is built from time-stamped events: a log, a ticket timeline, a
chat thread with times. An architecture or a plan has decisions and milestones, not an event log,
so it has a film only: leave `events` out, and `build.mjs --replay` refuses the story
("this story has no events, so there is nothing to replay"). Do not invent a log to get a replay;
an illustrative one is allowed only when the owner asks and sees it at the confirmation.

**Replay: "N of M systems reached".** M is the systems in `systems` minus the attacker's own: the
system the first attacker action starts from (`from` of the first event whose `actor` is `attacker`).
It is not a system that was reached, so it is left out and the page says so wherever the figure
appears ("9 of 10 systems reached, excluding the attacker"; a system not named "attacker" is named
in the label). A compromised system that later acts for the attacker counts as reached. N counts
the other systems on the route of an attacker action (a request through a CDN reaches the CDN).
Systems the attacker never touched (the detection tooling, the responders) are in M and not in N.
To change what is left out, change which system the first attacker event starts from; there is no
other switch.

**Replay: reconstruction banner.** The masthead and the sticky bar both carry one quiet line: "Reconstruction of
recorded events, not a live view", then the incident's range: dates and times in UTC when
`meta.startsAt` is set ("9 Mar 2026, 14:02 to 16:40 UTC"), else the span ("covers 2 hours 10
minutes of the incident"). When every record is illustrative it says "invented events" instead of
"recorded". Whether some records are illustrative is not repeated there: the chip says it.

**Replay: link labels and the graph.** `label` on a link is shown on the graph where it fits. When
a label does not fit its link it is shortened to its first word or hidden (the link keeps the full
text as a tooltip), and `build.mjs --replay` prints `warning: replay: no room for N link labels ...`
naming `replay.layout`. The graph also warns when it is wider than the page draws it at a readable
size. To move a system to another cell, add a top-level block:
`"replay": { "layout": { "<system id>": [column, row] } }` (the film ignores it), or shorten the label.

## 2. Presentation fields (the film reads, the replay ignores)

`layout` on zones and systems, `route` on links, `frame`, `callouts` and `beats` on steps, `color`,
`icon`, `tint`. They are chosen by whoever writes the film; gathering never needs them. The replay
draws its own small graph from zones, systems and links, so a story with no presentation fields
still replays.

## 3. Beats: the closed vocabulary

A step's `beats` run in order. A beat starts when the previous ends, unless it has
`"parallel": true` (1.5 s after the previous started) or `"at": <seconds>` after the step's motion
starts. `at` is valid on every beat except `card`, where `at` names the system. A beat's kind is the
first of `chain exchange stream card camera shields pulse custom mark` present as a key; `mark`
beside another of them is that beat's field. An unknown key inside a beat is an error. You never
set a duration or a speed: the kit caps packet speed, holds each label long
enough to read, and spaces the steps. Every id is a system id and every hop in a path must be a
link.

| Beat | Fields | Worked example (from the story) |
|---|---|---|
| `chain` | `[ids]` path, `tag` (1-2 words), `color`, `says` (string or array of lines), `sayAt` (a system id; default the destination, and either end of the chain works: `"sayAt":"attacker"` puts the text at the sender), `trail`, `mark`, `mono` | `{"chain":["attacker","cdn","lb","storefront"],"tag":"GET","color":"accent","says":"GET /shop?id=7","sayAt":"attacker"}` |
| `exchange` | `[from,to]`, `tag`, `req`, `resp`, `respTag`, `respColor`, `color`, `mono`, `trail`, `mark` | `{"exchange":["attacker","iam"],"tag":"API call","respTag":"result","req":"sts:GetCallerIdentity","resp":"→ role: node-role","mono":true,"trail":true,"mark":"iam"}` |
| `stream` | path of two or more ids, `items` (at most 4), `says`, `tally` (heading), `mono`, `color`, `tag`, `glyph` (`dot` default, `file`, `push`, `mail`, `key`: the packet's shape; a `tag` replaces it with a chip) | `{"stream":["s3","attacker"],"items":["orders.csv","refunds.csv","emails.csv","cards.csv"],"says":"s3:GetObject","mono":true,"tally":"received:"}` |
| `card` | `card` (id), `at` (system), `title`, `rows`, `color`, `then` (`"fold"`) | `{"card":"cred","at":"imds","rows":["AccessKeyId","SecretAccessKey","SessionToken","Expiration"],"color":"token","then":"fold"}` |
| `pulse` | system id, `color` | `{"pulse":"iam","color":"identity"}`: a ring on a system, no packet |
| `mark` | system id | `{"mark":"db"}`: the blast-radius marker, when it should appear on its own |
| `camera` | `{hold:[ids],grow?,zoom?}`, `"step"` or `"full"` | `{"camera":{"hold":["cluster"]}}`, later `{"camera":"full"}` |
| `shields` | `"controls"` or control ids | `{"shields":"controls"}`: the summary step |
| `custom` | `"custom": "<kind>"`, free fields | needs `build.mjs --extra <file.js>` registering `EXK.extra.beats.<kind>`; at most one kind per story |

Behaviour worth knowing:

- `chain`: one packet along the hops; the links light; a ring on each arrival; the `says` box
  appears at departure and stays after arrival. `mark` is shorthand for a `mark` beat at arrival;
  `mark` may sit on `chain` and `exchange`, as in the example above.
- `pulse`: a ring on a system, no packet, no text. Safe in both styles; use it to point at a system
  that something happens to without a hop.
- `exchange`: the response label replaces the request label in the same box; `respColor` gives
  the response its own colour (request red, response yellow).
- `card`: a `title` line above the rows; holds long enough to read, then folds into its system if
  asked. Iso shows one card per step.
- `stream`: packets at least 0.9 s apart; the tally lines appear as each packet lands, under the
  badge that stands in for an off-frame sender.
- `camera`: a mid-step move (flat style only). Motion resumes 1.8 s later.
- A system that sits outside the camera is shown by a small proxy badge at the frame edge. Writing
  `frame` is enough; there is no proxy beat.

### A whole step

```json
{ "id": "creds", "title": "Metadata service hands over keys", "touch": ["attacker","cdn","lb","storefront","imds"],
  "uses": [["imds","storefront"],["storefront","lb"],["lb","cdn"],["cdn","attacker"]], "frame": "full",
  "beats": [ {"camera":{"hold":["cluster"]}},
             {"card":"cred","at":"imds","rows":["AccessKeyId","SecretAccessKey","SessionToken","Expiration"],"color":"token","then":"fold"},
             {"camera":"full"},
             {"chain":["imds","storefront","lb","cdn","attacker"],"tag":"credentials","color":"token","says":["AccessKeyId","SecretAccessKey","SessionToken","Expiration"],"sayAt":"attacker"} ] }
```

### What the vocabulary cannot say

Do not invent a beat. Express the nearest thing and list the loss in a top-level `_gaps` array:
`{ "step", "page", "beats" }`: what the original did, and what your beats do instead. The
reference story has 13; they are the backlog for the kit. Known gaps: link-anchored labels with
their own timing, an alert badge beat, a recap beat apart from `shields`, timed callouts, hand-set
shield and label spots, a stream counter.

## 4. Provenance

Every record (meta, zone, system, link, phase, step, control, event, figure) carries
`source: { "kind": "provided" | "derived" | "illustrative", "ref"?: "..." }`.

- `provided`: stated by a source the owner supplied; `ref` says which, precisely enough to find it
  again. Never a guess.
- `derived`: computed from provided records; `ref` names the rule.
- `illustrative`: invented to complete the picture. The reference story is entirely this, so its
  film and replay show the "Illustrative" chip. The replay words its chip from the records it
  shows (meta, zones, systems, links, phases, steps, controls, events): "Illustrative data" when
  all are illustrative; "Includes illustrative records (N)" when some are, with a small amber
  diamond on each illustrative control card, event in the stream and graph link (explained once in
  the footer); no chip when none are.

Rules:

1. Nothing is upgraded. A derived value is illustrative if any input is.
2. Any scene that shows an illustrative record carries the chip while it is visible.
3. Counts are computed. No totals, spans, "N of M", first or last seen, time to detect, or step
   counts in text ("nine steps done" is a count). Per-event `count` is event data, not a total.
   `check-story` warns about a quantity that looks like a count of things (digits and a noun, a
   number word and a noun, "N of M", "x4") in a title, body, callout, `says`, `req`/`resp`, card row
   or tag, and lets versions, ports, addresses, times, HTTP codes, paths and identifiers pass; where
   a number is part of a quoted name, put it in double quotes or set `"_literal": true` on the step,
   beat or callout ([rules.md](rules.md) section B lists the exemptions).
4. Gaps are asked about, not filled. List conflicts and missing evidence for the owner.
5. Redaction by default: no credentials, tokens or key material; generalise hostnames, addresses,
   account ids and names to roles unless told otherwise. `meta.redaction` says what was done.
6. Times are seconds from the first event; long silences stay in the data (the replay compresses).
7. One confirmation before building: show a summary of systems, steps, event counts by source
   kind, figures and open gaps.

## 5. How the two outputs read it

| Output | Reads | Ignores |
|---|---|---|
| Film (`--style flat` or `iso`) | `zones`, `systems`, `links` (with `route`), `phases`, `steps` (all fields, `beats`, `frame`, `callouts`), `controls`, `figures` | `events`, `detail`, `tag`, `short` of steps |
| Stills | the same, at each step's rest frame | the same |
| Replay (`--replay`) | `meta`, `zones`, `systems` (`role`, `tag`, `detail`), `links`, `phases`, `steps` (`title`, `short`, `body`, `detail`), `controls` (`why`, `on`, `stops`), `events` | `layout`, `route`, `frame`, `callouts`, `beats`, `icon` (it has its own grid) |

The film shows a step's `title` and `body`; the replay shows the same text beside the clock. Keep
the copy true to both: a body that only makes sense next to an animation fails in the replay.

Checks without a browser: `node scripts/check-story.mjs <story>` validates references, limits and
provenance and prints one line per problem with a fix.

## 6. Gathering, whatever the source

The story is source-agnostic: the owner's material may be chat (Slack, Teams), a log or ticket
system, documents or pasted notes, and nothing here assumes one. For each source in the session:

1. Say what is being read and why; read only what the question needs.
2. Pull candidate facts: who or what acted, on what, when, what was observed, what was done in
   response; which systems and boundaries are named.
3. Record each with its `source.ref` ("incident channel, message at 14:02 UTC on the 9th",
   "audit log export, row 412").
4. Merge across sources: the same event from two places is one record with both refs; conflicts
   are kept side by side and raised as gaps (rule 4).
5. Map events to steps and systems. Events that fit no step suggest a missing step: propose it.

The same procedure serves an architecture or a plan: the "events" are then decisions, milestones
or measurements, and many such stories have no `events` at all (no replay). Before building, show
the owner the summary of rule 7. Event times are converted to seconds from the first event, with
the original timestamp and zone in `source.ref`.

## 7. Pattern blocks (the custom pattern) and what is not there yet

A story built with `--pattern custom` (the scene file draws the picture, [patterns.md](patterns.md)
section 3) names its scene with `meta.scene` (the name the file registers as
`EXK.scenes.<name>`; optional when exactly one is registered) and carries the scene's data as
top-level pattern blocks of free shape: `runs`, `states`, `objects`, `horizons`, `lanes`,
`initiatives`, `risks`, `dependencies`, `layers`, `coverage`, or any other top-level array of
records. `check-story` requires only a `source` on every record of every block (and the usual `ref`
on a `provided` one); the scene reads a block with `ctx.block("lanes")`. A story needs no `zones`,
`systems` or `links` then. Steps still need `title` and `body`, and may carry fields the scene
reads (the roadmap example's `act` and `horizon`); the kit shows each step's title and body, the
scene does the rest. A step's own `source` does not drive the chip: the scene reports what is on
screen (patterns.md section 3).

Every number the scene shows is a `figures` entry:
`{ "key": { "value", "unit", "label", "source" } }`; the scene reads it with `ctx.figure("key")`
(an unknown key stops the page at start-up with a message naming the keys that exist), and
a `unit` of `count` is refused: counts are computed (`ctx.count(n, of)`). The example
`assets/examples/roadmap-risk-burn-down.story.json` is a complete custom story.

Not yet:

- `meta.summary` (a short incident summary for the replay's introduction): the replay does not
  read it, so the schema has no such field; the masthead uses `title`, `accent`, `tagline`,
  `incidentRef` and the computed totals.
- Beats for the `_gaps` above; a second `custom` beat kind; pattern modules beyond `flow` (a scene that is
  not estate-based goes through the custom pattern).
- Hover or click inside the film: the stage never responds to the mouse. Wishes to click belong to
  the replay.
