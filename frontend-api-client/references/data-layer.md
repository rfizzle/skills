# Data layer

`web/src/lib/api/query.svelte.ts`: a small helper, about a hundred lines,
that every screen uses. It owns cancellation, stale data, invalidation and
the idempotency key so no screen re-implements them.

## Contents

- [query](#query)
- [mutation](#mutation)
- [Using them in a screen](#using-them-in-a-screen)
- [Cursor pagination](#cursor-pagination)
- [Optimistic updates](#optimistic-updates)
- [SvelteKit load](#sveltekit-load)
- [Server streams](#server-streams)

## query

```ts
import { untrack } from 'svelte';
import { type ApiError, toApiError } from './errors';

export type Key = readonly [resource: string, ...inputs: unknown[]];

const live = new Map<string, Set<() => void>>();

/** Refetch every live query whose key starts with `resource`. */
export function invalidate(resource: string): void {
  for (const refetch of live.get(resource) ?? []) refetch();
}

/**
 * Call during component init. `key` is tracked and holds every input;
 * `fn` runs untracked, so anything it reads that is not in the key is a bug.
 */
export function query<T>(key: () => Key, fn: (signal: AbortSignal) => Promise<T>) {
  let data = $state.raw<T>();
  let error = $state.raw<ApiError>();
  let loading = $state(true);
  let tick = $state(0);
  const refetch = () => void tick++;

  $effect(() => {
    const [resource] = key();
    void tick;
    const controller = new AbortController();
    const set = live.get(resource) ?? new Set();
    live.set(resource, set.add(refetch));
    loading = true;

    untrack(() => fn(controller.signal)).then(
      (value) => {
        if (controller.signal.aborted) return; // a newer key or unmount won
        data = value;
        error = undefined;
        loading = false;
      },
      (err: unknown) => {
        const e = toApiError(err);
        if (controller.signal.aborted || e.kind === 'canceled') return;
        error = e; // data already shown stays shown
        loading = false;
      },
    );

    return () => {
      controller.abort();
      set.delete(refetch);
    };
  });

  return {
    get data() { return data; },
    get error() { return error; },
    /** True while a request is in flight; with data present it means refreshing. */
    get loading() { return loading; },
    refetch,
    /** Local write for optimistic updates. */
    set(value: T) { data = value; },
  };
}
```

`$state.raw` because API data is replaced, never mutated in place; it also
avoids proxying generated messages.

## mutation

```ts
type Intent<I, O> = (input: I, idempotencyKey: string) => Promise<O>;

// A definite rejection: nothing was written, so the next attempt is a new intent.
const REJECTED = new Set<ApiError['kind']>(['invalid', 'conflict', 'forbidden', 'not-found', 'rate-limited']);

export function mutation<I, O>(fn: Intent<I, O>, opts: { invalidates?: string[] } = {}) {
  let pending = $state(false);
  let error = $state.raw<ApiError>();
  let key = crypto.randomUUID();

  return {
    get pending() { return pending; },
    get error() { return error; },
    async run(input: I): Promise<O | undefined> {
      if (pending) return undefined; // double submit
      pending = true;
      error = undefined;
      try {
        const out = await fn(input, key);
        key = crypto.randomUUID();
        for (const r of opts.invalidates ?? []) invalidate(r);
        return out;
      } catch (err) {
        error = toApiError(err);
        if (REJECTED.has(error.kind)) key = crypto.randomUUID();
        // unavailable or server: the outcome is unknown, so Retry reuses the key
        return undefined;
      } finally {
        pending = false;
      }
    },
  };
}
```

No signal: leaving the page does not undo a write, and an aborted create
whose response was lost is exactly the case the key exists for.

## Using them in a screen

The screen component sits beside its `+page.svelte`, which reads the URL
and passes the inputs as props (`svelte-frontend`); the screen owns the
queries, so its stories render it against a fake (`testing.md`).

```svelte
<script lang="ts">
  import { getApi } from '$lib/api/context';
  import { mutation, query } from '$lib/api/query.svelte';
  import OrderTable from '$lib/features/OrderTable/OrderTable.svelte';

  interface Props {
    /** The status filter from the URL, '' for all. */
    status: string;
    /** The page cursor from the URL, '' for the first page. */
    cursor: string;
  }

  let { status, cursor }: Props = $props();
  const api = getApi();

  const orders = query(
    () => ['orders', status, cursor],
    (signal) => api.orders.listOrders({ status, pageToken: cursor, pageSize: 50 }, { signal }),
  );

  const create = mutation(
    (input: { customerName: string }, key) => api.orders.createOrder({ ...input, idempotencyKey: key }),
    { invalidates: ['orders'] },
  );
</script>

<main data-page="orders" data-loaded={!orders.loading}>
  <OrderTable
    orders={orders.data?.orders}
    loading={orders.loading}
    error={orders.error}
    onRetry={orders.refetch}
    onCreate={(input) => create.run(input)}
    createError={create.error}
  />
</main>
```

`data-loaded` turns false on every key change, so an end-to-end test that
changes a filter waits for the new data, not the old (`browser-e2e`).

## Cursor pagination

Next and Previous: the cursor is in the URL and the key, as above. Next
pushes `?cursor=<next>`; Previous is the browser's Back or the first page.
Filter changes drop the cursor from the URL.

Load more appends instead:

```ts
export function cursorList<T>(
  key: () => Key,
  page: (cursor: string | undefined, signal: AbortSignal) => Promise<{ items: T[]; next?: string }>,
) {
  let items = $state.raw<T[]>([]);
  let next = $state<string>();
  let more = $state(false);
  let moreError = $state.raw<ApiError>();
  let controller: AbortController | undefined;

  const first = query(key, (signal) => page(undefined, signal));
  $effect(() => {
    const p = first.data;
    if (!p) return;
    controller?.abort(); // a Load more from the old key must not append here
    items = p.items;
    next = p.next;
  });
  $effect(() => () => controller?.abort());

  return {
    get first() { return first; },
    get items() { return items; },
    get hasMore() { return next !== undefined; },
    get loadingMore() { return more; },
    get moreError() { return moreError; },
    async loadMore() {
      if (more || next === undefined) return;
      more = true;
      moreError = undefined;
      const c = (controller = new AbortController());
      try {
        const p = await page(next, c.signal);
        if (c.signal.aborted) return;
        items = [...items, ...p.items];
        next = p.next;
      } catch (err) {
        const e = toApiError(err);
        if (e.kind !== 'canceled') moreError = e; // items already shown stay
      } finally {
        more = false;
      }
    },
  };
}
```

Map the protocol's names in `page`: Connect `pageToken`/`nextPageToken`
(an empty string means the end), OpenAPI `cursor`/`nextCursor` (absent at
the end).

## Optimistic updates

Only where `ui-patterns` allows. Snapshot, write, run, roll back visibly:

```ts
async function toggleStar(id: string) {
  const before = orders.data;
  if (!before) return;
  orders.set({ ...before, orders: before.orders.map((o) => (o.id === id ? { ...o, starred: !o.starred } : o)) });
  const done = await star.run(id); // star invalidates 'orders' on success
  if (done === undefined) orders.set(before); // the screen shows star.error
}
```

## SvelteKit load

Use `load` for data that must exist before the page renders, which is
usually only the session in the root `+layout.ts`:

```ts
export const load = async ({ depends }) => {
  depends('api:session');
  return { me: await getMe() }; // getMe throws ApiError; 'unauthenticated' redirects
};
```

After sign-in or sign-out, `invalidate('api:session')` from
`$app/navigation`. Screens use `query` so they render their own loading,
empty and error states instead of blocking navigation.

## Server streams

In a screen; a composition never opens a stream.

```svelte
<script lang="ts">
  import type { OrderEvent } from '$lib/api/gen/acme/orders/v1/orders_pb';
  import { getApi } from '$lib/api/context';
  import { type ApiError, toApiError } from '$lib/api/errors';

  let { orderId }: { orderId: string } = $props();
  const api = getApi();
  let events = $state.raw<OrderEvent[]>([]);
  let error = $state.raw<ApiError>();

  $effect(() => {
    const id = orderId; // re-subscribe when the order changes
    const controller = new AbortController();
    events = [];
    error = undefined;
    void watch(id, controller.signal);
    return () => controller.abort(); // unmount or new orderId
  });

  async function watch(id: string, signal: AbortSignal) {
    let after = '';
    for (let attempt = 0; !signal.aborted; attempt++) {
      try {
        for await (const res of api.orders.watchOrder({ orderId: id, after }, { signal })) {
          if (!res.event) continue;
          events = [...events, res.event];
          after = res.event.id;
          attempt = 0;
        }
        return; // the server ended the stream
      } catch (err) {
        const e = toApiError(err);
        if (e.kind === 'canceled') return;
        if (e.kind !== 'unavailable' || attempt >= 5) {
          error = e;
          return;
        }
        await new Promise((r) => setTimeout(r, Math.min(30_000, 1000 * 2 ** attempt)));
      }
    }
  }
</script>
```

The resume field (`after` here) is whatever the contract defines; without
one, a reconnect refetches the current state with `query` first.
