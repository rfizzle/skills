#!/usr/bin/env node
// Usage: check-layout.mjs <story.json> [--style flat|iso] [--area WxH]
// No browser. Lays out the estate, routes the links and frames every step, then prints:
// containment and sibling results, zones the engine laid out itself, the full-view scale for the diagram area
// (default 1920x720) with the hint changes that would raise it, the frame audit per step and per camera beat, route
// problems each with the hint that fixes it, and for --style iso whether the estate can be drawn cleanly at all
// (REFUSED with the reason and the remedy when not). Exit 1 on a failure or a refusal.
// --json: stdout is one JSON array of findings instead (references/checks.md, Machine-readable output).
import fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadKit } from './lib/load-kit.mjs';
import { createReport } from './lib/findings.mjs';

const args = process.argv.slice(2);
let file = null, style = 'flat', area = { w: 1920, h: 720 }, json = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--style') style = args[++i];
  else if (args[i] === '--json') json = true;
  else if (args[i] === '--area') { const m = /^(\d+)x(\d+)$/.exec(args[++i] || ''); if (m) area = { w: +m[1], h: +m[2] }; else style = null; }
  else if (args[i] === '-h' || args[i] === '--help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 7).join('\n')); process.exit(0); }
  else file = args[i];
}
const rep = createReport({ check: 'check-layout', path: file ?? undefined, json });
if (!file || !['flat', 'iso'].includes(style)) {
  const usage = 'usage: check-layout.mjs <story.json> [--style flat|iso] [--area WxH] [--json]';
  rep.add({ rule: 'usage', severity: 'error', message: usage, fix: 'pass one story file, --style flat|iso and --area WxH', human: usage, stream: 'err' });
  rep.exit(2);
}

let raw;
try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
  rep.add({ rule: 'unreadable-json', severity: 'error', message: `cannot read as JSON (${e.message})`, fix: 'make the file valid JSON',
    human: `${file}: cannot read as JSON (${e.message}). Fix: make the file valid JSON.`, stream: 'err' });
  rep.exit(1);
}
const EXK = loadKit({ bundle: 'scene' });
const iso = style === 'iso';
const story = EXK.normalize(raw);
const estate = EXK.layout.layoutEstate(story, style);
const E = EXK.route.routeLinks(estate, story);
let bad = 0;
const refusals = [];
// a failure: counted and printed as "FAIL <m>"; f carries rule, record, step, fix (and message when it differs from m)
const fail = (m, f) => { bad++; rep.add({ severity: 'error', message: m, human: 'FAIL ' + m, ...f }); };
const info = (rule, message, human, f) => rep.add({ rule, severity: 'info', message, human, ...f });
const LAYOUT_RULES = { parent: 'zone-parent-unknown', zone: 'system-zone-unknown', cols: 'cols-ignored', below: 'below-not-sibling' };
const layoutRule = (p) => LAYOUT_RULES[p.split('.').pop()] || 'layout-hint';
const ISO_RULES = { small: 'iso-zoom-too-small', hidden: 'iso-blocks-overlap', labels: 'iso-label-ambiguous' };
const ROUTE_RULES = { through: 'route-through-node', shared: 'route-shared-segment', near: 'route-near-node', skim: 'route-skims-border', crossing: 'route-crossing',
  blocked: 'route-blocked', narrow: 'route-narrow-gap', hint: 'route-hint-reassigned', lanes: 'route-lanes-unsearched' };
const r0 = (v) => Math.round(v);
const clone = (v) => JSON.parse(JSON.stringify(v));
const zoneIdx = Object.fromEntries((raw.zones || []).map((z, i) => [z.id, i]));
const linkIdx = (id) => (raw.links || []).findIndex((l) => l.from + '-' + l.to === id.replace(/#\d+$/, ''));
// the layout block a hint is read from in this style (layout.iso replaces layout in iso)
const layoutKey = (z) => (iso && z.layout && z.layout.iso ? 'layout.iso' : 'layout');
const hintOf = (z) => (iso && z.layout && z.layout.iso ? z.layout.iso : z.layout || {});

// ---- layout ----
for (const p of estate.problems) rep.add({ rule: layoutRule(p.path), severity: 'warning', record: p.path.split('.')[0], message: `${p.path}: ${p.message}`, fix: p.fix, human: `warn layout ${p.path}: ${p.message}. Fix: ${p.fix}.` });
for (const z of raw.zones || []) {
  const h = z.layout || {};
  if (!iso && h.cols != null) rep.add({ rule: 'cols-flat-ignored', severity: 'warning', record: `zones[${zoneIdx[z.id]}]`, message: `zones[${zoneIdx[z.id]}].layout.cols: cols is read in iso only (inside layout.iso); flat ignores it`, fix: 'move it into layout.iso, or use dir in flat',
    human: `warn layout zones[${zoneIdx[z.id]}].layout.cols: cols is read in iso only (inside layout.iso); flat ignores it. Fix: move it into layout.iso, or use dir in flat.` });
}
for (const p of EXK.layout.checkLayout(estate)) fail(p.message, { rule: p.kind === 'outside' ? 'outside-parent' : 'overlap', record: p.ids[0], fix: p.kind === 'outside' ? `raise the gap or pad of ${p.ids[1]}, or move ${p.ids[0]} with a layout hint` : `separate ${p.ids.join(' and ')} with layout gap, dir or below` });
if (!bad) rep.say('containment and sibling checks passed');
for (const a of estate.auto || []) {
  const autoFix = `set zones[${zoneIdx[a.id]}].${layoutKey(raw.zones[zoneIdx[a.id]])}.dir to choose yourself`;
  const autoMsg = `zone ${a.id} is laid out as a ${a.dir === 'row' ? 'row' : 'column'} (it has no dir; that fills the area better than the default)`;
  info('zone-auto-dir', autoMsg, `layout: ${autoMsg}. Fix: ${autoFix}.`, { record: `zones[${zoneIdx[a.id]}]`, fix: autoFix });
}

// the single hint changes that would make the estate fill the area better (each tried with a full layout)
function layoutAdvice(score0) {
  const tries = [];
  (raw.zones || []).forEach((z, i) => {
    // the block the change goes into: layout in flat; layout.iso in iso (a copy of layout when there is none yet,
    // since layout.iso replaces layout)
    const h = hintOf(z), path = iso ? 'layout.iso' : 'layout', kids = estate.B[z.id] ? estate.B[z.id].kids.length : 0;
    const mut = (label, fn) => tries.push({ label, fn: (s) => {
      const zz = s.zones[i];
      zz.layout = zz.layout || {};
      if (iso && !zz.layout.iso) { const { iso: _, ...rest } = zz.layout; zz.layout.iso = clone(rest); }
      fn(iso ? zz.layout.iso : zz.layout);
    } });
    const flip = h.dir === 'row' ? 'col' : 'row';
    if (kids >= 2 && h.dir) mut(`set zones[${i}].${path}.dir "${flip}" (${z.id})`, (t) => { t.dir = flip; });
    if (h.below) mut(`remove zones[${i}].${path}.below (${z.id} beside ${h.below} instead of under it)`, (t) => { delete t.below; delete t.belowGap; });
    if (iso && kids >= 3 && h.cols == null) for (const n of [...new Set([2, 3, Math.round(Math.sqrt(kids))])]) if (n < kids) mut(`set zones[${i}].layout.iso.cols ${n} (${z.id})`, (t) => { t.cols = n; delete t.dir; });
  });
  const res = [];
  for (const t of tries) {
    const s = clone(raw);
    t.fn(s);
    const st = EXK.normalize(s), e = EXK.layout.layoutEstate(st, style);
    if (EXK.layout.checkLayout(e).length) continue;
    const sc = EXK.layout.fitScore(e.world, e.sizes, area);
    if (sc > score0 * 1.05) res.push({ label: t.label, sc });
  }
  return res.sort((a, b) => b.sc - a.sc).slice(0, 3);
}

const full = EXK.layout.fullOf(estate.world, area.w / area.h);
const scale = area.w / full.w;
const fit = EXK.layout.fitScore(estate.world, estate.sizes, area);
const aspectW = estate.world.w / estate.world.h, aspectA = area.w / area.h;
let scaleNote = '';
if (!iso && scale < 0.7) scaleNote = `  (below 0.70: text gets small; the estate is ${aspectW < aspectA ? 'taller' : 'wider'} than the area (${aspectW.toFixed(2)} against ${aspectA.toFixed(2)}), so the full view ${aspectW < aspectA ? 'uses only the middle of the frame' : 'is thin'})`;
const worldLine = `world ${r0(estate.world.w)}x${r0(estate.world.h)}  full-view scale ${scale.toFixed(3)} at ${area.w}x${area.h}${scaleNote}`;
if (!iso && scale < 0.7) rep.add({ rule: 'full-view-scale-low', severity: 'warning', message: worldLine, fix: 'apply the layout-advice entries, or regroup systems into fewer, squarer zones', human: worldLine });
else info('full-view-scale', worldLine, worldLine);
const audit = iso ? EXK.layout.isoAudit(estate, story, area) : null;
if ((!iso && scale < 0.7) || (iso && audit.zoom < 0.55)) {
  const adv = layoutAdvice(fit);
  if (adv.length) for (const a of adv) { const m = `${a.label} raises the ${iso ? 'iso zoom' : 'full-view scale'} to ${a.sc.toFixed(3)}`; info('layout-advice', m, `advice: ${m}`, { fix: a.label }); }
  else info('layout-advice', 'no single dir/below/cols change helps', 'advice: no single dir/below/cols change helps; regroup systems into fewer, squarer zones, or split the story', { fix: 'regroup systems into fewer, squarer zones, or split the story' });
}

// ---- iso: can it be drawn cleanly at all? ----
if (iso) {
  const zoomLine = `iso full-view zoom ${audit.zoom.toFixed(3)} (a block is ${r0(118 * audit.zoom)} px wide)`;
  info('iso-zoom', zoomLine, zoomLine);
  for (const p of audit.problems) {
    if (p.level === 'error') refusals.push(p);
    else rep.add({ rule: ISO_RULES[p.kind] || 'iso-' + p.kind, severity: 'warning', message: p.message, fix: p.fix, human: `warn iso ${p.message}. Fix: ${p.fix}.` });
  }
  for (const [i, z] of (raw.zones || []).entries()) {
    const h = z.layout || {};
    if (h.below && !h.iso) rep.say(`note iso zones[${i}].layout.below: honoured in iso as "under ${h.below}, starting at its x + dx" (flat starts at the parent's left + dx); set layout.iso to place it differently.`);
  }
}

// ---- frames (iso ignores grow, so it is dropped before framing) ----
if (iso) rep.say('note: iso frames below are the ground-plane audit; the iso painter frames each step in projected space at run time (paint/iso.js frameFor)');
const specFor = (spec) => (iso && spec && spec.grow ? { hold: spec.hold } : spec);
const frameLine = (label, f, allowCut) => {
  const cut = f.cut.join(' ') || '-';
  const stepId = label.split(' ')[0];
  rep.say(`${label.padEnd(22)} ${f.full ? 'full' : 'zoom ' + f.zoom.toFixed(2)}  cut: ${cut}${f.cut.length && allowCut ? ' (grow)' : ''}  | enclosing: ${f.enclosing.join(' ') || '-'}  | crumb: ${f.crumb.join(' > ') || '-'}${f.widened.length ? '  | widened for: ' + f.widened.join(' ') : ''}`);
  if (f.widened.length && !iso) {
    const why = `a frame around ${f.hold.join(' ')} would cut the border of ${f.widened.join(', ')}, so ${f.widened.length > 1 ? 'they were' : 'it was'} added to the hold${f.full ? ' and the frame grew to the full view' : ''} (a frame never slices a container)`;
    const whyFix = `if the full view is what you want, write frame "full"; for a close-up, hold one container that holds them all (frame.hold), or set frame.grow "down"/"up" to accept the cut`;
    rep.add({ rule: 'frame-widened', severity: 'info', step: stepId, message: `${label}: ${why}`, fix: whyFix, human: `  why ${label}: ${why}. Fix: ${whyFix}.` });
  }
  for (const q of f.issues) rep.add({ rule: q.kind === 'hold' ? 'frame-hold-unknown' : 'frame-grow-invalid', severity: 'warning', step: stepId, message: `${label}: ${q.message}`, fix: q.fix, human: `warn ${label}: ${q.message}. Fix: ${q.fix}.` });
  if (f.cut.length && !allowCut) fail(`${label}: frame cuts ${f.cut.join(' ')}`, { rule: 'frame-cuts-container', step: stepId, fix: 'hold one container that holds them all (frame.hold), write frame "full", or set frame.grow "down"/"up" to accept the cut' });
  if (f.cut.length && allowCut) {
    // a grow frame may cut the containers around its hold, not a neighbour (e.g. the VPC sliced at the top of the frame)
    const anc = new Set();
    for (const id of f.hold) for (let b = estate.B[id]; b; b = estate.B[b.parent]) anc.add(b.id);
    const stray = f.cut.filter((id) => !anc.has(id));
    if (stray.length) fail(`${label}: grow frame slices ${stray.join(' ')}, which does not contain the held boxes (move the frame or hold more)`, { rule: 'grow-frame-slices-neighbour', step: stepId, fix: 'move the frame or hold more' });
  }
};
for (const st of story.steps) {
  const f = EXK.frame.frameFor(estate, specFor(st.frame), area);
  frameLine(st.id, f, !!(st.frame && st.frame.grow) && !iso);
  (st.beats || []).forEach((b, i) => {
    if (!b.camera) return;
    if (iso) { rep.say(`${(st.id + ' camera[' + i + ']').padEnd(22)} skipped (iso: no camera beats in version 1; the step keeps one frame)`); return; }
    if (b.camera === 'full' || b.camera === 'step') return;
    const g = EXK.frame.frameFor(estate, specFor(b.camera), area);
    frameLine(`${st.id} camera[${i}]`, g, !!b.camera.grow && !iso);
  });
}

// ---- routes ----
// for a link with an error: does it route cleanly without its hints, or with one exit/corridor hint?
const routeErrors = (EE, id) => EXK.route.checkRoutes(estate, EE, { near: iso ? 12 : 0 }).filter((c) => c.level === 'error' && c.links.includes(id));
function routeAdvice(id) {
  const li = linkIdx(id);
  if (li < 0) return null;
  const link = raw.links[li], key = iso && link.route && link.route.iso ? 'route.iso' : 'route';
  const tryHint = (h) => {
    const s = clone(raw);
    if (iso) { s.links[li].route = s.links[li].route || {}; s.links[li].route.iso = h; } else s.links[li].route = h;
    const EE = EXK.route.routeLinks(estate, EXK.normalize(s));
    return EE[id] && !routeErrors(EE, id).length;
  };
  const cur = iso ? (link.route && link.route.iso) || link.route : link.route;
  if (cur && Object.keys(cur).length && tryHint({})) return `the hint ${JSON.stringify(cur)} makes it worse: without ${key} hints the router finds a clean route; remove links[${li}].${key}`;
  const ids = (raw.zones || []).map((z) => z.id).concat([link.from, link.to]);
  for (const exit of [null, 'top', 'bottom', 'left', 'right']) {
    for (const cor of [null, ...ids.flatMap((z) => ['below:', 'above:', 'left:', 'right:'].map((sd) => sd + z))]) {
      if (!exit && !cor) continue;
      const h = {};
      if (exit) h.exit = exit;
      if (cor) h.corridor = cor;
      if (tryHint(h)) return `set links[${li}].${iso ? 'route.iso' : 'route'} = ${JSON.stringify(h)} (routes it cleanly)`;
    }
  }
  return 'no single exit/corridor hint routes it cleanly; give it route.via waypoints, or move one end (layout gap, dir, below)';
}
const near = iso ? 12 : 0;
const shapes = {};
for (const r of Object.values(E)) shapes[r.shape] = (shapes[r.shape] || 0) + 1;
rep.add({ rule: 'routes', severity: 'info', message: `routes ${Object.keys(E).length}`, human: `routes ${Object.keys(E).length}: ${Object.entries(shapes).map(([k, v]) => `${v} ${k}`).join(', ')}; ${Object.values(E).filter((r) => r.rule === 'corridor' || r.rule === 'via').map((r) => r.id + ' (' + r.rule + ')').join(', ') || 'no hints used'}` });
rep.say('note: links are drawn from node centre to node centre and hidden under the node boxes, so a packet never jumps between hops');
const advised = new Set();
const linkRecord = (id) => { const li = linkIdx(id); return li < 0 ? undefined : `links[${li}]`; };
for (const c of EXK.route.checkRoutes(estate, E, { near })) {
  const f = { rule: ROUTE_RULES[c.kind] || 'route-' + c.kind, record: linkRecord(c.links[0]), message: c.message, fix: c.fix };
  if (c.level === 'error') {
    fail(`${c.message}. Fix: ${c.fix}.`, f);
    for (const id of c.links) {
      if (advised.has(id)) continue;
      advised.add(id);
      const a = routeAdvice(id);
      if (a) rep.add({ rule: 'route-advice', severity: 'info', record: linkRecord(id), message: `${id}: ${a}`, fix: a, human: `  advice ${id}: ${a}` });
    }
  } else rep.add({ ...f, severity: c.level === 'warning' ? 'warning' : 'info', human: `${c.level === 'warning' ? 'warn' : 'info'} ${c.message}${c.level === 'warning' ? '. Fix: ' + c.fix + '.' : ''}` });
}

refusals.forEach((p) => rep.add({ rule: ISO_RULES[p.kind] || 'iso-' + p.kind, severity: 'error', message: p.message, fix: p.fix, human: `REFUSED iso: ${p.message}. Fix: ${p.fix}.` }));
if (refusals.length) rep.say('this estate cannot be drawn cleanly in isometric; build it with --style flat, or apply the fixes above and check again');
rep.say(bad || refusals.length ? `${bad + refusals.length} check(s) failed` : 'frame and route checks passed');
rep.exit(bad || refusals.length ? 1 : 0);
