// Layout and camera-frame audit for the flat prototype (no browser needed).
// Loads the page's <!--//<core>--> block (scenario data, layout, edge routing, frame rules: pure code with
// no DOM or gsap) and checks:
//   - every child box lies inside its parent container, and no two sibling boxes overlap   (assertions)
//   - the full-view scale is printed (PATTERNS.md section 9 wants 0.7 or better)           (report)
//   - for every step frame: which containers are cut by the frame edge and which enclose it (report;
//     "enclosing" ones become the breadcrumb, a cut one is a faded border the owner may question)
// Exits 1 if a containment or overlap assertion fails.
//
//   node flat-check.mjs <file.html>
//
// Page hooks: the source must contain the markers `//<core>` and `//</core>` around code that defines
// buildModel() and frameAudit(model, frame), and STEPS-derived model.frames[stepId].{main,lead}.
import fs from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: node flat-check.mjs <file.html>'); process.exit(2); }
const html = fs.readFileSync(file, 'utf8');
const core = html.split('//<core>')[1].split('//</core>')[0];
const { M, audit } = new Function(core + '; var M = buildModel(); return { M: M, audit: frameAudit };')();
const B = M.B;
let bad = 0;
const fail = (m) => { bad++; console.log('FAIL ' + m); };

for (const id of Object.keys(B)) {
  const b = B[id];
  if (b.type !== 'box') continue;
  for (const k of b.kids) {
    const kb = B[k.id];
    if (kb.x < b.x || kb.y < b.y || kb.x + kb.w > b.x + b.w || kb.y + kb.h > b.y + b.h) fail(`${k.id} outside ${id}`);
  }
  for (let i = 0; i < b.kids.length; i++) for (let j = i + 1; j < b.kids.length; j++) {
    const p = B[b.kids[i].id], q = B[b.kids[j].id];
    if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) fail(`siblings overlap: ${p.id} / ${q.id}`);
  }
}
console.log(`world ${Math.round(M.world.w)}x${Math.round(M.world.h)}  full-view scale ${(1920 / M.full.w).toFixed(3)}`);
for (const [id, f] of Object.entries(M.frames)) {
  for (const [nm, fr] of [['main', f.main], ['lead', f.lead]]) {
    if (!fr) continue;
    const r = audit(M, fr);
    console.log(`${id.padEnd(10)} ${nm.padEnd(4)} zoom ${(1920 / fr.w).toFixed(2)}  cut: ${r.cut.join(' ') || '-'}  | enclosing: ${r.enclosing.join(' ') || '-'}`);
  }
}
console.log(bad ? `${bad} assertion(s) failed` : 'containment and sibling checks passed');
process.exit(bad ? 1 : 0);
