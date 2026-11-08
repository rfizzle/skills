// The flow model: checks, the text form and the viewer render. No dependencies.
// `ascii` is injected into the viewer and must stay self-contained.

export const CHANGES = new Set(['unchanged', 'added', 'changed', 'removed']);
export const MODES = new Set(['change', 'snapshot']);
export const LANE_KINDS = new Set(['person', 'browser', 'api', 'module', 'store', 'external']);
export const STEP_KINDS = new Set(['action', 'system', 'decision', 'async', 'external', 'end']);

export function check(model) {
  const errors = [];
  const warnings = [];
  const error = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);
  if (!model || typeof model !== 'object' || Array.isArray(model)) return { errors: ['the model must be a JSON object'], warnings };
  if (!model.title) error('title is required');
  if (!MODES.has(model.mode)) error(`mode must be one of ${[...MODES].join(', ')}`);
  if (!model.capability) warn('capability is missing: one paragraph of what the flow does end to end');
  if (!model.success) warn('success is missing: what is true when the flow worked');
  const lanes = Array.isArray(model.lanes) ? model.lanes : [];
  const steps = Array.isArray(model.steps) ? model.steps : [];
  const states = Array.isArray(model.states) ? model.states : [];
  const guarantees = Array.isArray(model.guarantees) ? model.guarantees : [];
  if (lanes.length === 0) error('lanes must hold at least one participant');
  if (steps.length === 0) error('steps must hold at least one step');

  const ids = new Map();
  const claim = (id, where) => {
    if (!id || typeof id !== 'string') { error(`${where}: id is required`); return; }
    if (ids.has(id)) error(`${where}: id ${id} is already used by ${ids.get(id)}`);
    ids.set(id, where);
  };
  const changeOf = (node, where) => {
    const change = node.change ?? 'unchanged';
    if (!CHANGES.has(change)) error(`${where}: change must be one of ${[...CHANGES].join(', ')}`);
    if (model.mode === 'snapshot' && change !== 'unchanged') warn(`${where}: change markers are ignored in snapshot mode`);
    if (node.was !== undefined && change !== 'changed') error(`${where}: "was" belongs only to a changed node`);
    if (change === 'changed' && node.was === undefined) warn(`${where}: changed without "was": say what changed`);
    return change;
  };

  lanes.forEach((lane, i) => {
    const where = `lanes[${i}]`;
    claim(lane.id, where);
    if (!lane.name) error(`${where}: name is required`);
    if (lane.kind !== undefined && !LANE_KINDS.has(lane.kind)) error(`${where}: kind must be one of ${[...LANE_KINDS].join(', ')}`);
    changeOf(lane, where);
  });
  const laneIds = new Set(lanes.map((l) => l.id));
  const stepIds = new Set(steps.map((s) => s.id));
  const incoming = new Map(steps.map((s) => [s.id, 0]));

  steps.forEach((step, i) => {
    const where = `steps[${i}]`;
    claim(step.id, where);
    if (!laneIds.has(step.lane)) error(`${where}: lane ${step.lane} does not exist`);
    if (!step.text) error(`${where}: text is required`);
    const kind = step.kind ?? 'system';
    if (!STEP_KINDS.has(kind)) error(`${where}: kind must be one of ${[...STEP_KINDS].join(', ')}`);
    const next = Array.isArray(step.next) ? step.next : [];
    if (kind === 'decision' && next.length < 2) error(`${where}: a decision needs at least two next entries, each with "when"`);
    if (kind !== 'end' && next.length === 0 && i < steps.length - 1) warn(`${where}: no next step; mark it kind "end" if the flow stops here`);
    next.forEach((n, j) => {
      const nw = `${where}.next[${j}]`;
      if (!n || !n.to) { error(`${nw}: "to" is required`); return; }
      if (!stepIds.has(n.to)) error(`${nw}: step ${n.to} does not exist`);
      else incoming.set(n.to, incoming.get(n.to) + 1);
      if (kind === 'decision' && !n.when) error(`${nw}: a decision's branch needs "when"`);
    });
    if (step.fails !== undefined) {
      if (!Array.isArray(step.fails)) error(`${where}: fails must be an array`);
      else step.fails.forEach((f, j) => {
        if (!f || !f.what) error(`${where}.fails[${j}]: "what" is required`);
        if (f && !f.recovery) error(`${where}.fails[${j}]: "recovery" is required: what happens next, and who sees what`);
      });
    } else if (kind === 'async' || kind === 'external') {
      warn(`${where}: an ${kind} step with no fails entry; what happens when it does not complete?`);
    }
    changeOf(step, where);
  });
  steps.forEach((s, i) => { if (i > 0 && incoming.get(s.id) === 0) warn(`steps[${i}]: nothing leads to ${s.id}`); });

  states.forEach((s, i) => {
    const where = `states[${i}]`;
    for (const k of ['entity', 'state', 'owner']) if (!s[k]) error(`${where}: ${k} is required`);
    if (s.owner && !laneIds.has(s.owner)) error(`${where}: owner ${s.owner} is not a lane`);
    if (s.next !== undefined && !Array.isArray(s.next)) error(`${where}: next must be an array of state names`);
    changeOf(s, where);
  });
  const stateNames = new Set(states.map((s) => `${s.entity}:${s.state}`));
  states.forEach((s, i) => (s.next || []).forEach((n) => { if (!stateNames.has(`${s.entity}:${n}`)) error(`states[${i}]: next state ${n} of ${s.entity} is not listed`); }));

  guarantees.forEach((g, i) => {
    const where = `guarantees[${i}]`;
    claim(g.id, where);
    if (!g.text) error(`${where}: text is required`);
    (g.steps || []).forEach((sid) => { if (!stepIds.has(sid)) error(`${where}: step ${sid} does not exist`); });
    if (!(g.steps || []).length) warn(`${where}: names no step that holds it`);
    changeOf(g, where);
  });

  if (model.mode === 'change') {
    const changed = [...lanes, ...steps, ...states, ...guarantees].some((n) => (n.change ?? 'unchanged') !== 'unchanged');
    if (!changed) error('mode is change but nothing is marked added, changed or removed');
  }
  return { errors, warnings };
}

export function ascii(model) {
  const mark = (n) => {
    if (model.mode !== 'change') return '';
    const c = n.change || 'unchanged';
    return c === 'added' ? '+ ' : c === 'changed' ? '~ ' : c === 'removed' ? '- ' : '';
  };
  const was = (n) => n.was && typeof n.was === 'object' ? `  was: ${Object.keys(n.was).map((k) => `${k} ${JSON.stringify(n.was[k])}`).join(', ')}` : '';
  const lanes = model.lanes || [], steps = model.steps || [];
  const laneName = (id) => { const l = lanes.find((x) => x.id === id); return l ? l.name : id; };
  const index = new Map(steps.map((s, i) => [s.id, i + 1]));
  const lines = [];
  if (model.mode === 'change') lines.push('+ added  ~ changed  - removed', '');
  lines.push(`[FLOW] ${model.title}${model.subtitle ? `  ${model.subtitle}` : ''}`);
  if (model.capability) lines.push(model.capability);
  if (model.success) lines.push(`Success: ${model.success}`);
  lines.push('', '[PARTICIPANTS]');
  lanes.forEach((l) => lines.push(`${mark(l)}${l.name}${l.kind ? ` (${l.kind})` : ''}${l.summary ? `  ${l.summary}` : ''}`));
  lines.push('', '[SEQUENCE]');
  steps.forEach((s, i) => {
    const kind = s.kind || 'system';
    const prefix = kind === 'decision' ? '? ' : kind === 'async' ? '~> ' : kind === 'external' ? '>> ' : kind === 'end' ? '[] ' : '';
    const links = [s.endpoint ? `endpoint: ${s.endpoint}` : '', s.screen ? `screen: ${s.screen}` : ''].filter(Boolean).join(', ');
    lines.push(`${String(i + 1).padStart(2)}. ${mark(s)}${prefix}[${laneName(s.lane)}] ${s.text}${links ? `  (${links})` : ''}${was(s)}`);
    const next = s.next || [];
    const children = [];
    next.forEach((n) => {
      const target = index.get(n.to);
      const explicit = kind === 'decision' || n.when || n.label || (target !== i + 2);
      if (explicit) children.push(`${n.when ? `${n.when} ` : ''}${n.label ? `[${n.label}] ` : ''}→ ${target !== undefined ? target : n.to}`);
    });
    (s.fails || []).forEach((f) => children.push(`fails: ${f.what} → ${f.recovery}`));
    children.forEach((c, j) => lines.push(`    ${j === children.length - 1 ? '└── ' : '├── '}${c}`));
  });
  const states = model.states || [];
  if (states.length) {
    lines.push('', '[STATES]');
    const entities = [...new Set(states.map((s) => s.entity))];
    entities.forEach((entity) => {
      lines.push(`${entity}`);
      const rows = states.filter((s) => s.entity === entity);
      rows.forEach((s, i) => lines.push(`${i === rows.length - 1 ? '└── ' : '├── '}${mark(s)}${s.state} → ${(s.next || []).join(' | ') || '(final)'}  owner: ${laneName(s.owner)}${s.stored ? `, in ${s.stored}` : ''}${was(s)}`));
    });
  }
  const guarantees = model.guarantees || [];
  if (guarantees.length) {
    lines.push('', '[GUARANTEES]');
    guarantees.forEach((g) => lines.push(`${mark(g)}${g.id}: ${g.text}${(g.steps || []).length ? `  (steps ${g.steps.map((x) => index.get(x) ?? x).join(', ')})` : ''}${was(g)}`));
  }
  return lines.join('\n');
}

const JSON_SLOT = /<script id="flow" type="application\/json">[\s\S]*?<\/script>/;
const LIB_SLOT = '/*__ASCII__*/';

export function render(model, template) {
  if (!JSON_SLOT.test(template)) throw new Error('template has no flow JSON slot');
  if (!template.includes(LIB_SLOT)) throw new Error('template has no ascii slot');
  const json = JSON.stringify(model).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  const title = String(model.title).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return template
    .replace(JSON_SLOT, () => `<script id="flow" type="application/json">${json}</script>`)
    .replace(LIB_SLOT, () => `const ascii = ${ascii.toString()};`)
    .replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`);
}
