// The custom pattern seam: figure lookup, counts, chip windows, scene lookup, block validation, scene-file lint, build errors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadKit } from './lib/load-kit.mjs';
import { checkScene, lintHudNumbers, registeredScenes } from './lib/scene-file.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const example = (n) => path.join(root, 'assets', 'examples', n);
const EXK = loadKit();
const C = EXK.patterns.custom;
const eq = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exk-custom-'));
const ill = { kind: 'illustrative' };
const prov = { kind: 'provided', ref: 'FY26 plan, p.4' };
const run = (script, ...args) => spawnSync(process.execPath, [path.join(here, script), ...args], { encoding: 'utf8' });

const story = () => ({
  meta: { id: 's', title: 'T', kind: 'plan', audience: 'executive', redaction: 'none', source: ill, scene: 'demo' },
  phases: [{ id: 'p', title: 'P', source: ill }],
  steps: [{ id: 'a', phase: 'p', title: 'A', body: 'b', source: ill }],
  figures: { 'risk.a': { value: 70, unit: 'index', label: 'Risk A today', source: ill }, 'goal': { value: 90, unit: 'percent', label: 'Goal', source: prov }, _note: 'comment' },
  lanes: [{ id: 'l1', source: ill }],
});
const problems = (s, opts) => EXK.validate(s, opts).filter((p) => p.level === 'error').map(EXK.formatProblem);

test('ctx.figure returns value, unit, label and source', () => {
  const f = C.makeLedger(story()).figure('risk.a');
  eq({ value: f.value, unit: f.unit, label: f.label, source: f.source }, { value: 70, unit: 'index', label: 'Risk A today', source: ill });
  assert.equal(f.key, 'risk.a');
});

test('ctx.figure throws a clear message for an unknown key, and for a comment key', () => {
  const L = C.makeLedger(story());
  assert.throws(() => L.figure('risk.b'), /ctx\.figure\("risk\.b"\): no such key in story\.figures \(known: risk\.a, goal\)/);
  assert.throws(() => L.figure('_note'), /no such key/);
  assert.throws(() => L.figure('toString'), /no such key/);
});

test('ctx.count is a computed, derived count', () => {
  const c = C.count(9, 12);
  eq(c, { n: 9, of: 12, text: '9 of 12', derived: true });
  assert.throws(() => C.count(1.5, 4), /whole number/);
  assert.throws(() => C.count(-1, 4), /whole number/);
  assert.throws(() => C.count(5, 4), /at least n/);
  assert.throws(() => C.count('3', 4), /whole number/);
});

test('chip windows come from the windows in which illustrative figures and records are on screen', () => {
  const s = story(), L = C.makeLedger(s);
  L.figure('risk.a').shown(2, 5);                 // illustrative
  L.figure('goal').shown(0, 20);                  // provided: never drives the chip
  L.note(s.lanes[0], 9, Infinity);                // an illustrative record, open ended
  eq(L.windows(12), [{ from: 2, to: 5 }, { from: 9, to: 12 }]);
  eq(L.windows(12, 5), [{ from: 2, to: 12 }]);    // a wider gap merges them
});

test('chip windows merge close and overlapping windows, clip to the scene, and are empty without illustrative figures', () => {
  const P = EXK.provenance;
  eq(P.shownWindows([{ from: 1, to: 3, source: ill }, { from: 2.5, to: 4, source: ill }, { from: 4.5, to: 6, source: ill }], 10), [{ from: 1, to: 6 }]);
  eq(P.shownWindows([{ from: 1, to: 3, source: ill }, { from: 5, to: 6, source: ill }], 10), [{ from: 1, to: 3 }, { from: 5, to: 6 }]);
  eq(P.shownWindows([{ from: -2, to: Infinity, source: ill }], 7), [{ from: 0, to: 7 }]);
  eq(P.shownWindows([{ from: 20, to: 30, source: ill }, { from: 3, to: 3, source: ill }], 10), []);
  eq(P.shownWindows([{ from: 0, to: 9, source: prov }, { from: 0, to: 9, source: { kind: 'derived' } }], 10), []);
  eq(P.shownWindows([], 10), []);
});

test('ctx.shown refuses something without a source and a window that is not a time', () => {
  const L = C.makeLedger(story());
  assert.throws(() => L.note({ id: 'x' }, 0, 1), /figure from ctx\.figure/);
  assert.throws(() => L.note({ source: ill }, 'a', 1), /times in seconds/);
});

test('scene lookup: one registered, named by meta.scene, none, several, wrong name', () => {
  const sc = { build() {}, step() {} };
  const s = story();
  assert.equal(C.resolveScene(s, { demo: sc }).name, 'demo');
  delete s.meta.scene;
  assert.equal(C.resolveScene(s, { only: sc }).name, 'only');
  assert.throws(() => C.resolveScene(s, {}), /no scene is registered; the scene file must set EXK\.scenes\.<name>/);
  assert.throws(() => C.resolveScene(s, { a: sc, b: sc }), /several scenes are registered \(a, b\); set meta\.scene/);
  s.meta.scene = 'c';
  assert.throws(() => C.resolveScene(s, { a: sc }), /meta\.scene is "c" but the scene file registers "a"/);
  s.meta.scene = 'a';
  assert.throws(() => C.resolveScene(s, { a: { build() {} } }), /needs build\(ctx\) and step\(ctx, step, t0\)/);
});

test('timing: a quantity change takes 1.2 s and its result holds max(2.0 s, words x 0.35)', () => {
  const T = EXK.timing;
  assert.equal(T.QUANTITY_MIN, 1.2);
  assert.equal(T.resultHold(), 2.0);
  assert.equal(T.resultHold('three short words'), 2.0);
  assert.ok(Math.abs(T.resultHold('one two three four five six seven eight nine ten') - 3.5) < 1e-9);
});

test('validation: a custom story needs source on every record of every block, and on every figure', () => {
  const s = story();
  eq(problems(s), []);
  s.lanes.push({ id: 'l2' });
  s.dependencies = [{ from: 'a', to: 'b' }];
  s.figures.bad = { value: 3, unit: 'index', label: 'x' };
  s.horizons = [{ id: 'h', source: { kind: 'provided' } }];
  s.extra = [{ id: 'e', note: 'free shape' }];
  eq(problems(s, { pattern: 'custom' }).map((l) => l.split(':')[0]).sort(), ['dependencies[0].source', 'extra[0].source', 'figures.bad.source', 'horizons[0].source.ref', 'lanes[1].source']);
});

test('validation: a block outside the named ones is checked only for a custom story (pattern or meta.scene)', () => {
  const s = story();
  s.extra = [{ id: 'e' }];
  assert.equal(problems(s).length, 1);                                  // meta.scene is set: custom
  delete s.meta.scene;
  eq(problems(s), []);                                                  // a flow story: free key ignored
  assert.equal(problems(s, { pattern: 'custom' }).length, 1);
  s.meta.scene = '';
  assert.match(problems(s)[0], /^meta\.scene: is not a scene name/);
});

test('validation: a figure typed as a count is still refused', () => {
  const s = story();
  s.figures.n = { value: 9, unit: 'count', label: 'n', source: ill };
  assert.match(problems(s)[0], /figures\.n: is a count typed into the story/);
});

test('lint: a number typed into the text of a HUD call is warned about, one read through figures or counts is not', () => {
  const js = [
    "ctx.hud.banner('Target 2027', C.accent);",
    "ctx.hud.measure({ label: 'Risks above appetite', value: ctx.count(0, n), color: C.danger });",
    "ctx.hud.measure({ label: 'Cover', value: 42 });",
    'ctx.hud.legend([{ color: c, label: `${n} done` }, { color: c, label: `${n} of 12` }]);',
    "ctx.hud.measure({ key: 'cut.p2', label: 'Plain' });",
    "var x = 'free 12 text'; ctx.text.add(g, 'Out of 100', {}, 'k');",
  ].join('\n');
  const w = lintHudNumbers(js, 's.js', ['cut.p2']);
  assert.equal(w.length, 3);
  assert.match(w[0], /^s\.js:1: hud\.banner text 'Target 2027' has a number typed into it/);
  assert.match(w[1], /^s\.js:3: hud\.measure value is a number typed into the scene/);
  assert.match(w[2], /^s\.js:4: hud\.legend text `\$\{n\} of 12`/);
});

test('lint: the roadmap example scene is clean, and registers the scene the story names', () => {
  const file = example('roadmap-risk-burn-down.scene.js');
  assert.deepEqual(lintHudNumbers(fs.readFileSync(file, 'utf8'), file), []);
  const st = JSON.parse(fs.readFileSync(example('roadmap-risk-burn-down.story.json'), 'utf8'));
  assert.deepEqual(registeredScenes(fs.readFileSync(file, 'utf8')), ['roadmap']);
  assert.equal(checkScene({ file, story: st }).name, 'roadmap');
});

test('the roadmap example story is valid; every figure and every block record has a source', () => {
  const st = JSON.parse(fs.readFileSync(example('roadmap-risk-burn-down.story.json'), 'utf8'));
  eq(problems(st), []);
  for (const f of Object.values(st.figures)) assert.equal(f.source.kind, 'illustrative');
  for (const k of ['horizons', 'lanes', 'initiatives', 'risks', 'dependencies']) assert.ok(st[k].length && st[k].every((r) => r.source.kind === 'illustrative'), k);
  assert.ok(EXK.provenance.illustrative(st).length > 40);
});

test('registeredScenes finds both spellings', () => {
  assert.deepEqual(registeredScenes("EXK.scenes.a = {}; EXK . scenes['b-c'] = {}; EXK.scenes.a = 1; x.scenes.q = 1"), ['a', 'b-c']);
});

test('build: --pattern custom needs --scene; a file that registers nothing, or not the named scene, is an error', () => {
  const s = path.join(tmp, 's.story.json');
  fs.writeFileSync(s, JSON.stringify(story()));
  const none = path.join(tmp, 'none.js'), other = path.join(tmp, 'other.js'), good = path.join(tmp, 'good.js'), out = path.join(tmp, 'o.html');
  fs.writeFileSync(none, '// nothing');
  fs.writeFileSync(other, 'EXK.scenes.other = { build() {}, step() {} };');
  fs.writeFileSync(good, 'EXK.scenes.demo = { build() {}, step() {} };');
  let r = run('build.mjs', s, '--style', 'flat', '--pattern', 'custom', '-o', out);
  assert.equal(r.status, 2); assert.match(r.stderr, /--pattern custom needs --scene/);
  r = run('build.mjs', s, '--style', 'flat', '--pattern', 'custom', '--scene', none, '-o', out);
  assert.equal(r.status, 1); assert.match(r.stderr, /no scene is registered/);
  r = run('build.mjs', s, '--style', 'flat', '--pattern', 'custom', '--scene', other, '-o', out);
  assert.equal(r.status, 1); assert.match(r.stderr, /meta\.scene is "demo" but the scene file registers "other"/);
  assert.ok(!fs.existsSync(out));
  r = run('build.mjs', s, '--style', 'flat', '--pattern', 'custom', '--scene', good, '-o', out);
  assert.equal(r.status, 0, r.stderr);
  assert.match(fs.readFileSync(out, 'utf8'), /EXK\.scenes\.demo/);
});

test('build: a typed number in a HUD call is a warning, not an error; gsap.timeline( is still refused', () => {
  const s = path.join(tmp, 's2.story.json'), f = path.join(tmp, 'typed.js'), out = path.join(tmp, 'o2.html');
  fs.writeFileSync(s, JSON.stringify(story()));
  fs.writeFileSync(f, "EXK.scenes.demo = { build(ctx) { ctx.hud.banner('9 of 12', ctx.THEME.accent); }, step() {} };");
  let r = run('build.mjs', s, '--style', 'flat', '--pattern', 'custom', '--scene', f, '-o', out);
  assert.equal(r.status, 0);
  assert.match(r.stderr, /warning: .*typed\.js:1: hud\.banner text '9 of 12' has a number typed into it/);
  fs.writeFileSync(f, 'EXK.scenes.demo = { build() { gsap.timeline({}); }, step() {} };');
  r = run('build.mjs', s, '--style', 'flat', '--pattern', 'custom', '--scene', f, '-o', out);
  assert.equal(r.status, 1); assert.match(r.stderr, /gsap\.timeline\(/);
});

test('check-story: the roadmap example is ok; a record without source in a free block is refused', () => {
  let r = run('check-story.mjs', example('roadmap-risk-burn-down.story.json'));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^ok: custom scene roadmap, 3 phases, 6 steps, 25 figures, blocks horizons 3, lanes 4, initiatives 9, risks 5, dependencies 4/);
  const st = JSON.parse(fs.readFileSync(example('roadmap-risk-burn-down.story.json'), 'utf8'));
  delete st.initiatives[2].source;
  const f = path.join(tmp, 'nosrc.story.json');
  fs.writeFileSync(f, JSON.stringify(st));
  r = run('check-story.mjs', f);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^initiatives\[2\]\.source: is missing\. Fix: add "source"/);
});

test('build: the flow pattern still treats --scene as --extra (the stub path) and --pattern flow is the default', () => {
  const st = path.join(here, 'testdata', 'minimal.story.json'), out = path.join(tmp, 'flow.html');
  const r = run('build.mjs', st, '--style', 'flat', '--scene', path.join(here, 'testdata', 'stub', 'stub.js'), '-o', out);
  assert.equal(r.status, 0, r.stderr);
  assert.match(fs.readFileSync(out, 'utf8'), /EXK\.runSteps = function/);
});
