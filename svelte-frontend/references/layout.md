# Layout, screens and the import check

## The tree

```text
web/
├── package.json            scripts: check, lint, test, build (config.md)
├── svelte.config.js
├── vite.config.ts          Tailwind, dev proxy, vitest projects
├── bundle-budget.json
├── .storybook/             main.ts, preview.ts
├── scripts/
│   ├── check-imports.mjs   the import rule (below)
│   ├── check-cards.mjs     ui-component-contract's check
│   └── check-bundle.mjs    the bundle budget (config.md)
├── static/                 favicon, fonts
├── build/                  adapter-static output, embedded by Go; ignored by git
└── src/
    ├── app.css             the token layer (design-tokens)
    ├── app.html
    ├── lib/
    │   ├── utils/          cn, formatters; no components
    │   ├── api/            generated client and data layer (frontend-api-client)
    │   ├── components/     Components: Button/, Dialog/, Icon/, StateDot/
    │   ├── compositions/   Compositions: FilterBar/, DataTable/
    │   ├── features/       Features: ServerList/, toasts/
    │   └── layouts/        Layouts: DashboardLayout/
    └── routes/             Screens
        ├── +layout.ts      export const ssr = false
        ├── +layout.svelte  fills the layout, passes the current path down
        └── servers/
            ├── +page.svelte        thin: URL in, ServersScreen out
            ├── ServersScreen.svelte
            └── ServersScreen.stories.svelte   title: Screens/Servers
```

A unit directory, at any layer:

```text
lib/compositions/FilterBar/
├── FilterBar.svelte
├── FilterBar.card.md
├── FilterBar.stories.svelte          Compositions/FilterBar
├── FilterBar.flows.stories.svelte    Compositions/FilterBar/Flows
├── FilterBar.examples.stories.svelte Compositions/FilterBar/Examples (when needed)
├── FilterChip.svelte                 a part: Compositions/FilterBar/FilterChip
└── FilterBar.test.ts                 only for logic stories cannot express
```

A small project without features or layouts omits those directories; the
check needs no change.

## Screens

`+page.svelte` is wiring only, so the screen renders in Storybook without
SvelteKit's runtime:

```svelte
<!-- src/routes/servers/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import ServersScreen from './ServersScreen.svelte';

  function setFilter(state: string | null): void {
    const url = new URL(page.url);
    if (state) url.searchParams.set('state', state);
    else url.searchParams.delete('state');
    void goto(url, { keepFocus: true, noScroll: true });
  }
</script>

<ServersScreen stateFilter={page.url.searchParams.get('state')} onFilterChange={setFilter} />
```

`ServersScreen.svelte` puts features into the layout, carries
`data-page` and `data-loaded` on its root (`ui-patterns`), takes the URL
state as props and owns its queries through `getApi()` and `query`
(`frontend-api-client`), so its desktop and phone stories, states and
play tests sit in one `Screens/Servers` file (`storybook-layout`),
rendered against the fake API. A root `+layout.ts` `load` exists only for
what must be there before render, the session.

## The import check

`web/scripts/check-imports.mjs`, run by `pnpm run lint` and so by
`make web-lint`. It resolves `$lib/` and relative specifiers, so a
`../../features/...` path cannot slip past it, which is why it is a script
and not `no-restricted-imports`.

```js
#!/usr/bin/env node
// Fails when a file imports from a layer it may not use. Run from web/.
import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve('src');
// Layer of a path under src/, or null for files outside the layers.
const layers = ['utils', 'api', 'components', 'compositions', 'features', 'layouts'];
function layerOf(file) {
  const rel = path.relative(src, file).split(path.sep);
  if (rel[0] === 'routes') return 'routes';
  if (rel[0] === 'lib' && layers.includes(rel[1])) return rel[1];
  return null;
}

// Which layers each layer may import. routes may import every layer.
const allowed = {
  utils: ['utils'],
  api: ['utils', 'api'],
  components: ['utils', 'components'],
  compositions: ['utils', 'components', 'compositions'],
  features: ['utils', 'api', 'components', 'compositions', 'features'],
  layouts: ['utils', 'components', 'compositions', 'layouts'],
  routes: [...layers, 'routes'],
};
// Packages only some layers may import.
const packages = [
  { prefix: 'bits-ui', only: ['components'], why: 'wrap the primitive in lib/components' },
  { prefix: '$app/', only: ['routes'], why: 'URL and navigation belong to the screen' },
  { prefix: '@connectrpc/', only: ['api'], why: 'the client lives in lib/api; screens use getApi()' },
  { prefix: 'openapi-fetch', only: ['api'], why: 'the client lives in lib/api; screens use getApi()' },
];

const importPattern = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g;
const failures = [];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(item);
    return /\.(svelte|ts|js)$/.test(entry.name) ? [item] : [];
  });
}

for (const file of walk(src)) {
  const from = layerOf(file);
  if (!from) continue;
  for (const [, spec] of fs.readFileSync(file, 'utf8').matchAll(importPattern)) {
    const pkg = packages.find((p) => spec.startsWith(p.prefix));
    if (pkg && !pkg.only.includes(from)) {
      failures.push(`${path.relative('.', file)}: imports ${spec} (${pkg.why})`);
      continue;
    }
    let target = null;
    if (spec.startsWith('$lib/')) target = path.join(src, 'lib', spec.slice(5));
    else if (spec.startsWith('.')) target = path.resolve(path.dirname(file), spec);
    if (!target) continue;
    const to = layerOf(target);
    if (to && !allowed[from].includes(to)) {
      failures.push(`${path.relative('.', file)}: ${from} imports ${to} (${spec})`);
    }
  }
}

for (const line of failures) console.error(line);
if (failures.length > 0) {
  console.error(`check-imports: ${failures.length} import(s) cross a layer boundary`);
  process.exit(1);
}
```

Its output names the file, the two layers and the specifier. Fix by moving
the code down a layer, passing it in as a prop or snippet, or moving the
import up to the screen; never by adding a layer to `allowed` without a
decision record.
