// The sketch model: checks, the hand-over text and the viewer render. No dependencies.

export const STATUSES = new Set(['candidate', 'kept', 'passed']);
export const LAYERS = new Set(['component', 'composition', 'feature', 'layout', 'screen']);
export const DEFAULT_VIEWPORTS = [{ name: 'desktop', width: 1280 }, { name: 'tablet', width: 820 }, { name: 'phone', width: 390 }];
export const DEFAULT_STATES = ['filled', 'loading', 'empty', 'error', 'partial'];

// `files` maps a direction's file (and the tokens file) to its contents; the
// CLI reads them from disk, tests pass them in.
export function check(model, files = {}) {
  const errors = [];
  const warnings = [];
  const error = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);
  if (!model || typeof model !== 'object' || Array.isArray(model)) return { errors: ['the model must be a JSON object'], warnings };
  if (!model.title) error('title is required');
  if (!model.unit) error('unit is required: the code name of the unit being sketched');
  if (model.layer !== undefined && !LAYERS.has(model.layer)) error(`layer must be one of ${[...LAYERS].join(', ')}`);
  if (!model.question) error('question is required: the one thing this round decides');
  if (model.round !== undefined && !(Number.isInteger(model.round) && model.round >= 1)) error('round must be a positive integer');
  if (!model.tokens) warn('tokens is missing: the directions will not use the project\'s tokens');
  else if (files[model.tokens] === undefined) error(`tokens file ${model.tokens} was not found`);
  const directions = Array.isArray(model.directions) ? model.directions : [];
  if (directions.length === 0) error('directions must hold at least one direction');
  const ids = new Set();
  const axes = new Map();
  let kept = 0;
  directions.forEach((d, i) => {
    const where = `directions[${i}]`;
    if (!d.id) error(`${where}: id is required`);
    else if (!/^[A-Z][a-z][A-Za-z0-9]*$/.test(d.id)) error(`${where}: id ${d.id} must be a PascalCase name that describes the direction, never a letter or a number`);
    if (ids.has(d.id)) error(`${where}: duplicate id ${d.id}`);
    ids.add(d.id);
    for (const k of ['axis', 'changes', 'wins', 'costs']) if (!d[k]) error(`${where}: ${k} is required`);
    if (!d.file) error(`${where}: file is required`);
    else if (files[d.file] === undefined) error(`${where}: file ${d.file} was not found`);
    else {
      const html = files[d.file];
      if (/<(html|head|body)\b/i.test(html)) error(`${where}: ${d.file} is a fragment; no html, head or body tags`);
      if (/<script\b/i.test(html)) warn(`${where}: ${d.file} has a script; a direction is static, interactions are CSS-only or noted`);
      if (/(src|href)=["']https?:/i.test(html)) warn(`${where}: ${d.file} loads something from the network; inline it so the page stands alone`);
      if (/lorem ipsum/i.test(html)) error(`${where}: ${d.file} has lorem ipsum; use the product's real copy`);
      if (/#[0-9a-f]{3,8}\b/i.test(html) && model.tokens) warn(`${where}: ${d.file} has a literal colour; use the tokens`);
    }
    const status = d.status ?? 'candidate';
    if (!STATUSES.has(status)) error(`${where}: status must be one of ${[...STATUSES].join(', ')}`);
    if (status === 'kept') kept++;
    if (d.from !== undefined && !directions.some((o) => o.id === d.from)) error(`${where}: from ${d.from} is not a direction`);
    if (status !== 'passed' && d.axis) {
      const key = String(d.axis).toLowerCase().trim();
      if (axes.has(key)) warn(`${where}: shares the axis "${d.axis}" with ${axes.get(key)}; two directions on one axis are usually one direction`);
      axes.set(key, d.id);
    }
  });
  const live = directions.filter((d) => (d.status ?? 'candidate') !== 'passed');
  if (kept > 1) error('only one direction can be kept');
  if (kept === 0 && live.length < 2) error('a round needs two or more live directions, or one kept');
  if (kept === 0 && live.length > 5) error('more than five live directions; a round spreads wide with three or four');
  if (model.recommendation) {
    if (!model.recommendation.direction || !ids.has(model.recommendation.direction)) error('recommendation.direction must name a direction');
    if (!model.recommendation.reason) error('recommendation.reason is required: rooted in how the product is used');
  } else if (kept === 0) warn('no recommendation: the hand-over always carries one');
  (model.decisions || []).forEach((d, i) => {
    for (const k of ['date', 'kept', 'why']) if (!d[k]) error(`decisions[${i}]: ${k} is required`);
  });
  (model.viewports || []).forEach((v, i) => { if (!v.name || !(v.width > 0)) error(`viewports[${i}]: name and width are required`); });
  return { errors, warnings };
}

export function text(model) {
  const directions = (model.directions || []).filter((d) => (d.status ?? 'candidate') !== 'passed');
  const lines = [];
  lines.push(`Round ${model.round ?? 1} on ${model.unit} asks: ${model.question}`);
  lines.push('');
  lines.push('| Direction | Axis | What it changes | When it wins | What it costs |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const d of directions) {
    const name = (d.status === 'kept' ? `${d.id} (kept)` : d.id) + (d.from ? ` (from ${d.from})` : '');
    lines.push(`| ${name} | ${d.axis} | ${d.changes} | ${d.wins} | ${d.costs} |`);
  }
  if (model.recommendation) lines.push('', `Recommendation: ${model.recommendation.direction}; ${model.recommendation.reason}`);
  const passed = (model.directions || []).filter((d) => d.status === 'passed');
  if (passed.length) lines.push('', `Passed over: ${passed.map((d) => d.id).join(', ')} (kept on disk, restorable).`);
  if ((model.decisions || []).length) {
    lines.push('', 'Decisions:');
    for (const d of model.decisions) lines.push(`- ${d.date}: kept ${d.kept}${d.over ? ` over ${d.over}` : ''}; ${d.why}`);
  }
  lines.push('', 'Which is closest, and what is still off?');
  return lines.join('\n');
}

const JSON_SLOT = /<script id="sketch" type="application\/json">[\s\S]*?<\/script>/;
const FRAGMENT_SLOT = '<!--__FRAGMENTS__-->';
const TOKENS_SLOT = '/*__TOKENS__*/';

export function render(model, template, files = {}) {
  if (!JSON_SLOT.test(template)) throw new Error('template has no sketch JSON slot');
  if (!template.includes(FRAGMENT_SLOT) || !template.includes(TOKENS_SLOT)) throw new Error('template has no fragment or tokens slot');
  const safe = (s) => String(s).replace(/<\/(script|style|template)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
  const json = JSON.stringify({ ...model, viewports: model.viewports || DEFAULT_VIEWPORTS, states: model.states || DEFAULT_STATES });
  const fragments = (model.directions || []).map((d) => `<template data-direction="${d.id}">${String(files[d.file] ?? '').replace(/<\/template/gi, '<\\/template')}</template>`).join('\n');
  const tokens = model.tokens ? String(files[model.tokens] ?? '') : '';
  const title = String(model.title).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return template
    .replace(JSON_SLOT, () => `<script id="sketch" type="application/json">${safe(json)}</script>`)
    .replace(FRAGMENT_SLOT, () => fragments)
    .replace(TOKENS_SLOT, () => tokens.replace(/<\/(script|style)/gi, '<\\/$1'))
    .replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`);
}
