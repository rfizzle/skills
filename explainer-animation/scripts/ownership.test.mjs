// The ownership helpers of the shared-responsibility example scene (pure functions loaded under Node's vm, the way the
// kit's pure files are), the layout they drive, and the numbers the example story computes.
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
vm.runInContext(fs.readFileSync(path.join(examples, 'shared-responsibility.scene.js'), 'utf8'), sandbox, { filename: 'shared-responsibility.scene.js' });
const O = sandbox.EXK.ownership;
const story = JSON.parse(fs.readFileSync(path.join(examples, 'shared-responsibility.story.json'), 'utf8'));
const plain = (v) => JSON.parse(JSON.stringify(v));
const same = (a, b, m) => assert.deepEqual(plain(a), plain(b), m);

const P = ['a', 'b', 'c'].map((id) => ({ id, name: id }));
const L = ['l1', 'l2'].map((id) => ({ id, name: id }));
const U = ['u1', 'u2'].map((id) => ({ id, name: id }));
const cell = (layer, duty, owner, note) => ({ layer, duty, owner, ...(note ? { note } : {}) });
const small = () => ({
  parties: P, layers: L, duties: U,
  cells: [cell('l1', 'u1', 'a'), cell('l1', 'u2', 'none', 'nobody'), cell('l2', 'u1', ['b', 'c'], 'both'), cell('l2', 'u2', 'c')],
  fixes: [{ layer: 'l1', duty: 'u2', party: 'a', takes: 'x' }, { layer: 'l2', duty: 'u1', party: 'b', takes: 'y' }]
});
const fails = (d, re) => assert.throws(() => O.check(d), re);

test('ownersOf and kindOf: one owner, nobody, or two', () => {
  same(O.ownersOf(cell('l', 'u', 'a')), ['a']);
  same(O.ownersOf(cell('l', 'u', 'none')), []);
  same(O.ownersOf(cell('l', 'u', ['a', 'b'])), ['a', 'b']);
  same([O.kindOf(cell('l', 'u', 'a')), O.kindOf(cell('l', 'u', 'none')), O.kindOf(cell('l', 'u', ['a', 'b']))], ['owned', 'none', 'disputed']);
});

test('counts: cells a party alone owns; gaps and disputed cells count for nobody', () => {
  const d = small();
  same(O.counts(d.parties, d.cells), { a: 1, b: 0, c: 1 });
});

test('gaps: unowned and disputed cells, bottom row first, left to right', () => {
  const d = small();
  const g = O.gaps(d.layers, d.duties, d.cells);
  same(g.map((x) => x.layer + '/' + x.duty + ':' + x.kind), ['l1/u2:none', 'l2/u1:disputed']);
  same(g[1].owners, ['b', 'c']);
  assert.equal(g[0].note, 'nobody');
});

test('coverage: owned over total, before and after the fixes', () => {
  const d = small();
  same(O.coverage(d.cells), { owned: 2, total: 4 });
  same(O.coverage(d.cells, d.fixes), { owned: 4, total: 4 });
});

test('applyFixes: replaces only the fixed cells and leaves the input alone', () => {
  const d = small(), after = O.applyFixes(d.cells, d.fixes);
  same(after.map((c) => c.owner), ['a', 'a', 'b', 'c']);
  assert.equal(d.cells[1].owner, 'none');
  assert.equal(after[1].note, 'nobody');
});

test('check: the small example passes', () => { O.check(small()); });

test('check: refuses data that does not tell the story', () => {
  let d = small(); d.cells.pop(); fails(d, /no cell for layer "l2" and duty "u2"/);
  d = small(); d.cells.push(cell('l1', 'u1', 'b')); fails(d, /two cells for "l1" \/ "u1"/);
  d = small(); d.cells[0].owner = 'zz'; fails(d, /owner "zz"/);
  d = small(); d.cells[2].owner = ['b', 'b']; fails(d, /two different party ids/);
  d = small(); d.cells[2].owner = ['b', 'c', 'a']; fails(d, /two different party ids/);
  d = small(); delete d.cells[1].note; fails(d, /needs a note/);
  d = small(); d.parties = P.slice(0, 2); fails(d, /exactly three/);
  d = small(); d.cells[1].owner = 'a'; delete d.cells[1].note; d.fixes.shift(); fails(d, /at least one unowned/);
  d = small(); d.cells[2].owner = 'c'; delete d.cells[2].note; d.fixes.pop(); fails(d, /at least one disputed/);
});

test('check: every gap has one fix; a disputed cell goes to one of its two; no gap survives the fixes', () => {
  let d = small(); d.fixes.pop(); fails(d, /gap "l2" \/ "u1" has no fix/);
  d = small(); d.fixes.push({ layer: 'l1', duty: 'u2', party: 'b', takes: 'z' }); fails(d, /two fixes/);
  d = small(); d.fixes[1].party = 'a'; fails(d, /one of its two parties/);
  d = small(); d.fixes.push({ layer: 'l1', duty: 'u1', party: 'b', takes: 'z' }); fails(d, /not a gap/);
  d = small(); d.fixes[0].party = 'zz'; fails(d, /not a party/);
  d = small(); delete d.fixes[0].takes; fails(d, /needs `takes`/);
});

test('layout: cells tile the box beside the headers, bottom layer on the bottom row, nothing overlaps', () => {
  const box = { x: 24, y: 136, w: 1872, h: 520 }, lay = O.layout(story.layers, story.duties, box);
  const nr = story.layers.length, nc = story.duties.length, rects = [];
  for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) rects.push(lay.cell(i, j));
  for (const r of rects) {
    assert.ok(r.x >= box.x + lay.headW && r.x + r.w <= box.x + box.w + 1e-9, 'inside horizontally');
    assert.ok(r.y >= box.y + lay.headH && r.y + r.h <= box.y + box.h + 1e-9, 'inside vertically');
  }
  for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) {
    const p = rects[a], q = rects[b];
    assert.ok(p.x + p.w <= q.x + 1e-9 || q.x + q.w <= p.x + 1e-9 || p.y + p.h <= q.y + 1e-9 || q.y + q.h <= p.y + 1e-9, 'cells ' + a + ' and ' + b + ' overlap');
  }
  assert.ok(lay.cell(0, 0).y > lay.cell(nr - 1, 0).y, 'layer 0 is the bottom row');
  assert.ok(lay.cell(0, 0).x < lay.cell(0, nc - 1).x, 'duties run left to right');
  const filled = lay.cell(nr - 1, nc - 1);
  assert.ok(filled.x + filled.w > box.x + box.w - 6 && lay.cell(0, 0).y + lay.cell(0, 0).h > box.y + box.h - 6, 'the grid fills the box');
  assert.ok(lay.font >= 22, 'headers are readable');
  assert.ok(lay.rowHead(0).h >= 2 * lay.font + 8, 'a row header holds two lines at its font size');
  assert.ok(lay.colHead(0).x >= box.x + lay.headW - 1e-9);
});

test('the example story: the numbers it computes', () => {
  O.check(story);
  const c = O.counts(story.parties, story.cells), after = O.counts(story.parties, O.applyFixes(story.cells, story.fixes));
  same(c, { provider: 8, platform: 6, product: 6 });
  same(after, { provider: 8, platform: 9, product: 7 });
  same(O.coverage(story.cells), { owned: 20, total: 24 });
  same(O.coverage(story.cells, story.fixes), { owned: 24, total: 24 });
  const g = O.gaps(story.layers, story.duties, story.cells);
  assert.equal(g.length, 4);
  assert.ok(g.some((x) => x.kind === 'none') && g.some((x) => x.kind === 'disputed'));
  assert.ok(story.cells.every((x) => x.source.kind === 'illustrative') && story.fixes.every((x) => x.source.kind === 'illustrative'));
  assert.equal(story.steps.length, 6);
});

test('the scene registers itself under the name the story asks for', () => {
  assert.equal(story.meta.scene, 'ownership');
  assert.equal(typeof sandbox.EXK.scenes.ownership, 'undefined', 'the pure part loads without a page; the scene needs one');
});
