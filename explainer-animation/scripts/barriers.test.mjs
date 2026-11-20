// The barrier helpers of the defence-in-depth example scene (pure functions loaded under Node's vm, the way the kit's
// pure files are), the layout they drive, and the numbers the example story computes.
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
vm.runInContext(fs.readFileSync(path.join(examples, 'defence-in-depth.scene.js'), 'utf8'), sandbox, { filename: 'defence-in-depth.scene.js' });
const B = sandbox.EXK.bowtie;
const story = JSON.parse(fs.readFileSync(path.join(examples, 'defence-in-depth.story.json'), 'utf8'));
const plain = (v) => JSON.parse(JSON.stringify(v));
const same = (a, b, m) => assert.deepEqual(plain(a), plain(b), m);
const data = (s = story) => plain({ threats: s.threats, event: s.event, consequences: s.consequences, barriers: s.barriers, attempts: s.attempts, additions: s.additions, steps: s.steps });
const fails = (d, re) => assert.throws(() => B.check(d), re);
const names = (path_) => path_.map((b) => b.id);

// A small bow-tie: two threats, one consequence.
const rec = (id, name) => ({ id, name: name || id });
const bar = (id, side, on, state, order) => ({ id, name: id, side, on, state, owner: 'Someone', ...(order || {}) });
const small = () => ({
  threats: [rec('t1'), rec('t2')], event: [rec('e')], consequences: [rec('c1')],
  barriers: [bar('a', 'prevent', ['t1'], 'strong'), bar('b', 'prevent', ['t2'], 'weak'), bar('m', 'mitigate', ['c1'], 'weak')],
  attempts: [],
  additions: [{ id: 'x', barrier: 'b', change: 'stronger', state: 'strong' }, { id: 'y', barrier: 'm', change: 'stronger', state: 'strong' }]
});

test('pathOf: the barriers on a threat or consequence, in array order', () => {
  const d = data();
  same(names(B.pathOf(d, 't-supplier')), ['b-supplier', 'b-least']);
  same(names(B.pathOf(d, 't-signin')), ['b-signin', 'b-device']);
  same(names(B.pathOf(d, 'c-disrupt')), ['m-detect', 'm-backup']);
  same(B.pathOf(d, 'nobody'), []);
});

test('trace: the first strong barrier stops an attack; weak lets it through; missing is not there', () => {
  const d = data(), s = B.statesBefore(d);
  let tr = B.trace(B.pathOf(d, 't-signin'), s);
  assert.equal(tr.reached, false);
  assert.equal(tr.stopAt, 0);
  same(tr.stops.map((x) => x.outcome), ['held']);                 // the walk ends at the first strong barrier
  tr = B.trace(B.pathOf(d, 't-supplier'), s);
  assert.equal(tr.reached, true);
  assert.equal(tr.stopAt, -1);
  same(tr.stops.map((x) => x.outcome), ['slips', 'absent']);
  tr = B.trace(B.pathOf(d, 't-supplier'), B.statesAfter(d));
  assert.equal(tr.reached, false);
  same(tr.stops.map((x) => x.outcome), ['slips', 'held']);        // slips past the weak one, held by the next
  assert.equal(B.trace([], {}).reached, true);                    // no barrier at all: nothing stops it
});

test('statesAfter applies the additions and leaves the rest; statesBefore does not', () => {
  const d = data();
  assert.equal(B.statesBefore(d)['b-least'], 'missing');
  assert.equal(B.statesAfter(d)['b-least'], 'strong');
  assert.equal(B.statesAfter(d)['m-detect'], 'strong');
  assert.equal(B.statesAfter(d)['b-supplier'], 'weak');
  assert.equal(B.statesBefore(d)['m-detect'], 'weak');
});

test('reaching and unmitigated: the numbers the example story computes, before and after', () => {
  const d = data();
  const r0 = B.reaching(d, B.statesBefore(d)), r1 = B.reaching(d, B.statesAfter(d));
  same([r0.n, r0.of, r0.ids], [2, 4, ['t-supplier', 't-web']]);
  same([r1.n, r1.of, r1.ids], [0, 4, []]);
  const u0 = B.unmitigated(d, B.statesBefore(d)), u1 = B.unmitigated(d, B.statesAfter(d));
  same([u0.n, u0.of, u0.ids], [1, 3, ['c-loss']]);
  same([u1.n, u1.of, u1.ids], [0, 3, []]);
});

test('describe: the caption sentence for an attempt', () => {
  const d = data(), s0 = B.statesBefore(d);
  assert.equal(B.describe(B.trace(B.pathOf(d, 't-signin'), s0)), 'Held at once by strong sign-in.');
  assert.equal(B.describe(B.trace(B.pathOf(d, 't-supplier'), s0)), 'Past weak supplier access limits and no least access to data.');
  assert.equal(B.describe(B.trace(B.pathOf(d, 't-supplier'), B.statesAfter(d))), 'Past weak supplier access limits, then held by least access to data.');
  for (const t of d.threats) assert.ok(B.describe(B.trace(B.pathOf(d, t.id), s0)).length <= 70, 'one caption line');
});

test('slots: shared barriers line up; a barrier sits one column past the one before it', () => {
  const d = data();
  const p = B.slots(d, 'prevent');
  assert.equal(p.n, 2);
  assert.equal(p.slotOf['b-signin'], 0);
  assert.equal(p.slotOf['b-device'], 1);
  assert.equal(p.slotOf['b-least'], 1);                           // one column, on three paths
  const m = B.slots(d, 'mitigate');
  assert.equal(m.n, 2);
  assert.equal(m.slotOf['m-detect'], 0);
  assert.equal(m.slotOf['m-backup'], 1);
  // two barriers on one path never share a column, even when another path puts a barrier between them
  const mixed = small();
  mixed.barriers = [bar('a', 'prevent', ['t1', 't2'], 'strong'), bar('b', 'prevent', ['t1'], 'weak'), bar('c', 'prevent', ['t1', 't2'], 'strong')];
  same(B.slots(mixed, 'prevent'), { slotOf: { a: 0, b: 1, c: 2 }, n: 3 });
});

test('layout: threats at the left, consequences at the right, the event between; bars on the lines at their columns', () => {
  const d = data(), box = { x: 24, y: 140, w: 1872, h: 440 }, L = B.layout(d, box);
  assert.ok(L.th['t-signin'].x === box.x && L.co['c-loss'].x + L.co['c-loss'].w === box.x + box.w);
  assert.ok(L.th['t-signin'].x + L.th['t-signin'].w < L.ev.x && L.ev.x + L.ev.w < L.co['c-loss'].x);
  assert.ok(Math.abs(L.ev.x + L.ev.w / 2 - (box.x + box.w / 2)) < 1, 'the event is the knot in the middle');
  // threats keep their order top to bottom and every box lies inside the diagram area
  const ys = d.threats.map((t) => L.th[t.id].y);
  same(ys.slice().sort((a, b) => a - b), ys);
  for (const r of [...Object.values(L.th), ...Object.values(L.co), L.ev]) assert.ok(r.y >= box.y - 1 && r.y + r.h <= box.y + box.h + 1);
  // each bar sits on its line, between the two ends, in the column of its slot
  for (const [id, ps] of Object.entries(L.bars)) {
    const l = L.lane[id];
    for (const p of ps) {
      assert.ok(p.x > Math.min(l.x1, l.x2) && p.x < Math.max(l.x1, l.x2));
      assert.ok(Math.abs(p.y - B.yAt(l, p.x)) < 1e-9);
    }
  }
  const x6 = Object.values(L.bars).flat().filter((p) => p.barrier === 'b-least').map((p) => Math.round(p.x));
  assert.equal(x6.length, 3);
  assert.equal(new Set(x6).size, 1, 'a shared barrier stands in one column');
  assert.ok(L.minGap >= 80, 'bars on neighbouring lines stay clear of each other: ' + L.minGap);
  assert.equal(L.nPrevent, 2);
  assert.equal(L.nMitigate, 2);
});

test('check accepts the example story', () => {
  B.check(data());
  for (const k of ['threats', 'event', 'consequences', 'barriers', 'attempts', 'additions'])
    assert.ok(story[k].every((r) => r.source && r.source.kind === 'illustrative'), k + ' records carry a source');
  for (const b of story.barriers) assert.ok(['prevent', 'mitigate'].includes(b.side) && ['strong', 'weak', 'missing'].includes(b.state) && b.owner);
  assert.equal(story.barriers.filter((b) => b.side === 'prevent' && b.state === 'weak').length, 2);
  assert.equal(story.barriers.filter((b) => b.side === 'prevent' && b.state === 'missing').length, 1);
  assert.equal(story.barriers.filter((b) => b.side === 'mitigate' && b.state === 'weak').length, 1);
});

test('check: a threat with no barrier is an error that names the threat', () => {
  const d = small();
  B.check(d);
  d.threats.push(rec('t3', 'A laptop is lost'));
  fails(d, /threat "A laptop is lost" has no barrier on its path\. A threat with no barrier is an error: add a prevention barrier whose "on" lists "t3"/);
  const e = small();
  e.consequences.push(rec('c2', 'Lost trust'));
  fails(e, /consequence "Lost trust" has no barrier/);
});

test('check: the story has to tell the story', () => {
  let d = small();
  d.barriers[1].state = 'strong';
  d.additions = [];
  fails(d, /no attack gets through today/);
  d = small(); d.additions = [d.additions[1]];
  fails(d, /after the additions the threat "t2" still gets through; add or strengthen a barrier on its path/);
  d = small(); d.additions = [d.additions[0]];
  fails(d, /after the additions the consequence "c1" is still left unmitigated/);
  d = small(); d.barriers[2].state = 'strong';
  d.additions = [d.additions[0]];
  fails(d, /every consequence is already softened today/);
});

test('check: ids, sides and additions are validated with a message that names what to fix', () => {
  let d = small(); d.event = [];
  fails(d, /"event" must hold exactly one record/);
  d = small(); d.event.push(rec('e2'));
  fails(d, /"event" must hold exactly one record/);
  d = small(); d.barriers[0].on = ['c1'];
  fails(d, /barrier "a" is a prevention barrier but stands in front of "c1", which is not a threat/);
  d = small(); d.barriers[2].on = ['t1'];
  fails(d, /barrier "m" is a mitigation barrier but stands in front of "t1", which is not a consequence/);
  d = small(); d.barriers[0].state = 'solid';
  fails(d, /state is "strong", "weak" or "missing"/);
  d = small(); d.barriers[0].side = 'block';
  fails(d, /side is "prevent" or "mitigate"/);
  d = small(); d.barriers[0].on = [];
  fails(d, /stands in front of nothing/);
  d = small(); d.barriers[0].owner = '';
  fails(d, /needs an owner/);
  d = small(); d.barriers.push({ ...d.barriers[0] });
  fails(d, /duplicate id "a"/);
  d = small(); d.additions[0].barrier = 'zzz';
  fails(d, /names barrier "zzz", which is not in barriers/);
  d = small(); d.additions[0].barrier = 'a';
  fails(d, /already strong/);
  d = small(); d.additions[0].change = 'new';
  fails(d, /change is "stronger" for a weak barrier, not "new"/);
});

test('check: each attempt does what the story says it does', () => {
  const d = data();
  d.attempts[0].expect = 'through';
  fails(d, /attempt "at-held" on "A staff sign-in is stolen" is said to be through today but it is held/);
  const e = data();
  e.attempts[3].expect = 'through';
  fails(e, /attempt "at-replay" .* after the additions but it is held/);
  const f = data();
  f.attempts[1].threat = 'nobody';
  fails(f, /tries "nobody", which is not a threat/);
  const g = data();
  g.attempts[1].step = 'zzz';
  fails(g, /in step "zzz", which is not a step/);
});

test('the example story: the scene is registered and the steps follow the pattern', () => {
  assert.equal(story.meta.scene, 'bowtie');
  assert.equal(story.steps.length, 6);
  same(story.steps.map((s) => s.id), ['picture', 'held', 'through', 'cost', 'add', 'layers']);
  for (const s of story.steps) {
    assert.ok(s.title.split(/\s+/).length <= 6, 'title: ' + s.title);
    assert.ok(s.body.split(/\s+/).length <= 24, 'body: ' + s.body);
  }
  for (const a of story.attempts) assert.ok(story.steps.some((s) => s.id === a.step));
});
