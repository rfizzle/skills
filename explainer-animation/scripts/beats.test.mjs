// Every beat kind in isolation, in both styles: a small story per beat is built, and, when a browser harness is
// available (EXPLAINER_BROWSER_DIR), render-check must report `seek: ok` and `speed: ok` for each page (a page with
// no packet, the card, reports the speed hook missing). Without a
// harness the build half still runs and the render half is skipped with a note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const build = path.join(here, 'build.mjs');
const renderCheck = path.join(here, 'render-check.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exk-beats-'));
const src = { kind: 'illustrative' };

/* four systems in three zones, so a chain has two junctions inside nodes (client > web > api > db) */
function storyWith(beat, extraSteps = []) {
  return {
    meta: { id: 'beat', title: 'One beat in isolation', kind: 'architecture', audience: 'technical', redaction: 'none: invented example', source: src },
    zones: [
      { id: 'outside', name: 'Outside', source: src },
      { id: 'cloud', name: 'Cloud account', source: src },
      { id: 'data', name: 'Data tier', parent: 'cloud', source: src }
    ],
    systems: [
      { id: 'client', name: 'Client', role: 'sends requests', zone: 'outside', icon: 'attacker', source: src },
      { id: 'web', name: 'Web app', role: 'answers requests', zone: 'cloud', icon: 'store', source: src },
      { id: 'api', name: 'Orders API', role: 'serves orders', zone: 'cloud', icon: 'chip', source: src },
      { id: 'db', name: 'Database', role: 'stores the records', zone: 'data', icon: 'db', source: src }
    ],
    links: [
      { from: 'client', to: 'web', source: src },
      { from: 'web', to: 'api', source: src },
      { from: 'api', to: 'db', source: src }
    ],
    phases: [{ id: 'p', title: 'Phase', source: src }],
    steps: [
      { id: 'one', phase: 'p', title: 'The beat under test', body: 'One beat, nothing else in the step.', touch: ['client', 'web', 'api', 'db'],
        uses: [['client', 'web'], ['web', 'api'], ['api', 'db']], frame: 'full', beats: [beat], source: src },
      ...extraSteps
    ],
    controls: [
      { id: 'waf', name: 'Web firewall rule', why: 'blocks the request', on: ['client', 'web'], stops: ['one'], source: src },
      { id: 'authz', name: 'Scoped database role', why: 'limits the read', on: ['api', 'db'], stops: ['one'], source: src }
    ],
    figures: {}
  };
}

const summary = { id: 'sum', phase: 'p', title: 'Where it could be cut', body: 'Two controls on the path.', touch: [], uses: [], all: true, beats: [{ shields: 'controls' }], source: src };
const CASES = [
  ['chain', storyWith({ chain: ['client', 'web', 'api', 'db'], tag: 'GET', says: 'GET /orders', trail: true })],
  ['chain-sayAt-source', storyWith({ chain: ['client', 'web', 'api'], tag: 'GET', says: 'GET /orders', sayAt: 'client' })],
  ['exchange', storyWith({ exchange: ['web', 'api'], tag: 'query', respTag: 'rows', req: 'orders?id=7', resp: '1 row', respColor: 'token' })],
  ['stream', storyWith({ stream: ['db', 'api', 'web'], items: ['a.csv', 'b.csv', 'c.csv'], says: 'export', tally: 'received:' })],
  ['stream-file', storyWith({ stream: ['db', 'api'], items: ['a.csv', 'b.csv'], glyph: 'file', tally: 'received:' })],
  ['stream-push', storyWith({ stream: ['web', 'client'], items: ['push', 'push', 'push'], glyph: 'push' })],
  ['card', storyWith({ card: 'c', at: 'api', title: 'Finding', rows: ['row one', 'row two'], then: 'fold' })],
  ['pulse', storyWith({ pulse: 'db', color: 'danger' })],
  ['mark', storyWith({ mark: 'db' })],
  ['camera', storyWith({ camera: { hold: ['data'] } }), ['flat']],
  ['shields', storyWith({ chain: ['client', 'web'], tag: 'GET', trail: true }, [summary])]
];

const pages = [];
for (const [name, story, styles] of CASES) {
  for (const style of styles || ['flat', 'iso']) {
    test(`beat ${name} (${style}): builds`, () => {
      const file = path.join(tmp, `${name}.story.json`);
      fs.writeFileSync(file, JSON.stringify(story));
      const out = path.join(tmp, `${name}.${style}.html`);
      const r = spawnSync(process.execPath, [build, file, '--style', style, '-o', out], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr + r.stdout);
      pages.push(out);
    });
  }
}

function harness() {
  const dir = process.env.EXPLAINER_BROWSER_DIR;
  return dir && fs.existsSync(path.join(dir, 'node_modules', 'playwright')) ? dir : null;
}

test('every beat in isolation: render-check seek and speed', { skip: harness() ? false : 'no browser harness (set EXPLAINER_BROWSER_DIR)' }, () => {
  assert.ok(pages.length > 0);
  const r = spawnSync(process.execPath, [renderCheck, ...pages], { encoding: 'utf8', timeout: 600000 });
  const blocks = {};
  let cur = null;
  for (const line of r.stdout.split('\n')) {
    if (/\.html$/.test(line)) { cur = line.trim(); blocks[cur] = []; } else if (cur && /^ {2}\w+:/.test(line)) blocks[cur].push(line.trim());
  }
  for (const p of pages) {
    const lines = blocks[path.basename(p)] || [];
    const seek = lines.find((l) => l.startsWith('seek:')) || 'seek: missing';
    const speed = lines.find((l) => l.startsWith('speed:')) || 'speed: missing';
    assert.match(seek, /^seek: ok/, `${path.basename(p)}: ${seek}`);
    assert.match(speed, /^speed: (ok|hook missing)/, `${path.basename(p)}: ${speed}`);
  }
});
