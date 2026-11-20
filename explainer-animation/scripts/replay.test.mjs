// Unit tests of the replay's pure derivations and graph layout (no browser).
// Expected numbers are the ones the approved page (scripts/testdata/oracle/attack-chain.replay-v2.html) shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKit } from './lib/load-kit.mjs';
import { replayChecks } from './lib/replay-warnings.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const storyPath = path.join(here, '..', 'assets', 'examples', 'ssrf-attack-chain.story.json');
const EXK = loadKit({ bundle: 'replay' });
const R = EXK.replay;
const raw = () => JSON.parse(fs.readFileSync(storyPath, 'utf8'));
const story = EXK.normalize(raw());
const D = R.derive(story);
// objects built inside the vm context have another realm's prototypes: compare as plain JSON
const eq = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);

test('the reference story validates and the replay kit loads', () => {
  eq(EXK.validate(raw()).filter((p) => p.level === 'error'), []);
  assert.equal(typeof R.derive, 'function');
  assert.equal(typeof R.layoutGraph, 'function');
  assert.equal(typeof R.light, 'function');
});

test('totals: 408 actions (400 attacker, 8 response) in 61 log lines', () => {
  assert.equal(D.totals.actions, 408);
  assert.equal(D.totals.attacker, 400);
  assert.equal(D.totals.response, 8);
  assert.equal(D.totals.lines, 61);
  assert.equal(D.events.length, 61);
});

test('visibility: 347 blind, 57 logged, 4 alerted', () => {
  assert.equal(D.totals.blind, 347);
  assert.equal(D.totals.logged, 57);
  assert.equal(D.totals.alerted, 4);
  assert.equal(D.totals.blind + D.totals.logged + D.totals.alerted, D.totals.actions);
});

test('systems reached: 9 of 10 (the attacker is not counted; detection is never reached by the attacker)', () => {
  assert.equal(D.attackerId, 'attacker');
  assert.equal(D.totals.systemsTotal, 10);
  assert.equal(D.totals.systemsReached, 9);
  assert.ok(!D.reachedIds.includes('detect'));
  assert.ok(!D.reachedIds.includes('attacker'));
  // the first event routes through the edge and the load balancer, so both count as reached
  assert.ok(D.reachedIds.includes('cdn') && D.reachedIds.includes('lb'));
});

test('time: span, time to first alert, days', () => {
  assert.equal(D.span, 768218);
  assert.equal(R.fmt.short(D.span), '8d 21h');
  assert.equal(D.firstAlertSeconds, 768050);
  assert.equal(R.fmt.short(D.firstAlertSeconds), '8d 21h');
  assert.equal(D.attackSpan, 830);
  assert.equal(D.days, 9);
});

test('events are sorted, routed through the graph, and carry running counts', () => {
  const ts = D.events.map((e) => e.t);
  eq(ts, ts.slice().sort((a, b) => a - b));
  eq(D.events[0].nodes, ['attacker', 'cdn', 'lb', 'storefront']);
  eq(D.events[0].edges, ['attacker>cdn', 'cdn>lb', 'lb>storefront']);
  const last = D.events[60];
  assert.equal(last.c1, 408);
  assert.equal(last.a1, 400);
  // a defender or an alert is the response side; a compromised system relaying for the attacker is not
  assert.equal(D.events.filter((e) => e.response).reduce((a, e) => a + e.count, 0), 8);
  assert.ok(D.events.filter((e) => e.actor === 'system' && e.visibility !== 'alerted').every((e) => e.attack));
  // running figures at the clock values the approved page shows
  eq([D.pre[17].att, D.pre[17].reached], [31, 4]);
  eq([D.pre[38].att, D.pre[38].reached], [383, 7]);
  eq([D.pre[60].n, D.pre[60].att, D.pre[60].reached], [408, 400, 9]);
  eq(D.pre[60].vis, [347, 57, 4]);
});

test('phase spans: counts and order on the replay axis', () => {
  eq(D.phases.map((p) => p.id), ['initial', 'cred', 'disc', 'lateral', 'detect']);
  eq(D.phases.map((p) => p.total), [26, 12, 347, 15, 8]);
  eq(D.phases.map((p) => p.n), [13, 12, 16, 12, 8]);                                  // log lines per phase
  eq(D.phases.map((p) => Math.round(p.first * 100) / 100), [1.2, 15.7, 31.7, 58.2, 78.37]);
  eq(D.phases.map((p) => Math.round(p.last * 100) / 100), [14.37, 30.53, 55.53, 70.37, 92.37]);
  D.phases.forEach((p, i) => {
    assert.ok(p.first <= p.last);
    if (i) assert.ok(p.first >= D.phases[i - 1].last);
  });
  assert.equal(D.phases.reduce((a, p) => a + p.n, 0), 61);
  assert.equal(D.phases[0].first, D.clockOpts.leadS);
});

test('clock: piecewise map with gap compression and one labelled break', () => {
  const c = D.clock;
  assert.equal(D.duration, 96.4);
  assert.equal(c.breaks.length, 1);
  const b = c.breaks[0];
  assert.equal(b.r1 - b.r0, D.clockOpts.breakS);
  assert.equal(b.t0, 830);
  assert.equal(b.t1, 768050);
  assert.equal(R.fmt.long(b.t1 - b.t0), '8 days 21 hours');
  // the active stretch runs at the steady rate
  assert.ok(Math.abs(c.rOfT(830) - (D.clockOpts.leadS + 830 / 12)) < 1e-9);
  assert.equal(c.rToT(0), 0);
  assert.equal(c.rToT(D.duration), D.tLast);
  assert.ok(Math.abs(c.rToT(c.rOfT(300)) - 300) < 1e-9);
  // inside the break the incident clock crosses the whole silence
  const mid = c.rToT((b.r0 + b.r1) / 2);
  assert.ok(Math.abs(mid - (b.t0 + b.t1) / 2) < 1e-6);
  assert.equal(R.fmt.T(c.rToT(52)), 'T+00:10:09');
  // idxAt: before the first event, at it, between, and at the end
  assert.equal(c.idxAt(0), -1);
  assert.equal(c.idxAt(D.events[0].r), 0);
  assert.equal(c.idxAt(20), 17);
  assert.equal(c.idxAt(52), 38);
  assert.equal(c.idxAt(D.duration), 60);
});

test('clock options: a smaller gap threshold gives more breaks; none compresses nothing', () => {
  const none = R.derive(story, { gapMin: 1e9 });
  assert.equal(none.clock.breaks.length, 0);
  assert.ok(none.duration > 1000);
  const more = R.derive(story, { gapMin: 15 });
  assert.ok(more.clock.breaks.length > 1);
});

test('what would have stopped it: cut at attacker actions 20, 23, 44, 50 and 387', () => {
  eq(D.cuts.map((c) => c.id), ['waf', 'imdsv2', 'least-privilege', 'bucket-policy', 'netpol']);
  eq(D.cuts.map((c) => c.at), [20, 23, 44, 50, 387]);
  eq(D.cuts.map((c) => c.later), [380, 377, 356, 350, 13]);
  eq(D.cuts.map((c) => c.prevented), [381, 378, 357, 351, 14]);
  eq(D.cuts.map((c) => c.badge), ['2', '2/3', '5', '6', '8']);
  // each cut is an attacker action that uses the control's link, on or after the control's first step
  D.cuts.forEach((c) => { assert.ok(c.ev.attack); assert.ok(c.ev.edges.includes(c.edge)); assert.equal(c.ev.a0 + 1, c.at); });
});

test('activity buckets add up to every action, by visibility', () => {
  const B = D.buckets;
  assert.equal(B.data.length, B.n);
  const sum = [0, 0, 0];
  B.data.forEach((d) => d.forEach((v, k) => { sum[k] += v; }));
  eq(sum, [347, 57, 4]);
  assert.equal(B.max, Math.max(...B.totals));
});

test('formatting', () => {
  assert.equal(R.fmt.T(0), 'T+00:00:00');
  assert.equal(R.fmt.T(3725), 'T+01:02:05');
  assert.equal(R.fmt.T(86400 + 5), 'T+1d 00:00:05');
  assert.equal(R.fmt.n(1234567), '1,234,567');
  assert.equal(R.fmt.long(90), '1 minute');
  assert.equal(R.fmt.axis(300), 'T+5m');
});

/* ---------- the graph ---------- */
const G = R.layoutGraph(story, D);

test('graph: two frame levels at most, collapsed from the film\'s deeper zone tree', () => {
  assert.ok(story.zones.length > G.Z.length);
  assert.ok(G.Z.every((z) => z.level <= 2));
  eq(G.Z.map((z) => z.id).sort(), ['cluster', 'data', 'edge', 'internet', 'public', 'services', 'vpc']);
  eq(G.Z.filter((z) => z.level === 2).map((z) => z.id).sort(), ['cluster', 'data', 'public']);
  eq(G.warnings, []);
});

test('graph: the automatic grid reproduces the approved page\'s grid', () => {
  const cell = (id) => [G.S[id].col, G.S[id].row];
  eq(cell('attacker'), [0, 1]); eq(cell('cdn'), [1, 1]); eq(cell('lb'), [2, 1]);
  eq(cell('imds'), [3, 0]); eq(cell('storefront'), [3, 1]); eq(cell('payments'), [3, 2]); eq(cell('db'), [4, 2]);
  eq(['iam', 's3', 'secrets', 'detect'].map((id) => G.S[id].col), [0, 1, 2, 4]);
  assert.ok(['iam', 's3', 'secrets', 'detect'].every((id) => G.S[id].band === 1));
  assert.equal(new Set(['iam', 's3', 'secrets', 'detect'].map((id) => G.S[id].y)).size, 1);
});

test('graph: no cards overlap, every card is inside its frame, no link label sits on a card', () => {
  const ids = Object.keys(G.S);
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) assert.ok(!hit(G.S[ids[i]], G.S[ids[j]]), `${ids[i]} / ${ids[j]}`);
  const fr = Object.fromEntries(G.Z.map((z) => [z.id, z]));
  ids.forEach((id) => {
    const f = fr[G.S[id].frameId], n = G.S[id];
    assert.ok(n.x >= f.x && n.y >= f.y && n.x + n.w <= f.x + f.w && n.y + n.h <= f.y + f.h, `${id} inside ${f.id}`);
  });
  Object.values(G.L).filter((l) => l.lab).forEach((l) => {
    const r = { x: l.lab.x - l.lab.w / 2, y: l.lab.y - 8, w: l.lab.w, h: 16 };
    ids.forEach((id) => assert.ok(!hit(r, G.S[id]), `label ${l.lab.text} on ${id}`));
  });
  eq(Object.values(G.L).filter((l) => l.lab).map((l) => l.lab.text).sort(), ['SSRF', 'direct from outside', 'sideways', 'stolen keys']);
});

test('graph: replay.layout hints override a system\'s cell', () => {
  const s2 = JSON.parse(JSON.stringify(story));
  s2.replay = { layout: { db: [5, 0] } };
  const G2 = R.layoutGraph(s2, D);
  eq([G2.S.db.col, G2.S.db.row], [5, 0]);
  eq([G2.S.attacker.col, G2.S.attacker.row], [0, 1]);
});

test('graph: lit is a pure function of the events at or before the clock', () => {
  eq(Object.keys(R.light(D, -1, 0).nodes), []);
  assert.equal(R.light(D, -1, 0).now, null);
  const at = (i) => Object.keys(R.light(D, i, D.events[i].r).nodes).sort();
  eq(at(0), ['attacker', 'cdn', 'lb', 'storefront']);
  const touched = (i) => [...new Set(D.events.slice(0, i + 1).flatMap((e) => e.nodes))].sort();
  [0, 9, 17, 38, 60].forEach((i) => eq(at(i), touched(i)));
  eq(at(60).length, 11);                       // all ten systems and the attacker
  // the ring fades with time since the event
  assert.equal(R.light(D, 5, D.events[5].r).now.amp, 1);
  assert.equal(R.light(D, 5, D.events[5].r + 5).now.amp, 0);
});

/* ---------- other stories ---------- */
const tiny = (over = {}) => EXK.normalize(Object.assign({
  meta: { id: 't', title: 'T', source: { kind: 'provided', ref: 'x' } },
  zones: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
  systems: [{ id: 'x', name: 'X', zone: 'a' }, { id: 'y', name: 'Y', zone: 'b' }, { id: 'z', name: 'Z', zone: 'b' }],
  links: [{ from: 'x', to: 'y' }, { from: 'y', to: 'z' }],
  phases: [{ id: 'p', title: 'P' }],
  steps: [{ id: 's', phase: 'p', title: 'S', body: 'b', touch: [], uses: [] }],
  events: [
    { t: 0, step: 's', from: 'x', to: 'y', action: 'a', count: 2, visibility: 'blind', actor: 'attacker' },
    { t: 10, step: 's', from: 'y', to: 'z', action: 'b', count: 1, visibility: 'logged', actor: 'system' },
    { t: 20, step: 's', from: 'z', to: 'y', action: 'c', count: 1, visibility: 'alerted', actor: 'system' },
    { t: 30, step: 's', from: 'y', to: 'x', action: 'd', count: 3, visibility: 'logged', actor: 'defender' }
  ]
}, over));

test('actor classes: the attacker\'s side, an alert, and the defender', () => {
  const d = R.derive(tiny());
  assert.equal(d.totals.actions, 7);
  assert.equal(d.totals.attacker, 3);       // 2 attacker + 1 relayed by a compromised system
  assert.equal(d.totals.response, 4);       // 1 alert + 3 defender
  assert.equal(d.attackerId, 'x');
  eq([d.totals.systemsReached, d.totals.systemsTotal], [2, 2]);
  assert.equal(d.clock.breaks.length, 0);
  assert.equal(d.cuts.length, 0);
});

test('a story with no events says so instead of building a page', () => {
  assert.throws(() => R.derive(tiny({ events: [] })), /no events/);
});

test('a deep zone tree collapses to two levels, and a wrapper zone is dropped', () => {
  const zones = [
    { id: 'w', name: 'Wrapper' },
    { id: 'n', name: 'Net', parent: 'w' }, { id: 'n1', name: 'N1', parent: 'n' }, { id: 'n2', name: 'N2', parent: 'n1' },
    { id: 'o', name: 'Other', parent: 'w' }
  ];
  const systems = [{ id: 'x', name: 'X', zone: 'o' }, { id: 'y', name: 'Y', zone: 'n2' }, { id: 'z', name: 'Z', zone: 'n' }, { id: 'v', name: 'V', zone: 'n1' }];
  const s = tiny({ zones, systems });
  const g = R.layoutGraph(s, R.derive(s));
  assert.ok(g.Z.every((z) => z.level <= 2));
  assert.ok(!g.Z.some((z) => z.id === 'w'));
  assert.ok(Object.values(g.S).every((n) => n.frameId));
});

test('a large estate asks for layout hints', () => {
  const systems = Array.from({ length: 13 }, (_, i) => ({ id: 's' + i, name: 'S' + i, zone: 'a' }));
  const links = systems.slice(1).map((s, i) => ({ from: 's' + i, to: s.id }));
  const events = [{ t: 0, step: 's', from: 's0', to: 's1', action: 'a', count: 1, visibility: 'blind', actor: 'attacker' }];
  const s = tiny({ systems, links, events });
  assert.equal(R.layoutGraph(s, R.derive(s)).warnings.length, 1);
});

/* ---------- what would have stopped it: every control has a card ---------- */
const withControls = (controls, stops) => tiny({
  steps: [{ id: 's', phase: 'p', title: 'S', body: 'b', touch: [], uses: [] }, { id: 's2', phase: 'p', title: 'S2', body: 'b', touch: [], uses: [] }],
  events: [
    { t: 0, step: 's', from: 'x', to: 'y', action: 'a', visibility: 'blind', actor: 'attacker' },
    { t: 10, step: 's2', from: 'y', to: 'z', action: 'b', visibility: 'logged', actor: 'attacker' },
    { t: 20, step: 's2', from: 'y', to: 'z', action: 'c', visibility: 'logged', actor: 'attacker' }
  ],
  controls: controls.map((c, i) => Object.assign({ id: 'c' + i, name: 'C' + i, why: 'w', source: { kind: 'provided', ref: 'x' } }, c))
});

test('controls with the same cut point both get a card, in story order', () => {
  const s = withControls([{ on: ['y', 'z'], stops: ['s2'] }, { on: ['y', 'z'], stops: ['s2'] }, { on: ['x', 'y'], stops: ['s'] }]);
  const d = R.derive(s);
  eq(d.cards.map((c) => c.id), ['c2', 'c0', 'c1']);
  eq(d.cards.map((c) => c.at), [1, 2, 2]);
  assert.equal(d.cuts.length, 3);
  assert.equal(d.unplaced.length, 0);
});

test('a control whose link is only crossed before the steps it stops is cut at its last crossing, and says so', () => {
  const d = R.derive(withControls([{ on: ['x', 'y'], stops: ['s2'] }]));
  assert.equal(d.cuts.length, 1);
  assert.equal(d.cuts[0].how, 'before');
  assert.equal(d.cuts[0].at, 1);
  assert.equal(d.cuts[0].later, 2);
});

test('a control that no attacker action crosses is listed as unplaced with a reason, never dropped', () => {
  const s = withControls([{ on: ['x', 'y'], stops: ['s'] }, { on: ['z', 'y'], stops: ['s'] }]);
  s.events = s.events.filter((e) => !(e.from === 'y' && e.to === 'z'));          // nothing crosses y-z any more
  s.events.push({ t: 30, step: 's2', from: 'z', to: 'y', action: 'd', visibility: 'blind', actor: 'defender' });
  const d = R.derive(s);
  eq(d.cards.map((c) => [c.id, c.placed]), [['c0', true], ['c1', false]]);
  assert.match(d.unplaced[0].reason, /no attacker action/);
  assert.equal(d.cards.length, s.controls.length);
});

test('the cold stories: every control appears, and the example\'s cut points are unchanged', () => {
  eq(D.cards.map((c) => c.id), ['waf', 'imdsv2', 'least-privilege', 'bucket-policy', 'netpol']);
  assert.ok(D.cards.every((c) => c.placed && c.how === 'at'));
  for (const name of ['cold-supply-chain', 'cold-phishing']) {
    const st = EXK.normalize(JSON.parse(fs.readFileSync(path.join(here, 'testdata', 'stories', name + '.story.json'), 'utf8')));
    const d = R.derive(st);
    eq(d.cards.map((c) => c.id).sort(), st.controls.map((c) => c.id).sort());
    assert.ok(d.cards.every((c) => c.placed), name);
    assert.ok(d.cards.some((c) => c.how === 'before'), name);
  }
});

/* ---------- systems reached: what is left out is named ---------- */
test('systems reached excludes the attacker\'s own system and says so; a compromised system counts', () => {
  assert.equal(D.excludedLabel, 'excluding the attacker');
  eq(D.excludedIds, ['attacker']);
  const sc = EXK.normalize(JSON.parse(fs.readFileSync(path.join(here, 'testdata', 'stories', 'cold-supply-chain.story.json'), 'utf8')));
  const d = R.derive(sc);
  assert.equal(sc.systems.length, 9);
  eq([d.totals.systemsReached, d.totals.systemsTotal], [8, 8]);          // 9 defined, minus the attacker
  assert.ok(d.reachedIds.includes('payments'));                        // acts for the attacker, but was reached
  const ph = EXK.normalize(JSON.parse(fs.readFileSync(path.join(here, 'testdata', 'stories', 'cold-phishing.story.json'), 'utf8')));
  eq([R.derive(ph).totals.systemsReached, R.derive(ph).totals.systemsTotal], [6, 8]);
  // a system not called "attacker" is named
  const s = tiny({ systems: [{ id: 'x', name: 'Red team box', zone: 'a' }, { id: 'y', name: 'Y', zone: 'b' }, { id: 'z', name: 'Z', zone: 'b' }] });
  assert.equal(R.derive(s).excludedLabel, 'excluding the attacker (Red team box)');
});

/* ---------- the illustrative chip follows the records ---------- */
test('chip wording: all illustrative, some, none', () => {
  const mark = (s, pred, kind) => {
    [s.meta, ...['zones', 'systems', 'links', 'phases', 'steps', 'controls', 'events'].flatMap((k) => s[k])].filter(pred).forEach((r) => { r.source = { kind, ref: 'x' }; });
    return s;
  };
  const none = tiny();
  mark(none, () => true, 'provided');
  assert.equal(R.provenanceChip(R.derive(none).prov), null);
  assert.equal(R.derive(none).prov.mixed, false);
  const all = mark(tiny(), () => true, 'illustrative');
  assert.equal(R.provenanceChip(R.derive(all).prov), 'Illustrative data');
  assert.equal(R.derive(all).prov.mixed, false);
  const some = mark(tiny(), () => true, 'provided');
  some.events[0].source = { kind: 'illustrative' }; some.links[0].source = { kind: 'illustrative' };
  const dp = R.derive(some);
  assert.equal(R.provenanceChip(dp.prov), 'Includes illustrative records (2)');
  assert.equal(dp.prov.mixed, true);
  assert.equal(dp.events.filter((e) => e.ill).length, 1);
  assert.equal(dp.links.filter((l) => l.ill).length, 1);
  // the example is entirely illustrative; the phishing story is mostly provided
  eq([D.prov.all, D.prov.mixed, R.provenanceChip(D.prov)], [true, false, 'Illustrative data']);
  const ph = EXK.normalize(JSON.parse(fs.readFileSync(path.join(here, 'testdata', 'stories', 'cold-phishing.story.json'), 'utf8')));
  assert.equal(R.provenanceChip(R.derive(ph).prov), 'Includes illustrative records (4)');
});

/* ---------- the graph on other stories ---------- */
test('graph on the cold stories: nothing overlaps, no label clipped, text fits its card', () => {
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const name of ['cold-supply-chain', 'cold-phishing']) {
    const st = EXK.normalize(JSON.parse(fs.readFileSync(path.join(here, 'testdata', 'stories', name + '.story.json'), 'utf8')));
    const d = R.derive(st), g = R.layoutGraph(st, d);
    const cards = Object.values(g.S), pills = Object.values(g.L).filter((l) => l.lab).map((l) => ({ id: l.link.id, x: l.lab.x - l.lab.w / 2, y: l.lab.y - 8, w: l.lab.w, h: 16 }));
    cards.forEach((a, i) => cards.slice(i + 1).forEach((b) => assert.ok(!hit(a, b), `${name}: ${a.id} / ${b.id}`)));
    pills.forEach((p) => {
      cards.forEach((c) => assert.ok(!hit(p, c), `${name}: label ${p.id} on ${c.id}`));
      assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= g.W && p.y + p.h <= g.H, `${name}: label ${p.id} inside the graph`);
      pills.forEach((q) => { if (q !== p) assert.ok(!hit(p, q), `${name}: labels ${p.id} / ${q.id}`); });
      g.Z.forEach((z) => { if (!z.label) return; assert.ok(!hit(p, z.labelRect), `${name}: label ${p.id} on the title of ${z.id}`); });
    });
    assert.ok(g.W <= 719, `${name}: ${g.W} wide`);
    // a label that was dropped is said so, naming the hint
    if (g.dropped.length) assert.ok(g.warnings.some((w) => /replay\.layout/.test(w) && /hidden/.test(w)), name);
  }
});

test('graph: a long name or tag widens the card, then wraps or is cut; it never runs out of the card', () => {
  const systems = [
    { id: 'x', name: 'X', tag: 'a tag that is far too long to fit on one line of a card', zone: 'a' },
    { id: 'y', name: 'A very long system name that cannot fit any card', tag: 'short', zone: 'b' },
    { id: 'z', name: 'Z', zone: 'b' }
  ];
  const s = tiny({ systems });
  const g = R.layoutGraph(s, R.derive(s));
  assert.ok(g.S.x.w > 110 && g.S.x.w <= 150);
  assert.equal(g.S.x.sub.length, 2);
  assert.ok(g.S.x.h > 50 && Object.values(g.S).every((n) => n.h === g.S.x.h));
  assert.ok(/…$/.test(g.S.y.label) && g.S.y.name.startsWith('A very long'));
  eq(g.S.z.sub, []);
  // ordinary short text keeps the example's 110x50 card
  assert.ok(Object.values(G.S).every((n) => n.w === 110 && n.h === 50));
});

test('graph: a gap holds the pill of a labelled link between neighbouring columns', () => {
  const s = tiny({ links: [{ from: 'x', to: 'y', label: 'a long label here' }, { from: 'y', to: 'z' }] });
  const g = R.layoutGraph(s, R.derive(s));
  const gapXY = g.S.y.x - (g.S.x.x + g.S.x.w);
  assert.ok(gapXY > 29, `gap ${gapXY}`);
  assert.equal(Object.values(g.L)[0].lab.text, 'a long label here');
});

test('graph: too wide an estate warns, naming replay.layout', () => {
  const zones = Array.from({ length: 8 }, (_, i) => ({ id: 'z' + i, name: 'Zone ' + i }));
  const systems = Array.from({ length: 8 }, (_, i) => ({ id: 's' + i, name: 'S' + i, zone: 'z' + i }));
  const links = systems.slice(1).map((s, i) => ({ from: 's' + i, to: s.id }));
  const events = [{ t: 0, step: 's', from: 's0', to: 's1', action: 'a', count: 1, visibility: 'blind', actor: 'attacker' }];
  const s = tiny({ zones, systems, links, events });
  const g = R.layoutGraph(s, R.derive(s));
  assert.ok(g.W > 719);
  assert.ok(g.warnings.some((w) => /replay\.layout/.test(w) && /wide/.test(w)), g.warnings.join('|'));
});

test('the build refuses a story with no events and warns about what the layout could not place', () => {
  const none = replayChecks(tiny({ events: [] }));
  assert.match(none.refusal, /no events, so there is nothing to replay/);
  const ph = EXK.normalize(JSON.parse(fs.readFileSync(path.join(here, 'testdata', 'stories', 'cold-phishing.story.json'), 'utf8')));
  const r = replayChecks(ph);
  assert.equal(r.refusal, null);
  assert.ok(r.warnings.every((w) => /replay\.layout/.test(w)));
  eq(replayChecks(story).warnings, []);                       // the example lays out cleanly
});
