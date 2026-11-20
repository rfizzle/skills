// --json on the four check scripts: stdout is one JSON array of findings, every finding has the shared shape,
// and error findings exist exactly when the exit code is not 0. The two browser scripts are skipped when no
// browser harness is available (EXPLAINER_BROWSER_DIR), as in beats.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const example = path.join(root, 'assets', 'examples', 'ssrf-attack-chain.story.json');
const roadmap = path.join(root, 'assets', 'examples', 'roadmap-risk-burn-down.story.json');
const invalid = path.join(here, 'testdata', 'invalid');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exk-json-'));
const SEVERITIES = ['error', 'warning', 'info'];

function harness() {
  const dir = process.env.EXPLAINER_BROWSER_DIR;
  return dir && fs.existsSync(path.join(dir, 'node_modules', 'playwright')) ? dir : null;
}
const noHarness = harness() ? false : 'no browser harness (set EXPLAINER_BROWSER_DIR)';

function run(script, args) {
  const r = spawnSync(process.execPath, [path.join(here, script), ...args, '--json'], { encoding: 'utf8', timeout: 600000 });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// Runs `script --json`, checks the shape of every finding, and returns the findings.
function findings(script, args, { status }) {
  const r = run(script, args);
  assert.equal(r.status, status, `${script} exit code (stderr: ${r.stderr.slice(0, 300)})`);
  assert.ok(r.stdout.startsWith('['), 'stdout starts with the array');
  const list = JSON.parse(r.stdout);                      // throws when anything but the array is on stdout
  assert.equal(r.stdout.trim(), JSON.stringify(list, null, 2), 'stdout is the array and nothing else');
  assert.ok(Array.isArray(list));
  const check = script.replace(/\.mjs$/, '');
  for (const f of list) {
    for (const k of ['check', 'rule', 'severity', 'message', 'fix']) assert.equal(typeof f[k], 'string', `${k} is a string in ${JSON.stringify(f)}`);
    for (const k of ['step', 'record', 'path']) assert.ok(f[k] === undefined || typeof f[k] === 'string', `${k} is a string when present`);
    assert.equal(f.check, check);
    assert.match(f.rule, /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, 'rule is a short kebab-case identifier');
    assert.ok(SEVERITIES.includes(f.severity), `severity ${f.severity}`);
    assert.ok(f.message.length > 0);
    assert.ok(Object.keys(f).every((k) => ['check', 'rule', 'severity', 'step', 'record', 'path', 'message', 'fix'].includes(k)), 'no other keys');
  }
  const errors = list.filter((f) => f.severity === 'error');
  assert.equal(errors.length > 0, status !== 0, 'error findings exist exactly when the exit code is not 0');
  return list;
}

/* ---------- check-story ---------- */
test('check-story --json: a failing fixture', () => {
  const list = findings('check-story.mjs', [path.join(invalid, 'title-too-long.story.json')], { status: 1 });
  assert.equal(list.length, 1);
  assert.equal(list[0].rule, 'title-too-long');
  assert.equal(list[0].step, 'arrive');
  assert.equal(list[0].record, 'steps[0]');
  assert.match(list[0].fix, /shorten the title/);
  assert.ok(list[0].path.endsWith('title-too-long.story.json'));
});

test('check-story --json: every invalid fixture reports at least one error', () => {
  for (const f of fs.readdirSync(invalid).filter((n) => n.endsWith('.json'))) findings('check-story.mjs', [path.join(invalid, f)], { status: 1 });
});

test('check-story --json: the examples pass with only information', () => {
  for (const f of [example, roadmap]) {
    const list = findings('check-story.mjs', [f], { status: 0 });
    assert.deepEqual(list.map((x) => x.severity), ['info']);
  }
});

test('check-story --json: a warning does not fail the check', () => {
  const list = findings('check-story.mjs', [path.join(here, 'testdata', 'warn', 'camera-beat-iso.story.json'), '--style', 'iso'], { status: 0 });
  assert.ok(list.some((x) => x.severity === 'warning'));
});

test('check-story --json: a usage error and an unreadable file are errors', () => {
  const list = findings('check-story.mjs', [], { status: 2 });
  assert.equal(list[0].rule, 'usage');
  const bad = path.join(tmp, 'not-json.story.json');
  fs.writeFileSync(bad, '{ nope');
  assert.equal(findings('check-story.mjs', [bad], { status: 1 })[0].rule, 'unreadable-json');
});

/* ---------- check-layout ---------- */
test('check-layout --json: a failing estate', () => {
  const s = JSON.parse(fs.readFileSync(example, 'utf8'));
  s.zones.find((z) => z.id === 'cluster').layout = { dir: 'row', gap: -80, main: true };     // siblings overlap
  const bad = path.join(tmp, 'overlap.story.json');
  fs.writeFileSync(bad, JSON.stringify(s));
  const list = findings('check-layout.mjs', [bad], { status: 1 });
  const hits = list.filter((x) => x.rule === 'overlap');
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].severity, 'error');
  assert.ok(hits[0].fix.length > 0);
});

test('check-layout --json: the example passes in both styles', () => {
  for (const style of ['flat', 'iso']) {
    const list = findings('check-layout.mjs', [example, '--style', style], { status: 0 });
    assert.ok(list.every((x) => x.severity !== 'error'));
    assert.ok(list.some((x) => x.rule === 'routes'));
  }
});

/* ---------- the browser scripts ---------- */
function build(args, out) {
  const r = spawnSync(process.execPath, [path.join(here, 'build.mjs'), example, ...args, '-o', out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return out;
}

test('render-check --json: a failing page and a passing page, in one invocation', { skip: noHarness }, () => {
  const bad = path.join(tmp, 'bad.html');
  fs.writeFileSync(bad, '<!doctype html><body><div id="b" style="position:absolute;width:20px;height:20px;background:#000"></div><script>window.anim={duration:4,seek:function(t){var b=document.getElementById("b");b.style.left=Math.random()*1500+"px";b.style.top=Math.random()*900+"px";},steps:[{id:"one",time:0}]};</script>');
  const good = build(['--style', 'flat'], path.join(tmp, 'flat.html'));
  const list = findings('render-check.mjs', [bad, good], { status: 1 });
  const errors = list.filter((x) => x.severity === 'error');
  assert.deepEqual(errors.map((x) => [x.rule, path.basename(x.path)]), [['seek-nondeterministic', 'bad.html']]);
  assert.ok(list.some((x) => x.rule === 'rest-missing' && x.step === 'one'));
  assert.deepEqual([...new Set(list.map((x) => path.basename(x.path)))].sort(), ['bad.html', 'flat.html']);
  // the passing page alone: no errors, exit 0
  assert.ok(findings('render-check.mjs', [good], { status: 0 }).every((x) => x.severity !== 'error'));
});

test('check-replay --json: a failing page and a passing page', { skip: noHarness }, () => {
  const good = build(['--replay'], path.join(tmp, 'replay.html'));
  const html = fs.readFileSync(good, 'utf8');
  const i = html.lastIndexOf('</body>');
  const bad = path.join(tmp, 'replay-bad.html');      // a total on the page that the story does not give
  fs.writeFileSync(bad, html.slice(0, i) + "<script>setTimeout(function(){document.getElementById('kick').textContent='reconstructed from 1 actions';},300)</script>" + html.slice(i));
  const list = findings('check-replay.mjs', [bad], { status: 1 });
  assert.ok(list.some((x) => x.rule === 'displayed-total-mismatch' && x.severity === 'error'));
  assert.ok(findings('check-replay.mjs', [good], { status: 0 }).every((x) => x.severity !== 'error'));
});

/* ---------- the documented rule list ---------- */
test('references/checks.md lists every rule these fixtures produce', () => {
  const doc = fs.readFileSync(path.join(root, 'references', 'checks.md'), 'utf8');
  const documented = new Set([...doc.matchAll(/`([a-z][a-z0-9<>]*(?:-[a-z0-9<>]+)*)`/g)].map((m) => m[1]));
  const seen = new Set();
  for (const f of fs.readdirSync(invalid).filter((n) => n.endsWith('.json'))) {
    for (const x of findings('check-story.mjs', [path.join(invalid, f)], { status: 1 })) seen.add(x.rule);
  }
  for (const r of seen) assert.ok(documented.has(r), `${r} is documented`);
  for (const r of ['usage', 'unreadable-json', 'summary', 'overlap', 'routes', 'seek-nondeterministic', 'displayed-total-mismatch']) assert.ok(documented.has(r), `${r} is documented`);
  const src = fs.readFileSync(path.join(root, 'assets', 'kit', 'story', 'validate.js'), 'utf8');
  for (const m of src.matchAll(/\b(?:err|warn|pairProblem|pair)\('([^']*)'/g)) assert.ok(documented.has(m[1]), `${m[1]} is documented`);
});
