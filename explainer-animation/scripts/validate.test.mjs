import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadKit } from './lib/load-kit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const data = (...p) => path.join(here, 'testdata', ...p);
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const EXK = loadKit();
// objects built inside the vm context have another realm's prototypes: compare as plain JSON
const eq = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);
const minimal = () => readJson(data('minimal.story.json'));
const lines = (story, opts) => EXK.validate(story, opts).filter((p) => p.level === 'error').map(EXK.formatProblem);

test('the minimal story is valid and counts match', () => {
  eq(EXK.validate(minimal()), []);
  const s = minimal();
  assert.equal(s.zones.length, 2); assert.equal(s.systems.length, 3); assert.equal(s.links.length, 2);
  assert.equal(s.phases.length, 1); assert.equal(s.steps.length, 2);
});

const invalid = fs.readdirSync(data('invalid')).filter((f) => f.endsWith('.story.json')).sort();
test('there is one fixture per P0 rule', () => assert.equal(invalid.length, 10));   /* camera-beat-iso became a warning in P7: testdata/warn/ */

test('warn/camera-beat-iso: check-story exits 0 and prints the warning (iso skips camera beats)', () => {
  const f = data('warn', 'camera-beat-iso.story.json'), story = readJson(f);
  const r = spawnSync(process.execPath, [path.join(here, 'check-story.mjs'), f], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stderr.trim(), story._expect);
});

for (const f of invalid) {
  test(`invalid/${f}: validator prints exactly _expect`, () => {
    const story = readJson(data('invalid', f));
    assert.ok(story._expect, 'fixture has _expect');
    eq(lines(story, { style: story._style }), [story._expect]);
  });
  test(`invalid/${f}: check-story exits 1 and prints _expect`, () => {
    const story = readJson(data('invalid', f));
    const r = spawnSync(process.execPath, [path.join(here, 'check-story.mjs'), data('invalid', f)], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.equal(r.stderr.trim(), story._expect);
  });
}

test('check-story prints a one-line ok summary for the minimal story', () => {
  const r = spawnSync(process.execPath, [path.join(here, 'check-story.mjs'), data('minimal.story.json')], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), 'ok: 3 systems, 2 zones, 2 links, 1 phases, 2 steps, 0 events, 0 controls');
});

test('provided without ref, and bad source kind', () => {
  const s = minimal();
  s.systems[0].source = { kind: 'provided' };
  s.systems[1].source = { kind: 'guess' };
  eq(lines(s), [
    'systems[0].source.ref: is missing on a provided record. Fix: add ref naming where the fact came from, specific enough to find it again.',
    'systems[1].source.kind: is "guess", not one of provided, derived, illustrative. Fix: set kind to provided, derived or illustrative.',
  ]);
});

test('events need step, from, to, visibility, actor', () => {
  const s = minimal();
  s.events = [{ t: 0, source: { kind: 'illustrative' } }];
  const paths = EXK.validate(s).map((p) => p.path);
  eq(paths, ['events[0].step', 'events[0].from', 'events[0].to', 'events[0].visibility', 'events[0].actor']);
});

test('beats: closed vocabulary and resolved ids', () => {
  const s = minimal();
  s.steps[0].beats = [{ teleport: ['client', 'db'] }, { chain: ['client', 'web', 'db'], mark: 'nope' }, { shields: ['x'] }, { stream: ['client', 'web'], items: [1, 2, 3, 4, 5] }];
  eq(EXK.validate(s).map((p) => p.path), [
    'steps[0].beats[0]', 'steps[0].beats[1].mark', 'steps[0].beats[2].shields[0]', 'steps[0].beats[3].items',
  ]);
});

test('beat kind is the first kind key; mark beside it is a field; pulse and stream paths', () => {
  const s = minimal();
  s.steps[0].beats = [{ chain: ['client', 'web'], mark: 'web', mono: true, at: 1 }, { mark: 'db' }, { pulse: 'web', at: 2 }, { stream: ['client', 'web', 'db'], items: ['a'] }];
  eq(EXK.validate(s), []);
  s.steps[0].beats = [{ pulse: 'nope' }, { mark: 'db', at: 'soon' }];
  eq(EXK.validate(s).map((p) => p.path), ['steps[0].beats[0].pulse', 'steps[0].beats[1].at']);
});

test('iso: camera, grow and a second card are warnings (the iso painter skips or ignores them)', () => {
  const s = minimal();
  s.steps[0].frame = { hold: ['web'], grow: 'down' };
  s.steps[0].beats = [{ camera: 'full' }, { card: 'a', at: 'web' }, { card: 'b', at: 'db' }];
  eq(EXK.validate(s, { style: 'iso' }).map((p) => p.level), ['warning', 'warning', 'warning']);
  eq(EXK.validate(s, { style: 'flat' }), []);
});

test('links: route hints and route.iso take exit, corridor, lane, via; anything else is an error', () => {
  const s = minimal();
  s.links[0].route = { exit: 'bottom', lane: 1, iso: { corridor: 'below:web', via: [[0, 0]] } };
  eq(EXK.validate(s), []);
  s.links[0].route = { exit: 'bottom', side: 'x', iso: { iso: {}, lane: 0 } };
  eq(EXK.validate(s).map((p) => p.path), ['links[0].route.side', 'links[0].route.iso.iso']);
});

test('callouts: at most 2, 6 words each, targets resolve', () => {
  const s = minimal();
  s.steps[0].callouts = [{ target: 'web', text: 'one two three four five six seven' }, { target: 'zz', text: 'ok' }, { target: 'db', text: 'ok' }];
  eq(EXK.validate(s).filter((p) => p.level === 'error').map((p) => p.path), ['steps[0].callouts', 'steps[0].callouts[0].text', 'steps[0].callouts[1].target']);
});

test('keys starting with _ are comments and are skipped', () => {
  const s = minimal();
  s._anything = { nonsense: true };
  s.steps[0]._note = 'x';
  eq(EXK.validate(s), []);
  assert.equal(EXK.normalize(s)._anything, undefined);
  assert.equal(EXK.normalize(s).steps[0]._note, undefined);
});

test('normalize fills beats from uses, frame from touch, short from name', () => {
  const n = EXK.normalize(minimal());
  assert.equal(n.zones[1].short, 'Cloud');
  assert.equal(n.systems[2].short, 'Database');
  eq(n.steps[1].beats, [{ chain: ['web', 'db'] }]);
  eq(n.steps[1].frame, { hold: ['web', 'db'] });
  assert.equal(n.steps[0].frame, 'full');
  eq(n.steps[0].beats[0].tag, 'GET');
  const s = minimal();
  s.steps[1].uses = [['client', 'web'], ['web', 'db'], ['db', 'web']];
  s.steps[1].touch = [];
  const m = EXK.normalize(s);
  eq(m.steps[1].beats, [{ chain: ['client', 'web', 'db', 'web'] }]);
  assert.equal(m.steps[1].frame, 'full');
  assert.equal(minimal().systems[0].short, undefined, 'input is not mutated');
});

test('normalize splits uses runs that do not continue', () => {
  const s = minimal();
  s.steps[1].uses = [['client', 'web'], ['web', 'db'], ['client', 'web']];
  eq(EXK.normalize(s).steps[1].beats, [{ chain: ['client', 'web', 'db'] }, { chain: ['client', 'web'] }]);
});

test('provenance: illustrative records and chip windows', () => {
  const s = minimal();
  assert.equal(EXK.provenance.illustrative(s).length, 1 + 2 + 3 + 2 + 1 + 2);
  // all illustrative via meta: one window over the whole film
  const steps = [{ id: 'arrive', time: 0 }, { id: 'lookup', time: 10 }];
  eq(EXK.provenance.chipWindows(s, steps, 20), [{ from: 0, to: 20 }]);
  // only the db is illustrative: the chip shows for step 2 only
  const t = minimal();
  const prov = { kind: 'provided', ref: 'x' };
  [t.meta, ...t.zones, ...t.systems, ...t.links, ...t.phases, ...t.steps].forEach((r) => { r.source = { ...prov }; });
  t.systems[2].source = { kind: 'illustrative' };
  eq(EXK.provenance.illustrative(t), [{ path: 'systems[2]', id: 'db' }]);
  eq(EXK.provenance.chipWindows(t, steps, 20), [{ from: 10, to: 20 }]);
  t.systems[2].source = prov;
  eq(EXK.provenance.chipWindows(t, steps, 20), []);
});

test('boot does not throw on the minimal story and exposes it', () => {
  const kit = loadKit();
  kit.STORY = minimal();
  kit.BUILD = { style: 'flat' };
  const story = kit.boot();
  assert.equal(story.steps.length, 2);
  assert.equal(kit.story, story);
});

/* ---- caption rules and typed counts: warnings, never errors ---- */
const warns = (story, opts) => EXK.validate(story, opts).filter((p) => p.level === 'warning');
const withTitle = (text) => { const s = minimal(); s.steps[0].body = text; return s; };
const countWarn = (text) => warns(withTitle(text)).filter((p) => /typed count/.test(p.message)).map((p) => p.message.match(/contains "(.*?)"/)[1]);

test('typed counts: digits and a noun, a number word and a noun, N of M, x4 are warned about', () => {
  eq(countWarn('The model retrieves 3 passages for the question.'), ['3 passages']);
  eq(countWarn('Three tokens leave the cluster.'), ['Three tokens']);
  eq(countWarn('Two of the controls fail.'), ['Two of the']);
  eq(countWarn('Step done, 4 of 9 systems reached.'), ['4 of 9']);
  eq(countWarn('The push repeats x4 before approval.'), ['x4']);
  eq(countWarn('Retries run 5x faster.'), ['5x']);
  eq(countWarn('1,200 users saw the page.'), ['1,200 users']);
});

test('typed counts: versions, ports, addresses, times, HTTP codes, paths, identifiers, units, years and quoted names are not warned about', () => {
  for (const t of [
    'The registry returns 2.4.1 and nothing compares it.', 'TLS 1.3 is used.', 'It listens on port 443 only.', 'The call goes to 169.254.169.254 first.',
    'At 14:02 UTC the alert fires.', 'The request returns 403 Forbidden.', 'HTTP 200 comes back.', 'It fetches /shop?id=7 and /v2/items.',
    'Role node-role-2 and s3 and ec2 and sha256 and x509 are named.', 'Keys expire after 15 minutes or 2 hours.', 'The 2024 release adds 10 GB limits.',
    'Step 3 reads the secret.', 'One policy blocks it and no one notices.', 'A "Top 10 risks" list is shown.', 'The flow takes 1.5 seconds.', 'Phase 2 starts.',
  ]) eq(countWarn(t), []);
});

test('typed counts: _literal on the step, the beat or the callout exempts it; machine text in a mono beat is not scanned', () => {
  const s = withTitle('The vendor ships 3 passages.');
  s.steps[0]._literal = true;
  eq(warns(s), []);
  const b = minimal();
  b.steps[0].beats = [{ chain: ['client', 'web'], says: 'sent 3 passages', _literal: true }, { chain: ['client', 'web'], says: 'sent 3 passages', mono: true }, { chain: ['client', 'web'], says: 'sent 3 passages' }];
  eq(warns(b).map((p) => p.path), ['steps[0].beats[2].says']);
  const c = minimal();
  c.steps[0].callouts = [{ target: 'web', text: '3 passages', _literal: true }, { target: 'db', text: '3 passages' }];
  eq(warns(c).map((p) => p.path), ['steps[0].callouts[1].text']);
  eq(lines(b), []); eq(lines(c), []);
});

test('typed counts are looked for in titles, callouts, says, req, resp, card rows and tags', () => {
  const s = minimal();
  s.steps[0].title = 'Seven tokens leave';
  s.steps[0].callouts = [{ target: 'web', text: 'two copies kept' }];
  s.steps[0].beats = [{ chain: ['client', 'web'], says: ['ok', 'got 3 rows'], tag: '3 hops' }, { exchange: ['web', 'db'], req: 'fetch 4 files', resp: 'sent 5 files' }, { card: 'c', at: 'web', rows: ['6 keys'] }];
  eq(warns(s).map((p) => p.path), ['steps[0].title', 'steps[0].callouts[0].text', 'steps[0].beats[0].says[1]', 'steps[0].beats[0].tag', 'steps[0].beats[1].req', 'steps[0].beats[1].resp', 'steps[0].beats[2].rows[0]']);
});

test('caption rules: character caps per field, "Now", "Here", "Next" as a first word, unbalanced backticks', () => {
  const s = minimal();
  s.steps[0].title = 'Now the attacker enters';
  s.steps[0].body = 'Here is what happens. ' + 'x'.repeat(260);
  s.steps[0].callouts = [{ target: 'web', text: 'extraordinarily long callout phrase' }];
  s.steps[0].beats = [{ chain: ['client', 'web'], says: ['short line\nthis second line is much too long to fit beside a block'], tag: 'authentication-tokens' }, { exchange: ['web', 'db'], req: 'fine', resp: '`broken' }, { card: 'c', at: 'web', rows: ['a row that is longer than the card can show'] }];
  const w = warns(s).map((p) => p.path + ' ' + p.message.split(' (')[0].replace(/\d+/g, 'N'));
  eq(w, [
    'steps[0].title starts with "Now", which points at the screen instead of saying what happens, ',
    'steps[0].body has a line of N characters',
    'steps[0].body starts with "Here", which points at the screen instead of saying what happens, ',
    'steps[0].callouts[0].text has a line of N characters',
    'steps[0].beats[0].says[0] has a line of N characters',
    'steps[0].beats[0].tag has a line of N characters',
    'steps[0].beats[1].resp has an unbalanced backtick',
    'steps[0].beats[2].rows[0] has a line of N characters',
  ].map((x) => x.replace(/, $/, '')));
  eq(lines(s), []);
});

test('meta.startsAt that is not a date is a warning', () => {
  const s = minimal(); s.meta.startsAt = 'last Tuesday';
  eq(warns(s).map((p) => p.path), ['meta.startsAt']);
  s.meta.startsAt = '2026-03-09T14:02:00Z';
  eq(warns(s), []);
});

test('the shipped examples validate with no warnings; the cold-test fixtures validate with no errors', () => {
  const ex = path.join(here, '..', 'assets', 'examples');
  for (const f of fs.readdirSync(ex).filter((n) => n.endsWith('.story.json'))) {
    eq(EXK.validate(readJson(path.join(ex, f))), []);
  }
  const cold = data('stories');
  const names = fs.readdirSync(cold).filter((n) => n.endsWith('.story.json'));
  assert.equal(names.length, 3);
  for (const f of names) {
    const probs = EXK.validate(readJson(path.join(cold, f)));
    eq(probs.filter((p) => p.level === 'error'), []);   /* fixtures stay as the cold-test sessions wrote them: warnings allowed, errors not */
  }
});

/* ---------- every problem carries a stable rule ---------- */
const ruleOk = (r) => typeof r === 'string' && /^[a-z]+(-[a-z]+)*$/.test(r);
const jsonFixtures = (dir) => fs.readdirSync(data(dir)).filter((f) => f.endsWith('.json')).map((f) => [f, readJson(data(dir, f))]);

test('every problem from every invalid and warning fixture has a rule, and the fixture\'s _rule matches it', () => {
  for (const dir of ['invalid', 'warn']) {
    for (const [f, story] of jsonFixtures(dir)) {
      const probs = EXK.validate(story, { style: story._style });
      assert.ok(probs.length > 0, `${dir}/${f} reports a problem`);
      for (const p of probs) assert.ok(ruleOk(p.rule), `${dir}/${f}: ${p.path} has a rule`);
      if (story._rule) eq(probs.map((p) => p.rule), [story._rule], `${dir}/${f}: _rule`);
    }
  }
});

test('rules are unique per kind of problem: each rule is named at one place in validate.js, and carries no author-chosen name', () => {
  const src = fs.readFileSync(path.join(here, '..', 'assets', 'kit', 'story', 'validate.js'), 'utf8');
  const named = [...src.matchAll(/\b(?:err|warn|pairProblem|pair)\('([^']*)'/g)].map((m) => m[1]);
  assert.ok(named.length >= 80, `found ${named.length} rules`);
  for (const r of named) assert.ok(ruleOk(r), `${r} is kebab-case`);
  const dup = named.filter((r, i) => named.indexOf(r) !== i);
  assert.deepEqual(dup, []);
});
