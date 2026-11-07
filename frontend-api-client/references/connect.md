# Connect client

Connect-ES v2 (`@connectrpc/connect`, `@connectrpc/connect-web`,
`@bufbuild/protobuf` v2). Names below are examples; the service is whatever
`connect-rpc` defined.

## Generation

`connect-rpc` owns `buf.gen.yaml` (its `references/buf-setup.md`): the
`protoc-gen-es` entry writes `web/src/lib/api/gen` with `target=ts`, and a
second template generates `google/rpc/error_details_pb.ts` for
`BadRequest`. Connect-ES v2 builds clients from the service descriptors in
the `_pb.ts` files; `protoc-gen-connect-es` is for v1 projects only.

- `json_types=true` is on, so the generated `<Message>Json` types exist for
  the e2e seed helper (`browser-e2e`).
- `.prettierignore` and the eslint `ignores` list carry `src/lib/api/gen/`.

## config.ts

```ts
// The one place the API location is set. Connect services mount at the
// origin root (/acme.orders.v1.OrderService/GetOrder), so the base is '/'.
export const API_BASE = '/';
```

The app is same-origin in production; in development the Vite proxy
forwards the Connect service paths as well as `/api` (`svelte-frontend`).

## client.ts

```ts
import { Code, ConnectError, createClient, type Interceptor, type Transport } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { OrderService } from './gen/acme/orders/v1/orders_pb';
import { API_BASE } from './config';

const SIGN_IN = '/acme.auth.v1.AuthService/SignIn';

type Hooks = { onUnauthenticated: () => void };

export function createTransport({ onUnauthenticated }: Hooks): Transport {
  // 401 anywhere but the sign-in call itself sends the user to sign in.
  const authRedirect: Interceptor = (next) => async (req) => {
    try {
      return await next(req);
    } catch (err) {
      const e = ConnectError.from(err);
      if (e.code === Code.Unauthenticated && !req.url.endsWith(SIGN_IN)) onUnauthenticated();
      throw e;
    }
  };

  return createConnectTransport({
    baseUrl: API_BASE,
    // JSON keeps payloads readable in the network panel. A project that moves
    // to binary for size keeps JSON in development: !import.meta.env.DEV.
    useBinaryFormat: false,
    useHttpGet: true, // NO_SIDE_EFFECTS procedures as cacheable GETs (connect-rpc)
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      globalThis.fetch(input, { ...init, credentials: 'include' }),
    interceptors: [authRedirect],
  });
}

export function createApi(transport: Transport) {
  return {
    orders: createClient(OrderService, transport),
  };
}

export type Api = ReturnType<typeof createApi>;
```

- `connect-web` speaks the Connect protocol over HTTP/1.1 with `fetch`.
  Unary calls and server streams work in every browser; client and
  bidirectional streams do not, so the contract never asks the browser for
  them.
- Every unary POST carries `Connect-Protocol-Version: 1`; the server
  rejects requests without it (`WithRequireConnectProtocolHeader`,
  `connect-rpc`). A cross-site form cannot set it, so it is the CSRF
  header. Reads marked `NO_SIDE_EFFECTS` may go as GET (`useHttpGet: true`),
  which carries no such header; that is safe only because they write nothing.
- On failure the request ID is in `ConnectError.metadata` (`errors.md`).

## session.ts

`lib/api` imports no `$app/*` module (`svelte-frontend`'s import rule), so
the redirect itself lives in the root layout; this file only builds and
checks the return path.

```ts
export function signInHref(here: Location): string {
  return `/sign-in?return=${encodeURIComponent(here.pathname + here.search)}`;
}

// The sign-in screen runs `return` through this before following it.
export function safeReturn(value: string | null): string {
  // Parse, do not prefix-check: the URL parser strips '/\t/evil.example' to '//evil.example'.
  try {
    const u = new URL(value ?? '/', location.origin);
    return u.origin === location.origin ? u.pathname + u.search + u.hash : '/';
  } catch {
    return '/';
  }
}
```

## context.ts

```ts
import { getContext, setContext } from 'svelte';
import type { Api } from './client';

export const API_KEY = Symbol('api');
export const setApi = (api: Api): void => void setContext(API_KEY, api);
export const getApi = (): Api => getContext<Api>(API_KEY);
```

The exported key lets a unit test pass the context to `render` directly
(`testing.md`).

## Root layout

The transport is created here, once:

```svelte
<script lang="ts">
  import { goto, invalidate } from '$app/navigation';
  import { createApi, createTransport } from '$lib/api/client';
  import { setApi } from '$lib/api/context';
  import { signInHref } from '$lib/api/session';
  import { drafts } from '$lib/utils/drafts.svelte';
  import { reauth } from '$lib/features/ReauthDialog/reauth.svelte';

  let { children } = $props();

  setApi(
    createApi(
      createTransport({
        onUnauthenticated: () => {
          void invalidate('api:session'); // the client forgets the user at once
          if (location.pathname === '/sign-in') return;
          if (drafts.any) reauth.open = true; // sign in over the page; the draft stays (go-auth)
          else void goto(signInHref(location), { replaceState: true });
        },
      }),
    ),
  );
</script>

{@render children()}
```

## Calls

```ts
const api = getApi();

// Read: pass the signal.
const res = await api.orders.listOrders({ pageSize: 50, pageToken: cursor }, { signal });

// Retryable create: the key is a request field (connect-rpc); the mutation
// helper supplies it.
await api.orders.createOrder({ ...input, idempotencyKey: key });

// Server stream: for await, cancelled by the signal.
for await (const res of api.orders.watchOrder({ orderId }, { signal })) { /* ... */ }
```

Messages are plain objects typed by the generated types; build a full one
with `create(OrderSchema, { ... })` from `@bufbuild/protobuf` (tests,
optimistic rows).
