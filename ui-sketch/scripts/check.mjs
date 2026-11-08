#!/usr/bin/env node
// Usage: check.mjs <sketch.json>
// Reads the tokens file and every direction file beside the JSON. Exit 1 on an error.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { check } from './lib.mjs';

export function readFiles(file, model) {
  const dir = path.dirname(file);
  const files = {};
  const names = [model.tokens, ...(model.directions || []).map((d) => d.file)].filter(Boolean);
  for (const name of names) {
    const target = path.resolve(dir, name);
    if (fs.existsSync(target)) files[name] = fs.readFileSync(target, 'utf8');
  }
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const file = process.argv[2];
  if (!file) { console.error('usage: check.mjs <sketch.json>'); process.exit(2); }
  let model;
  try { model = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { console.error(`${file}: ${error.message}`); process.exit(1); }
  const { errors, warnings } = check(model, readFiles(file, model));
  for (const w of warnings) console.warn(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  console.log(`${file}: ${errors.length} errors, ${warnings.length} warnings`);
  process.exitCode = errors.length === 0 ? 0 : 1;
}
