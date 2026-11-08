import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ascii, check, render } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const example = () => JSON.parse(fs.readFileSync(path.join(here, 'example.json'), 'utf8'));
const template = fs.readFileSync(path.join(here, '..', 'assets', 'viewer.html'), 'utf8');

test('the example flow passes with no errors', () => {
  assert.deepEqual(check(example()).errors, []);
});

test('dangling steps, lanes and states are errors', () => {
  const model = example();
  model.steps[0].next = [{ to: 'nowhere' }];
  model.steps[1].lane = 'nobody';
  model.states[0].next = ['LOST'];
  model.guarantees[0].steps = ['ghost'];
  const { errors } = check(model);
  assert.ok(errors.some((e) => /step nowhere does not exist/.test(e)));
  assert.ok(errors.some((e) => /lane nobody does not exist/.test(e)));
  assert.ok(errors.some((e) => /next state LOST of order is not listed/.test(e)));
  assert.ok(errors.some((e) => /step ghost does not exist/.test(e)));
});

test('a decision needs two branches with "when"; a failing step without recovery is an error', () => {
  const model = example();
  model.steps[2].next = [{ to: 'markCancelled' }];
  model.steps[6].fails = [{ what: 'the lease expires' }];
  const { errors } = check(model);
  assert.ok(errors.some((e) => /a decision needs at least two next entries/.test(e)));
  assert.ok(errors.some((e) => /"recovery" is required/.test(e)));
});

test('an async step with no failure path is a warning, and change mode needs a change', () => {
  const model = example();
  delete model.steps[6].fails;
  assert.ok(check(model).warnings.some((w) => /async step with no fails entry/.test(w)));
  const quiet = example();
  [...quiet.lanes, ...quiet.steps, ...quiet.states, ...quiet.guarantees].forEach((n) => { delete n.change; delete n.was; });
  assert.ok(check(quiet).errors.some((e) => /nothing is marked/.test(e)));
});

test('the text form carries sequence, branches, failures, states and guarantees', () => {
  const text = ascii(example());
  assert.match(text, /\[SEQUENCE\]/);
  assert.match(text, / 3\. \+ \? \[orders\] Has the order shipped\?\n {4}├── yes → 4\n {4}└── no → 5/);
  assert.match(text, /fails: the lease expires mid-call → another worker claims it/);
  assert.match(text, /\[STATES\]\norder\n├── PENDING → PAID \| CANCELLED/);
  assert.match(text, /\+ G2: The provider refunds at most once/);
  assert.match(text, /\(screen: OrderPage\)/);
  assert.match(text, /\(endpoint: cancelOrder\)/);
});

test('render injects the model and the ascii function and the script parses', () => {
  const html = render(example(), template);
  assert.match(html, /<title>Order cancellation<\/title>/);
  assert.match(html, /<script id="flow" type="application\/json">\{"title":"Order cancellation"/);
  assert.match(html, /const ascii = function ascii\(model\)/);
  const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)[1];
  assert.doesNotThrow(() => new Function(script));
});
