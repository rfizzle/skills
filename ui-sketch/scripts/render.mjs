#!/usr/bin/env node
// Usage: render.mjs <sketch.json> [-o <out.html>]   render the sketch page (fragments and tokens inlined)
//        render.mjs <sketch.json> --text            print the hand-over table for the conversation
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { check, render, text } from './lib.mjs';
import { readFiles } from './check.mjs';

const args = process.argv.slice(2);
let file = null, out = null, wantText = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o') out = args[++i];
  else if (args[i] === '--text') wantText = true;
  else file = args[i];
}
if (!file) { console.error('usage: render.mjs <sketch.json> [-o <out.html>] [--text]'); process.exit(2); }
const model = JSON.parse(fs.readFileSync(file, 'utf8'));
const files = readFiles(file, model);
const { errors, warnings } = check(model, files);
for (const w of warnings) console.warn(`warning: ${w}`);
for (const e of errors) console.error(`error: ${e}`);
if (errors.length) process.exit(1);
if (wantText) {
  process.stdout.write(`${text(model)}\n`);
} else {
  const template = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'viewer.html'), 'utf8');
  const target = out ?? file.replace(/\.json$/i, '') + '.html';
  fs.writeFileSync(target, render(model, template, files));
  console.log(`rendered ${target}`);
}
