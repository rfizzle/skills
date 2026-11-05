import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = join(dirname(fileURLToPath(import.meta.url)), 'validate-skills.mjs');

function fixture(skillText, evalValue, skillName = 'sample-skill') {
  const root = mkdtempSync(join(tmpdir(), 'validate-skills-'));
  const skillDir = join(root, skillName);
  mkdirSync(join(skillDir, 'evals'), { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), skillText);
  writeFileSync(join(skillDir, 'evals', 'evals.json'), JSON.stringify(evalValue));
  return root;
}

function run(root, ...flags) {
  return spawnSync(process.execPath, [script, root, ...flags], { encoding: 'utf8' });
}

const portableSkill = `---
name: sample-skill
description: "Use for a small validation fixture."
license: MIT
allowed-tools: Bash(git:*) Read
metadata:
  fixture: portable
---

# Sample skill

Follow the fixture instructions.
`;

const portableEvals = {
  skill_name: 'sample-skill',
  evals: [{
    id: 1,
    name: 'sample',
    prompt: 'Exercise the sample skill.',
    assertions: [{ id: '1.1', text: 'Follows the fixture.' }],
  }],
};

test('accepts a portable skill and shared eval schema', () => {
  const result = run(fixture(portableSkill, portableEvals));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 skills, 0 errors, 0 warnings/);
});

test('rejects client-specific frontmatter and an array-form eval file', () => {
  const nonPortable = portableSkill.replace('license: MIT', 'user-invocable: true');
  const result = run(fixture(nonPortable, portableEvals.evals));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /non-portable frontmatter key/);
  assert.match(result.stderr, /expected an object with skill_name and evals/);
});

test('validates folded descriptions and strict hyphenated names', () => {
  const longDescription = portableSkill.replace(
    'description: "Use for a small validation fixture."',
    `description: >\n  ${'x'.repeat(1025)}`,
  );
  const longResult = run(fixture(longDescription, portableEvals));
  assert.equal(longResult.status, 1);
  assert.match(longResult.stderr, /description exceeds 1024 characters/);

  const invalidName = portableSkill.replaceAll('sample-skill', 'sample--skill');
  const invalidEvals = { ...portableEvals, skill_name: 'sample--skill' };
  const nameResult = run(fixture(invalidName, invalidEvals, 'sample--skill'));
  assert.equal(nameResult.status, 1);
  assert.match(nameResult.stderr, /invalid skill name/);
});

test('rejects an empty suite instead of reporting a false green', () => {
  const root = mkdtempSync(join(tmpdir(), 'validate-skills-empty-'));
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no skill directories containing SKILL\.md were found/);
  assert.match(result.stdout, /0 skills, 1 errors, 0 warnings/);
});

test('rejects compatibility text over the specification limit', () => {
  const incompatible = portableSkill.replace(
    'license: MIT',
    `license: MIT\ncompatibility: "${'x'.repeat(501)}"`,
  );
  const result = run(fixture(incompatible, portableEvals));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /compatibility must contain 1-500 characters/);
});

test('client terms are rejected unless the skill is allowlisted', () => {
  const naming = portableSkill.replace('Follow the fixture instructions.', 'Symlink it for Claude Code.');
  const root = fixture(naming, portableEvals);
  const strict = run(root);
  assert.equal(strict.status, 1);
  assert.match(strict.stderr, /client-specific instruction/);
  const allowed = run(root, '--allow-client-terms=sample-skill');
  assert.equal(allowed.status, 0, allowed.stderr);
});

test('a description pointer must name an existing skill', () => {
  const pointing = portableSkill.replace('Use for a small validation fixture.', 'Use for a fixture. Not for planning (plan-feature).');
  const result = run(fixture(pointing, portableEvals));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /points at missing skill plan-feature/);
});
