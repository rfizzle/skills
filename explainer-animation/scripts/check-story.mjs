#!/usr/bin/env node
// Usage: check-story.mjs <story.json> [--style flat|iso] [--pattern custom]
// One line per problem: "path: what is wrong. Fix: how to fix it." Exit 1 on any error.
// --json: stdout is one JSON array of findings instead (references/checks.md, Machine-readable output).
import fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadKit } from './lib/load-kit.mjs';
import { createReport, recordOf } from './lib/findings.mjs';

const args = process.argv.slice(2);
let file = null;
let style = null;
let pattern = null;
let json = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--style') style = args[++i];
  else if (args[i] === '--pattern') pattern = args[++i];
  else if (args[i] === '--json') json = true;
  else if (args[i] === '-h' || args[i] === '--help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 3).join('\n')); process.exit(0); }
  else file = args[i];
}
const rep = createReport({ check: 'check-story', path: file ?? undefined, json });
if (!file || (style && !['flat', 'iso'].includes(style)) || (pattern && !['flow', 'custom'].includes(pattern))) {
  const usage = 'usage: check-story.mjs <story.json> [--style flat|iso] [--pattern flow|custom] [--json]';
  rep.add({ rule: 'usage', severity: 'error', message: usage, fix: 'pass one story file and valid flags', human: usage, stream: 'err' });
  rep.exit(2);
}

let story;
try { story = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
  rep.add({ rule: 'unreadable-json', severity: 'error', message: `cannot read as JSON (${e.message})`, fix: 'make the file valid JSON',
    human: `${file}: cannot read as JSON (${e.message}). Fix: make the file valid JSON.`, stream: 'err' });
  rep.exit(1);
}
// A fixture may carry a `_style` comment key so it can be checked without flags.
if (!style && ['flat', 'iso'].includes(story._style)) style = story._style;
const EXK = loadKit();
const problems = EXK.validate(story, { style, pattern });
// the step a problem belongs to: a step record, or an event's step field
const stepOf = (p) => {
  const m = /^steps\[(\d+)\]/.exec(p.path);
  if (m) return story.steps?.[+m[1]]?.id;
  const e = /^events\[(\d+)\]/.exec(p.path);
  return e ? story.events?.[+e[1]]?.step : undefined;
};
let errors = 0;
for (const p of problems) {
  if (p.level === 'error') errors++;
  rep.add({ rule: p.rule, severity: p.level, step: stepOf(p), record: recordOf(p.path), message: `${p.path}: ${p.message}`, fix: p.fix,
    human: p.level === 'warning' ? `warning: ${EXK.formatProblem(p)}` : EXK.formatProblem(p), stream: 'err' });
}
if (errors) rep.exit(1);
const info = (message) => rep.add({ rule: 'summary', severity: 'info', message, human: message });
if (pattern === 'custom' || story.meta?.scene) {   // free-shaped blocks: name the ones found
  const blocks = Object.keys(story).filter((k) => !k.startsWith('_') && Array.isArray(story[k]) && !['zones', 'systems', 'links', 'phases', 'steps', 'controls', 'events'].includes(k));
  const figs = Object.keys(story.figures ?? {}).filter((k) => !k.startsWith('_')).length;
  info(`ok: custom scene ${story.meta?.scene ?? '(by file)'}, ${story.phases?.length ?? 0} phases, ${story.steps.length} steps, ${figs} figures, blocks ${blocks.map((k) => `${k} ${story[k].length}`).join(', ') || 'none'}`);
  rep.exit(0);
}
const n = (k) => (Array.isArray(story[k]) ? story[k].length : 0);
info(`ok: ${n('systems')} systems, ${n('zones')} zones, ${n('links')} links, ${n('phases')} phases, ${n('steps')} steps, ${n('events')} events, ${n('controls')} controls`);
rep.exit(0);
