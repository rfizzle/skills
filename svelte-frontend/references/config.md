# Configuration

## Contents

- `svelte.config.js`
- `vite.config.ts` (Tailwind, dev proxy, vitest projects)
- `tsconfig.json`
- `package.json` scripts
- eslint and prettier
- Storybook
- Fonts and images
- The bundle budget
- Embedding in the Go binary

Versions are pinned in `package.json` and `pnpm-lock.yaml` (`repo-tooling`);
excerpts show the shape, not every key.

## `svelte.config.js`

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  // Runes everywhere in the project; dependencies keep their own mode.
  vitePlugin: {
    dynamicCompileOptions: ({ filename }) =>
      filename.includes('node_modules') ? undefined : { runes: true },
  },
  kit: {
    adapter: adapter({ pages: 'build', assets: 'build', fallback: 'index.html', strict: true }),
  },
};

export default config;
```

```ts
// src/routes/+layout.ts
export const ssr = false;
```

`$lib` is SvelteKit's built-in alias for `src/lib`; add no other aliases.

## `vite.config.ts`

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const browser = {
  enabled: true,
  headless: true,
  provider: playwright(),
  instances: [{ browser: 'chromium' as const }],
};

// Every story runs once per theme; initialGlobals sets the theme global the
// preview decorator reads. The plugin loads preview.ts itself: no setup file.
const storyProject = (theme: 'light' | 'dark') => ({
  extends: true,
  plugins: [storybookTest({ configDir: '.storybook', initialGlobals: { theme } })],
  test: { name: `stories-${theme}`, browser },
});

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    // One origin in dev as in production: cookies and the CSRF header work unchanged.
    proxy: {
      // /api (OpenAPI) and every Connect service path (/acme.orders.v1.OrderService/...).
      '/api': `http://127.0.0.1:${process.env.APP_PORT ?? '8080'}`,
      '^/(?:[a-z][a-z0-9_]*\\.)+[A-Z][A-Za-z0-9]*/': `http://127.0.0.1:${process.env.APP_PORT ?? '8080'}`,
    },
  },
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['src/**/*.test.ts'], browser } },
      storyProject('light'),
      storyProject('dark'),
    ],
  },
});
```

`/api` is the OpenAPI prefix and the regex matches the root-mounted
Connect services (`go-http-server`); change them with the mux. The e2e run uses the real binary, not this proxy (`browser-e2e`).

## `tsconfig.json`

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "checkJs": true,
    "moduleResolution": "bundler"
  }
}
```

## `package.json` scripts

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "check:budget": "node scripts/check-bundle.mjs",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings",
    "lint": "prettier --check . && eslint --max-warnings 0 . && node scripts/check-imports.mjs && node scripts/check-cards.mjs",
    "format": "prettier --write .",
    "test": "vitest run",
    "storybook": "storybook dev --port 6006",
    "build-storybook": "storybook build"
  }
}
```

`make web-lint` runs `check` then `lint`; `make web-test` runs `test`;
`make web-budget` runs `build` then `check:budget`. The class lint from `design-tokens` joins
`lint` when the project has it.

## eslint and prettier

```js
// eslint.config.js
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default defineConfig(
  { ignores: ['build/', '.svelte-kit/', 'storybook-static/', 'src/lib/api/gen/'] },
  js.configs.recommended,
  ts.configs.strict,
  svelte.configs.recommended,
  prettier,
  svelte.configs.prettier,
  { languageOptions: { globals: globals.browser } },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: { projectService: true, extraFileExtensions: ['.svelte'], parser: ts.parser, svelteConfig },
    },
  },
  {
    rules: {
      'svelte/require-each-key': 'error',
      'svelte/no-at-html-tags': 'error',
    },
  },
);
```

The ignore for generated code follows wherever `frontend-api-client` puts it.

```json
// .prettierrc
{
  "plugins": ["prettier-plugin-svelte", "prettier-plugin-tailwindcss"],
  "overrides": [{ "files": "*.svelte", "options": { "parser": "svelte" } }],
  "tailwindStylesheet": "./src/app.css",
  "tailwindFunctions": ["cn"]
}
```

The Tailwind plugin is listed last; `tailwindStylesheet` points it at the
Tailwind 4 entry so custom token utilities sort correctly, and
`tailwindFunctions` sorts classes inside `cn(...)` too.

## Storybook

```ts
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/sveltekit';

const config: StorybookConfig = {
  stories: ['./*.mdx', '../src/**/*.stories.svelte'],
  addons: [
    '@storybook/addon-svelte-csf',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
    '@storybook/addon-docs',
  ],
  framework: '@storybook/sveltekit',
};

export default config;
```

```ts
// .storybook/preview.ts
import type { Preview } from '@storybook/sveltekit';
import '../src/app.css';

const preview: Preview = {
  parameters: {
    a11y: { test: 'error' }, // an axe violation fails the story test
    options: {
      storySort: {
        order: ['Docs', 'Foundations', 'Components', 'Compositions', 'Features', 'Layouts', 'Screens'],
      },
    },
  },
  globalTypes: {
    theme: { description: 'Theme', toolbar: { icon: 'mirror', items: ['light', 'dark'] } },
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    (Story, context) => {
      document.documentElement.classList.toggle('dark', context.globals.theme === 'dark');
      return Story();
    },
  ],
};

export default preview;
```

The vitest plugin applies `preview.ts` and the addons' annotations on its
own; a `vitest.setup.ts` calling `setProjectAnnotations` is the older
shape and the plugin reports it as redundant.

## Fonts and images

```css
/* src/app.css, before @theme */
@import '@fontsource-variable/inter';
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import inter from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
</script>

<svelte:head>
  <link rel="preload" href={inter} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>
```

- One variable family for text, at most one more for code; Latin subset
  unless the product is translated. Fontsource sets `font-display: swap`.
- Images: `width` and `height` on every `img` so nothing shifts;
  `loading="lazy"` and `decoding="async"` below the fold; logos and
  illustrations as SVG; photos through `@sveltejs/enhanced-img`
  (`<enhanced:img src="./hero.jpg" alt="..." />`), which emits sized AVIF
  and WebP.

## The bundle budget

`web/bundle-budget.json`, in kB gzip; set from the first build plus about
10%, lowered when a change shrinks the app (values illustrative):

```json
{ "totalJsKb": 160, "largestJsKb": 60, "totalCssKb": 15 }
```

`web/scripts/check-bundle.mjs`, run as `check:budget` after `build`:

```js
#!/usr/bin/env node
// Fails when the built app passes bundle-budget.json. Run from web/ after vite build.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve('build/_app/immutable');
const budget = JSON.parse(fs.readFileSync('bundle-budget.json', 'utf8'));

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(item) : [item];
  });
}

const kb = (bytes) => Math.round(bytes / 102.4) / 10;
const sizes = walk(root)
  .filter((file) => /\.(js|css)$/.test(file))
  .map((file) => ({ file: path.relative(root, file), gzip: zlib.gzipSync(fs.readFileSync(file)).length }));
const js = sizes.filter((s) => s.file.endsWith('.js'));
const largest = js.reduce((a, b) => (b.gzip > a.gzip ? b : a), { file: 'none', gzip: 0 });
const measured = {
  totalJsKb: kb(js.reduce((sum, s) => sum + s.gzip, 0)),
  largestJsKb: kb(largest.gzip),
  totalCssKb: kb(sizes.filter((s) => s.file.endsWith('.css')).reduce((sum, s) => sum + s.gzip, 0)),
};

let failed = false;
for (const [key, limit] of Object.entries(budget)) {
  const ok = measured[key] <= limit;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${key.padEnd(12)} ${String(measured[key]).padStart(7)} kB gzip (budget ${limit})`);
}
console.log(`largest chunk: ${largest.file}`);
if (failed) process.exit(1);
```

A failure names the largest chunk; look there first for a library that
should be imported by one route or loaded with `import()`.

## Embedding in the Go binary

```go
// web/embed.go
package web

import "embed"

// Build holds the SvelteKit output. "all:" keeps _app, which embed
// otherwise skips because its name starts with an underscore.
//
//go:embed all:build
var Build embed.FS
```

The package does not compile until the frontend has been built once, so
`make ci` runs `web-budget` (which builds it) before the Go targets that
compile it (`lint`, `test`). Serving it, with `index.html` as the fallback and long-lived
caching for `_app/immutable/`, is `go-http-server`'s.
