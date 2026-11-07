# Playwright setup

Names (`orders`, `acme.orders.v1.OrderService`, the sign-in RPC) are
examples. Connect paths sit at the origin root; for an OpenAPI API they
are under `/api/v1/`.

## Contents

- [Package](#package)
- [Make target](#make-target)
- [playwright.config.ts](#playwrightconfigts)
- [Page markers](#page-markers)
- [Setup project](#setup-project)
- [Fixtures](#fixtures)
- [Seed helper](#seed-helper)
- [Specs](#specs)

## Package

`e2e/package.json`:

```json
{
  "private": true,
  "type": "module",
  "packageManager": "pnpm@<x.y.z>",
  "engines": { "node": ">=<major>.<minor>" },
  "scripts": { "check": "tsc --noEmit" },
  "devDependencies": {
    "@playwright/test": "<x.y.z>",
    "typescript": "<x.y.z>"
  }
}
```

- `make tools` runs `pnpm --dir e2e install --frozen-lockfile` and
  `pnpm --dir e2e exec playwright install chromium`; `make web-lint` runs
  `pnpm --dir e2e run check` after the web package's checks.
- `@playwright/test` here and `playwright` in `web/` (vitest browser mode)
  are the same version; Renovate groups them.
- `.gitignore`: `e2e/.auth/`, `e2e/test-results/`, `e2e/playwright-report/`.
- `tsconfig.json` is strict and includes `../web/src/lib/api/gen` for
  type-only imports of the generated API types.

## Make target

```make
COMPOSE     ?= docker compose
E2E_PROJECT ?= $(notdir $(CURDIR))-e2e
E2E_ARGS    ?= --project=chromium

e2e: ## Browser tests against the built image and a fresh database
	@$(COMPOSE) -p $(E2E_PROJECT) --profile e2e up --build --detach --wait
	@set -a; . ./.env.e2e; set +a; \
		pnpm --dir e2e exec playwright test $(E2E_ARGS); status=$$?; \
		$(COMPOSE) -p $(E2E_PROJECT) --profile e2e down --volumes; exit $$status
```

- `.env.e2e` is exported into the Playwright process too, so the setup
  project reads the same bootstrap administrator the app was started with.

- Its own Compose project name gives it its own volumes, so
  `down --volumes` drops the e2e database and never the dev one.
- `--wait` waits for the app's healthcheck (`/healthz`); the setup project
  then waits for `/readyz`, which also covers migrations.
- Debugging locally: `make e2e E2E_ARGS="--project=chromium --trace on --headed tests/orders.spec.ts"`.

## playwright.config.ts

```ts
import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);
const chrome = { ...devices['Desktop Chrome'] };

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined, // one tenant per worker; setup reads the resolved count
  timeout: 30_000,
  expect: { timeout: 5_000 },
  globalTimeout: CI ? 15 * 60_000 : undefined,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'on-failure' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    locale: 'en-GB',
    timezoneId: 'UTC',
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    { name: 'chromium', use: chrome, dependencies: ['setup'], grepInvert: /@quarantine/ },
    { name: 'quarantine', use: chrome, dependencies: ['setup'], grep: /@quarantine/ },
  ],
});
```

The quarantine filter sits on the projects, not the command line: a CLI
`--grep` would also filter out the setup project's tests.

## Page markers

`e2e/support/pages.ts`:

```ts
import { expect, type Page } from '@playwright/test';

/** The view's root sets data-page and data-loaded (ui-patterns). */
export async function expectLoaded(page: Page, slug: string): Promise<void> {
  await expect(page.locator(`[data-page="${slug}"][data-loaded="true"]`)).toBeVisible();
}

export function unique(label: string): string {
  return `${label} ${crypto.randomUUID().slice(0, 8)}`;
}
```

## Setup project

`e2e/tests/auth.setup.ts`. The first administrator comes from the binary's
bootstrap settings in `.env.e2e` (`APP_BOOTSTRAP_ADMIN_EMAIL` and
`APP_BOOTSTRAP_ADMIN_PASSWORD`, created on first start when no account
exists; `go-auth`); every other account is created here through the API.

```ts
import { type APIRequestContext, expect, request, test as setup } from '@playwright/test';
import { type Account, admin, workerAccount } from '../support/accounts';

setup('service is ready and each worker has an account', async ({ baseURL }) => {
  const api = await request.newContext({ baseURL });
  await expect
    .poll(async () => (await api.get('/readyz')).status(), { timeout: 60_000, intervals: [500] })
    .toBe(200);

  await signIn(api, admin);
  const workers = setup.info().config.workers;
  for (let n = 0; n < workers; n++) {
    const account = workerAccount(n);
    await post(api, 'acme.tenants.v1.TenantService/CreateTenant', { name: `Tenant ${n}`, owner: account });

    const ctx = await request.newContext({ baseURL });
    await signIn(ctx, account);
    await ctx.storageState({ path: `.auth/worker-${n}.json` });
    await ctx.dispose();
  }
  await api.dispose();
});

async function signIn(ctx: APIRequestContext, a: Account) {
  await post(ctx, 'acme.auth.v1.AuthService/SignIn', a);
}

async function post(ctx: APIRequestContext, method: string, body: unknown) {
  // Connect services mount at the origin root (connect-rpc).
  const res = await ctx.post(`/${method}`, { data: body, headers: { 'Connect-Protocol-Version': '1' } });
  expect(res.ok(), `${method}: ${res.status()} ${await res.text()}`).toBe(true);
}
```

`e2e/support/accounts.ts` holds the account helpers, because a spec may
not import another test file:

```ts
export type Account = { email: string; password: string };

// From .env.e2e, which make e2e exports; the app bootstrapped this account.
export const admin: Account = {
  email: process.env.APP_BOOTSTRAP_ADMIN_EMAIL ?? 'admin@example.test',
  password: process.env.APP_BOOTSTRAP_ADMIN_PASSWORD ?? '',
};

export const workerAccount = (n: number): Account => ({
  email: `worker-${n}@example.test`,
  password: `e2e-worker-${n}-passphrase`,
});
```

For an OpenAPI API the calls are `POST /api/v1/sessions` and the like, with
the custom CSRF header `go-auth` requires instead of
`Connect-Protocol-Version`. An account with TOTP enrolled is created
without it, except in the one test that covers TOTP.

## Fixtures

`e2e/fixtures.ts`; specs import `test` and `expect` from here only.

```ts
import { test as base, expect } from '@playwright/test';
import { expectLoaded } from './support/pages';
import { Seed } from './support/seed';

type Fixtures = {
  seed: Seed;
  open: (path: string, slug: string) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  // The worker's own account, signed in once by the setup project.
  storageState: async ({}, use, testInfo) => {
    await use(`.auth/worker-${testInfo.parallelIndex}.json`);
  },
  // page.request shares the page's cookies, so seeding acts as the same user.
  seed: async ({ page }, use) => {
    await use(new Seed(page.request));
  },
  open: async ({ page }, use) => {
    await use(async (path, slug) => {
      await page.goto(path);
      await expectLoaded(page, slug);
    });
  },
});

export { expect };
```

## Seed helper

`e2e/support/seed.ts`. Bodies are typed with the JSON types `protoc-gen-es`
emits with `json_types=true` (`frontend-api-client`); for OpenAPI, with
`components['schemas'][...]` from the generated schema.

```ts
import type { APIRequestContext } from '@playwright/test';
import type {
  CreateOrderRequestJson,
  CreateOrderResponseJson,
} from '../../web/src/lib/api/gen/acme/orders/v1/orders_pb';
import { unique } from './pages';

export class Seed {
  constructor(private readonly api: APIRequestContext) {}

  order(input: Partial<CreateOrderRequestJson> = {}): Promise<CreateOrderResponseJson> {
    return this.call('acme.orders.v1.OrderService/CreateOrder', {
      customerName: unique('Ana Pereira'),
      idempotencyKey: crypto.randomUUID(),
      ...input,
    });
  }

  private async call<T>(method: string, body: unknown): Promise<T> {
    const res = await this.api.post(`/${method}`, {
      data: body,
      headers: { 'Connect-Protocol-Version': '1' },
    });
    if (!res.ok()) throw new Error(`seed ${method}: ${res.status()} ${await res.text()}`);
    return (await res.json()) as T;
  }
}
```

A seed method fails loudly; a test never continues on half-seeded data.

## Specs

`e2e/tests/orders.spec.ts`: the golden path and its deep link.

```ts
import { expect, test } from '../fixtures';
import { expectLoaded, unique } from '../support/pages';

test('creates an order and sees it on its page', async ({ page, open }) => {
  const customer = unique('Ana Pereira');
  await open('/orders', 'orders');

  await page.getByRole('link', { name: 'Create order' }).click();
  await expectLoaded(page, 'order-new');
  await page.getByLabel('Customer name').fill(customer);
  await page.getByRole('button', { name: 'Create order' }).click();

  await expect(page).toHaveURL(/\/orders\/[^/]+$/);
  await expectLoaded(page, 'order');
  await expect(page.getByRole('heading', { name: customer })).toBeVisible();
});

test('opens an order from a deep link', async ({ page, seed, open }) => {
  const { order } = await seed.order();
  await open(`/orders/${order?.id}`, 'order');
  await expect(page.getByRole('heading', { name: order?.customerName })).toBeVisible();
});
```

`e2e/tests/auth.spec.ts`: sign-in with return path, from no session.

```ts
import { expect, test } from '../fixtures';
import { expectLoaded } from '../support/pages';
import { workerAccount } from '../support/accounts';

test.describe('sign in', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('returns to the page that asked for it', async ({ page }, testInfo) => {
    const account = workerAccount(testInfo.parallelIndex);
    await page.goto('/orders?status=open');
    await expect(page).toHaveURL(/\/sign-in\?return=/);
    await expectLoaded(page, 'sign-in');

    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/orders\?status=open$/);
    await expectLoaded(page, 'orders');
  });
});
```

Quarantined test, until fixed:

```ts
test(
  'filters by status',
  { tag: '@quarantine', annotation: { type: 'issue', description: '<issue URL>' } },
  async ({ page, open }) => { /* ... */ },
);
```
