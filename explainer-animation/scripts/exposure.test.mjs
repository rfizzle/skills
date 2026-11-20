// The exposure helpers of the harvest-now-decrypt-later example scene (pure functions loaded under Node's vm, the way the
// kit's pure files are), the layout they drive, and the numbers the example story computes from its figures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const examples = path.join(here, '..', 'assets', 'examples');
const sandbox = { console };
sandbox.window = sandbox;
sandbox.EXK = { scenes: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(examples, 'harvest-now-decrypt-later.scene.js'), 'utf8'), sandbox, { filename: 'harvest-now-decrypt-later.scene.js' });
const X = sandbox.EXK.exposure;
const story = JSON.parse(fs.readFileSync(path.join(examples, 'harvest-now-decrypt-later.story.json'), 'utf8'));
const plain = (v) => JSON.parse(JSON.stringify(v));
const same = (a, b, m) => assert.deepEqual(plain(a), plain(b), m);

const fig = (k) => story.figures[k].value;
const fromStory = () => ({
  axis: { span: fig(story.axis[0].span), step: fig(story.axis[0].step) },
  datasets: story.datasets.map((d) => ({ id: d.id, name: d.name, secrecy: fig(d.secrecy) })),
  migration: { lower: fig(story.migration[0].lower), upper: fig(story.migration[0].upper) },
  threat: { earliest: fig(story.threat[0].earliest), latest: fig(story.threat[0].latest) },
  plan: story.plan.map((p) => ({ dataset: p.dataset, completes: fig(p.completes) }))
});
const small = () => ({
  axis: { span: 20, step: 5 },
  datasets: [{ id: 'a', secrecy: 2 }, { id: 'b', secrecy: 8 }, { id: 'c', secrecy: 12 }, { id: 'd', secrecy: 16 }],
  migration: { lower: 2, upper: 4 },
  threat: { earliest: 6, latest: 14 },
  plan: [{ dataset: 'd', completes: 2 }, { dataset: 'c', completes: 3 }, { dataset: 'b', completes: 3 }, { dataset: 'a', completes: 4 }]
});
const fails = (d, re) => assert.throws(() => X.check(d), re);

test('ticks: now, then relative labels, never a calendar year', () => {
  same(X.ticks(10, 5, 'years').map((t) => t.text), ['now', '+5 years', '+10 years']);
  same(X.ticks(3, 1, 'years').map((t) => t.text), ['now', '+1 year', '+2 years', '+3 years']);
  assert.ok(X.ticks(story.figures['axis.span'].value, story.figures['axis.step'].value, 'years').every((t) => !/\b(19|20)\d\d\b/.test(t.text)));
});

test('exposure: exposed when the secrecy lifetime ends after the threat, by how many years at each end', () => {
  const th = { earliest: 6, latest: 14 };
  same(X.exposure({ id: 'a', secrecy: 2 }, th), { id: 'a', exposedEarliest: false, exposedLatest: false, yearsEarliest: 0, yearsLatest: 0, kind: 'safe' });
  same(X.exposure({ id: 'c', secrecy: 12 }, th), { id: 'c', exposedEarliest: true, exposedLatest: false, yearsEarliest: 6, yearsLatest: 0, kind: 'edge' });
  same(X.exposure({ id: 'd', secrecy: 16 }, th), { id: 'd', exposedEarliest: true, exposedLatest: true, yearsEarliest: 10, yearsLatest: 2, kind: 'exposed' });
});

test('exposure: a lifetime that ends exactly at the threat is not exposed (the threat must arrive before it ends)', () => {
  assert.equal(X.exposure({ id: 'x', secrecy: 6 }, { earliest: 6, latest: 14 }).exposedEarliest, false);
  assert.equal(X.exposure({ id: 'x', secrecy: 14 }, { earliest: 6, latest: 14 }).exposedLatest, false);
});

test('exposedCount: the earliest end exposes at least as many as the latest end', () => {
  const d = small();
  assert.equal(X.exposedCount(d.datasets, d.threat, 'earliest'), 3);
  assert.equal(X.exposedCount(d.datasets, d.threat, 'latest'), 1);
});

test('lastStart: the earliest arrival minus the slowest migration, to the latest minus the fastest', () => {
  same(X.lastStart({ lower: 2, upper: 4 }, { earliest: 6, latest: 14 }), { lo: 2, hi: 12 });
});

test('deadlines: the start that finishes in time for data created from then on; passed when it is before now', () => {
  const d = small();
  same(X.deadlines(d.datasets, d.migration, d.threat).map((x) => [x.startBy, x.passed]), [[0, false], [-6, true], [-10, true], [-14, true]]);
});

test('afterPlan: migration protects new data from its year; the data already copied stays exposed as before', () => {
  const d = small(), a = X.afterPlan(d.datasets, d.plan, d.threat);
  same(a.map((x) => x.protectedFrom), [4, 3, 3, 2]);
  same(a.map((x) => x.harvestedExposed), [false, true, true, true]);
  assert.ok(a.some((x) => x.harvestedExposed), 'something stays exposed after the plan');
});

test('check: the small example tells the story', () => { X.check(small()); });

test('check: refuses data that does not', () => {
  let d = small(); d.datasets.pop(); d.datasets.pop(); fails(d, /four or five/);
  d = small(); d.datasets[0].secrecy = 30; fails(d, /longer than the axis/);
  d = small(); d.threat.latest = 6; fails(d, /window.*not a date/);
  d = small(); d.migration.lower = 5; fails(d, /migration is a range/);
  d = small(); d.datasets.forEach((x) => { x.secrecy = 1; }); fails(d, /at least one dataset must be exposed/);
  d = small(); d.datasets.forEach((x) => { x.secrecy = 18; }); fails(d, /must not be exposed/);
  d = small(); d.datasets[1].secrecy = 4; d.datasets[2].secrecy = 16; fails(d, /on the edge/);
  d = small(); d.migration.upper = 8; fails(d, /already past/);
  d = small(); d.plan[1].dataset = 'zz'; fails(d, /not in datasets/);
  d = small(); d.plan.pop(); fails(d, /leaves out/);
  d = small(); d.plan[3].completes = 9; fails(d, /outside the migration range/);
  d = small(); d.plan.reverse(); fails(d, /backwards|longest-lived first/);
  d = small(); d.axis.step = 7; fails(d, /whole number of label steps/);
});

test('layout: x maps the axis onto the box, lanes are evenly spaced below the axis', () => {
  const box = { x0: 100, x1: 1100, top: 50, pitch: 40 }, l = X.layout(20, 5, 4, box);
  assert.equal(l.x(0), 100); assert.equal(l.x(20), 1100); assert.equal(l.x(10), 600);
  same([0, 1, 2, 3].map(l.laneTop), [50, 90, 130, 170]);
  assert.equal(l.bottom, 210);
  same(l.ticks('years').map((t) => t.at), [0, 5, 10, 15, 20]);
});

test('the example story: every number is a figure, every figure is used, the story passes its own checks', () => {
  const blocks = { axis: story.axis, datasets: story.datasets, migration: story.migration, threat: story.threat, plan: story.plan };
  const used = new Set();
  for (const [name, list] of Object.entries(blocks)) {
    for (const rec of list) {
      for (const [k, v] of Object.entries(rec)) {
        assert.notEqual(typeof v, 'number', `${name}.${k} holds a number; blocks hold figure keys`);
        if (['span', 'step', 'secrecy', 'lower', 'upper', 'earliest', 'latest', 'completes'].includes(k)) {
          assert.ok(story.figures[v], `${name}.${k}: no figure "${v}"`);
          used.add(v);
        }
      }
    }
  }
  same([...used].sort(), Object.keys(story.figures).sort());
  for (const f of Object.values(story.figures)) { assert.equal(f.source.kind, 'illustrative'); assert.notEqual(f.unit, 'count'); }
  X.check(fromStory());
});

test('the example story computes the numbers the scene shows', () => {
  const d = fromStory();
  assert.equal(X.exposedCount(d.datasets, d.threat, 'earliest'), 3);
  assert.equal(X.exposedCount(d.datasets, d.threat, 'latest'), 2);
  const by = Object.fromEntries(d.datasets.map((x) => [x.id, X.exposure(x, d.threat)]));
  same(Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.kind])), { cards: 'safe', contracts: 'safe', designs: 'edge', health: 'exposed', keys: 'exposed' });
  same(X.lastStart(d.migration, d.threat), { lo: 6, hi: 18 });
  same(X.deadlines(d.datasets, d.migration, d.threat).map((x) => x.startBy), [3, 1, -12, -19, -26]);
  same(X.afterPlan(d.datasets, d.plan, d.threat).filter((x) => x.harvestedExposed).map((x) => x.id), ['designs', 'health', 'keys']);
  assert.equal(d.plan[0].dataset, 'keys', 'the longest-lived data moves first');
});

test('the story copy: titles of six words or fewer, bodies of thirty or fewer, six steps, no calendar years', () => {
  assert.equal(story.steps.length, 6);
  for (const s of story.steps) {
    assert.ok(s.title.split(/\s+/).length <= 6, s.id + ' title');
    assert.ok(s.body.split(/\s+/).length <= 30, s.id + ' body');
    assert.ok(!/\b(19|20)\d\d\b/.test(s.title + ' ' + s.body), s.id + ' mentions a calendar year');
    assert.ok(!/\d/.test(s.title + ' ' + s.body), s.id + ' types a number');
  }
});

test('startNote: the lane sublabel by case, computed from the exposure and the start date', () => {
  const d = fromStory(), by = Object.fromEntries(d.datasets.map((x) => [x.id, x]));
  const dl = X.deadlines(d.datasets, d.migration, d.threat);
  const note = (id) => X.startNote(X.exposure(by[id], d.threat), dl.find((x) => x.id === id), 'years');
  // safe regardless: the secrecy ends before the window, so the start date is not shown as a task
  const safe = d.datasets.filter((x) => X.exposure(x, d.threat).kind === 'safe');
  assert.ok(safe.length > 0);
  for (const x of safe) same(note(x.id), { kind: 'safe', text: 'Safe without migrating' });
  // already too late for data copied today: exposed, and the start date has passed
  const late = d.datasets.filter((x) => X.exposure(x, d.threat).exposedEarliest);
  assert.ok(late.length > 0);
  for (const x of late) same(note(x.id), { kind: 'late', text: 'Already copied: exposed' });
  // migration needed and still possible: exposed, start date ahead
  same(X.startNote({ exposedEarliest: true }, { passed: false, startBy: 3 }, 'years'), { kind: 'start', text: 'Start within 3 years' });
  same(X.startNote({ exposedEarliest: true }, { passed: false, startBy: 1 }, 'years'), { kind: 'start', text: 'Start within 1 year' });
});

test('startNote: exposed data always has a passed start date (the earliest arrival minus its lifetime and the slowest migration)', () => {
  for (const d of [fromStory(), small()]) {
    const dl = X.deadlines(d.datasets, d.migration, d.threat);
    d.datasets.forEach((x, i) => { if (X.exposure(x, d.threat).exposedEarliest) assert.equal(dl[i].passed, true, x.id); });
  }
});
