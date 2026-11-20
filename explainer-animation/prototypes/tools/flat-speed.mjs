// Asserts that no packet moves faster than 320 px/s on the 1920x1080 stage (PATTERNS.md section 6).
// Seeks the page through its whole timeline in 0.05 s steps and measures the on-screen centre of every
// child of the packets layer that is visible (opacity > 0.5). Exits 1 if the fastest sample is over 320.
//
//   node flat-speed.mjs <file.html>
//
// Page hooks: ?capture=1, window.anim.duration and window.anim.seek(t), and a <g data-layer="packets">
// holding the moving packets (the flat prototype in v3/ has all three). Samples carry about 0.5%
// rounding noise, so the file's own cap is set a little under 320 (SPEED_CAP).
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const file = process.argv[2];
if (!file) { console.error('usage: node flat-speed.mjs <file.html>'); process.exit(2); }
const LIMIT = 320, DT = 0.05;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(path.resolve(file)).href + '?capture=1');
await page.waitForFunction(() => window.anim && window.anim.duration > 0);
const res = await page.evaluate((dt) => {
  const layer = document.querySelector('[data-layer="packets"]');
  const kids = Array.from(layer.children), D = window.anim.duration;
  const sc = document.getElementById('stage').getBoundingClientRect().width / 1920;
  const prev = new Map(), worst = [];
  for (let t = 0; t < D; t += dt) {
    window.anim.seek(t);
    kids.forEach((k, i) => {
      const op = parseFloat(getComputedStyle(k).opacity), r = k.getBoundingClientRect();
      const c = [(r.left + r.right) / 2 / sc, (r.top + r.bottom) / 2 / sc];
      if (op > 0.5 && prev.has(i)) { const p = prev.get(i); worst.push([Math.hypot(c[0] - p[0], c[1] - p[1]) / dt, t, i]); }
      if (op > 0.5) prev.set(i, c); else prev.delete(i);
    });
  }
  worst.sort((a, b) => b[0] - a[0]);
  return { packets: kids.length, top: worst.slice(0, 5) };
}, DT);
await browser.close();
const peak = res.top[0] ? res.top[0][0] : 0;
console.log(`packets=${res.packets} peak=${peak.toFixed(1)} px/s (limit ${LIMIT})`);
res.top.forEach(([v, t, i]) => console.log(`  ${v.toFixed(1)} px/s at t=${t.toFixed(2)}s packet#${i}`));
process.exit(peak <= LIMIT ? 0 : 1);
