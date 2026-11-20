#!/usr/bin/env node
// Usage: check-layout.mjs <story.json> [--style flat|iso] [--area WxH]
// No browser. Lays out the estate, routes the links and frames every step, then prints:
// containment and sibling results, the full-view scale for the diagram area (default 1920x720),
// the frame audit per step and per camera beat (which containers each frame cuts), and route
// problems (shared segments, routes under unrelated nodes, hints not honoured). Exit 1 on a failure.
import fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadKit } from './lib/load-kit.mjs';

const args = process.argv.slice(2);
let file = null, style = 'flat', area = { w: 1920, h: 720 };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--style') style = args[++i];
  else if (args[i] === '--area') { const m = /^(\d+)x(\d+)$/.exec(args[++i] || ''); if (m) area = { w: +m[1], h: +m[2] }; else style = null; }
  else if (args[i] === '-h' || args[i] === '--help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 6).join('\n')); process.exit(0); }
  else file = args[i];
}
if (!file || !['flat', 'iso'].includes(style)) {
  console.error('usage: check-layout.mjs <story.json> [--style flat|iso] [--area WxH]');
  process.exit(2);
}

let raw;
try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
  console.error(`${file}: cannot read as JSON (${e.message}). Fix: make the file valid JSON.`);
  process.exit(1);
}
const EXK = loadKit({ bundle: 'scene' });
const story = EXK.normalize(raw);
const estate = EXK.layout.layoutEstate(story, style);
const E = EXK.route.routeLinks(estate, story);
let bad = 0;
const fail = (m) => { bad++; console.log('FAIL ' + m); };
const r0 = (v) => Math.round(v);

// layout
for (const p of estate.problems) console.log(`warn layout ${p.path}: ${p.message}. Fix: ${p.fix}.`);
for (const p of EXK.layout.checkLayout(estate)) fail(p.message);
if (!bad) console.log('containment and sibling checks passed');
const full = EXK.layout.fullOf(estate.world, area.w / area.h);
const scale = area.w / full.w;
console.log(`world ${r0(estate.world.w)}x${r0(estate.world.h)}  full-view scale ${scale.toFixed(3)} at ${area.w}x${area.h}${scale < 0.7 ? '  (below 0.70: text gets small; rearrange the estate toward the area aspect)' : ''}`);
if (style === 'iso') {
  const n = estate.nodes;
  for (let i = 0; i < n.length; i++) for (let j = i + 1; j < n.length; j++) {
    if (Math.abs((n[i].cx + n[i].cy) - (n[j].cx + n[j].cy)) < 8) console.log(`warn iso depth: ${n[i].id} and ${n[j].id} share x+y within 8 units (draw order is ambiguous)`);
  }
}

// frames (iso ignores grow, so it is dropped before framing)
if (style === 'iso') console.log('note: iso frames below are the ground-plane audit; the iso painter frames each step in projected space at run time (paint/iso.js frameFor)');
const specFor = (spec) => (style === 'iso' && spec && spec.grow ? { hold: spec.hold } : spec);
const frameLine = (label, f, allowCut) => {
  const cut = f.cut.join(' ') || '-';
  console.log(`${label.padEnd(22)} ${f.full ? 'full' : 'zoom ' + f.zoom.toFixed(2)}  cut: ${cut}${f.cut.length && allowCut ? ' (grow)' : ''}  | enclosing: ${f.enclosing.join(' ') || '-'}  | crumb: ${f.crumb.join(' > ') || '-'}${f.widened.length ? '  | widened for: ' + f.widened.join(' ') : ''}`);
  for (const q of f.issues) console.log(`warn ${label}: ${q.message}. Fix: ${q.fix}.`);
  if (f.cut.length && !allowCut) fail(`${label}: frame cuts ${f.cut.join(' ')}`);
  if (f.cut.length && allowCut) {
    // a grow frame may cut the containers around its hold, not a neighbour (e.g. the VPC sliced at the top of the frame)
    const anc = new Set();
    for (const id of f.hold) for (let b = estate.B[id]; b; b = estate.B[b.parent]) anc.add(b.id);
    const stray = f.cut.filter((id) => !anc.has(id));
    if (stray.length) fail(`${label}: grow frame slices ${stray.join(' ')}, which does not contain the held boxes (move the frame or hold more)`);
  }
};
for (const st of story.steps) {
  const f = EXK.frame.frameFor(estate, specFor(st.frame), area);
  frameLine(st.id, f, !!(st.frame && st.frame.grow) && style === 'flat');
  (st.beats || []).forEach((b, i) => {
    if (!b.camera) return;
    if (style === 'iso') { console.log(`${(st.id + ' camera[' + i + ']').padEnd(22)} skipped (iso: no camera beats in version 1; the step keeps one frame)`); return; }
    if (b.camera === 'full' || b.camera === 'step') return;
    const g = EXK.frame.frameFor(estate, specFor(b.camera), area);
    frameLine(`${st.id} camera[${i}]`, g, !!b.camera.grow && style === 'flat');
  });
}

// routes
const near = style === 'iso' ? 12 : 0;
const shapes = {};
for (const r of Object.values(E)) shapes[r.shape] = (shapes[r.shape] || 0) + 1;
console.log(`routes ${Object.keys(E).length}: ${Object.entries(shapes).map(([k, v]) => `${v} ${k}`).join(', ')}; ${Object.values(E).filter((r) => r.rule === 'corridor' || r.rule === 'via').map((r) => r.id + ' (' + r.rule + ')').join(', ') || 'no hints used'}`);
for (const c of EXK.route.checkRoutes(estate, E, { near })) {
  if (c.level === 'error') fail(`${c.message}. Fix: ${c.fix}.`);
  else console.log(`${c.level === 'warning' ? 'warn' : 'info'} ${c.message}${c.level === 'warning' ? '. Fix: ' + c.fix + '.' : ''}`);
}

console.log(bad ? `${bad} check(s) failed` : 'frame and route checks passed');
process.exit(bad ? 1 : 0);
