---
name: frontend-api-client
description: Use this skill when frontend code calls the backend API, even if no client is named - generating the TypeScript client from a Connect or OpenAPI contract, the one client module (base URL, session cookie, CSRF header, Idempotency-Key, cancelling on navigation, the 401 redirect), turning ConnectError or Problem Details into per-field form errors, cursor-paginated lists, refreshing data after a save, optimistic updates, consuming a server stream, or faking the API in stories and unit tests. Triggers include "call the API from the page", "the types drifted from the backend", "regenerate the client", "show the server's validation errors on the fields", "the list does not refresh after create", "mock the API in Storybook", and any raw fetch or hand-written API type in a component. Svelte 5 examples. Not for designing the contract (api-contract) or the Connect service (connect-rpc), server sessions and CSRF (go-auth), what each async state looks like (ui-patterns), or framework setup (svelte-frontend).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Frontend API client

One typed path runs from the contract to a screen: contract, generator,
`web/src/lib/api/gen`, one client module, a small query and mutation helper,
the screen, props. A screen that calls `fetch('/api/v1/orders')` with a
hand-written `Order` interface type-checks after the backend renames a
field and renders an empty column in production. Every rule below keeps
that path the only one.

## Layout

| Path | Holds |
|---|---|
| `web/src/lib/api/gen/` | generator output; never edited, excluded from lint and format |
| `web/src/lib/api/config.ts` | `API_BASE`, the one place the base URL is set |
| `web/src/lib/api/client.ts` | transport or HTTP client, interceptors, `createApi`; the only file that touches `fetch` |
| `web/src/lib/api/session.ts` | the sign-in return path and its same-origin check |
| `web/src/lib/api/errors.ts` | `ApiError` and the normaliser |
| `web/src/lib/api/query.svelte.ts` | `query`, `mutation`, `invalidate`, `cursorList` |
| `web/src/lib/api/context.ts` | `setApi` and `getApi`, so stories and tests swap the client |

## Generate, never hand-write

- **Connect RPC is the default.** `buf generate`, from the template
  `connect-rpc` owns, runs `protoc-gen-es` (`target=ts`) into
  `web/src/lib/api/gen`. With Connect-ES v2 that plugin emits the service
  descriptors; `protoc-gen-connect-es` is for v1 projects only.
  `createClient(Service, transport)` gives the typed client.
- **OpenAPI projects** generate types from `api/openapi.yaml` with
  `openapi-typescript` into the same directory and call them through
  `openapi-fetch`, so paths, parameters and bodies are checked.
- Both: generated code is never edited; no API shape is typed by hand (use
  the generated message, schema and enum types); `make generate` regenerates
  it; the generate check in `make ci` fails on any diff.

## The client module

- **Base URL** from `config.ts` only: `/` for Connect (services mount at
  the root), `/api` for OpenAPI. Same-origin always; in development the
  Vite proxy forwards those paths.
- **Cookies**: `credentials: 'include'` on every call; the session is an
  HttpOnly cookie (`go-auth`), so no token is stored in JavaScript.
- **CSRF**: every mutating call carries a header a cross-site form cannot
  send. Connect's required `Connect-Protocol-Version: 1` header is that
  header when the server enforces it; for OpenAPI, the custom header
  `go-auth` names, set by middleware on every request.
- **Idempotency**: a create the user may retry carries a key: the
  `idempotency_key` request field in Connect (`connect-rpc`), the
  `Idempotency-Key` header in OpenAPI. One key per user intent: the same
  key on a retry or double submit, a new one after success or a definite
  rejection (a 4xx).
- **Cancellation**: every read takes an `AbortSignal`; leaving the screen or
  changing its inputs aborts it. A mutation is never aborted on navigation:
  aborting does not undo a write.
- **Interceptors**: 401 calls the root layout's hook, which forgets the
  user and opens the re-auth dialog over a page with an unsaved draft, else
  sends the user to the sign-in screen with a same-origin `return` path
  (`go-auth`; never for the sign-in call itself); 403 becomes
  an error the screen shows as "You do not have access", never a redirect;
  5xx and unavailable keep the request ID for the error state and the log.
- **One instance**: the root layout creates the transport once, with the
  redirect hook (`lib/api` imports no `$app/*`), and passes
  `createApi(transport)` down with `setApi`; screens call `getApi()`.
  Stories pass a fake instead.

## Errors

Both protocols normalise into one type, thrown by every call:

```ts
export type ApiErrorKind =
  | 'invalid' | 'unauthenticated' | 'forbidden' | 'not-found' | 'conflict'
  | 'rate-limited' | 'unavailable' | 'server' | 'canceled';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string, // safe, human: Problem `title` or the Connect message
    readonly fieldErrors: Readonly<Record<string, string>> = {},
    readonly requestId?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
```

`fieldErrors` keys are the form's field names, dotted camelCase with
numeric indexes (`items.0.unitPrice`): from the Problem `errors` extension,
`[{pointer, detail}]` (`api-contract`), or from the `google.rpc.BadRequest`
detail on `InvalidArgument` (`connect-rpc`). The form maps them onto its
fields and summary (`ui-patterns`, forms). `canceled` is never shown.

## Data layer

- No `fetch` or client call below the screen: components, compositions and
  features may import generated types, never call the API. Screens fetch
  through `query` and `mutation` and pass data down as props.
- `query(key, fn)`: the key is a tuple whose first element names the
  resource (`['orders', filters, cursor]`) and holds every input; `fn` gets
  the signal. It exposes `data`, `error` and `loading`; the screen's
  `data-loaded` is `!loading`.
- **Stale while revalidate**: on refresh or a key change the shown data
  stays with a quiet indicator; the skeleton is only for no data yet. No
  shared cache across screens, no polling and no refetch on focus by
  default; live data comes from a stream. A project that needs a
  cross-screen cache adopts one library by decision record instead of
  growing the helper.
- `mutation(fn, { invalidates: ['orders'] })`: ignores repeat runs while
  pending, holds the idempotency key, and after success calls
  `invalidate` for each named resource, which refetches every live query
  whose key starts with it. SvelteKit `load` data is refreshed with
  `depends('api:<resource>')` and `invalidate('api:<resource>')`; use
  `load` only for what must exist before render (the session).
- **Cursor pagination**: the cursor is in the URL and in the key for
  Next/Previous; `cursorList` appends for Load more and resets on a key
  change.
- **Optimistic updates** only where `ui-patterns` allows: write, run,
  restore the snapshot and show the error on failure.
- **Streams**: a Connect server stream is a `for await` loop in an effect
  whose cleanup aborts it; on `unavailable` it reconnects with backoff.

## Testing

The client runs in stories and unit tests against a fake: Connect's
`createRouterTransport` with handlers for the methods the screen calls,
or msw handlers for OpenAPI with `onUnhandledRequest: 'error'`. No unit
test or story reaches the network. Each async state is a handler: one
that never resolves (Loading), one that returns no items (Empty), one
that throws (LoadError).

## Gotchas

- Retrying by re-sending a consumed `Request` body fails or sends nothing;
  a retry with a fresh idempotency key creates two records. Retries live
  in the mutation helper, reuse the key, and rebuild the call.
- An aborted request rejects. A catch that does not drop `canceled` shows
  an error state, or writes a late response over newer state.
- A 422 or `InvalidArgument` shown as a toast loses the user's place.
  Field errors go on the fields; only an error with no field goes to the
  form summary.
- A hand-written `'pending' | 'shipped'` drifts from the proto enum. Import
  the generated enum and key label maps with it, with a fallback for values
  added later.
- A call in `onMount` with no loading state renders an empty table that
  looks like real data. Use `query`; it starts loading.
- `createConnectTransport` or `createClient<paths>` inside a component
  makes a client without the interceptors and one the story fake cannot
  replace.
- Connect GET (`useHttpGet`) sends no `Connect-Protocol-Version` header, so
  it is for side-effect-free methods only, never a mutation.
- Generated files under lint or prettier churn on every regenerate. Ignore
  `gen/` in both.

## Definition of done

- No raw `fetch`, hand-written API type or enum, or API call outside
  `lib/api` and screens; `make generate` leaves no diff.
- Every call sends cookies and the CSRF header; retryable creates send one
  idempotency key per intent; reads abort on navigation.
- Errors reach screens as `ApiError`; field errors land on fields; 401
  redirects with a return path.
- Every screen query has stories for Loading, Empty, LoadError and Default
  against a fake; no test touches the network.

## References

- [references/connect.md](references/connect.md): generating or wiring a
  Connect client: `buf.gen.yaml`, transport, interceptors, context.
- [references/openapi.md](references/openapi.md): an OpenAPI project's
  generation script, `openapi-fetch` client and middleware.
- [references/errors.md](references/errors.md): mapping a code or status,
  or wiring field errors into a form.
- [references/data-layer.md](references/data-layer.md): writing `query`,
  `mutation`, pagination, invalidation, optimistic updates or a stream.
- [references/testing.md](references/testing.md): a story or unit test
  that needs API data.
