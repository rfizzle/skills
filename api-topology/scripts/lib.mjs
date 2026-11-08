// The topology model: checks, the ASCII tree and the viewer render.
// No dependencies; the same `ascii` function is injected into the viewer, so
// it must stay self-contained (no imports, no closures over module state).

export const CHANGES = new Set(['unchanged', 'added', 'changed', 'removed']);
export const MODES = new Set(['change', 'snapshot']);
export const STYLES = new Set(['rest', 'connect']);
export const KINDS = new Set(['resource', 'request', 'response', 'enum', 'value']);

// "Order", "Order[]", "Array<Order>" all refer to the schema Order.
export function refId(ref) {
  if (ref === null || ref === undefined || ref === '') return null;
  const text = String(ref).trim();
  const array = text.match(/^(?:Array<(.+)>|(.+)\[\])$/);
  return (array ? (array[1] ?? array[2]) : text).trim();
}

export function isList(ref) {
  return /^(?:Array<.+>|.+\[\])$/.test(String(ref ?? '').trim());
}

// PascalCase identifiers inside a field type: "map<string, Money>" -> ["Money"].
export function typeRefs(type) {
  return [...String(type ?? '').matchAll(/\b([A-Z][A-Za-z0-9]*)\b/g)].map((m) => m[1]);
}

export function check(model) {
  const errors = [];
  const warnings = [];
  const error = (message) => errors.push(message);
  const warn = (message) => warnings.push(message);
  if (!model || typeof model !== 'object' || Array.isArray(model)) {
    return { errors: ['the model must be a JSON object'], warnings };
  }
  if (!model.title) error('title is required');
  if (!MODES.has(model.mode)) error(`mode must be one of ${[...MODES].join(', ')}`);
  if (model.style !== undefined && !STYLES.has(model.style)) error(`style must be one of ${[...STYLES].join(', ')}`);
  const roots = Array.isArray(model.roots) ? model.roots : [];
  const endpoints = Array.isArray(model.endpoints) ? model.endpoints : [];
  const schemas = Array.isArray(model.schemas) ? model.schemas : [];
  const tables = Array.isArray(model.tables) ? model.tables : [];
  if (roots.length === 0) error('roots must hold at least one root');

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
    if (change === 'changed' && node.was === undefined && !node.fields && !node.columns && !node.values) {
      warn(`${where}: changed without "was": say what changed`);
    }
    if (node.breaking && change !== 'changed' && change !== 'removed') error(`${where}: breaking needs change: changed or removed`);
    return change;
  };

  roots.forEach((root, i) => {
    const where = `roots[${i}]`;
    claim(root.id, where);
    if (!root.name) error(`${where}: name is required`);
    if (!root.base) error(`${where}: base is required`);
    changeOf(root, where);
  });
  const schemaIds = new Set(schemas.map((s) => s.id));
  const rootIds = new Set(roots.map((r) => r.id));
  const used = new Set();

  const seenOps = new Set();
  endpoints.forEach((endpoint, i) => {
    const where = `endpoints[${i}]`;
    claim(endpoint.id, where);
    if (!rootIds.has(endpoint.root)) error(`${where}: root ${endpoint.root} does not exist`);
    if (!endpoint.method) error(`${where}: method is required`);
    if (!endpoint.path || !String(endpoint.path).startsWith('/')) error(`${where}: path is required and starts with /`);
    if (!endpoint.summary) warn(`${where}: no summary`);
    const op = `${endpoint.root} ${endpoint.method} ${endpoint.path}`;
    if (seenOps.has(op)) error(`${where}: duplicate operation ${op}`);
    seenOps.add(op);
    for (const side of ['request', 'response']) {
      const id = refId(endpoint[side]);
      if (id === null) continue;
      if (!schemaIds.has(id)) error(`${where}: ${side} ${endpoint[side]} is not a schema`);
      else used.add(id);
    }
    if (endpoint.errors !== undefined) {
      if (!Array.isArray(endpoint.errors)) error(`${where}: errors must be an array`);
      else endpoint.errors.forEach((e, j) => { if (!e || !e.code) error(`${where}.errors[${j}]: code is required`); });
    }
    changeOf(endpoint, where);
  });

  schemas.forEach((schema, i) => {
    const where = `schemas[${i}]`;
    claim(schema.id, where);
    if (schema.kind !== undefined && !KINDS.has(schema.kind)) error(`${where}: kind must be one of ${[...KINDS].join(', ')}`);
    const change = changeOf(schema, where);
    const fields = Array.isArray(schema.fields) ? schema.fields : [];
    const values = Array.isArray(schema.values) ? schema.values : [];
    if (schema.kind === 'enum' && values.length === 0 && !(model.mode === 'change' && change === 'unchanged')) error(`${where}: an enum needs values`);
    const context = model.mode === 'change' && change === 'unchanged';
    if (schema.kind !== 'enum' && fields.length === 0 && values.length === 0 && !context) warn(`${where}: no fields`);
    if (context && (fields.length || values.length)) warn(`${where}: unchanged on a change map; drop its fields, it is context`);
    const names = new Set();
    fields.forEach((field, j) => {
      const fw = `${where}.fields[${j}]`;
      if (!field.name) error(`${fw}: name is required`);
      if (!field.type) error(`${fw}: type is required`);
      if (names.has(field.name)) error(`${fw}: duplicate field ${field.name}`);
      names.add(field.name);
      const fc = changeOf(field, fw);
      if (change === 'unchanged' && fc !== 'unchanged') error(`${fw}: a field marked ${fc} makes the schema changed`);
      if (change === 'added' && fc !== 'unchanged' && fc !== 'added') error(`${fw}: a field of an added schema is added or unmarked`);
      for (const ref of typeRefs(field.type)) {
        if (schemaIds.has(ref)) used.add(ref);
        else if (!/^(Array|Map|Set|String|Int|Int32|Int64|Float|Bool|Boolean|Number|Timestamp|Duration|Date|UUID|Bytes|Any)$/.test(ref)) {
          warn(`${fw}: type ${ref} is not a schema; lowercase scalars (string, integer, timestamp) or a schema id`);
        }
      }
    });
    values.forEach((value, j) => {
      const node = typeof value === 'string' ? { name: value } : value;
      if (!node || !node.name) error(`${where}.values[${j}]: name is required`);
      else changeOf(node, `${where}.values[${j}]`);
    });
  });

  tables.forEach((table, i) => {
    const where = `tables[${i}]`;
    claim(table.id, where);
    const columns = Array.isArray(table.columns) ? table.columns : [];
    if (columns.length === 0) error(`${where}: columns are required`);
    const change = changeOf(table, where);
    for (const backs of table.backs ?? []) {
      if (!schemaIds.has(backs)) error(`${where}: backs ${backs} is not a schema`);
    }
    const names = new Set();
    columns.forEach((column, j) => {
      const cw = `${where}.columns[${j}]`;
      if (!column.name) error(`${cw}: name is required`);
      if (!column.type) error(`${cw}: type is required`);
      if (names.has(column.name)) error(`${cw}: duplicate column ${column.name}`);
      names.add(column.name);
      const cc = changeOf(column, cw);
      if (change === 'unchanged' && cc !== 'unchanged') error(`${cw}: a column marked ${cc} makes the table changed`);
    });
  });

  for (const schema of schemas) {
    if (!used.has(schema.id) && schema.kind !== 'resource') warn(`schemas: ${schema.id} is used by no endpoint or schema`);
  }
  if (model.mode === 'change') {
    const changed = [...roots, ...endpoints, ...schemas, ...tables].some((n) => (n.change ?? 'unchanged') !== 'unchanged');
    if (!changed) error('mode is change but nothing is marked added, changed or removed');
  }
  return { errors, warnings };
}

// The tree shown in the conversation. Self-contained: injected into the viewer.
export function ascii(model) {
  const mark = (node) => {
    if (model.mode !== 'change') return '';
    const change = node.change || 'unchanged';
    return change === 'added' ? '+ ' : change === 'changed' ? '~ ' : change === 'removed' ? '- ' : '';
  };
  const was = (node) => {
    if (!node.was || typeof node.was !== 'object') return '';
    const parts = Object.keys(node.was).map((k) => `${k} ${JSON.stringify(node.was[k])}`);
    return parts.length ? `  was: ${parts.join(', ')}` : '';
  };
  const tree = (items, line) => items.map((item, i) => {
    const last = i === items.length - 1;
    const [head, children] = line(item);
    const out = [`${last ? '└── ' : '├── '}${head}`];
    const pad = last ? '    ' : '│   ';
    for (const child of children || []) out.push(pad + child);
    return out;
  }).flat();
  const io = (e) => {
    const parts = [];
    if (e.request) parts.push(`Req: ${e.request}`);
    if (e.response) parts.push(`Res: ${e.response}`);
    return parts.length ? `(${parts.join(', ')})` : '(no body)';
  };
  const lines = [];
  if (model.mode === 'change') lines.push('+ added  ~ changed  - removed', '');
  lines.push('[API ROUTING TREE]');
  const roots = model.roots || [];
  const endpoints = model.endpoints || [];
  roots.forEach((root, ri) => {
    if (ri) lines.push('');
    lines.push(`${mark(root)}${root.name}  ${root.base}`);
    const mine = endpoints.filter((e) => e.root === root.id);
    const groups = new Map();
    for (const e of mine) {
      const key = model.style === 'connect' ? e.path.slice(0, e.path.lastIndexOf('/')) || e.path : e.path;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }
    const sortedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
    lines.push(...tree(sortedGroups, ([path, ops]) => [path, tree(ops, (e) => {
      const name = model.style === 'connect' ? `${e.rpc || e.path.slice(e.path.lastIndexOf('/') + 1)}  ${e.method}` : e.method.padEnd(4);
      const flags = [e.breaking ? 'BREAKING' : '', e.stream ? 'stream' : ''].filter(Boolean).join(' ');
      return [`${mark(e)}${name}  ${io(e)}${e.summary ? `  ${e.summary}` : ''}${flags ? `  [${flags}]` : ''}${was(e)}`, []];
    })]));
  });
  const schemas = model.schemas || [];
  if (schemas.length) {
    lines.push('', '[DATA SCHEMAS]');
    schemas.forEach((s, i) => {
      if (i) lines.push('');
      lines.push(`${mark(s)}${s.id}${s.kind ? ` (${s.kind})` : ''}${s.breaking ? '  [BREAKING]' : ''}${was(s)}`);
      if (s.kind === 'enum' || (s.values && s.values.length)) {
        lines.push(...tree((s.values || []).map((v) => (typeof v === 'string' ? { name: v } : v)), (v) => [`${mark(v)}${v.name}`, []]));
      } else {
        lines.push(...tree(s.fields || [], (f) => {
          const flag = f.required ? 'required' : f.default !== undefined ? `default: ${JSON.stringify(f.default)}` : 'optional';
          return [`${mark(f)}${f.name}: ${f.type} (${flag})${f.breaking ? '  [BREAKING]' : ''}${was(f)}`, []];
        }));
      }
    });
  }
  const tables = model.tables || [];
  if (tables.length) {
    lines.push('', '[STORAGE]');
    tables.forEach((t, i) => {
      if (i) lines.push('');
      const meta = [t.migration ? `migration ${t.migration}` : '', t.backs && t.backs.length ? `backs ${t.backs.join(', ')}` : ''].filter(Boolean).join('  ');
      lines.push(`${mark(t)}${t.name || t.id}${meta ? `  ${meta}` : ''}${was(t)}`);
      lines.push(...tree(t.columns || [], (c) => {
        const flags = [c.key, c.nullable ? 'nullable' : 'not null', c.default !== undefined ? `default ${c.default}` : ''].filter(Boolean).join(', ');
        return [`${mark(c)}${c.name}: ${c.type} (${flags})${was(c)}`, []];
      }));
    });
  }
  return lines.join('\n');
}

const JSON_SLOT = /<script id="topology" type="application\/json">[\s\S]*?<\/script>/;
const LIB_SLOT = '/*__ASCII__*/';

export function render(model, template) {
  if (!JSON_SLOT.test(template)) throw new Error('template has no topology JSON slot');
  if (!template.includes(LIB_SLOT)) throw new Error('template has no ascii slot');
  const json = JSON.stringify(model).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  const title = String(model.title).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return template
    .replace(JSON_SLOT, () => `<script id="topology" type="application/json">${json}</script>`)
    .replace(LIB_SLOT, () => `const ascii = ${ascii.toString()};`)
    .replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`);
}
