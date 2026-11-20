// Reports: the peak on-stage speed (px/s at 1920x1080) of any packet over the whole timeline, sampled at 30 fps.
// The cap in PATTERNS.md section 6 is 320; this exits 1 above 321.
// Run:   node iso-speed.mjs <file.html>      (viewport must stay 1920x1080, set below)
// Needs the page hooks: window.anim.{duration,seek}; packets as the children of #L-packets.
// Teleports (jumps over 2000 px/s while visible) are ignored; they would be bugs of a different kind.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1920,height:1080}});
await p.goto(pathToFileURL(process.argv[2]).href + '?capture=1'); await p.waitForTimeout(800);
const res = await p.evaluate(() => {
  const gs = Array.from(document.querySelectorAll('#L-packets > g')); const D = window.anim.duration, dt = 1/30;
  let prev = gs.map(() => null), worst = { v: 0 }, per = {};
  for (let t = 0; t < D; t += dt) {
    window.anim.seek(t);
    gs.forEach((g, i) => {
      const op = parseFloat(getComputedStyle(g).opacity); const r = g.getBoundingClientRect(); const c = { x: r.left + r.width/2, y: r.top + r.height/2 };
      if (op > 0.9 && prev[i]) { const v = Math.hypot(c.x - prev[i].x, c.y - prev[i].y) / dt; if (v < 2000) { if (v > worst.v) worst = { v, t, i }; } }
      prev[i] = op > 0.9 ? c : null;
    });
  }
  return worst;
});
console.log(JSON.stringify(res)); await b.close();
process.exit(res.v > 321 ? 1 : 0);
