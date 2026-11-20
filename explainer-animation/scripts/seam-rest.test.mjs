// The rest rule of the custom seam, in a browser: for every step of every example scene, a frame at the step's `rest` time has
// its caption on screen whenever the scene has a caption panel on screen (stills and the last frame of each clip are taken
// there). Needs a browser harness (EXPLAINER_BROWSER_DIR); without one the build half runs and the browser half is skipped.
// A scene whose panel would be empty at a rest frame fails at boot (the seam's own assertion): tested with a small scene too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const examples = path.join(here, '..', 'assets', 'examples');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exk-rest-'));
const SCENES = ['privilege-escalation', 'shared-responsibility', 'defence-in-depth', 'data-protection-views', 'harvest-now-decrypt-later', 'roadmap-risk-burn-down'];

function build(story, scene, out) {
  return spawnSync(process.execPath, [path.join(here, 'build.mjs'), story, '--style', 'flat', '--pattern', 'custom', '--scene', scene, '-o', out], { encoding: 'utf8' });
}
const pages = [];
for (const n of SCENES) {
  test(`${n}: builds`, () => {
    const out = path.join(tmp, n + '.html'), r = build(path.join(examples, n + '.story.json'), path.join(examples, n + '.scene.js'), out);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    pages.push([n, out]);
  });
}

const hasHarness = () => { const d = process.env.EXPLAINER_BROWSER_DIR; return d && fs.existsSync(path.join(d, 'node_modules', 'playwright')); };
const skip = hasHarness() ? false : 'no browser harness (set EXPLAINER_BROWSER_DIR)';

/* in the page: the caption panels that are on screen at the current time and whether each has a caption fully shown */
const probe = () => {
  const eff = (el) => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentNode) { const v = parseFloat(getComputedStyle(n).opacity); o *= Number.isNaN(v) ? 1 : v; } return o; };
  return [...document.querySelectorAll('[data-caption]')].filter((p) => eff(p) > 0.01).map((p) => ({
    panel: eff(p),
    texts: [...p.querySelectorAll('[data-ov^="caption:"]')].filter((t) => t.textContent.trim() && eff(t) > 0.99).length
  }));
};

test('every step of every example scene shows its caption at rest wherever a caption panel is on screen', { skip }, async () => {
  const { launchBrowser } = await import('./lib/browser.mjs');
  const browser = await launchBrowser();
  try {
    for (const [n, file] of pages) {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(pathToFileURL(file).href + '?capture=1');
      await page.waitForFunction(() => window.anim && window.anim.duration > 0, null, { timeout: 20000 });
      const steps = await page.evaluate(() => window.anim.steps.map((s) => ({ id: s.id, rest: s.rest })));
      let withCaption = 0;
      for (const s of steps) {
        await page.evaluate((t) => window.anim.seek(t), s.rest);
        const panels = await page.evaluate(probe);
        if (panels.length) withCaption++;
        for (const p of panels) assert.ok(p.texts > 0, `${n}, step "${s.id}": a caption panel is on screen with no caption at rest`);
      }
      assert.deepEqual(errors, [], n);
      if (n !== 'roadmap-risk-burn-down') assert.ok(withCaption > 0, `${n} shows a caption panel at some rest frame`);
      await page.close();
    }
  } finally { await browser.close(); }
});

test('the seam refuses, at boot, a scene whose caption panel is empty at a rest frame', { skip }, async () => {
  const { launchBrowser } = await import('./lib/browser.mjs');
  const ill = { kind: 'illustrative' };
  const story = { meta: { id: 'x', title: 'X', kind: 'plan', audience: 'executive', redaction: 'none', source: ill, scene: 'empty' }, phases: [{ id: 'p', title: 'P', source: ill }],
    steps: [{ id: 'a', phase: 'p', title: 'A', body: 'one', source: ill }, { id: 'b', phase: 'p', title: 'B', body: 'two', source: ill }], figures: {} };
  // step "a" says something; step "b" brings up a second caption panel and puts nothing in it
  const js = `(function () { 'use strict'; EXK.scenes.empty = {
    build: function (ctx) { this.cap = ctx.hud.caption({ x: 28, y: ctx.area.y + 8, w: 800, h: 100 }); this.cap2 = ctx.hud.caption({ x: 848, y: ctx.area.y + 8, w: 800, h: 100 }); },
    step: function (ctx, st, t0) {
      if (st.id === 'a') { var c = this.cap.say('Something to say here', t0 + 0.5, { last: true }); return { end: 1, hold: c.hold }; }
      this.cap2.show(t0 + 0.2); return { end: 2 };
    } }; })();`;
  fs.writeFileSync(path.join(tmp, 'empty.story.json'), JSON.stringify(story));
  fs.writeFileSync(path.join(tmp, 'empty.scene.js'), js);
  const out = path.join(tmp, 'empty.html'), r = build(path.join(tmp, 'empty.story.json'), path.join(tmp, 'empty.scene.js'), out);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(pathToFileURL(out).href + '?capture=1');
    await page.waitForTimeout(1500);
    assert.ok(errors.some((e) => /caption panel is on screen with no caption at the rest frame of step 2 "b"/.test(e)), errors.join('\n') || 'no error was raised');
  } finally { await browser.close(); }
});
