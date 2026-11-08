#!/usr/bin/env node
// Usage: check.mjs <flow.json>
// Exit 1 on an error; warnings are printed and do not fail.
import fs from 'node:fs';
import process from 'node:process';
import { check } from './lib.mjs';

const file = process.argv[2];
if (!file) {
  console.error('usage: check.mjs <flow.json>');
  process.exit(2);
}
let model;
try {
  model = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (error) {
  console.error(`${file}: ${error.message}`);
  process.exit(1);
}
const { errors, warnings } = check(model);
for (const warning of warnings) console.warn(`warning: ${warning}`);
for (const error of errors) console.error(`error: ${error}`);
console.log(`${file}: ${errors.length} errors, ${warnings.length} warnings`);
process.exitCode = errors.length === 0 ? 0 : 1;
