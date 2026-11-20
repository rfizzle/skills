// The "one record, many viewers" helpers of the data-protection example scene (pure functions loaded under Node's vm, the way
// the kit's pure files are): stand-ins, views per viewer and protection, counts, reversibility, the sweep, layout, and the
// numbers the example story computes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const examples = path.join(here, '..', 'assets', 'examples');
const sandbox = { console, Math };
sandbox.window = sandbox;
sandbox.EXK = { scenes: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(examples, 'data-protection-views.scene.js'), 'utf8'), sandbox, { filename: 'data-protection-views.scene.js' });
const V = sandbox.EXK.views;
const story = JSON.parse(fs.readFileSync(path.join(examples, 'data-protection-views.story.json'), 'utf8'));
const plain = (v) => JSON.parse(JSON.stringify(v));
const same = (a, b, m) => assert.deepEqual(plain(a), plain(b), m);

const data = () => plain({ record: story.record, protections: story.protections, viewers: story.viewers, access: story.access });
const joined = () => V.viewers(story.viewers, story.access);
const P = (id) => story.protections.find((p) => p.id === id);
const who = (id) => joined().find((v) => v.id === id);
const seen = (id, pid) => V.view(story.record, P(pid), who(id));
const n = (id, pid) => V.counts(seen(id, pid)).n;

test('the example story passes the build-time checks', () => {
  V.check(data());
  V.checkClaims(joined());
});

test('stand-ins: deterministic, token keeps the original shape and differs, ciphertext is grouped hex bytes', () => {
  const a = V.standIns(story.record), b = V.standIns(story.record);
  same(a, b);
  for (const f of story.record) {
    assert.notEqual(a[f.id].token, f.value);
    assert.equal(V.shapeOf(a[f.id].token), V.shapeOf(f.value));
    assert.match(a[f.id].cipher, /^[0-9a-f]{4}( [0-9a-f]{1,4})*$/);
  }
  assert.notDeepEqual(plain(V.standIns(story.record, 1)), plain(a), 'another seed gives another sequence');
});

test('maskValue: keeps the last letters and digits, separators stay', () => {
  assert.equal(V.maskValue('4242 4242 4242 4242', 4, '*'), '**** **** **** 4242');
  assert.equal(V.maskValue('pat.sample@example.test', 4, '*'), '***.******@*******.test');
  assert.equal(V.maskValue('Pat Sample', 0, '*'), '*** ******');
  assert.equal(V.maskValue('ab', 9, '*'), 'ab');
});

test('view: tokenization shows tokens, the vault turns them back, a copy of the store has tokens', () => {
  const none = V.view(story.record, P('tokenize'), null);
  same(none.map((x) => x.shows), ['token', 'token', 'token', 'original']);
  same(none.map((x) => x.readable), [false, false, false, true]);
  same(seen('processor', 'tokenize').map((x) => x.shows), ['original', 'original', 'original', 'original']);
  assert.equal(seen('processor', 'tokenize')[1].why, 'calls the token vault');
  same(seen('order', 'tokenize').map((x) => x.shows), ['token', 'token', 'token', 'original'], 'the key is no use against a token');
  assert.equal(seen('thief', 'tokenize')[1].why, 'stored as a token');
  assert.equal(seen('thief', 'tokenize')[1].value, V.standIns(story.record).card.token);
});

test('view: encryption shows ciphertext, the key turns it back, the vault is no use', () => {
  same(seen('order', 'encrypt').map((x) => x.shows), ['original', 'original', 'original', 'original']);
  same(seen('support', 'encrypt').map((x) => x.shows), ['ciphertext', 'ciphertext', 'ciphertext', 'ciphertext']);
  assert.equal(seen('analytics', 'encrypt')[0].why, 'ciphertext only, no key');
  assert.equal(seen('thief', 'encrypt')[3].why, 'stored as ciphertext');
});

test('view: display masking hides it on screen only; static masking overwrites the store', () => {
  const card = (v) => v.find((x) => x.id === 'card');
  assert.equal(card(seen('analytics', 'mask')).value, '•••• •••• •••• 4242');
  assert.equal(card(seen('processor', 'mask')).why, 'unmasked screen');
  assert.equal(card(seen('thief', 'mask')).value, '4242 4242 4242 4242', 'the store still holds the original');
  const stat = { ...P('mask'), mode: 'static' };
  for (const id of ['processor', 'thief']) {
    const v = V.view(story.record, stat, who(id));
    assert.ok(v.filter((x) => x.protected).every((x) => x.shows === 'masked' && !x.readable), id + ' reads only masks under static masking');
  }
  same(V.recoverers(stat, joined()), []);
});

test('counts and the matrix: readable fields per viewer per protection', () => {
  same(V.counts(seen('thief', 'mask')), { n: 4, of: 4 });
  const m = V.matrix(story.record, story.protections, joined()).map((row) => row.map((c) => c.n));
  same(m, [[4, 4, 4], [1, 4, 1], [1, 0, 1], [4, 0, 1], [1, 0, 4]], 'processor, order, analytics, support, thief against tokenize, encrypt, mask');
});

test('the thief reads no protected field under tokenization or encryption', () => {
  for (const pid of ['tokenize', 'encrypt']) assert.ok(seen('thief', pid).filter((x) => x.protected).every((x) => !x.readable), pid);
  assert.equal(n('thief', 'tokenize'), 1, 'the amount is left clear by the rule, not by a failure');
});

test('reversibility matches who holds a vault or a key; a mask has no way back', () => {
  same(V.recoverers(P('tokenize'), joined()).map((v) => v.id), ['processor', 'support']);
  same(V.recoverers(P('encrypt'), joined()).map((v) => v.id), ['processor', 'order']);
  same(V.recoverers(P('mask'), joined()), []);
  same(story.protections.map((p) => p.reversible), [true, true, false]);
});

test('status: the reason shown under a column comes from the first protected field', () => {
  assert.equal(V.status(seen('support', 'tokenize')), 'Calls the token vault');
  assert.equal(V.status(seen('thief', 'mask')), 'Stored as the original');
  assert.equal(V.status(seen('analytics', 'mask')), 'Masked on screen');
});

test('accessText: what a chip says each viewer holds', () => {
  same(joined().map(V.accessText), ['Key · Vault · Unmasked', 'Key', 'No access', 'Vault', 'Raw copy of the store']);
});

test('the sweep: positions change left to right and never both layers at once', () => {
  const starts = Array.from({ length: 12 }, (_, i) => V.flipStart(i, 12, 0.9));
  assert.deepEqual(starts, [...starts].sort((a, b) => a - b));
  assert.equal(starts[0], 0);
  assert.ok(starts[11] < 0.9);
  assert.equal(V.flipProgress(3, 12, 0.9, 0.16, 0), 0);
  assert.equal(V.flipProgress(3, 12, 0.9, 0.16, 5), 1);
  assert.ok(V.flipProgress(5, 12, 0.9, 0.16, 0.5) <= V.flipProgress(4, 12, 0.9, 0.16, 0.5), 'a later position is never ahead of an earlier one');
  for (let f = 0; f <= 1.0001; f += 0.05) { const m = V.mix(f); assert.ok(m.out === 0 || m.in === 0, 'f=' + f); }
  same(V.mix(0), { out: 1, in: 0 }); same(V.mix(1), { out: 0, in: 1 });
});

test('check: refuses data that does not tell the story', () => {
  const fails = (mut, re) => { const d = data(); mut(d); assert.throws(() => V.check(d), re); };
  fails((d) => { d.protections[0].reversible = false; d.protections[0].by = null; }, /reversibility/);
  fails((d) => { d.protections[2].mode = undefined; }, /mode/);
  fails((d) => { d.protections[0].transform.card = 'keep'; d.protections[0].transform.email = 'keep'; d.protections[0].transform.name = 'keep'; d.protections[0].transform.amount = 'keep'; }, /protects no field/);
  fails((d) => { d.protections[0].transform.card = 'encrypt'; }, /cannot use "encrypt"/);
  fails((d) => { d.access[4].copy = false; }, /exactly one viewer holds a copy/);
  fails((d) => { d.access = d.access.filter((a) => a.viewer !== 'order'); }, /no access record/);
  fails((d) => { d.access.forEach((a) => { a.key = false; a.vault = false; a.unmask = false; }); }, /no viewer reads every field|reversib/);
  const v = joined(); v.find((x) => x.id === 'order').vault = true;
  assert.throws(() => V.checkClaims(v), /order service holds the key but not the vault/);
});

test('layout: three columns, the chip row and the bands fill the box, every block at least 20 px from the next', () => {
  const box = { x: 24, y: 4, w: 1872, h: 712 }, L = V.layout(box, 3, 4, 5);
  const cols = [0, 1, 2].map((c) => L.card(c));
  assert.equal(cols[0].x, box.x);
  assert.ok(Math.abs(cols[2].x + cols[2].w - (box.x + box.w)) < 1e-6, 'the last column ends at the right edge');
  const chips = [0, 1, 2, 3, 4].map((i) => L.chip(i));
  assert.ok(Math.abs(chips[4].x + chips[4].w - (box.x + box.w)) < 1e-6);
  assert.ok(chips.every((c, i) => i === 0 || c.x >= chips[i - 1].x + chips[i - 1].w + 20), 'chips stand 20 px apart');
  assert.ok(cols.every((c, i) => i === 0 || c.x >= cols[i - 1].x + cols[i - 1].w + 20), 'cards stand 20 px apart');
  const bot = L.band(2).y + L.band(2).h;
  assert.ok(Math.abs(bot - (box.y + box.h)) < 1e-6, 'the comparison bands end at the bottom of the box');
  assert.ok(L.foot(0).y + L.foot(0).h <= box.y + box.h + 1e-6);
  assert.ok(L.cardH >= 280, 'a card is tall enough for four rows of label and 30 px value');
  assert.ok(L.row(0, 3).y + L.row(0, 3).h <= L.card(0).y + L.card(0).h);
  // the vertical stack, top to bottom, with at least 20 px between each pair (the ring and the copy outline reach 8 px beyond a column or card)
  const stack = [L.cap, L.chip(0), L.head(0), L.card(0), L.foot(0)];
  stack.forEach((b, i) => { if (i) assert.ok(b.y >= stack[i - 1].y + stack[i - 1].h + 20 + 8 - 1e-6, `block ${i} stands at least 20 px clear of the one above, outlines included`); });
  for (const r of [0, 1]) assert.ok(L.band(r + 1).y >= L.band(r).y + L.band(r).h + 20 - 1e-6, 'the comparison bands stand 20 px apart');
  assert.ok(L.chip(0).y + L.chip(0).h + 20 <= L.head(0).y - 4, 'the column ring clears the chip row by 20 px');
});

test('the example story: every record has a source, nothing typed, and the numbers it computes', () => {
  for (const k of ['record', 'protections', 'viewers', 'access', 'steps', 'phases']) assert.ok(story[k].every((r) => r.source && r.source.kind === 'illustrative'), k);
  assert.equal(story.meta.scene, 'views');
  assert.equal(story.record.find((f) => f.id === 'card').value, '4242 4242 4242 4242', 'a published test number');
  const counts = story.protections.map((p) => V.counts(V.view(story.record, p, who('thief'))));
  same(counts, [{ n: 1, of: 4 }, { n: 0, of: 4 }, { n: 4, of: 4 }]);
  for (const s of story.steps) { assert.ok(s.title.split(/\s+/).length <= 6, s.id); assert.ok(s.body.split(/\s+/).length <= 30, s.id); }
});
