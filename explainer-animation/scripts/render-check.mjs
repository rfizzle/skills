// Usage: node render-check.mjs <page.html>... [--allow-cdn] [--json]
//
// Loads each page headless with ?capture=1 and prints one line per check, then PASS or FAIL
// (exit 1 on any failure; warnings and "hook missing" lines do not fail).
//   console   console errors and uncaught exceptions
//   network   any request other than file:/data:/blob: is a failure (--allow-cdn permits the three
//             GSAP 3.13.0 jsdelivr files, for hand-adapted pages not yet run through build.mjs --inline)
//   seek      the same t reached forwards, after a jump to the end, and after a jump to 0 gives the
//             same picture within a pixel tolerance, at four probe times
//   overlaps  window.__overlaps() is empty every 0.25 s
//   hops      at the midpoint of every hop in window.__hops(), both end labels are opaque and not overlapped
//   speed     peak packet speed on the 1920x1080 stage is within the 320 px/s cap
//   rest      every window.anim.steps[i] has a numeric rest (warning only)
//
// Page hooks used (see references/checks.md):
//   window.anim = { duration, seek(t), steps: [{ id, time, rest }] }          required
//   window.__overlaps() -> array of overlapping pairs                          optional
//   window.__hops() -> [{ step, rid, mid, ends: [nodeId, ...] }], plus elements marked
//       data-ov="label:<nodeId>" and window.__overlaps                         optional
//   packets: the children of [data-layer="packets"] or of #L-packets           optional
// --json: stdout is one JSON array of findings for all the pages (references/checks.md, Machine-readable output).
// Needs EXPLAINER_BROWSER_DIR (lib/browser.mjs).
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser } from './lib/browser.mjs';
import { createReport } from './lib/findings.mjs';

const args = process.argv.slice(2);
const allowCdn = args.includes('--allow-cdn');
const json = args.includes('--json');
const files = args.filter((a) => !a.startsWith('--'));
const rep = createReport({ check: 'render-check', json });
if (!files.length || args.some((a) => a.startsWith('--') && a !== '--allow-cdn' && a !== '--json')) {
  const usage = 'usage: node render-check.mjs <page.html>... [--allow-cdn] [--json]';
  rep.add({ rule: 'usage', severity: 'error', message: usage, fix: 'pass one or more built pages', human: usage, stream: 'err' });
  rep.exit(2);
}

const TOLERATED_PIXELS = 400;       // of 2,073,600; pixels whose largest channel delta exceeds 24
const PROBES = [0.17, 0.43, 0.71, 0.93];
const SPEED_CAP = 320, SPEED_SLACK = 1;     // samples carry about 0.5% rounding noise
const SPEED_DT = 1 / 30, OVERLAP_DT = 0.25;
const GSAP_CDN = /^https:\/\/cdn\.jsdelivr\.net\/npm\/gsap@3\.13\.0\/dist\/(gsap|MotionPathPlugin|DrawSVGPlugin)\.min\.js$/;

const browser = await launchBrowser();
const differ = await browser.newPage();
async function diffPixels(bufA, bufB) {
  if (bufA.equals(bufB)) return 0;
  return differ.evaluate(async ([a, b]) => {
    const load = async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = new OffscreenCanvas(img.width, img.height);
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      return g.getImageData(0, 0, img.width, img.height).data;
    };
    const [da, db] = [await load(a), await load(b)];
    let n = 0;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])) > 24) n++;
    }
    return n;
  }, [bufA.toString('base64'), bufB.toString('base64')]);
}

let failed = false;
for (const file of files) {
  const name = path.basename(file);
  // one check line: printed as "  <check>: <text>"; f = { rule, severity, message, fix, step? } is its finding
  const line = (check, status, text, f) => {
    if (status === 'fail') failed = true;
    if (f) rep.add({ path: file, ...f, human: `  ${check}: ${text}` });
    else rep.say(`  ${check}: ${text}`);
  };
  rep.say(name);
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [], badRequests = [];
  let allowed = 0;
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('request', (r) => {
    const u = r.url();
    if (/^(file|data|blob|about):/.test(u)) return;
    if (allowCdn && GSAP_CDN.test(u)) { allowed++; return; }
    badRequests.push(u);
  });
  page.on('requestfailed', (r) => { if (/^file:/.test(r.url())) errors.push('requestfailed: ' + r.url()); });

  await page.goto(pathToFileURL(path.resolve(file)).href + '?capture=1').catch((e) => errors.push('goto: ' + e.message));
  let ready = true;
  try {
    await page.waitForFunction(() => window.anim && window.anim.duration > 0, null, { timeout: 15000 });
  } catch { ready = false; }
  if (!ready) {
    const noAnim = `FAIL window.anim never appeared${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`;
    line('console', 'fail', noAnim, { rule: 'anim-missing', severity: 'error', message: noAnim.slice(5), fix: 'the page must define window.anim = { duration, seek(t), steps }; build it with build.mjs and read the console errors' });
    if (badRequests.length) line('network', 'fail', `FAIL ${badRequests.length} network request(s): ${[...new Set(badRequests)].slice(0, 3).join(' ')}`,
      { rule: 'network-request', severity: 'error', message: `${badRequests.length} network request(s): ${[...new Set(badRequests)].slice(0, 3).join(' ')}`, fix: 'build with build.mjs --inline so nothing loads from the network' });
    await page.close();
    continue;
  }
  await page.evaluate(() => document.fonts.ready);
  const info = await page.evaluate(() => ({
    duration: window.anim.duration,
    steps: window.anim.steps.map((s) => ({ id: s.id, time: s.time, rest: s.rest })),
    hasOverlaps: typeof window.__overlaps === 'function',
    hasHops: typeof window.__hops === 'function',
    hasLabels: !!document.querySelector('[data-ov^="label:"]'),
    packets: document.querySelectorAll('[data-layer="packets"] > *, #L-packets > *').length,
  }));
  const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const shot = async (t) => { await page.evaluate((tt) => window.anim.seek(tt), t); await settle(); return page.screenshot(); };

  // seek determinism
  let worst = 0;
  for (const f of PROBES) {
    const probe = info.duration * f;
    const a = await shot(probe);
    await shot(info.duration);
    const b = await shot(probe);
    await shot(0);
    const c = await shot(probe);
    worst = Math.max(worst, await diffPixels(a, b), await diffPixels(a, c));
  }

  // overlaps
  let overlapLine;
  if (!info.hasOverlaps) overlapLine = ['ok', 'overlaps: hook missing (window.__overlaps)'];
  else {
    const res = await page.evaluate((dt) => {
      const D = window.anim.duration, bad = [];
      let n = 0;
      for (let t = 0; t <= D + 1e-9; t += dt) {
        window.anim.seek(Math.min(t, D)); n++;
        const r = window.__overlaps();
        if (r.length) bad.push({ t, r: r.slice(0, 3) });
      }
      return { n, bad };
    }, OVERLAP_DT);
    overlapLine = res.bad.length
      ? ['fail', `overlaps: FAIL ${res.bad.length} of ${res.n} samples; first at t=${res.bad[0].t.toFixed(2)}s ${JSON.stringify(res.bad[0].r)}`]
      : ['ok', `overlaps: ok (${res.n} samples, every ${OVERLAP_DT}s)`];
  }

  // hops
  let hopLine, hopStep;
  if (!info.hasHops || !info.hasOverlaps || !info.hasLabels) hopLine = ['ok', 'hops: hook missing'];
  else {
    const hops = await page.evaluate(() => window.__hops());
    const bad = [];
    for (const h of hops) {
      const res = await page.evaluate(({ mid, ends }) => {
        window.anim.seek(mid);
        const op = (e) => { let o = 1, n = e; while (n && n !== document.body) { o *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; } return o; };
        const ov = window.__overlaps();
        return ends.map((id) => {
          const els = Array.from(document.querySelectorAll('[data-ov="label:' + id + '"]'));
          const o = Math.max(0, ...els.map(op));
          return { id, o: +o.toFixed(2), hit: ov.filter((q) => JSON.stringify(q).indexOf('label:' + id) >= 0).length };
        });
      }, { mid: h.mid, ends: h.ends });
      for (const r of res) if (r.o < 0.95 || r.hit) { if (!bad.length) hopStep = h.step; bad.push(`${h.step}/${h.rid} t=${h.mid.toFixed(1)} ${JSON.stringify(r)}`); }
    }
    hopLine = bad.length
      ? ['fail', `hops: FAIL ${bad.length} of ${hops.length} hops; first ${bad[0]}`]
      : ['ok', `hops: ok (${hops.length} hops checked)`];
  }

  // speed
  let speedLine;
  if (!info.packets) speedLine = ['ok', 'speed: hook missing'];
  else {
    const res = await page.evaluate((dt) => {
      const gs = Array.from(document.querySelectorAll('[data-layer="packets"] > *, #L-packets > *'));
      const stage = document.getElementById('stage');
      const sc = stage ? stage.getBoundingClientRect().width / 1920 || 1 : 1;
      const D = window.anim.duration;
      const prev = gs.map(() => null);
      let worst = { v: 0, t: 0, i: -1 };
      for (let t = 0; t < D; t += dt) {
        window.anim.seek(t);
        gs.forEach((g, i) => {
          const op = parseFloat(getComputedStyle(g).opacity), r = g.getBoundingClientRect();
          const c = { x: (r.left + r.right) / 2 / sc, y: (r.top + r.bottom) / 2 / sc };
          if (op > 0.5 && prev[i]) {
            const v = Math.hypot(c.x - prev[i].x, c.y - prev[i].y) / dt;
            if (v < 2000 && v > worst.v) worst = { v, t, i };    // jumps over 2000 px/s are teleports, not travel
          }
          prev[i] = op > 0.5 ? c : null;
        });
      }
      return { n: gs.length, worst };
    }, SPEED_DT);
    const v = res.worst.v;
    speedLine = v > SPEED_CAP + SPEED_SLACK
      ? ['fail', `speed: FAIL peak ${v.toFixed(1)} px/s at t=${res.worst.t.toFixed(2)}s packet#${res.worst.i} (cap ${SPEED_CAP})`]
      : ['ok', `speed: ok (peak ${v.toFixed(1)} px/s of ${SPEED_CAP}, ${res.n} packets)`];
  }

  // rest
  const noRest = info.steps.filter((s) => !Number.isFinite(s.rest)).map((s) => s.id);

  const E = (rule, message, fix, step) => ({ rule, severity: 'error', message, fix, step });
  line('console', errors.length ? 'fail' : 'ok', errors.length ? `FAIL ${errors.length} error(s): ${errors.slice(0, 3).join(' | ')}` : 'ok',
    errors.length ? E('console-error', `${errors.length} error(s): ${errors.slice(0, 3).join(' | ')}`, 'fix the script error the page reports; every console error fails the page') : null);
  const net = [...new Set(badRequests)];
  const netMsg = `${badRequests.length} network request(s): ${net.slice(0, 3).join(' ')}`;
  line('network', net.length ? 'fail' : 'ok',
    net.length ? `FAIL ${netMsg}` : `ok${allowed ? ` (${allowed} GSAP CDN request(s) allowed by --allow-cdn)` : ''}`,
    net.length ? E('network-request', netMsg, 'build with build.mjs --inline so nothing loads from the network (--allow-cdn permits only the three GSAP files)') : null);
  const seekBad = worst > TOLERATED_PIXELS;
  line('seek', seekBad ? 'fail' : 'ok',
    `${seekBad ? 'FAIL' : 'ok'} (worst diff ${worst}px of ${TOLERATED_PIXELS} tolerated, ${PROBES.length} probes)`,
    seekBad ? E('seek-nondeterministic', `worst diff ${worst}px of ${TOLERATED_PIXELS} tolerated, ${PROBES.length} probes`, 'make the picture a pure function of window.anim.seek(t): no wall-clock, random or leftover state; seek(t) must give the same picture forwards, after a jump to the end and after a jump to 0') : null);
  // a hook that is missing is information; a failed check is an error carrying the text after "<check>: "
  const hookInfo = (ln) => (/hook missing/.test(ln[1]) ? { rule: 'hook-missing', severity: 'info', message: ln[1], fix: 'expose the hook (references/checks.md, Hooks a page exposes) to have this checked' } : null);
  const failOf = (ln, rule, fix, step) => (ln[0] === 'fail' ? E(rule, ln[1].replace(/^\w+: FAIL /, ''), fix, step) : hookInfo(ln));
  line('overlaps', overlapLine[0], overlapLine[1].replace(/^overlaps: /, ''),
    failOf(overlapLine, 'overlap', 'move or shorten the labels and nodes named in the pair so they never overlap at any time; window.__overlaps() lists the pairs'));
  line('hops', hopLine[0], hopLine[1].replace(/^hops: /, ''),
    failOf(hopLine, 'hop-label-hidden', 'keep both end labels of the hop fully visible and clear of other elements at its midpoint', hopStep));
  line('speed', speedLine[0], speedLine[1].replace(/^speed: /, ''),
    speedLine[0] === 'fail' ? failOf(speedLine, 'speed-over-cap', `lengthen the hop's time or shorten the path so a packet moves at ${SPEED_CAP} px/s or less`)
      : hookInfo(speedLine) || { rule: 'peak-speed', severity: 'info', message: speedLine[1].replace(/^speed: /, ''), fix: '' });
  line('rest', 'ok', noRest.length ? `WARN ${noRest.length} of ${info.steps.length} steps have no numeric rest (${noRest.slice(0, 5).join(', ')})` : `ok (${info.steps.length} steps)`,
    noRest.length ? { rule: 'rest-missing', severity: 'warning', step: noRest[0], message: `${noRest.length} of ${info.steps.length} steps have no numeric rest (${noRest.slice(0, 5).join(', ')})`, fix: 'give every window.anim.steps[i] a numeric rest (the time the step settles)' } : null);
  await page.close();
}
await browser.close();
rep.say(failed ? 'FAIL' : 'PASS');
rep.exit(failed ? 1 : 0);
