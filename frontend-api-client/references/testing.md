# Testing against a fake API

Stories and unit tests use the real client module and the real `query`
and `mutation` helpers against a fake server. Nothing reaches the network;
a request nobody faked is a failure, not a silent hang.

## Connect: router transport

`createRouterTransport` runs handlers in memory with the same types as the
real service. Keep one fake per service under `src/lib/api/fakes/`, built
from realistic fictional data (`ui-component-contract`).

```ts
// src/lib/api/fakes/orders.ts
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import { BadRequestSchema } from '../gen/google/rpc/error_details_pb';
import { OrderSchema, OrderService, type Order } from '../gen/acme/orders/v1/orders_pb';

export const sampleOrders: Order[] = [
  create(OrderSchema, { id: 'ord_7Hq2', customerName: 'Ana Pereira', total: '1,284.50' }),
  create(OrderSchema, { id: 'ord_9Kd4', customerName: 'Oluwaseun Adebayo-Whitfield', total: '86.00' }),
];

type Mode = 'ok' | 'empty' | 'loading' | 'error' | 'invalid';

export function ordersTransport(mode: Mode = 'ok') {
  return createRouterTransport(({ service }) => {
    service(OrderService, {
      listOrders: () => {
        if (mode === 'loading') return new Promise(() => {}); // never settles
        if (mode === 'error') throw new ConnectError('Internal error', Code.Internal);
        return { orders: mode === 'empty' ? [] : sampleOrders, nextPageToken: '' };
      },
      createOrder: (req) => {
        if (mode === 'invalid') {
          throw new ConnectError('Check the highlighted fields', Code.InvalidArgument, undefined, [
            {
              desc: BadRequestSchema,
              value: { fieldViolations: [{ field: 'customer_name', description: 'Enter the customer name' }] },
            },
          ]);
        }
        return { order: create(OrderSchema, { id: 'ord_new1', customerName: req.customerName }) };
      },
    });
  });
}
```

Stories wrap the screen in a provider that sets the fake through the same
context the root layout uses:

```svelte
<!-- src/lib/api/fakes/ApiProvider.svelte -->
<script lang="ts">
  import type { Transport } from '@connectrpc/connect';
  import type { Snippet } from 'svelte';
  import { createApi } from '../client';
  import { setApi } from '../context';

  let { transport, children }: { transport: Transport; children: Snippet } = $props();
  setApi(createApi(transport)); // once, at init, like the root layout
</script>

{@render children()}
```

```svelte
<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import ApiProvider from '$lib/api/fakes/ApiProvider.svelte';
  import { ordersTransport } from '$lib/api/fakes/orders';
  import OrdersScreen from './OrdersScreen.svelte';

  const { Story } = defineMeta({ title: 'Screens/Orders' });
</script>

<Story name="Default" asChild>
  <ApiProvider transport={ordersTransport()}><OrdersScreen status="" cursor="" /></ApiProvider>
</Story>
<Story name="Empty" asChild>
  <ApiProvider transport={ordersTransport('empty')}><OrdersScreen status="" cursor="" /></ApiProvider>
</Story>
```

Unit tests with `@testing-library/svelte` in vitest browser mode pass the
context directly:

```ts
import { render } from '@testing-library/svelte';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { createApi } from '$lib/api/client';
import { API_KEY } from '$lib/api/context';
import { ordersTransport } from '$lib/api/fakes/orders';
import OrdersScreen from './OrdersScreen.svelte';

test('shows the empty state with a next step', async () => {
  render(OrdersScreen, {
    props: { status: '', cursor: '' },
    context: new Map([[API_KEY, createApi(ordersTransport('empty'))]]),
  });
  await expect.element(page.getByRole('link', { name: 'Create an order' })).toBeVisible();
});
```

## OpenAPI: msw

msw intercepts `fetch` in the browser, so the real `openapi-fetch` client,
middleware and `unwrap` run. Handlers live in `src/lib/api/fakes/` and are
typed from the generated schema.

```ts
// src/lib/api/fakes/orders.ts
import { http, HttpResponse, delay } from 'msw';
import type { components } from '../gen/schema';

type Order = components['schemas']['Order'];
const base = '/api/v1';

export const sampleOrders: Order[] = [/* realistic fictional rows */];

export const orders = {
  ok: http.get(`${base}/orders`, () => HttpResponse.json({ items: sampleOrders })),
  empty: http.get(`${base}/orders`, () => HttpResponse.json({ items: [] })),
  loading: http.get(`${base}/orders`, () => delay('infinite')),
  error: http.get(`${base}/orders`, () =>
    HttpResponse.json(
      { type: 'https://example.test/problems/internal', title: 'Something went wrong', status: 500 },
      { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
    ),
  ),
};
```

- **Storybook**: `msw-storybook-addon`; `initialize({ onUnhandledRequest: 'error' })`
  and `loaders: [mswLoader]` in the preview; each story sets
  `parameters: { msw: { handlers: [orders.empty] } }`.
- **vitest browser mode**: a setup file starts `setupWorker()` from
  `msw/browser` with `onUnhandledRequest: 'error'`; each test calls
  `worker.use(orders.error)` and `afterEach` calls `worker.resetHandlers()`.
- The worker script (`mockServiceWorker.js`) is generated by
  `msw init static/` and committed; it is served only by Storybook and
  tests, never shipped from the production build's routes.

## What to test where

| Behaviour | Test |
|---|---|
| Each async state of a screen | a story per state against the fake |
| A field error lands on its field | a story with an `invalid` handler and a play test |
| Error normalisation and pointer mapping | plain unit tests of `errors.ts` |
| `query` cancels and ignores late responses | unit test: change the key before a delayed handler resolves |
| `mutation` reuses the key on `unavailable` | unit test: handler fails once, records the key, then succeeds |
| Cookies, CSRF header and the real server | `browser-e2e`, never here |
