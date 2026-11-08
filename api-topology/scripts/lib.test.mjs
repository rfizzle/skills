import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ascii, check, isList, refId, render, typeRefs } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const example = () => JSON.parse(fs.readFileSync(path.join(here, 'example.json'), 'utf8'));
const template = fs.readFileSync(path.join(here, '..', 'assets', 'viewer.html'), 'utf8');

test('references resolve list syntax and type identifiers', () => {
  assert.equal(refId('Order'), 'Order');
  assert.equal(refId('Order[]'), 'Order');
  assert.equal(refId('Array<Order>'), 'Order');
  assert.equal(refId(null), null);
  assert.equal(isList('Order[]'), true);
  assert.equal(isList('Order'), false);
  assert.deepEqual(typeRefs('map<string, Money>'), ['Money']);
});

test('the example model passes with no errors', () => {
  const { errors } = check(example());
  assert.deepEqual(errors, []);
});

test('an unknown schema reference, a stray "was" and a silent change are errors', () => {
  const model = example();
  model.endpoints[0].response = 'Missing';
  model.schemas[2].was = { kind: 'request' };
  model.schemas[3].fields[0].change = 'added';
  const { errors } = check(model);
  assert.ok(errors.some((e) => /response Missing is not a schema/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /"was" belongs only to a changed node/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /a field marked added makes the schema changed/.test(e)), errors.join('\n'));
});

test('change mode with nothing marked is an error; snapshot mode warns about markers', () => {
  const model = example();
  model.mode = 'snapshot';
  const snapshot = check(model);
  assert.deepEqual(snapshot.errors, []);
  assert.ok(snapshot.warnings.some((w) => /ignored in snapshot mode/.test(w)));
  const quiet = example();
  const strip = (n) => { delete n.change; delete n.was; (n.fields || n.columns || []).forEach(strip); (n.values || []).forEach((v) => { if (typeof v === 'object') delete v.change; }); };
  [...quiet.endpoints, ...quiet.schemas, ...quiet.tables].forEach(strip);
  assert.ok(check(quiet).errors.some((e) => /nothing is marked/.test(e)));
});

test('duplicate ids and operations are errors', () => {
  const model = example();
  model.schemas[1].id = 'Order';
  model.endpoints[2].path = '/orders';
  const { errors } = check(model);
  assert.ok(errors.some((e) => /id Order is already used/.test(e)));
  assert.ok(errors.some((e) => /duplicate operation api GET \/orders/.test(e)));
});

test('the ascii tree has the three sections and the change markers', () => {
  const text = ascii(example());
  assert.match(text, /^\+ added {2}~ changed {2}- removed/);
  assert.match(text, /\[API ROUTING TREE\]/);
  assert.match(text, /\[DATA SCHEMAS\]/);
  assert.match(text, /\[STORAGE\]/);
  assert.match(text, /└── \+ POST {2}\(Req: CancelOrder, Res: Order\)/);
  assert.match(text, /~ Order \(resource\)/);
  assert.match(text, /\+ cancelled_at: timestamptz \(nullable\)/);
  const snapshot = example();
  snapshot.mode = 'snapshot';
  assert.doesNotMatch(ascii(snapshot), /^\+ added/);
});

test('connect style groups by service and names the rpc', () => {
  const model = {
    title: 'Orders', mode: 'snapshot', style: 'connect',
    roots: [{ id: 'r', name: 'acme.orders.v1', base: 'acme.orders.v1' }],
    endpoints: [
      { id: 'get', root: 'r', method: 'GET', path: '/acme.orders.v1.OrderService/GetOrder', rpc: 'OrderService.GetOrder', summary: 'Fetch', request: 'GetOrderRequest', response: 'GetOrderResponse' },
    ],
    schemas: [
      { id: 'GetOrderRequest', kind: 'request', fields: [{ name: 'id', type: 'string', required: true }] },
      { id: 'GetOrderResponse', kind: 'response', fields: [{ name: 'order', type: 'Order', required: true }] },
      { id: 'Order', kind: 'resource', fields: [{ name: 'id', type: 'string', required: true }] },
    ],
  };
  assert.deepEqual(check(model).errors, []);
  const text = ascii(model);
  assert.match(text, /└── \/acme\.orders\.v1\.OrderService\n {4}└── OrderService\.GetOrder {2}GET/);
});

test('render injects the model, the ascii function and the title', () => {
  const html = render(example(), template);
  assert.match(html, /<title>Orders API<\/title>/);
  assert.match(html, /<script id="topology" type="application\/json">\{"title":"Orders API"/);
  assert.match(html, /const ascii = function ascii\(model\)/);
  assert.doesNotMatch(html, /\/\*__ASCII__\*\//);
  const hostile = example();
  hostile.subtitle = '</script><script>alert(1)</script>';
  assert.doesNotMatch(render(hostile, template), /<\/script><script>alert/);
});

test('the viewer script parses as JavaScript once rendered', () => {
  const html = render(example(), template);
  const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)[1];
  assert.doesNotThrow(() => new Function(script));
});
