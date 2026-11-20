#!/usr/bin/env node
// Usage: check-story.mjs <story.json> [--style flat|iso]
// One line per problem: "path: what is wrong. Fix: how to fix it." Exit 1 on any error.
import fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadKit } from './lib/load-kit.mjs';

const args = process.argv.slice(2);
let file = null;
let style = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--style') style = args[++i];
  else if (args[i] === '-h' || args[i] === '--help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 3).join('\n')); process.exit(0); }
  else file = args[i];
}
if (!file || (style && !['flat', 'iso'].includes(style))) {
  console.error('usage: check-story.mjs <story.json> [--style flat|iso]');
  process.exit(2);
}

let story;
try { story = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
  console.error(`${file}: cannot read as JSON (${e.message}). Fix: make the file valid JSON.`);
  process.exit(1);
}
// A fixture may carry a `_style` comment key so it can be checked without flags.
if (!style && ['flat', 'iso'].includes(story._style)) style = story._style;
const EXK = loadKit();
const problems = EXK.validate(story, { style });
let errors = 0;
for (const p of problems) {
  if (p.level === 'error') errors++;
  console.error(p.level === 'warning' ? `warning: ${EXK.formatProblem(p)}` : EXK.formatProblem(p));
}
if (errors) process.exit(1);
const n = (k) => (Array.isArray(story[k]) ? story[k].length : 0);
console.log(`ok: ${n('systems')} systems, ${n('zones')} zones, ${n('links')} links, ${n('phases')} phases, ${n('steps')} steps, ${n('events')} events, ${n('controls')} controls`);
