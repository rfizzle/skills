import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { check, render, text } from './lib.mjs';
import { readFiles } from './check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, 'example', 'sketch.json');
const example = () => JSON.parse(fs.readFileSync(file, 'utf8'));
const files = () => readFiles(file, example());
const template = fs.readFileSync(path.join(here, '..', 'assets', 'viewer.html'), 'utf8');

test('the example round passes with no errors', () => {
  assert.deepEqual(check(example(), files()).errors, []);
});

test('a missing fragment, a lettered direction, two kept and lorem ipsum are errors', () => {
  const model = example();
  const f = files();
  model.directions[0].id = 'A';
  model.directions[1].status = 'kept';
  model.directions[2].status = 'kept';
  model.directions[2].file = 'Missing.html';
  f['Timeline.html'] = '<p>lorem ipsum dolor</p>';
  const { errors } = check(model, f);
  assert.ok(errors.some((e) => /must be a PascalCase name/.test(e)));
  assert.ok(errors.some((e) => /only one direction can be kept/.test(e)));
  assert.ok(errors.some((e) => /Missing.html was not found/.test(e)));
  assert.ok(errors.some((e) => /lorem ipsum/.test(e)));
});

test('a single live direction without a kept one, and a bad recommendation, are errors', () => {
  const model = example();
  model.directions[1].status = 'passed';
  model.directions[2].status = 'passed';
  model.recommendation = { direction: 'Nope' };
  const { errors } = check(model, files());
  assert.ok(errors.some((e) => /two or more live directions/.test(e)));
  assert.ok(errors.some((e) => /recommendation.direction must name a direction/.test(e)));
  assert.ok(errors.some((e) => /recommendation.reason is required/.test(e)));
});

test('a shared axis, a literal colour and a network load are warnings', () => {
  const model = example();
  const f = files();
  model.directions[1].axis = 'Information order';
  f['Quiet.html'] = '<div style="color:#ff0000"><img src="https://example.com/x.png"></div>';
  const { warnings } = check(model, f);
  assert.ok(warnings.some((w) => /shares the axis/.test(w)));
  assert.ok(warnings.some((w) => /literal colour/.test(w)));
  assert.ok(warnings.some((w) => /loads something from the network/.test(w)));
});

test('the hand-over text has the table, the recommendation and the question', () => {
  const t = text(example());
  assert.match(t, /^Round 1 on OrderPage asks: /);
  assert.match(t, /\| Banner \| information order \|/);
  assert.match(t, /Recommendation: Banner;/);
  assert.match(t, /Which is closest, and what is still off\?$/);
  const narrowed = example();
  narrowed.directions[2].status = 'passed';
  assert.match(text(narrowed), /Passed over: Quiet/);
  assert.doesNotMatch(text(narrowed), /\| Quiet \|/);
});

test('render inlines the fragments and the tokens and the script parses', () => {
  const html = render(example(), template, files());
  assert.match(html, /<title>Order page<\/title>/);
  assert.match(html, /<template data-direction="Banner">/);
  assert.match(html, /--color-primary: #2f5bd8/);
  assert.match(html, /"viewports":\[\{"name":"desktop"/);
  const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)[1];
  assert.doesNotThrow(() => new Function(script));
});
