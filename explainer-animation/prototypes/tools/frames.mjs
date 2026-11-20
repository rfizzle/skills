// Usage: ./run.sh frames.mjs <file.html> <outdir> <t1> [t2 ...]     (times in seconds)
//        ./run.sh frames.mjs <file.html> <outdir> steps              (one frame at 30%, 60%, 95% of every step)
// Renders the page with ?capture=1 at 1920x1080 and writes one PNG per requested time.
// Also prints console errors. Extra query params: set QUERY, e.g. QUERY='narration=off'.
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const [file, outdir, ...rest] = process.argv.slice(2);
fs.mkdirSync(outdir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const q = 'capture=1' + (process.env.QUERY ? '&' + process.env.QUERY : '');
await page.goto(pathToFileURL(path.resolve(file)).href + '?' + q);
await page.waitForFunction(() => window.anim && window.anim.duration > 0, null, { timeout: 15000 });
const info = await page.evaluate(() => ({ duration: window.anim.duration, steps: window.anim.steps.map((s) => ({ id: s.id, time: s.time })) }));
let times;
if (rest[0] === 'steps') {
  times = [];
  info.steps.forEach((s, i) => {
    const next = i + 1 < info.steps.length ? info.steps[i + 1].time : info.duration;
    for (const f of [0.3, 0.6, 0.95]) times.push({ name: `${String(i + 1).padStart(2, '0')}-${s.id}-${Math.round(f * 100)}`, t: s.time + (next - s.time) * f });
  });
} else {
  times = rest.map((x) => ({ name: 't' + Number(x).toFixed(2).padStart(7, '0'), t: Number(x) }));
}
for (const { name, t } of times) {
  await page.evaluate((tt) => window.anim.seek(tt), t);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: path.join(outdir, name + '.png') });
}
console.log(`duration=${info.duration.toFixed(2)} steps=${JSON.stringify(info.steps)} frames=${times.length} errors=${errors.length}`);
for (const e of errors) console.log('  ', e);
await browser.close();
