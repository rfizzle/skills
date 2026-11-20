// The graph-reachability helpers of the privilege-escalation example scene (pure functions loaded under Node's vm,
// the way the kit's pure files are), the layout they drive, and the numbers the example story computes.
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
vm.runInContext(fs.readFileSync(path.join(examples, 'privilege-escalation.scene.js'), 'utf8'), sandbox, { filename: 'privilege-escalation.scene.js' });
const G = sandbox.EXK.graph;
const story = JSON.parse(fs.readFileSync(path.join(examples, 'privilege-escalation.story.json'), 'utf8'));
const plain = (v) => JSON.parse(JSON.stringify(v));
const same = (a, b, m) => assert.deepEqual(plain(a), plain(b), m);

const N = (...ids) => ids.map((id) => ({ id, name: id, kind: 'role' }));
const E = (id, from, to, kind = 'can assume', extra = {}) => ({ id, from, to, kind, ...extra });

test('reach: hop distance, start at zero, shortest hop wins', () => {
  const nodes = N('a', 'b', 'c', 'd');
  const edges = [E('1', 'a', 'b'), E('2', 'b', 'c'), E('3', 'a', 'c')];
  same((G.reach(nodes, edges, 'a')), { a: 0, b: 1, c: 1 });
});

test('reach: a cycle terminates and a disconnected node is not reached', () => {
  const nodes = N('a', 'b', 'c', 'x');
  const edges = [E('1', 'a', 'b'), E('2', 'b', 'c'), E('3', 'c', 'a'), E('4', 'c', 'b')];
  same((G.reach(nodes, edges, 'a')), { a: 0, b: 1, c: 2 });
  assert.equal(G.reach(nodes, edges, 'a').x, undefined);
});

test('reach: only the kinds that grant movement extend reach', () => {
  const nodes = N('a', 'b', 'c');
  const edges = [E('1', 'a', 'b', 'can list'), E('2', 'a', 'c', 'can read')];
  same((G.reach(nodes, edges, 'a')), { a: 0, c: 1 });
  for (const kind of G.MOVING) assert.equal(G.reach(nodes, [E('1', 'a', 'b', kind)], 'a').b, 1, kind);
  same((G.NON_MOVING), ['can list']);
});

test('reach: cut edges are removed, by id or by record', () => {
  const nodes = N('a', 'b', 'c');
  const edges = [E('1', 'a', 'b'), E('2', 'b', 'c')];
  same((G.reach(nodes, edges, 'a', ['2'])), { a: 0, b: 1 });
  same((G.reach(nodes, edges, 'a', [edges[0]])), { a: 0 });
});

test('graph errors name the problem', () => {
  const nodes = N('a', 'b');
  assert.throws(() => G.reach(nodes, [E('1', 'a', 'zz')], 'a'), /ends at "zz"/);
  assert.throws(() => G.reach(nodes, [E('1', 'qq', 'b')], 'a'), /starts at "qq"/);
  assert.throws(() => G.reach(nodes, [E('1', 'a', 'b', 'can hug')], 'a'), /kind "can hug"/);
  assert.throws(() => G.reach(nodes, [E('1', 'a', 'b'), E('1', 'b', 'a')], 'a'), /duplicate edge id/);
  assert.throws(() => G.reach(nodes, [{ from: 'a', to: 'b', kind: 'can assume' }], 'a'), /needs a string id/);
  assert.throws(() => G.reach(nodes, [E('1', 'a', 'b')], 'nope'), /"nope" is not a node/);
  assert.throws(() => G.reach(nodes, [E('1', 'a', 'b')], 'a', ['9']), /cut names edge "9"/);
  assert.throws(() => G.reach([...nodes, ...N('a')], [], 'a'), /duplicate node id/);
});

test('pathTo: the shortest chain, empty to itself, null when unreachable', () => {
  const nodes = N('a', 'b', 'c', 'd', 'x');
  const edges = [E('1', 'a', 'b'), E('2', 'b', 'c'), E('3', 'c', 'd'), E('4', 'a', 'd'), E('5', 'd', 'a')];
  same(G.pathTo(nodes, edges, 'a', 'd').map((e) => e.id), ['4']);
  same((G.pathTo(nodes, edges, 'a', 'a')), []);
  assert.equal(G.pathTo(nodes, edges, 'a', 'x'), null);
  same(G.pathTo(nodes, edges, 'a', 'd', ['4']).map((e) => e.id), ['1', '2', '3']);
});

test('others: identities other than the start that can reach the target', () => {
  const nodes = [{ id: 's', kind: 'identity' }, { id: 'i1', kind: 'identity' }, { id: 'i2', kind: 'identity' }, { id: 'r', kind: 'role' }, { id: 't', kind: 'resource' }];
  const edges = [E('1', 's', 'r'), E('2', 'r', 't'), E('3', 'i1', 'r', 'member of'), E('4', 'i2', 't', 'can list')];
  same((G.others(nodes, edges, 's', 't')), ['i1']);
  same((G.others(nodes, edges, 's', 't', ['2'])), []);
});

test('given: reach over the granted edges only', () => {
  const nodes = N('a', 'b', 'c');
  const edges = [E('1', 'a', 'b', 'can assume', { granted: true }), E('2', 'b', 'c')];
  same((G.given(nodes, edges, 'a')), { a: 0, b: 1 });
});

// ---- the example story ----
const nodes = story.nodes, edges = story.edges, cut = story.cuts[0].edges, target = 'customer-data';
const names = (ids) => ids.map((id) => nodes.find((n) => n.id === id).name);

test('the example computes its numbers from the graph', () => {
  const before = G.reach(nodes, edges, story.start), after = G.reach(nodes, edges, story.start, cut);
  assert.equal(Object.keys(before).length - 1, 8);
  assert.equal(Object.keys(after).length - 1, 4);
  assert.equal(nodes.length - 1, 11);
  same(G.pathTo(nodes, edges, story.start, target).map((e) => e.id), ['bot-deploy', 'deploy-orders', 'orders-ops', 'ops-admin', 'admin-customer']);
  assert.equal(G.pathTo(nodes, edges, story.start, target, cut), null);
  same(names(G.others(nodes, edges, story.start, target)), ['Developer', 'On-call engineer']);
  same(names(G.others(nodes, edges, story.start, target, cut)), ['Developer']);
});

test('the direct grants are a strict subset of the full reach', () => {
  const given = Object.keys(G.given(nodes, edges, story.start)), all = Object.keys(G.reach(nodes, edges, story.start));
  assert.ok(given.length < all.length && given.every((id) => all.includes(id)));
  same(given.sort(), ['build-bot', 'deploy-role', 'orders']);
});

test('the example has one crown resource and every edge kind is known', () => {
  same(nodes.filter((n) => n.crown && n.kind === 'resource').map((n) => n.id), [target]);
  for (const e of edges) assert.ok(G.MOVING.includes(e.kind) || G.NON_MOVING.includes(e.kind), e.id);
  assert.ok(edges.some((e) => G.NON_MOVING.includes(e.kind)), 'the story shows a kind that does not move');
});

// ---- layout ----
const BOX = { x: 24, y: 176, w: 1872, h: 528 };
test('layout: columns by hop, unreachable last, nothing overlaps, everything inside the box', () => {
  const L = G.layout(nodes, edges, story.start, BOX), dist = G.reach(nodes, edges, story.start);
  for (const n of nodes) {
    const want = dist[n.id] === undefined ? L.ncol - 1 : dist[n.id];
    assert.equal(L.col[n.id], want, n.id);
  }
  assert.equal(L.ncol, Math.max(...Object.values(dist)) + 2);
  const P = Object.values(L.pos);
  for (const p of P) {
    assert.ok(p.x >= BOX.x - 1e-6 && p.x + p.w <= BOX.x + BOX.w + 1e-6 && p.y >= BOX.y - 1e-6 && p.y + p.h <= BOX.y + BOX.h + 1e-6, `${p.id} inside`);
    assert.ok(p.w >= 150 && p.h >= 80);
  }
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const a = P[i], b = P[j];
    assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.id} and ${b.id} overlap`);
  }
  const right = Math.max(...P.map((p) => p.x + p.w));
  assert.ok(right >= BOX.x + BOX.w - 1, 'the graph fills the width');
});

test('layout: every edge has a path, long edges run above the cards or end as stubs, order keeps crossings low', () => {
  const L = G.layout(nodes, edges, story.start, BOX);
  for (const e of edges) {
    const g = L.edges[e.id];
    assert.ok(g && g.d.startsWith('M') && (g.kind === 'stub' ? g.head === '' : g.head.split(' ').length === 3), e.id);
    if (g.kind === 'lane') assert.ok(g.laneY < BOX.y && g.laneY > 134, `${e.id} lane`);
  }
  assert.ok(L.crossings <= 3, `crossings ${L.crossings}`);
  same(G.layout(nodes, edges, story.start, BOX).cols, L.cols, 'deterministic');
});

test('layout: an edge from the unreachable column to a column further left is a short stub, not a line across the graph', () => {
  const L = G.layout(nodes, edges, story.start, BOX), stubs = edges.filter((e) => L.edges[e.id].kind === 'stub').map((e) => e.id).sort();
  same(stubs, ['oncall-ops', 'runtime-orders']);
  assert.equal(L.stubs, 2);
  for (const id of stubs) {
    const g = L.edges[id], from = L.pos[edges.find((e) => e.id === id).from];
    assert.ok(g.stub.x1 === from.x && g.stub.x1 - g.stub.x2 <= 30, `${id} is short and leaves the card's left side`);
    assert.ok(g.stub.y > from.y && g.stub.y < from.y + from.h, `${id} leaves at the card`);
  }
  assert.equal(L.lanes, 0, 'no lane above the cards is left');
  // the column of stubs gets room for a tag: the last gap is wider than the others
  const last = L.pos['developer'].x - (L.pos['customer-data'].x + L.W), first = L.pos['deploy-role'].x - (L.pos['build-bot'].x + L.W);
  assert.ok(last > first + 100, `last gap ${last} vs ${first}`);
});

test('layout: without unreachable nodes, or when none of their edges go far left, nothing is a stub and the gaps are even', () => {
  const ns = N('a', 'b', 'c'), es = [E('1', 'a', 'b'), E('2', 'b', 'c')];
  const L = G.layout(ns, es, 'a', BOX);
  assert.equal(L.stubs, 0);
  assert.ok(Math.abs((L.pos.b.x - (L.pos.a.x + L.W)) - (L.pos.c.x - (L.pos.b.x + L.W))) < 1e-6);
  const un = G.layout([...ns, ...N('z')], [...es, E('4', 'z', 'c')], 'a', BOX);       // z reaches the neighbouring column: a curve
  assert.equal(un.stubs, 0);
  const far = G.layout([...ns, ...N('z')], [...es, E('4', 'z', 'a')], 'a', BOX);        // z reaches back to the first column: a stub
  assert.equal(far.stubs, 1);
});

test('layout: cards grow to hold the widest name on one line, and the gaps keep a fifth of a card', () => {
  const base = G.layout(nodes, edges, story.start, BOX), wide = G.layout(nodes, edges, story.start, BOX, { nameW: 178 });
  assert.ok(wide.W >= 178 + 22, 'a card holds the name and its padding');
  assert.ok(wide.W > base.W && wide.W <= 230);
  assert.ok(wide.G >= wide.W * 0.2 - 1e-6, 'the gap between columns stays a fifth of a card or more');
  assert.equal(wide.lanes, 0, 'no lane across the top comes back');
  assert.equal(wide.stubs, base.stubs);
  const huge = G.layout(nodes, edges, story.start, BOX, { nameW: 400 });
  assert.ok(huge.G >= huge.W * 0.2 - 1e-6, 'a name too wide for any card does not squeeze the gaps further');
  same(G.layout(nodes, edges, story.start, BOX, { nameW: 10 }).W, base.W, 'a short name never narrows the cards');
});
