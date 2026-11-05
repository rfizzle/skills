#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
// Usage: validate-skills.mjs [root] [--allow-client-terms=a,b]
// --allow-client-terms names skills whose subject is client discovery itself
// (where a skill directory lives for a given client), so naming a client is
// the content, not an instruction. Every other skill stays client-neutral.
const args = process.argv.slice(2);
const positional = args.filter((arg) => !arg.startsWith('--'));
const allowClientTerms = new Set(args
  .filter((arg) => arg.startsWith('--allow-client-terms='))
  .flatMap((arg) => arg.slice('--allow-client-terms='.length).split(','))
  .filter(Boolean));
const root = path.resolve(positional[0] ?? path.join(scriptDirectory, '..'));
const errors = [];
const warnings = [];
const portableKeys = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
]);
const forbiddenClientTerms = [
  /\bultrathink\b/i,
  /\bAskUserQuestion\b/,
  /\bWebSearch\b/,
  /\bWebFetch\b/,
  /\bAgent tool\b/i,
  /\bOpenClaw\b/i,
  /\bClaude Code\b/i,
  /\bClaude\b/i,
  /\bCodex\b/i,
  /\bPi coding agent\b/i,
];

function report(kind, file, message) {
  const relative = path.relative(root, file) || '.';
  (kind === 'error' ? errors : warnings).push(`${relative}: ${message}`);
}

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(item) : [item];
  });
}

function parseFrontmatter(file, source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) {
    report('error', file, 'missing YAML frontmatter');
    return null;
  }

  const lines = match[1].split(/\r?\n/);
  const values = new Map();
  const keys = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const topLevel = line.match(/^([a-zA-Z0-9_-]+):(?:\s*(.*))?$/);
    if (!topLevel) continue;
    const [, key, raw = ''] = topLevel;
    keys.push(key);
    if (raw === '>' || raw === '|') {
      const block = [];
      while (index + 1 < lines.length && (lines[index + 1].trim() === '' || /^\s+/.test(lines[index + 1]))) {
        index++;
        if (lines[index].trim()) block.push(lines[index].trim());
      }
      values.set(key, raw === '>' ? block.join(' ') : block.join('\n'));
    } else {
      values.set(key, raw.replace(/^(['"])(.*)\1$/, '$2'));
    }
  }
  return { body: source.slice(match[0].length), keys, values };
}

function validateLinks(file, source) {
  source = source
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '');
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of source.matchAll(linkPattern)) {
    let target = match[1].trim().replace(/^<|>$/g, '');
    if (!target || /^(?:https?:|mailto:|#)/i.test(target)) continue;
    target = target.split(/\s+["']/)[0].split('#')[0];
    if (!target) continue;
    try {
      target = decodeURIComponent(target);
    } catch {
      report('error', file, `invalid encoded link: ${match[1]}`);
      continue;
    }
    const resolved = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(resolved)) report('error', file, `broken local link: ${target}`);
  }
}

function validateEval(skillName, file) {
  let value;
  try {
    value = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    report('error', file, `invalid JSON: ${error.message}`);
    return;
  }

  if (!value || Array.isArray(value) || typeof value !== 'object') {
    report('error', file, 'expected an object with skill_name and evals');
    return;
  }
  if (value.skill_name !== skillName) {
    report('error', file, `skill_name must be ${skillName}`);
  }
  if (!Array.isArray(value.evals)) {
    report('error', file, 'evals must be an array');
    return;
  }

  const ids = new Set();
  for (const [index, evaluation] of value.evals.entries()) {
    const label = `evals[${index}]`;
    if (!evaluation || typeof evaluation !== 'object') {
      report('error', file, `${label} must be an object`);
      continue;
    }
    for (const field of ['id', 'name', 'prompt', 'assertions']) {
      if (evaluation[field] === undefined) report('error', file, `${label} missing ${field}`);
    }
    if (ids.has(evaluation.id)) report('error', file, `duplicate eval id ${evaluation.id}`);
    ids.add(evaluation.id);
    if (!Array.isArray(evaluation.assertions) || evaluation.assertions.length === 0) {
      report('error', file, `${label}.assertions must be a non-empty array`);
    } else {
      const assertionIds = new Set();
      for (const [assertionIndex, assertion] of evaluation.assertions.entries()) {
        const assertionLabel = `${label}.assertions[${assertionIndex}]`;
        if (!assertion || typeof assertion !== 'object') {
          report('error', file, `${assertionLabel} must be an object`);
          continue;
        }
        if (assertion.id === undefined) report('error', file, `${assertionLabel} missing id`);
        if (typeof assertion.text !== 'string' || !assertion.text.trim()) {
          report('error', file, `${assertionLabel} missing text`);
        }
        if (assertionIds.has(assertion.id)) {
          report('error', file, `${label} has duplicate assertion id ${assertion.id}`);
        }
        assertionIds.add(assertion.id);
      }
    }
  }
}

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error(`error: ${root}: skill suite directory does not exist`);
  process.exit(1);
}

// Shared skills are vendored from another repository and verified by hash
// (make skills-check); they are linted where they are edited, not here.
const sharedSum = path.join(root, 'shared.sum');
const shared = new Set(fs.existsSync(sharedSum)
  ? fs.readFileSync(sharedSum, 'utf8').split(/\r?\n/)
    .map((line) => line.match(/^\.agents\/skills\/([a-z0-9-]+)\s/)?.[1])
    .filter(Boolean)
  : []);
const allSkills = fs.readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'SKILL.md')))
  .map((entry) => entry.name)
  .sort();
const skillNames = new Set(allSkills);
const skills = allSkills.filter((name) => !shared.has(name));

if (allSkills.length === 0) {
  report('error', root, 'no skill directories containing SKILL.md were found');
}

for (const skillName of skills) {
  const skillDir = path.join(root, skillName);
  const skillFile = path.join(skillDir, 'SKILL.md');
  const source = fs.readFileSync(skillFile, 'utf8');
  const frontmatter = parseFrontmatter(skillFile, source);
  if (!frontmatter) continue;

  for (const key of frontmatter.keys) {
    if (!portableKeys.has(key)) report('error', skillFile, `non-portable frontmatter key: ${key}`);
  }
  const declaredName = frontmatter.values.get('name');
  const description = frontmatter.values.get('description') ?? '';
  const compatibility = frontmatter.values.get('compatibility');
  if (declaredName !== skillName) report('error', skillFile, `name must match directory ${skillName}`);
  if (skillName.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillName)) {
    report('error', skillFile, 'invalid skill name');
  }
  if (!description) report('error', skillFile, 'description is required');
  if (description.length > 1024) report('error', skillFile, 'description exceeds 1024 characters');
  if (compatibility !== undefined && (!compatibility || compatibility.length > 500)) {
    report('error', skillFile, 'compatibility must contain 1-500 characters');
  }

  const bodyLines = frontmatter.body.split(/\r?\n/).length;
  if (bodyLines > 500) report('error', skillFile, `body has ${bodyLines} lines; move detail to references`);
  const clientNeutral = !allowClientTerms.has(skillName);
  for (const pattern of clientNeutral ? forbiddenClientTerms : []) {
    if (pattern.test(source)) report('error', skillFile, `client-specific instruction matches ${pattern}`);
  }

  for (const file of clientNeutral ? walkFiles(skillDir) : []) {
    if (file === skillFile || !/\.(?:md|json|mjs|js|cjs|ts|py|sh)$/i.test(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of forbiddenClientTerms) {
      if (pattern.test(content)) report('error', file, `client-specific instruction matches ${pattern}`);
    }
  }

  // Descriptions point at neighbours as "(name)" or "(use name)"; a renamed or
  // deleted skill must not leave a dangling pointer behind.
  for (const match of description.matchAll(/\((?:use |see )?([a-z0-9]+(?:-[a-z0-9]+)+)\)/g)) {
    if (!skillNames.has(match[1])) report('error', skillFile, `description points at missing skill ${match[1]}`);
  }

  validateLinks(skillFile, source);
  for (const match of source.matchAll(/(?:see|use|consult) (?:the )?`([a-z0-9-]+)` skill/gi)) {
    if (!skillNames.has(match[1])) report('error', skillFile, `references missing skill ${match[1]}`);
  }

  const evalFile = path.join(skillDir, 'evals', 'evals.json');
  if (fs.existsSync(evalFile)) validateEval(skillName, evalFile);

  const referencesDir = path.join(skillDir, 'references');
  if (fs.existsSync(referencesDir)) {
    for (const entry of fs.readdirSync(referencesDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const file = path.join(referencesDir, entry.name);
      const reference = fs.readFileSync(file, 'utf8');
      validateLinks(file, reference);
      const lines = reference.split(/\r?\n/).length;
      if (lines > 200 && !/^## Contents\s*$/m.test(reference)) {
        report('warning', file, `${lines} lines without a Contents section`);
      }
    }
  }
}

for (const warning of warnings) console.warn(`warning: ${warning}`);
for (const error of errors) console.error(`error: ${error}`);
console.log(`${skills.length} skills, ${errors.length} errors, ${warnings.length} warnings`);
process.exitCode = errors.length === 0 ? 0 : 1;
