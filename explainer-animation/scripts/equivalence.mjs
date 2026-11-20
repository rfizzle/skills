#!/usr/bin/env node
// Usage: equivalence.mjs <story.json> --style flat [--oracle <page.html>] [--out <dir>]
//
// Builds the kit page from the story, opens it and the approved hand-built film (the oracle) in
// capture mode, and for every step id present in both: seeks each to its rest frame (the oracle has
// no `rest`: step end minus 0.7 s, as export.mjs does) and at 30% and 60% of the step, screenshots,
// and writes a side-by-side contact sheet per step (kit left, oracle right) plus index.html.
//
// Structural rows (they decide the exit code; 0 when PASS):
//   step ids and order; per-step duration (20%) and total (15%); node centres at the full view
//   (24 stage px, by system id); frame scale per step (width of a node box visible in both pages,
//   kit / oracle, within 15%); hop sets per step (kit window.__hops() against the story's beats).
// Pixel rows (information, and a regression guard against scripts/testdata/equivalence-flat.thresholds.json,
// which the first run writes as 1.5 x the measured counts): pixels whose largest channel delta exceeds 24.
// Needs EXPLAINER_BROWSER_DIR (lib/browser.mjs). Default oracle: scripts/testdata/oracle/a-flat-attack-chain.html.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser } from './lib/browser.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const args = process.argv.slice(2);
let file = null, style = null, oracle = path.join(ROOT, 'scripts/testdata/oracle/a-flat-attack-chain.html'), out = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--style') style = args[++i];
  else if (args[i] === '--oracle') oracle = path.resolve(args[++i]);
  else if (args[i] === '--out') out = path.resolve(args[++i]);
  else if (args[i] === '-h' || args[i] === '--help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 14).join('\n')); process.exit(0); }
  else file = args[i];
}
if (!file || style !== 'flat') {
  console.error('usage: node equivalence.mjs <story.json> --style flat [--oracle <page.html>] [--out <dir>]');
  process.exit(2);
}
out = out || path.resolve('explainer-out', 'equivalence-flat');
fs.mkdirSync(out, { recursive: true });

const DUR_TOL = 0.20, TOTAL_TOL = 0.15, CENTRE_TOL = 24, SCALE_TOL = 0.15, ORACLE_REST = 0.7;
const SAMPLES = [['rest', null], ['30%', 0.3], ['60%', 0.6]];
const AREA = { x0: 0, y0: 100, x1: 1920, y1: 820 };
const THRESHOLDS = path.join(HERE, 'testdata', 'equivalence-flat.thresholds.json');

const story = JSON.parse(fs.readFileSync(file, 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'equivalence-'));
const kitPage = path.join(tmp, 'kit.html');
const b = spawnSync(process.execPath, [path.join(HERE, 'build.mjs'), file, '--style', style, '-o', kitPage], { encoding: 'utf8' });
if (b.status !== 0) { console.error(b.stderr || b.stdout); process.exit(2); }

// expected hop sets from the story's beats: unordered system pairs per step
function expectedHops(st) {
  const set = new Set();
  const pair = (a, c) => set.add([a, c].sort().join('~'));
  for (const bt of st.beats || []) {
    const path = bt.chain || bt.exchange || bt.stream;
    if (Array.isArray(path)) for (let i = 1; i < path.length; i++) pair(path[i - 1], path[i]);
  }
  return set;
}

const browser = await launchBrowser();
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
async function open(f) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('pageerror', path.basename(f), e.message));
  await page.goto(pathToFileURL(f).href + '?capture=1');
  await page.waitForFunction(() => window.anim && window.anim.duration > 0, null, { timeout: 20000 });
  return page;
}
const [kit, orc] = [await open(kitPage), await open(oracle)];
const meta = async (p, isOracle) => p.evaluate((o) => ({ duration: window.anim.duration, steps: window.anim.steps.map((s) => ({ id: s.id, time: s.time, rest: s.rest, title: s.title || s.caption || '' })) }), isOracle);
const [km, om] = [await meta(kit), await meta(orc)];
for (const m of [km, om]) m.steps.forEach((s, i) => { s.end = i + 1 < m.steps.length ? m.steps[i + 1].time : m.duration; s.len = s.end - s.time; });
om.steps.forEach((s) => { s.rest = s.end - ORACLE_REST; });
km.steps.forEach((s) => { if (typeof s.rest !== 'number') s.rest = s.end - ORACLE_REST; });

// node boxes in stage px, keyed by system id; the oracle's nodes are matched by label text
const sysText = {};
for (const s of story.systems) sysText[s.id] = (s.name + (s.sub ? ' ' + s.sub : '')).replace(/\s+/g, ' ').trim().toLowerCase();
const measure = (page, isOracle, texts) => page.evaluate(([isO, texts]) => {
  const sr = document.getElementById('stage').getBoundingClientRect(), k = 1920 / sr.width;
  const eff = (el) => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const v = parseFloat(getComputedStyle(e).opacity); if (!isNaN(v)) o *= v; } return o; };
  const res = {};
  const take = (id, rect) => {
    const r = rect.getBoundingClientRect();
    res[id] = { x: (r.left - sr.left) * k, y: (r.top - sr.top) * k, w: r.width * k, h: r.height * k, op: eff(rect) };
  };
  if (!isO) document.querySelectorAll('[data-block]').forEach((el) => take(el.getAttribute('data-block'), el));
  else document.querySelectorAll('g.node').forEach((g) => {
    const t = Array.from(g.querySelectorAll('text')).filter((x) => !x.closest('g[opacity]') || x.closest('g[opacity]') === g).map((x) => x.textContent).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const id = Object.keys(texts).find((i) => texts[i] === t);
    if (id) take(id, g.querySelector('rect'));
  });
  return res;
}, [isOracle, texts]);

const seek = async (page, t) => { await page.evaluate((x) => window.anim.seek(x), t); await settle(page); };

// pixel diff via the browser
const differ = await browser.newPage();
const diffPixels = (a, c) => a.equals(c) ? 0 : differ.evaluate(async ([x, y]) => {
  const load = async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const cv = new OffscreenCanvas(img.width, img.height); const g = cv.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
  const [da, db] = [await load(x), await load(y)];
  let n = 0;
  for (let i = 0; i < da.length; i += 4) if (Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])) > 24) n++;
  return n;
}, [a.toString('base64'), c.toString('base64')]);

const kitById = new Map(km.steps.map((s) => [s.id, s])), orcById = new Map(om.steps.map((s) => [s.id, s]));
const common = km.steps.filter((s) => orcById.has(s.id));
const hops = await kit.evaluate(() => (window.__hops ? window.__hops() : null));
const pad = (n) => String(n).padStart(2, '0');
const pct = (a, c) => (a / c - 1) * 100;
const rows = [];   // { name, status, text }
const row = (name, ok, text) => rows.push({ name, ok, text });

// 1 ids and order
const kIds = km.steps.map((s) => s.id).join(' '), oIds = om.steps.map((s) => s.id).join(' ');
row('step ids and order', kIds === oIds, kIds === oIds ? `${km.steps.length} steps identical` : `kit: ${kIds}\n      oracle: ${oIds}`);

// 2 durations
const durBad = [];
const durTxt = common.map((s) => { const o = orcById.get(s.id), d = pct(s.len, o.len); if (Math.abs(d) > DUR_TOL * 100) durBad.push(s.id); return `${s.id} ${s.len.toFixed(1)}/${o.len.toFixed(1)}s ${d >= 0 ? '+' : ''}${d.toFixed(0)}%`; });
row('step durations (kit/oracle, 20%)', !durBad.length, durTxt.join('; ') + (durBad.length ? `  OVER: ${durBad.join(' ')}` : ''));
const td = pct(km.duration, om.duration);
row('total duration (15%)', Math.abs(td) <= TOTAL_TOL * 100, `kit ${km.duration.toFixed(1)}s, oracle ${om.duration.toFixed(1)}s (${td >= 0 ? '+' : ''}${td.toFixed(1)}%)`);

// 3 node centres at the full view (first step that is a full view in both: the first common step's rest)
const first = common[0];
await seek(kit, first.rest); await seek(orc, orcById.get(first.id).rest);
const [kn0, on0] = [await measure(kit, false, sysText), await measure(orc, true, sysText)];
const cBad = [], cTxt = [];
for (const id of Object.keys(sysText)) {
  const a = kn0[id], c = on0[id];
  if (!a || !c) { cBad.push(id); cTxt.push(`${id} missing in ${!a ? 'kit' : 'oracle'}`); continue; }
  const d = Math.hypot(a.x + a.w / 2 - (c.x + c.w / 2), a.y + a.h / 2 - (c.y + c.h / 2));
  if (d > CENTRE_TOL) cBad.push(id);
  cTxt.push(`${id} ${d.toFixed(1)}`);
}
row(`node centres at full view (${CENTRE_TOL} px)`, !cBad.length, cTxt.join(', ') + (cBad.length ? `  OVER: ${cBad.join(' ')}` : ''));

// per step: captures, scale, pixels
const sheets = [];
const pix = {};
const scaleBad = [], scaleTxt = [];
for (let si = 0; si < common.length; si++) {
  const ks = common[si], os_ = orcById.get(ks.id), n = pad(km.steps.indexOf(ks) + 1);
  const shots = [];
  let restNodes = null;
  for (const [label, f] of SAMPLES) {
    const tk = f === null ? ks.rest : ks.time + ks.len * f, to = f === null ? os_.rest : os_.time + os_.len * f;
    await seek(kit, tk); await seek(orc, to);
    const [pk, po] = [await kit.screenshot(), await orc.screenshot()];
    if (f === null) {
      restNodes = [await measure(kit, false, sysText), await measure(orc, true, sysText)];
      pix[ks.id] = await diffPixels(pk, po);
      fs.writeFileSync(path.join(out, `${n}-${ks.id}-kit.png`), pk);
      fs.writeFileSync(path.join(out, `${n}-${ks.id}-oracle.png`), po);
    }
    shots.push({ label, tk, to, k: pk, o: po });
  }
  // frame scale: median width ratio of node boxes fully inside the diagram area, visible in both
  const vis = (r) => r && r.op > 0.5 && r.x >= AREA.x0 - 1 && r.y >= AREA.y0 - 1 && r.x + r.w <= AREA.x1 + 1 && r.y + r.h <= AREA.y1 + 1;
  const ratios = Object.keys(sysText).filter((id) => vis(restNodes[0][id]) && vis(restNodes[1][id])).map((id) => ({ id, r: restNodes[0][id].w / restNodes[1][id].w }));
  if (!ratios.length) { scaleBad.push(ks.id); scaleTxt.push(`${ks.id} no shared node`); }
  else {
    const sorted = ratios.map((x) => x.r).sort((a, c) => a - c), med = sorted[Math.floor(sorted.length / 2)];
    const bad = Math.abs(med - 1) > SCALE_TOL;
    if (bad) scaleBad.push(ks.id);
    scaleTxt.push(`${ks.id} ${med.toFixed(2)}${bad ? '!' : ''}`);
    ks.scale = med;
  }
  sheets.push({ n, id: ks.id, title: ks.title || os_.title, shots });
}
row(`frame scale per step (kit/oracle node width, ${SCALE_TOL * 100}%)`, !scaleBad.length, scaleTxt.join(', ') + (scaleBad.length ? `  OVER: ${scaleBad.join(' ')}` : ''));

// hop sets
if (!hops) row('hop sets per step', false, 'window.__hops missing on the kit page');
else {
  const bad = [], txt = [];
  for (const st of story.steps) {
    const want = expectedHops(st), got = new Set(hops.filter((h) => h.step === st.id).map((h) => h.ends.slice().sort().join('~')));
    const miss = [...want].filter((x) => !got.has(x)), extra = [...got].filter((x) => !want.has(x));
    if (miss.length || extra.length) { bad.push(st.id); txt.push(`${st.id} missing [${miss.join(' ')}] extra [${extra.join(' ')}]`); }
  }
  row('hop sets per step (kit __hops vs story beats)', !bad.length, bad.length ? txt.join('; ') : `${story.steps.length} steps, ${hops.length} hops, all match`);
}

// contact sheets (rendered in the browser from the screenshots)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sheetPage = await browser.newPage({ viewport: { width: 1920, height: 600 } });
for (const sh of sheets) {
  const html = `<body style="margin:0;background:#0b0f17;color:#e8edf6;font:22px system-ui,sans-serif">
<div style="padding:14px 20px"><b>${esc(sh.n)} ${esc(sh.id)}</b> &mdash; ${esc(sh.title)}<span style="float:right;color:#8b98ad">kit (left) | oracle (right)</span></div>
${sh.shots.map((s) => `<div style="display:flex;gap:0"><div style="position:relative"><img width="960" src="data:image/png;base64,${s.k.toString('base64')}"><span style="position:absolute;left:8px;top:6px;background:#000a;padding:2px 8px;font-size:16px">${s.label} t=${s.tk.toFixed(1)}</span></div><div style="position:relative"><img width="960" src="data:image/png;base64,${s.o.toString('base64')}"><span style="position:absolute;left:8px;top:6px;background:#000a;padding:2px 8px;font-size:16px">${s.label} t=${s.to.toFixed(1)}</span></div></div>`).join('')}</body>`;
  await sheetPage.setContent(html);
  await sheetPage.waitForFunction(() => Array.from(document.images).every((i) => i.complete));
  await sheetPage.screenshot({ path: path.join(out, `${sh.n}-${sh.id}.png`), fullPage: true });
}
const index = `<!doctype html><meta charset="utf-8"><title>Equivalence: kit vs oracle</title>
<body style="margin:0;background:#0b0f17;color:#e8edf6;font:16px system-ui,sans-serif"><div style="padding:16px 24px"><h2>Kit (left) vs approved film (right), ${esc(story.meta.title)}</h2>
<p>Rows: rest frame, 30% and 60% of the step. Full-size rest frames sit beside each sheet (<code>NN-id-kit.png</code>, <code>NN-id-oracle.png</code>).</p>
<pre>${esc(rows.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}: ${r.text}`).join('\n'))}</pre></div>
${sheets.map((sh) => `<div style="margin:0 0 8px"><img style="width:100%" src="${esc(sh.n + '-' + sh.id + '.png')}"></div>`).join('\n')}</body>`;
fs.writeFileSync(path.join(out, 'index.html'), index);

// pixel guard
let th = null;
if (fs.existsSync(THRESHOLDS)) th = JSON.parse(fs.readFileSync(THRESHOLDS, 'utf8'));
const structural = rows.every((r) => r.ok);
const pixLines = [];
let over = 0;
for (const s of common) {
  const lim = th && th.steps ? th.steps[s.id] : undefined;
  const flag = lim === undefined ? '' : pix[s.id] > lim ? `  OVER guard ${lim}` : `  ok (guard ${lim})`;
  if (lim !== undefined && pix[s.id] > lim) over++;
  pixLines.push(`  ${s.id.padEnd(10)} ${String(pix[s.id]).padStart(8)} px${flag}`);
}
if (!th && structural) {
  fs.mkdirSync(path.dirname(THRESHOLDS), { recursive: true });
  const steps = {};
  for (const s of common) steps[s.id] = Math.ceil(pix[s.id] * 1.5);
  fs.writeFileSync(THRESHOLDS, JSON.stringify({ _note: 'First passing run of scripts/equivalence.mjs: pixels over delta 24 at each rest frame, times 1.5. A regression guard, not acceptance. Delete the file to record again.', steps }, null, 2) + '\n');
  pixLines.push('  (first passing run: thresholds recorded in ' + path.relative(ROOT, THRESHOLDS) + ')');
}

console.log('equivalence: kit page vs ' + path.relative(ROOT, oracle));
for (const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n      ${r.text}`);
console.log('pixels over delta 24 at rest (information; guard against recorded thresholds):');
for (const l of pixLines) console.log(l);
if (over) console.log(`WARN pixel guard: ${over} step(s) over their recorded threshold`);
console.log(`contact sheets: ${path.join(out, 'index.html')}`);
console.log('structural: ' + (structural ? 'PASS' : 'FAIL'));
await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(structural ? 0 : 1);
