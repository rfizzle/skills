# OpenAPI client

For a project whose contract is `api/openapi.yaml` (`api-contract`).
`openapi-typescript` turns the spec into types; `openapi-fetch` is a thin
typed `fetch` wrapper over them. Both are pinned dev and runtime
dependencies in `web/package.json`.

## Generation

```json
{
  "scripts": {
    "generate:api": "openapi-typescript ../api/openapi.yaml -o src/lib/api/gen/schema.d.ts"
  }
}
```

`make generate` runs `pnpm --dir web run generate:api` (the `repo-tooling`
skeleton already does). The output is one declaration file with `paths`
and `components`; the generate check fails when it is stale.

Use the generated schema types, never a copy:

```ts
import type { components } from './gen/schema';
export type Order = components['schemas']['Order'];
export type OrderStatus = components['schemas']['OrderStatus'];
```

## client.ts

```ts
import createClient, { type Client, type Middleware } from 'openapi-fetch';
import type { paths } from './gen/schema';
import { API_BASE } from './config';

// Header name and value: whatever go-auth requires on unsafe methods.
const CSRF_HEADER = 'X-Requested-With';
const CSRF_VALUE = 'fetch';

const csrf: Middleware = {
  onRequest({ request }) {
    request.headers.set(CSRF_HEADER, CSRF_VALUE); // harmless on reads
    return request;
  },
};

type Hooks = { onUnauthenticated: () => void };

export function createApi({ onUnauthenticated }: Hooks): Client<paths> {
  const authRedirect: Middleware = {
    onResponse({ request, response }) {
      const signingIn = new URL(request.url).pathname.endsWith('/sessions');
      if (response.status === 401 && !signingIn) onUnauthenticated();
      return response;
    },
  };
  const api = createClient<paths>({ baseUrl: `${API_BASE}/v1`, credentials: 'include' });
  api.use(csrf, authRedirect);
  return api;
}

export type Api = Client<paths>;
```

`config.ts` sets `API_BASE = '/api'` (the ogen server mounts at
`/api/v1/`, `go-http-server`). `session.ts`, `context.ts` and the root
layout are as in `connect.md`, with
`setApi(createApi({ onUnauthenticated }))`. msw intercepts at the network
layer, so stories and tests use the real client.

## Calls

`openapi-fetch` returns `{ data, error, response }` instead of throwing.
Wrap every call in `unwrap` (in `errors.md`) so screens see one shape: a
value or a thrown `ApiError`.

```ts
const api = getApi();

const page = await unwrap(
  api.GET('/orders', { params: { query: { cursor, limit: 50 } }, signal }),
);

const created = await unwrap(
  api.POST('/orders', { body: input, headers: { 'Idempotency-Key': key } }),
);
```

A path, parameter or body that does not match the spec is a type error.
Problem bodies are typed as the operation's declared error responses.
