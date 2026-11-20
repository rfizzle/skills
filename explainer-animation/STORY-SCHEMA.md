# Story: the one input behind every output

A **story** is the source-agnostic description that a film, its stills and a replay page are all
built from. It exists so that gathering ("what happened, what do we know") is separate from
drawing, and so nothing on screen can be more certain than its source.

The owner gathers material from whatever is connected in the session: chat (Slack, Teams), log
and ticket systems, documents, pasted notes. The skill must not assume any particular source. It
normalises whatever it is given into this shape, shows the result for confirmation, and only then
builds.

Status: draft. The prototypes do not read this shape yet; each carries its own data at the top of
its script. The field names below follow what those prototypes ended up needing.

## Shape

```js
story = {
  meta: {
    id, title, tagline,
    kind: 'incident' | 'architecture' | 'plan',
    audience: 'technical' | 'executive',
    redaction: 'what has been removed or generalised, in one or two sentences'
  },

  zones:   [{ id, name, parent? }],                 // trust boundaries; nesting by parent
  systems: [{ id, name, role, zone }],              // role: one line, plain language
  links:   [{ from, to, label? }],                  // what can talk to what

  phases:  [{ id, title, descriptor }],
  steps:   [{ id, phase, title, body, detail?,      // title <= 6 words; body <= 30 words
              touch: [systemId], uses: [[from, to]] }],

  events:  [{ t, step, from, to, action, note,      // optional; required for a replay
              count, visibility, actor }],          // visibility: blind | logged | alerted
                                                    // actor: attacker | defender | system

  controls: [{ id, name, why, on: [from, to] }],    // what would have cut the chain, and where
  figures:  { key: { value, unit, label } },        // every number shown that is not counted

  // pattern-specific blocks, present only when the pattern needs them
  runs?, states?, objects?, horizons?, lanes?, initiatives?, risks?, layers?, coverage?
}
```

Every record (a system, a step, an event, a figure) also carries:

```js
source: { kind: 'provided' | 'derived' | 'illustrative', ref?: 'where it came from' }
```

- `provided`: stated by a source the owner supplied. `ref` says which, specifically enough to
  find it again ("incident channel, message at 14:02 UTC on the 9th", "audit log export, row
  412"). Never a guess.
- `derived`: computed from provided records (a count, a span, a first-seen time). `ref` names
  the rule.
- `illustrative`: invented to make the picture complete. Allowed, never silent.

## Rules

1. **Nothing is upgraded.** An illustrative value stays illustrative until the owner supplies
   the real one. A derived value is only as good as its inputs: if any input is illustrative, so
   is the result.
2. **Illustrative material is marked on screen.** Any scene, film or replay that shows an
   illustrative record carries the "Illustrative" chip while it is visible (PATTERNS.md,
   executive scenes). A story made only of provided and derived records carries none.
3. **Counts are computed.** Totals, spans, "N of M", first and last seen, time to detect and
   similar are never typed into the story; they are derived from `events`, `systems` and `steps`.
4. **Gaps are asked about, not filled.** When sources disagree, or a step in the chain has no
   evidence, the skill lists the conflict or gap for the owner and waits. It may propose an
   illustrative bridge, labelled as such.
5. **Redaction by default.** Credentials, tokens and key material never enter a story. Hostnames,
   addresses, account ids and people's names are generalised to roles ("payments service", "the
   on-call engineer") unless the owner says to keep them. `meta.redaction` says what was done.
6. **Times are normalised.** Event times are converted to seconds from the first event, with the
   original timestamp and zone kept in `source.ref`. Long silences are kept as they are in the
   data; compressing them is a display decision made by the replay.
7. **One confirmation before building.** The skill shows the owner the story as a short readable
   summary: the systems and zones, the phases and steps with their one-line bodies, the count of
   events by source kind, the figures with their sources, and the open gaps. Building starts
   after the owner confirms it.

## Gathering, whatever the source

For each source available in the session (a connector, a file, pasted text):

1. Say what is being read and why, and read only what the question needs.
2. Pull candidate facts: who or what acted, on what, when, what was observed, what was done in
   response; and which systems and boundaries are named.
3. Record each with its `source.ref`.
4. Merge across sources: same event from two places becomes one record with both refs; conflicts
   are kept side by side and raised under rule 4.
5. Map events to steps and systems. Events that fit no step suggest a missing step; propose it.

The same procedure serves an architecture or a plan: the "events" are then decisions, milestones
or measurements, and many stories of those kinds have no `events` at all.

## What each output reads

| Output | Reads |
|---|---|
| Film (scene) | `zones`, `systems`, `links`, `phases`, `steps`, `controls`, `figures`, the pattern block |
| Stills | the same, at each step's rest frame |
| Replay | all of the above plus `events`; draws its own graph from `zones`, `systems`, `links` |
