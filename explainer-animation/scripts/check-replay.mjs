#!/usr/bin/env node
// Usage: EXPLAINER_BROWSER_DIR=<harness> node check-replay.mjs <replay.html>
//
// Browser check of a replay page built by `build.mjs <story> --replay` (modelled on BRIEF-v2 "Checks"):
//   views     at 12 sampled clock values, forwards then backwards, the clock readout, stat cards, phase
//             rows, stream length, scrubber heads, graph (lit systems and links) and control cards all
//             equal what the kit's own derivations give for that clock value (computed here in Node from
//             the story inside the page, never read from the page's views)
//   network   no request other than file:/data:/blob:, and no console error or page error; nothing
//             moves before Play
//   totals    the displayed totals (masthead, stat cards, chips, footer-independent figures) equal the
//             computed ones
//   lit       the lit systems equal the systems touched by events at or before the clock
//   graph     no graph text under 11 px at 1440 wide; no card, label or frame title overlaps another;
//             no card text runs out of its card
//   height    page height at 1440 wide (target 2,000 px or less)
//   900       at 900 wide the page has no horizontal overflow and the two-panel rows stack
//   behaviour click a system (card, filter), the filters, keyboard, #t= hash, reduced motion, Play,
//             and the "Illustrative data" chip following the story's provenance
// Exits 1 on any failure. Needs EXPLAINER_BROWSER_DIR (lib/browser.mjs).
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { launchBrowser } from './lib/browser.mjs';
import { loadKit } from './lib/load-kit.mjs';
import { assemble } from './lib/assemble.mjs';

const file = process.argv[2];
if (!file || process.argv.length > 3) { console.error('usage: node check-replay.mjs <replay.html>'); process.exit(2); }
const url = pathToFileURL(path.resolve(file)).href;

const EXK = loadKit({ bundle: 'replay' });
const R = EXK.replay;
let failed = 0;
const results = [];
function report(name, ok, detail = '') {
  if (!ok) failed++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ': ' + detail : ''}`);
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const sameSet = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const net = [], errors = [];
page.on('request', (r) => { const u = r.url(); if (!/^(file|data|blob|about):/.test(u)) net.push(u); });
page.on('requestfailed', (r) => { if (!/^(file|data|blob|about):/.test(r.url())) net.push(r.url()); });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url);
await page.waitForFunction(() => window.replay && document.body.getAttribute('data-ready') === 'replay', null, { timeout: 8000 }).catch(() => {});
if (!(await page.evaluate(() => !!window.replay))) {
  console.log(`FAIL  the page did not start: ${errors.join(' | ') || 'window.replay is missing'}`);
  await browser.close();
  process.exit(1);
}

/* ---------- what the kit computes from the story inside the page ---------- */
const story = EXK.normalize(await page.evaluate(() => EXK.STORY));
const D = R.derive(story);
const G = R.layoutGraph(story, D);
const fmt = R.fmt;
const duration = await page.evaluate(() => window.replay.duration);
report('duration', near(duration, D.duration, 1e-9), `${duration}s`);

/* ---------- nothing moves before Play ---------- */
const before = await page.evaluate(() => JSON.stringify(window.replay.state()) + document.getElementById('clock').textContent);
await page.waitForTimeout(1200);
const after = await page.evaluate(() => JSON.stringify(window.replay.state()) + document.getElementById('clock').textContent);
report('nothing moves before Play', before === after && JSON.parse(before.slice(0, before.lastIndexOf('}') + 1)).clock === 0);

/* ---------- views agree with the clock ---------- */
const readViews = () => page.evaluate(() => {
  const $ = (id) => document.getElementById(id);
  const num = (s) => parseFloat(String(s).replace(/,/g, ''));
  const rect = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width }; };
  const track = $('head').parentElement.getBoundingClientRect();
  return {
    state: window.replay.state(),
    clock: $('clock').textContent, sclock: $('sclock').textContent, day: $('day').textContent,
    act: num($('sAct').querySelector('.val').textContent), actSub: $('sAct').querySelector('.sub').textContent,
    phase: $('sPhase').querySelector('.val').textContent,
    blast: $('sBlast').querySelector('.val').textContent, blastSub: $('sBlast').querySelector('.sub').textContent,
    stream: [...$('stream').querySelectorAll('li:not(.empty) .when')].map((e) => e.textContent),
    phaseCounts: [...document.querySelectorAll('.prow2 .pc')].map((e) => num(e.textContent)),
    phaseDim: [...document.querySelectorAll('.prow2')].map((e) => e.classList.contains('dim')),
    lit: [...document.querySelectorAll('#gsvg .node')].filter((n) => n.getAttribute('data-lit') === '1').map((n) => n.getAttribute('data-id')),
    litLinks: [...document.querySelectorAll('#gsvg path[data-lit="1"]')].length,
    cards: [...document.querySelectorAll('#ctls li')].map((l) => l.classList.contains('lit')),
    head: rect($('head')), mhead: rect($('mhead')), track: { left: track.left, width: track.width },
    mtrack: (() => { const r = $('mhead').parentElement.getBoundingClientRect(); return { left: r.left, width: r.width }; })(),
    ariaNow: parseFloat($('head').getAttribute('aria-valuenow'))
  };
});

function expectViews(x, v) {
  const bad = [];
  const ci = D.clock.idxAt(x), pre = ci >= 0 ? D.pre[ci] : { n: 0, att: 0, reached: 0, vis: [0, 0, 0], boundaryId: null };
  const t = D.clock.rToT(x);
  if (v.state.index !== ci) bad.push(`index ${v.state.index} != ${ci}`);
  if (v.state.actions !== pre.n || v.state.attackActions !== pre.att) bad.push('state counts');
  if (v.clock !== fmt.T(t) || v.sclock !== fmt.T(t)) bad.push(`clock ${v.clock} != ${fmt.T(t)}`);
  if (v.day !== `Day ${Math.floor(t / fmt.DAY) + 1} of ${D.days}`) bad.push(`day ${v.day}`);
  if (v.act !== pre.att) bad.push(`attacker actions ${v.act} != ${pre.att}`);
  if (!v.actSub.includes(`of ${fmt.n(D.totals.attacker)} total`) || !v.actSub.includes(`${ci + 1} of ${D.events.length} log lines`)) bad.push(`sub "${v.actSub}"`);
  if (!v.blastSub.startsWith(`${pre.reached} of ${D.totals.systemsTotal} systems`)) bad.push(`blast "${v.blastSub}"`);
  const ph = ci >= 0 ? D.phases[D.events[ci].pi] : null;
  if (v.phase !== (ph ? ph.title : 'Not started')) bad.push(`phase "${v.phase}"`);
  if (v.stream.length !== ci + 1) bad.push(`stream ${v.stream.length} != ${ci + 1}`);
  else if (ci >= 0 && v.stream[0] !== fmt.T(D.events[ci].t)) bad.push('stream newest');
  const shown = D.phases.filter((p) => p.n > 0);
  const counts = shown.map((p) => p.events.filter((e) => e.i <= ci).reduce((a, e) => a + e.count, 0));
  if (JSON.stringify(v.phaseCounts) !== JSON.stringify(counts)) bad.push(`phase counts ${v.phaseCounts} != ${counts}`);
  const touched = new Set(); for (let i = 0; i <= ci; i++) D.events[i].nodes.forEach((n) => touched.add(n));
  if (!sameSet(v.lit, touched)) bad.push(`lit ${[...v.lit].sort()} != ${[...touched].sort()}`);
  if (!sameSet(v.state.lit, touched)) bad.push('state().lit');
  const links = new Set(); for (let i = 0; i <= ci; i++) D.events[i].edges.forEach((l) => links.add(l));
  if (v.litLinks !== links.size) bad.push(`lit links ${v.litLinks} != ${links.size}`);
  const cards = D.cuts.map((c) => c.evIndex <= ci);
  if (JSON.stringify(v.cards) !== JSON.stringify(cards)) bad.push('control cards');
  const px = (tr) => tr.left + 10 + x / duration * (tr.width - 20);
  if (!near((v.head.left + v.head.right) / 2, px(v.track), 1.5)) bad.push('main playhead');
  if (!near((v.mhead.left + v.mhead.right) / 2, px(v.mtrack), 1.5) && v.mhead.width > 0) bad.push('mini playhead');
  if (!near(v.ariaNow, Math.round(x * 10) / 10, 0.06)) bad.push('aria-valuenow');
  return bad;
}

const samples = [0, 1.2, 3, 14.3, 20, 31, 45, 52, 70, 80, 92, duration].map((x) => Math.min(x, duration));
const order = [...samples, ...samples.slice().reverse()];
let viewBad = [];
for (const x of order) {
  await page.evaluate((c) => window.replay.seek(c), x);
  await page.waitForTimeout(30);
  const bad = expectViews(x, await readViews());
  if (bad.length) viewBad.push(`@${x}s: ${bad.join('; ')}`);
}
report('views agree with the clock at 12 sampled values forwards and backwards', viewBad.length === 0, viewBad.length ? viewBad.slice(0, 4).join(' | ') : `${order.length} samples`);

/* ---------- displayed totals equal computed totals ---------- */
await page.evaluate((c) => window.replay.seek(c), duration);
const tot = await page.evaluate(() => ({
  kick: document.getElementById('kick').textContent,
  chips: [...document.querySelectorAll('#chips .sc')].map((c) => c.textContent),
  derived: window.replay.derived,
  state: window.replay.state()
}));
const T = D.totals;
const wantChips = [`${fmt.short(D.span)}span`, `${fmt.n(T.actions)}actions`, `${T.systemsReached} of ${T.systemsTotal}systems reached`, `${fmt.short(D.firstAlertSeconds)}to first alert`];
const totalsOk = tot.kick.includes(`reconstructed from ${fmt.n(T.actions)} actions`)
  && JSON.stringify(tot.chips) === JSON.stringify(wantChips)
  && tot.derived.totals.actions === T.actions && tot.derived.totals.attacker === T.attacker && tot.derived.totals.response === T.response
  && tot.derived.totals.blind === T.blind && tot.derived.totals.logged === T.logged && tot.derived.totals.alerted === T.alerted
  && tot.state.actions === T.actions && tot.state.attackActions === T.attacker && tot.state.reached === T.systemsReached
  && JSON.stringify(tot.state.vis) === JSON.stringify([T.blind, T.logged, T.alerted])
  && JSON.stringify(tot.derived.cuts.map((c) => c.at)) === JSON.stringify(D.cuts.map((c) => c.at));
report('displayed totals equal computed totals', totalsOk,
  `${T.actions} actions (${T.attacker} attacker, ${T.response} response) in ${T.lines} lines; ${T.blind} blind ${T.logged} logged ${T.alerted} alerted; ${T.systemsReached} of ${T.systemsTotal} systems; cuts at ${D.cuts.map((c) => c.at).join(', ')}`);
const stepText = await page.evaluate(() => document.getElementById('acap').textContent);
report('activity caption is computed', stepText.includes(`${fmt.n(T.blind)} actions unrecorded`), stepText);

/* ---------- lit systems equal touched systems, at every event ---------- */
let litBad = 0;
for (let i = 0; i < D.events.length; i++) {
  await page.evaluate((c) => window.replay.seek(c), D.events[i].r);
  const lit = await page.evaluate(() => [...document.querySelectorAll('#gsvg .node')].filter((n) => n.getAttribute('data-lit') === '1').map((n) => n.getAttribute('data-id')));
  const touched = new Set(); for (let j = 0; j <= i; j++) D.events[j].nodes.forEach((n) => touched.add(n));
  if (!sameSet(lit, touched)) litBad++;
}
report('lit systems equal the systems touched by events at or before the clock', litBad === 0, `${D.events.length} events checked, ${litBad} differ`);

/* ---------- graph geometry at 1440 ---------- */
await page.evaluate((c) => window.replay.seek(c), duration);
const geo = await page.evaluate(() => {
  const svg = document.getElementById('gsvg');
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const texts = [...svg.querySelectorAll('text')].map((t) => ({
    text: t.textContent, px: parseFloat(getComputedStyle(t).fontSize) * t.getScreenCTM().a, cls: t.getAttribute('class')
  }));
  const cards = [...svg.querySelectorAll('.node')].map((n) => ({ id: n.getAttribute('data-id'), ...box(n.querySelector('.body')),
    texts: [...n.querySelectorAll('text')].map((t) => box(t)) }));
  const pills = [...svg.querySelectorAll('g.lp')].map((g) => ({ id: g.getAttribute('data-link'), ...box(g.querySelector('rect')) }));
  const zl = [...svg.querySelectorAll('text.zl')].map((t) => ({ id: t.getAttribute('data-zone'), ...box(t) }));
  const key = svg.querySelector('g').nextElementSibling ? box(svg.querySelectorAll(':scope > g')[0]) : null;
  return { texts, cards, pills, zl, key, scale: svg.getScreenCTM().a, width: box(svg).w };
});
const hit = (a, b) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
const minPx = Math.min(...geo.texts.map((t) => t.px));
report('no graph text under 11px at 1440 wide', minPx >= 11, `smallest ${minPx.toFixed(1)}px, graph drawn at scale ${geo.scale.toFixed(2)}, ${geo.texts.length} text elements`);
const items = [
  ...geo.cards.map((c) => ({ k: 'card ' + c.id, ...c })), ...geo.pills.map((c) => ({ k: 'label ' + c.id, ...c })),
  ...geo.zl.map((c) => ({ k: 'frame title ' + c.id, ...c })), ...(geo.key ? [{ k: 'key', ...geo.key }] : [])
];
const clashes = [];
for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (hit(items[i], items[j])) clashes.push(`${items[i].k} / ${items[j].k}`);
report('no overlapping cards or labels in the graph', clashes.length === 0, clashes.length ? clashes.join(', ') : `${geo.cards.length} cards, ${geo.pills.length} link labels, ${geo.zl.length} frame titles`);
const spill = [];
geo.cards.forEach((c) => c.texts.forEach((t) => { if (t.x < c.x - 0.5 || t.x + t.w > c.x + c.w + 0.5) spill.push(c.id); }));
report('card text stays inside its card', spill.length === 0, spill.join(', '));

/* ---------- page height ---------- */
const height = await page.evaluate(() => document.documentElement.scrollHeight);
report('page height at 1440 wide (target 2,000px or less)', height <= 2000, `${height}px`);

/* ---------- interaction ---------- */
await page.evaluate(() => window.replay.seek(52));
await page.click('#gsvg .node[data-id="storefront"]');
let s = await page.evaluate(() => ({ st: window.replay.state(), pop: document.getElementById('pop').classList.contains('on'), chip: !document.getElementById('nodechip').hidden,
  n: document.querySelectorAll('#stream li:not(.empty)').length, marks: [...document.querySelectorAll('.mk')].filter((m) => m.style.display !== 'none').length }));
const sfEvents = D.events.filter((e) => e.i <= D.clock.idxAt(52) && e.nodes.includes('storefront')).length;
report('click a system: card opens, stream filters to it, its events are marked', s.pop && s.chip && s.st.nodeFilter === 'storefront' && s.n === sfEvents && s.marks === D.events.filter((e) => e.nodes.includes('storefront')).length, `${s.n} of ${sfEvents} lines, ${s.marks} marks`);
await page.keyboard.press('Escape');
await page.click('#nodechip button');
await page.click('#filters button.f:nth-of-type(2)');
s = await page.evaluate(() => ({ n: document.querySelectorAll('#stream li:not(.empty)').length, st: window.replay.state() }));
const blindNow = D.events.filter((e) => e.i <= D.clock.idxAt(52) && e.visibility === 'blind').length;
report('filters: node chip removed, visibility filter applies', s.st.nodeFilter === null && s.st.filter === 'blind' && s.n === blindNow, `${s.n} blind lines`);
await page.click('#filters button.f:nth-of-type(1)');
// keyboard: Right = next event, Shift+Right = next phase, Home = restart
await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.replay.seek(20); });
await page.keyboard.press('ArrowRight');
let k = await page.evaluate(() => window.replay.state());
const nextEv = D.events.find((e) => e.r > 20 + 1e-6);
await page.keyboard.press('Shift+ArrowRight');
const k2 = await page.evaluate(() => window.replay.state());
const nextPh = D.phases.filter((p) => p.n > 0).find((p) => p.first > nextEv.r + 1e-6);
await page.keyboard.press('Home');
const k3 = await page.evaluate(() => window.replay.state());
report('keyboard: Right, Shift+Right, Home', near(k.clock, nextEv.r, 1e-6) && near(k2.clock, nextPh.first, 1e-6) && k3.clock === 0, `${k.clock.toFixed(2)}, ${k2.clock.toFixed(2)}, ${k3.clock}`);
// play
await page.evaluate(() => { window.replay.seek(0); });
await page.click('#play');
await page.waitForTimeout(900);
const pl = await page.evaluate(() => window.replay.state());
await page.click('#play');
const pl2 = await page.evaluate(() => window.replay.state());
report('Play advances the clock, Pause stops it and writes #t=', pl.playing && pl.clock > 0.5 && !pl2.playing && /#t=\d/.test(pl2.hash), `clock ${pl.clock.toFixed(2)} after 0.9s, ${pl2.hash}`);
// scrubber drag backwards
await page.evaluate(() => window.replay.seek(60));
const tb = await page.evaluate(() => { const r = document.getElementById('head').parentElement.getBoundingClientRect(); return { l: r.left, w: r.width, y: r.top + 24 }; });
await page.mouse.move(tb.l + 10 + 60 / duration * (tb.w - 20), tb.y); await page.mouse.down();
await page.mouse.move(tb.l + 10 + 25 / duration * (tb.w - 20), tb.y, { steps: 6 }); await page.mouse.up();
const dr = await page.evaluate(() => window.replay.state());
report('dragging the scrubber scrubs backwards', near(dr.clock, 25, 0.6) && !dr.playing, `clock ${dr.clock.toFixed(2)}`);
// sticky bar after scroll
await page.evaluate(() => window.scrollTo(0, 1200));
await page.waitForTimeout(100);
report('sticky mini bar appears when the player card scrolls away', await page.evaluate(() => document.getElementById('sbar').classList.contains('on')));
await page.evaluate(() => window.scrollTo(0, 0));
// control card jumps to its cut
await page.click('#ctls li:nth-child(2) button');
const cj = await page.evaluate(() => window.replay.state());
report('a control card jumps to the action it would have refused', cj.index === D.cuts[1].evIndex, `index ${cj.index}`);

/* ---------- hash and reduced motion, on fresh loads ---------- */
const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
p2.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p2.on('pageerror', (e) => errors.push(String(e)));
await p2.goto(url + '#t=40');
await p2.waitForFunction(() => window.replay && document.body.getAttribute('data-ready') === 'replay');
const h40 = await p2.evaluate(() => window.replay.state());
report('#t=40 restores a moment', near(h40.clock, 40, 1e-6) && h40.index === D.clock.idxAt(40), `index ${h40.index}`);
await p2.evaluate(() => { window.replay.seek(0); });
await p2.click('#play');
await p2.waitForTimeout(2200);
const rm = await p2.evaluate(() => window.replay.state());
await p2.click('#play');
report('reduced motion: Play advances event by event, no in-between clock values', rm.index >= 1 && D.events.some((e) => near(e.r, rm.clock, 1e-6)), `index ${rm.index} at ${rm.clock.toFixed(2)}`);
await p2.close();

/* ---------- 900 wide ---------- */
const p3 = await browser.newPage({ viewport: { width: 900, height: 1200 } });
await p3.goto(url);
await p3.waitForFunction(() => window.replay);
await p3.evaluate(() => window.replay.seek(52));
const w900 = await p3.evaluate(() => {
  const rows = [...document.querySelectorAll('.row')].map((r) => { const k = [...r.children].map((c) => c.getBoundingClientRect()); return k[0].bottom <= k[1].top + 1; });
  const wide = [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('#stream, svg'));
  return { sw: document.documentElement.scrollWidth, rows, wide: wide.slice(0, 3).map((e) => e.tagName + '#' + e.id + '.' + e.className) };
});
report('at 900 wide the page does not overflow and the two-panel rows stack', w900.sw <= 900 && w900.rows.every(Boolean) && w900.wide.length === 0, `scrollWidth ${w900.sw}, ${w900.wide.join(' ')}`);
await p3.close();

/* ---------- provenance: the chip follows the story ---------- */
const illChips = await page.evaluate(() => [...document.querySelectorAll('.chip.ill')].filter((c) => !c.hidden).length);
const illStory = EXK.provenance.illustrative(story).length > 0;
report('"Illustrative data" chip shown when the story has illustrative records', illChips > 0 === illStory, `${illChips} chips, ${EXK.provenance.illustrative(story).length} illustrative records`);
const plain = JSON.parse(JSON.stringify(story));
(function strip(o) { if (!o || typeof o !== 'object') return; if (o.source && o.source.kind === 'illustrative') o.source = { kind: 'provided', ref: 'check' }; Object.values(o).forEach(strip); })(plain);
const p4 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
p4.on('pageerror', (e) => errors.push(String(e)));
await p4.setContent(assemble({ story: EXK.normalize(plain), replay: true }));
await p4.waitForFunction(() => window.replay);
const none = await p4.evaluate(() => ({ chips: [...document.querySelectorAll('.chip.ill')].filter((c) => !c.hidden).length, foot: document.getElementById('foot').textContent, title: document.title }));
report('no chip, no "illustrative" wording when no record is illustrative', none.chips === 0 && !/illustrative/i.test(none.foot + none.title), `${none.chips} chips`);
await p4.close();

/* ---------- network and errors ---------- */
await browser.close();
console.log(results.join('\n'));
console.log(`network=${net.length} errors=${errors.length}${net.length ? ' ' + net.slice(0, 3).join(' ') : ''}${errors.length ? ' ' + errors.slice(0, 3).join(' | ') : ''}`);
if (net.length || errors.length) failed++;
console.log(failed ? `FAIL (${failed})` : 'PASS');
process.exit(failed ? 1 : 0);
