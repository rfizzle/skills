// Asserts: window.__overlaps() returns no intersecting visible text boxes (node labels, container tags,
// says, callouts, cards, shield labels, moving chip tags; leader lines against other boxes and blocks)
// at 3 points in every step (30%, 60%, 95%) plus any extra times given.
// Run:   node iso-overlaps.mjs <file.html> [t1 t2 ...]      e.g.  node iso-overlaps.mjs page.html $(seq 2.25 0.25 130)
// Needs the page hooks: window.anim.{duration,steps,seek} and window.__overlaps() (isometric reference file).
// Prints each failing sample and a final total; exit code 1 if any overlap.
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [file, ...extra] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(pathToFileURL(path.resolve(file)).href + '?capture=1');
await page.waitForFunction(() => window.anim && window.anim.duration > 0, null, { timeout: 15000 });
const info = await page.evaluate(() => ({ d: window.anim.duration, steps: window.anim.steps.map((s) => ({ id: s.id, time: s.time })) }));
let total = 0;
const pts = [];
info.steps.forEach((s, i) => { const nx = i + 1 < info.steps.length ? info.steps[i + 1].time : info.d; [0.3, 0.6, 0.95].forEach((f) => pts.push([s.id + '@' + f, s.time + (nx - s.time) * f])); });
extra.forEach((t) => pts.push(['t' + t, +t]));
for (const [name, t] of pts) {
  const r = await page.evaluate((tt) => { window.anim.seek(tt); return window.__overlaps(); }, t);
  total += r.length;
  if (r.length) console.log(name, t.toFixed(1), JSON.stringify(r));
}
console.log('duration', info.d.toFixed(1), 'checked', pts.length, 'total overlaps', total, 'errors', JSON.stringify(errs));
await browser.close();
process.exit(total ? 1 : 0);
