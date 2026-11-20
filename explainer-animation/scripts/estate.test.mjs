import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadKit } from './lib/load-kit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const skill = path.join(here, '..');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const EXK = loadKit({ bundle: 'scene' });
const plain = (v) => JSON.parse(JSON.stringify(v));

const REF = path.join(skill, 'assets', 'examples', 'ssrf-attack-chain.story.json');
const ORACLE = path.join(skill, 'scripts', 'testdata', 'oracle', 'a-flat-attack-chain.html');
const SYNTH = ['deep', 'wide', 'mixed'].map((n) => path.join(here, 'testdata', 'estates', n + '.story.json'));
const AREA = { w: 1920, h: 720 };

function model(file, mutate) {
  const raw = readJson(file);
  if (mutate) mutate(raw);
  const story = EXK.normalize(raw);
  const estate = EXK.layout.layoutEstate(story);
  const E = EXK.route.routeLinks(estate, story);
  return { story, estate, E };
}

for (const file of [REF, ...SYNTH]) {
  const name = path.basename(file, '.story.json');
  test(`${name}: every child inside its parent, no sibling overlap`, () => {
    const { estate } = model(file);
    assert.deepEqual(plain(EXK.layout.checkLayout(estate)), []);
    assert.deepEqual(plain(estate.problems), []);
    // and independently of checkLayout: every system sits inside every zone above it
    for (const n of estate.nodes) {
      for (let p = n.parent; p && p !== 'root'; p = estate.B[p].parent) {
        const b = estate.B[p];
        assert.ok(n.x >= b.x && n.y >= b.y && n.x + n.w <= b.x + b.w && n.y + n.h <= b.y + b.h, `${n.id} inside ${p}`);
      }
    }
  });

  test(`${name}: no two routes share a segment, none passes under a node other than its ends`, () => {
    const { estate, E } = model(file);
    const problems = EXK.route.checkRoutes(estate, E).filter((c) => c.level === 'error');
    assert.deepEqual(plain(problems.map((c) => c.message)), []);
    // the same two properties, recomputed here from the polylines
    const ids = Object.keys(E);
    const segs = Object.fromEntries(ids.map((id) => [id, EXK.route.segments(E[id].pts)]));
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      for (const u of segs[ids[i]]) for (const v of segs[ids[j]]) {
        if (u.h !== v.h || Math.abs(u.c - v.c) >= 1) continue;
        assert.ok(Math.min(u.hi, v.hi) - Math.max(u.lo, v.lo) <= 1, `${ids[i]} and ${ids[j]} share a segment`);
      }
    }
    for (const id of ids) {
      const r = E[id];
      for (const n of estate.nodes) {
        if (n.id === r.a || n.id === r.b) continue;
        for (const s of segs[id]) {
          const x0 = n.x, x1 = n.x + n.w, y0 = n.y, y1 = n.y + n.h;
          const hit = s.h ? s.c > y0 && s.c < y1 && s.hi > x0 && s.lo < x1 : s.c > x0 && s.c < x1 && s.hi > y0 && s.lo < y1;
          assert.ok(!hit, `${id} passes under ${n.id}`);
        }
      }
      // orthogonal, ends inside the end nodes
      for (const s of segs[id]) assert.ok(s.h || Math.abs(s.p[0] - s.q[0]) < 1e-9);
      const [a, b] = [estate.B[r.a], estate.B[r.b]], p0 = r.pts[0], pn = r.pts[r.pts.length - 1];
      assert.ok(p0[0] > a.x && p0[0] < a.x + a.w && p0[1] > a.y && p0[1] < a.y + a.h, `${id} starts inside ${r.a}`);
      assert.ok(pn[0] > b.x && pn[0] < b.x + b.w && pn[1] > b.y && pn[1] < b.y + b.h, `${id} ends inside ${r.b}`);
    }
  });

  test(`${name}: every step frame cuts no container border unless the step says grow`, () => {
    const { story, estate } = model(file);
    for (const st of story.steps) {
      const f = EXK.frame.frameFor(estate, st, AREA);
      if (!(st.frame && st.frame.grow)) assert.deepEqual(plain(f.cut), [], `${st.id} cuts ${f.cut}`);
      for (const id of f.hold) {
        const b = estate.B[id];
        assert.ok(b.x >= f.x - 1e-6 && b.y >= f.y - 1e-6 && b.x + b.w <= f.x + f.w + 1e-6 && b.y + b.h <= f.y + f.h + 1e-6, `${st.id} holds ${id}`);
      }
      assert.ok(Math.abs(f.w / f.h - AREA.w / AREA.h) < 1e-9, `${st.id} has the area aspect`);
    }
  });
}

test('reference: layout matches the flat v3 oracle within 24 stage px at the full view', () => {
  const html = fs.readFileSync(ORACLE, 'utf8');
  const core = html.split('//<core>')[1].split('//</core>')[0];
  const M = new Function(core + '; return buildModel();')();
  const { estate } = model(REF);
  const fullK = EXK.layout.fullOf(estate.world, AREA.w / AREA.h);
  const stage = (b, F) => [(b.cx - F.x) * AREA.w / F.w, (b.cy - F.y) * AREA.w / F.w];
  let worst = { id: null, d: -1 };
  for (const n of estate.nodes) {
    const o = M.B[n.id];
    assert.ok(o, `oracle has ${n.id}`);
    const [x1, y1] = stage(n, fullK), [x2, y2] = stage(o, M.full);
    const d = Math.hypot(x1 - x2, y1 - y2);
    if (d > worst.d) worst = { id: n.id, d };
  }
  console.log(`worst node centre offset vs oracle: ${worst.id} ${worst.d.toFixed(2)} stage px; full-view scale ${(AREA.w / fullK.w).toFixed(3)} (oracle ${(AREA.w / M.full.w).toFixed(3)})`);
  assert.ok(worst.d <= 24, `${worst.id} is ${worst.d.toFixed(1)} px off`);
  assert.ok(AREA.w / fullK.w >= 0.7);
});

test('reference: route shapes, corridor lanes and nesting as the hints ask', () => {
  const { estate, E } = model(REF);
  for (const id of ['attacker-cdn', 'cdn-lb', 'lb-storefront', 'storefront-payments', 'payments-db', 'secrets-detect']) {
    assert.equal(E[id].shape, 'straight', id);
  }
  assert.equal(E['storefront-imds'].shape, 'L');
  assert.equal(E['storefront-imds'].exit, 'bottom');
  // the three bypass links: lanes in the corridor under the VPC, lane 0 nearest the VPC
  const byp = ['attacker-secrets', 'attacker-s3', 'attacker-iam'].map((id) => E[id]);
  const vpcBottom = estate.B.vpc.y + estate.B.vpc.h, svcTop = estate.B.services.y;
  byp.forEach((r, i) => {
    assert.equal(r.shape, 'Z'); assert.equal(r.exit, 'bottom'); assert.equal(r.lane, i); assert.equal(r.lanes, 3);
    assert.ok(r.pts[1][1] > vpcBottom && r.pts[1][1] < svcTop, `${r.id} runs in the corridor`);
  });
  assert.ok(byp[0].pts[1][1] < byp[1].pts[1][1] && byp[1].pts[1][1] < byp[2].pts[1][1]);
  // nested exits: the farthest destination leaves the attacker rightmost
  assert.ok(byp[0].pts[0][0] > byp[1].pts[0][0] && byp[1].pts[0][0] > byp[2].pts[0][0]);
  // the audit links nest under the services row and enter detect side by side
  assert.equal(E['iam-detect'].shape, 'U'); assert.equal(E['s3-detect'].shape, 'U');
  assert.ok(E['s3-detect'].pts[1][1] < E['iam-detect'].pts[1][1]);
  assert.ok(E['s3-detect'].pts.at(-1)[0] < E['iam-detect'].pts.at(-1)[0]);
  const all = EXK.route.checkRoutes(estate, E);
  assert.deepEqual(plain(all.map((c) => c.message)), [], 'no warnings or crossings at all');
  // ports: one per border crossed, in order along the route
  assert.deepEqual(plain(E['lb-storefront'].ports.map((p) => p.box)), ['public', 'private', 'cluster', 'ns_web']);
  const M = EXK.route.markers(E, 36 / (AREA.w / estate.full.w));
  assert.ok(M.length > 0 && Object.values(E).every((r) => r.ports.every((p) => p.m >= 0 && p.m < M.length)));
});

test('reference without hints: still no shared segment and no route under a node', () => {
  const { estate, E } = model(REF, (raw) => raw.links.forEach((l) => delete l.route));
  const errors = EXK.route.checkRoutes(estate, E).filter((c) => c.level === 'error');
  assert.deepEqual(plain(errors.map((c) => c.message)), []);
});

test('routing is deterministic', () => {
  const a = model(REF).E, b = model(REF).E;
  assert.deepEqual(plain(a), plain(b));
});

test('wide row: links that skip neighbours leave the row and get separate lanes', () => {
  const { estate, E } = model(SYNTH[1]);
  for (const id of ['s1-s4', 's2-s5', 's3-s7', 'client-s6']) assert.equal(E[id].shape, 'U', id);
  assert.equal(E['s1-s2'].shape, 'straight');
  const runs = ['s1-s4', 's2-s5', 's3-s7', 'client-s6'].map((id) => E[id].pts[1][1]);
  assert.equal(new Set(runs.map(Math.round)).size, runs.length, 'distinct lanes');
  assert.deepEqual(plain(EXK.route.checkRoutes(estate, E).filter((c) => c.level !== "info").map((c) => c.message)), []);
});

test('mixed: below-row, dx/dy and main anchors are honoured', () => {
  const { estate, E } = model(SYNTH[2]);
  const B = estate.B;
  assert.ok(B.ops.y >= B.web.y + B.web.h + 100 - 1e-6, 'ops sits belowGap under web');
  assert.equal(B.ops.x - (B.cloud.x + B.cloud.pad.l), 60, 'ops dx from the content left');
  assert.equal(B.data.y - B.web.y, 30 + (B.web.a - B.data.a), 'data shifted by dy from the anchor line');
  assert.equal(B.cache.x - B.db.x, 40, 'dx inside a column');
  assert.equal(B.laptop.cy, B.lb.cy, 'main anchors align across the root row');
  assert.equal(E['db-logs'].rule, 'corridor');
  assert.ok(E['db-logs'].pts[1][0] > B.data.x + B.data.w, 'corridor right:data runs right of data');
  assert.equal(E['laptop-mon'].exit, 'bottom');
});

test('via waypoints are taken as given; a blocked link is reported, not hidden', () => {
  const raw = readJson(SYNTH[1]);
  const est0 = EXK.layout.layoutEstate(EXK.normalize(raw));
  const s2 = est0.B.s2, s5 = est0.B.s5, row = est0.B.row;
  const yv = row.y + row.h + 12;
  raw.links.push({ from: 's2', to: 's5', route: { via: [[s2.cx + 30, yv], [s5.cx - 30, yv]] } });
  const { estate, E } = model(SYNTH[1], (r) => { r.links = raw.links; });
  const v = E['s2-s5#2'];
  assert.equal(v.rule, 'via');
  assert.deepEqual(plain(v.pts), [[s2.cx + 30, s2.cy], [s2.cx + 30, yv], [s5.cx - 30, yv], [s5.cx - 30, s5.cy]]);
  assert.equal(EXK.route.findLink(E, 's5', 's2').rev, true);

  // a node boxed in by neighbours 8 units apart: every candidate passes under one
  const grid = { zones: [{ id: 'z', name: 'Grid', layout: { dir: 'col', gap: 8 } },
    ...[0, 1, 2].map((r) => ({ id: 'r' + r, name: 'r' + r, parent: 'z', layout: { dir: 'row', gap: 8, pad: { l: 0, r: 0, t: 0, b: 0 } } })),
    { id: 'out', name: 'Out' }],
  systems: [...[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => ({ id: `n${r}${c}`, name: `n${r}${c}`, zone: 'r' + r }))), { id: 'far', name: 'Far', zone: 'out' }],
  links: [{ from: 'n11', to: 'far' }], steps: [] };
  grid.zones.forEach((z) => { if (z.parent) z.name = null; });
  const ge = EXK.layout.layoutEstate(EXK.normalize(grid));
  const GE = EXK.route.routeLinks(ge, grid);
  assert.equal(GE['n11-far'].rule, 'blocked');
  const errs = EXK.route.checkRoutes(ge, GE).filter((c) => c.level === 'error').map((c) => c.kind);
  assert.ok(errs.includes('blocked') && errs.includes('through'));
});

test('frames: close-up of the cluster, grow frames, breadcrumb and proxy points', () => {
  const { story, estate, E } = model(REF);
  const creds = story.steps.find((s) => s.id === 'creds');
  const cam = creds.beats.find((b) => b.camera && b.camera.hold).camera;
  const f = EXK.frame.frameFor(estate, cam, AREA);
  const c = estate.B.cluster;
  assert.deepEqual(plain(f.cut), []);
  assert.ok(f.x <= c.x - 8 + 1e-6 && f.x + f.w >= c.x + c.w + 8 - 1e-6 && f.y <= c.y - 8 + 1e-6 && f.y + f.h >= c.y + c.h + 8 - 1e-6, 'holds the cluster plus 8 units');
  assert.ok(Math.abs(f.y + f.h / 2 - (c.y + c.h / 2)) < 1, 'centred on the cluster');
  assert.ok(f.zoom > 1.3 && f.zoom <= 2 + 1e-9, 'the story sets zoom 2: the cap does not apply, the cluster still fits');
  // without a zoom, the cap and the label room make the same hold widen until nothing is sliced
  const capped = EXK.frame.frameFor(estate, { hold: ['cluster'] }, AREA);
  assert.ok(capped.zoom <= 1.3 + 1e-9); assert.deepEqual(plain(capped.cut), []);
  assert.deepEqual(plain(f.crumb), ['AWS account', 'VPC', 'Private subnet']);
  const full = EXK.frame.frameFor(estate, 'full', AREA);
  assert.ok(full.full); assert.deepEqual(plain(full.crumb), []);
  const id = story.steps.find((s) => s.id === 'identity');
  const g = EXK.frame.frameFor(estate, id, AREA);
  assert.equal(g.grow, 'down');
  assert.ok(g.zoom <= 1.3 + 1e-9, 'close-ups are capped at 1.3');
  const sv = estate.B.services, top = estate.B.vpc.y + estate.B.vpc.h;
  assert.ok(Math.abs(g.y - (top + 4)) < 1e-6, 'anchored at the corridor edge: the VPC border above it is out of frame');
  assert.ok(!g.cut.includes('vpc') && !g.enclosing.includes('vpc'), 'no sliced edge of the VPC at the top');
  assert.ok((g.y + g.h - (sv.y + sv.h + 8)) * g.zoom >= 150 - 1e-6, 'label room below the row, on the grow side only');
  assert.ok(sv.x - g.x >= 300 / g.zoom - 1e-6 && g.x + g.w >= sv.x + sv.w + 8, 'room at the left for the proxy badge, the row whole');
  assert.ok(E['attacker-iam'].pts.slice(1, 3).every((p) => p[1] > g.y), 'the corridor lanes are in view');
  const px = EXK.frame.proxyPoint(E['attacker-iam'], g, 'a');
  assert.equal(px.side, 'left'); assert.ok(Math.abs(px.x - g.x) < 1e-6);
  assert.equal(EXK.frame.proxyPoint(E['attacker-iam'], g, 'b'), null);
  const pr = EXK.frame.proxyPoint(E['attacker-iam'], g, 'a');
  assert.deepEqual(plain(EXK.route.pointAt(E['attacker-iam'].pts, pr.s)).map(Math.round), [Math.round(pr.x), Math.round(pr.y)]);
  // without grow the same hold may not slice the account: it widens instead
  const w = EXK.frame.frameFor(estate, { hold: ['services'] }, AREA);
  assert.deepEqual(plain(w.cut), []); assert.ok(w.widened.includes('account'));
});

test('check-layout.mjs: reference passes with scale >= 0.70, a broken layout exits 1', () => {
  const r = spawnSync(process.execPath, [path.join(here, 'check-layout.mjs'), REF, '--style', 'flat'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const sc = /full-view scale (\d\.\d+)/.exec(r.stdout);
  assert.ok(sc && +sc[1] >= 0.7, r.stdout);
  assert.match(r.stdout, /containment and sibling checks passed/);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exk-'));
  const raw = readJson(SYNTH[1]);
  raw.zones[1].layout.gap = 4;  // nodes 4 apart: the skip links cannot leave the row cleanly
  raw.links.push({ from: 's1', to: 's3', route: { via: [[0, 0]] } });
  raw.links.push({ from: 's1', to: 's3', route: { via: [[0, 0]] } });
  const f = path.join(tmp, 'bad.story.json');
  fs.writeFileSync(f, JSON.stringify(raw));
  const r2 = spawnSync(process.execPath, [path.join(here, 'check-layout.mjs'), f], { encoding: 'utf8' });
  assert.equal(r2.status, 1, r2.stdout);
  assert.match(r2.stdout, /share a segment/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ---- generalisation fixes (cold stories) ----
const COLD = path.join(here, 'testdata', 'stories');
const coldModel = (name, style, mutate) => {
  const raw = readJson(path.join(COLD, name + '.story.json'));
  if (mutate) mutate(raw);
  const story = EXK.normalize(raw), estate = EXK.layout.layoutEstate(story, style);
  return { story, estate, E: EXK.route.routeLinks(estate, story) };
};

test('iso: a flat below hint no longer makes siblings overlap (the stretched top-level zone stops at its row)', () => {
  const { estate } = coldModel('cold-ai-flows', 'iso', (r) => { delete r.zones.find((z) => z.id === 'ext').layout.iso; });
  assert.deepEqual(plain(EXK.layout.checkLayout(estate)), []);
});

test('router: no two routes share a segment in any cold story, either style', () => {
  for (const name of ['cold-ai-flows', 'cold-supply-chain', 'cold-phishing']) for (const style of ['flat', 'iso']) {
    const { estate, E } = coldModel(name, style);
    const shared = EXK.route.checkRoutes(estate, E, {}).filter((c) => c.kind === 'shared');
    assert.deepEqual(plain(shared), [], `${name} ${style}`);
  }
});

test('layout: a zone with no dir gets the direction that fills the area better; explicit dir is kept', () => {
  const deep = path.join(here, 'testdata', 'estates', 'deep.story.json');
  const story = EXK.normalize(readJson(deep));
  const fixed = EXK.layout.layoutEstate(story, 'flat', { auto: false }), auto = EXK.layout.layoutEstate(story, 'flat');
  assert.ok(EXK.layout.fitScore(auto.world, auto.sizes) > EXK.layout.fitScore(fixed.world, fixed.sizes) * 1.03);
  assert.ok(auto.auto.length > 0);
  const ref = EXK.layout.layoutEstate(EXK.normalize(readJson(REF)), 'flat');
  assert.deepEqual(plain(ref.auto), []);
});

test('iso audit: refuses an estate whose full view is too small, accepts the cold stories', () => {
  const src = { kind: 'illustrative' };
  const systems = Array.from({ length: 22 }, (_, i) => ({ id: 's' + i, name: 'System ' + i, role: 'r', zone: 'z', icon: 'chip', source: src }));
  const big = EXK.normalize({ meta: { id: 'big', title: 'Big', kind: 'architecture', audience: 'technical', redaction: 'none', source: src },
    zones: [{ id: 'z', name: 'Zone', layout: { dir: 'row' }, source: src }], systems, links: [], phases: [{ id: 'p', title: 'P', source: src }],
    steps: [{ id: 'a', phase: 'p', title: 'T', body: 'B.', touch: ['s0'], uses: [], source: src }], controls: [], figures: {} });
  const a = EXK.layout.isoAudit(EXK.layout.layoutEstate(big, 'iso'), big);
  assert.ok(a.problems.some((p) => p.level === 'error' && p.kind === 'small'));
  for (const name of ['cold-ai-flows', 'cold-supply-chain', 'cold-phishing']) {
    const { story, estate } = coldModel(name, 'iso');
    assert.deepEqual(plain(EXK.layout.isoAudit(estate, story).problems.filter((p) => p.level === 'error').map((p) => p.message)), [], name);
  }
});

test('check-layout: a hint that makes a route worse is named, with the fix', () => {
  const raw = readJson(REF);
  raw.links.find((l) => l.from === 'lb' && l.to === 'storefront').route = { exit: 'top', corridor: 'above:internet' };
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'exk-cl-')), 'bad.story.json');
  fs.writeFileSync(f, JSON.stringify(raw));
  const r = spawnSync(process.execPath, [path.join(here, 'check-layout.mjs'), f], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /advice lb-storefront: the hint .* makes it worse.*remove links\[2\]\.route/);
});
