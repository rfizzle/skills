#!/usr/bin/env node
// Usage: render.mjs <flow.json> [-o <out.html>]   render the viewer page
//        render.mjs <flow.json> --ascii           print the tree for the conversation
// The output defaults to the JSON's path with .html. Refuses a model with errors.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { ascii, check, render } from './lib.mjs';

const args = process.argv.slice(2);
let file = null;
let out = null;
let wantAscii = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o') out = args[++i];
  else if (args[i] === '--ascii') wantAscii = true;
  else if (args[i] === '-h' || args[i] === '--help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 4).join('\n')); process.exit(0); }
  else file = args[i];
}
if (!file) {
  console.error('usage: render.mjs <flow.json> [-o <out.html>] [--ascii]');
  process.exit(2);
}
const model = JSON.parse(fs.readFileSync(file, 'utf8'));
const { errors, warnings } = check(model);
for (const warning of warnings) console.warn(`warning: ${warning}`);
for (const error of errors) console.error(`error: ${error}`);
if (errors.length) process.exit(1);

if (wantAscii) {
  process.stdout.write(`${ascii(model)}\n`);
} else {
  const template = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'viewer.html'), 'utf8');
  const target = out ?? file.replace(/\.json$/i, '') + '.html';
  fs.writeFileSync(target, render(model, template));
  console.log(`rendered ${target}`);
}
