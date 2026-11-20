// Asserts: for every hop, at its midpoint, both end-node labels have computed opacity >= 0.95 and are not
// intersected by any other visible text box (P§8, P§12 of PATTERNS.md).
// Run:   node iso-hopcheck.mjs <file.html>
// Needs the page hooks: window.anim.{duration,seek}, window.__hops() (hop log) and window.__overlaps(),
// and label boxes marked data-ov="label:<node id>".
// Prints each failure and "hops checked N failures M"; exit code 1 if any.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1920,height:1080}});
await p.goto(pathToFileURL(process.argv[2]).href + '?capture=1'); await p.waitForFunction(() => window.anim && window.anim.duration > 0);
const hops = await p.evaluate(() => window.__hops());
let fails = 0;
for (const h of hops) {
  const res = await p.evaluate(({ mid, ends }) => {
    window.anim.seek(mid);
    const op = (e) => { let o = 1, n = e; while (n && n !== document.body) { o *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; } return o; };
    const ov = window.__overlaps();
    return ends.map((id) => { const els = Array.from(document.querySelectorAll('[data-ov="label:' + id + '"]')); const o = Math.max(0, ...els.map(op)); return { id, o: +o.toFixed(2), hit: ov.filter((q) => q.indexOf('label:' + id) >= 0) }; });
  }, { mid: h.mid, ends: h.ends });
  res.forEach((r) => { if (r.o < 0.95 || r.hit.length) { fails++; console.log('FAIL', h.step, h.rid, 't=' + h.mid.toFixed(1), JSON.stringify(r)); } });
}
console.log('hops checked', hops.length, 'failures', fails);
await b.close();
process.exit(fails ? 1 : 0);
