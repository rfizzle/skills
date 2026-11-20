#!/usr/bin/env node
// Usage: build.mjs <story.json> --style flat|iso [--pattern flow|custom] [--scene <file.js>] [--extra <file.js>] [-o out.html]
//        (--pattern custom needs --scene, a file registering EXK.scenes.<name>; with flow, --scene is an alias of --extra)
//        build.mjs <story.json> --replay [-o out.html]
//        build.mjs --inline <page.html> [-o out.html]   replace the three GSAP CDN tags with the vendored copies
// Refuses a story with errors, and refuses to write a page that would load from the network.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { assemble, inlinePage } from './lib/assemble.mjs';
import { loadKit } from './lib/load-kit.mjs';
import { checkScene } from './lib/scene-file.mjs';
import { replayChecks } from './lib/replay-warnings.mjs';

const args = process.argv.slice(2);
const o = { file: null, style: null, pattern: 'flow', replay: false, scene: null, extra: null, out: null, inline: null };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--style') o.style = args[++i];
  else if (a === '--pattern') o.pattern = args[++i];
  else if (a === '--replay') o.replay = true;
  else if (a === '--scene') o.scene = args[++i];
  else if (a === '--extra') o.extra = args[++i];
  else if (a === '--inline') o.inline = args[++i];
  else if (a === '-o') o.out = args[++i];
  else if (a === '-h' || a === '--help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 6).join('\n')); process.exit(0); }
  else o.file = a;
}
const usage = (msg) => { console.error(`${msg ? `${msg}\n` : ''}usage: build.mjs <story.json> --style flat|iso [--pattern flow|custom --scene file.js] [-o out.html] | <story.json> --replay | --inline <page.html>`); process.exit(2); };
const fail = (msg) => { console.error(`error: ${msg}`); process.exit(1); };

try {
  if (o.inline) {
    const target = o.out ?? o.inline.replace(/\.html$/i, '') + '.inline.html';
    fs.writeFileSync(target, inlinePage(fs.readFileSync(o.inline, 'utf8')));
    console.log(`inlined ${target}`);
    process.exit(0);
  }
  if (!o.file) usage();
  if (!o.replay && !['flat', 'iso'].includes(o.style)) usage('--style flat|iso is required (or --replay)');
  if (!['flow', 'custom'].includes(o.pattern)) usage(`unknown --pattern ${o.pattern} (flow or custom)`);
  if (o.pattern === 'custom' && !o.scene) usage('--pattern custom needs --scene <file.js>');

  let story;
  try { story = JSON.parse(fs.readFileSync(o.file, 'utf8')); } catch (e) { fail(`${o.file}: cannot read as JSON (${e.message})`); }
  const EXK = loadKit();
  const problems = EXK.validate(story, { style: o.replay ? null : o.style, pattern: o.replay ? null : o.pattern });
  for (const p of problems) console.error(p.level === 'warning' ? `warning: ${EXK.formatProblem(p)}` : EXK.formatProblem(p));
  if (problems.some((p) => p.level === 'error')) process.exit(1);

  if (o.pattern === 'custom' && !o.replay) for (const w of checkScene({ file: o.scene, story }).warnings) console.error(`warning: ${w}`);
  if (o.replay) {
    const { refusal, warnings } = replayChecks(EXK.normalize(story));
    if (refusal) fail(`${o.file}: ${refusal}`);
    for (const w of warnings) console.error(`warning: replay: ${w}`);
  }
  const html = assemble({ story: EXK.normalize(story), style: o.style, pattern: o.pattern, replay: o.replay, extraPath: o.scene ?? o.extra });
  const base = o.file.replace(/\.story\.json$|\.json$/i, '');
  const target = o.out ?? `${base}.${o.replay ? 'replay' : o.style}.html`;
  fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
  fs.writeFileSync(target, html);
  console.log(`built ${target} (${Math.round(html.length / 1024)} KB)`);
} catch (e) {
  fail(e.message);
}
