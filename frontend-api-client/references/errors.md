# Errors

Every call throws `ApiError` (defined in `SKILL.md`) or returns a value.
Screens switch on `kind`; forms read `fieldErrors`.

## Kinds

| Kind | Connect code | HTTP status | The screen shows |
|---|---|---|---|
| `invalid` | `InvalidArgument`, `FailedPrecondition`, `OutOfRange` | 400, 422 | field errors on fields, the rest in the form summary |
| `unauthenticated` | `Unauthenticated` | 401 | nothing; the hook already redirected or opened the re-auth dialog |
| `forbidden` | `PermissionDenied` | 403 | "You do not have access" |
| `not-found` | `NotFound` | 404 | the not-found state for that record |
| `conflict` | `AlreadyExists`, `Aborted` | 409, 412 | the message, and a reload offer when the record changed |
| `rate-limited` | `ResourceExhausted` | 429 | "Too many attempts. Try again in a minute." |
| `unavailable` | `Unavailable`, `DeadlineExceeded`, no response | 502, 503, 504, network failure | the error state with Retry |
| `server` | anything else | other 5xx | the error state with Retry; request ID logged |
| `canceled` | `Canceled` | `AbortError` | nothing, ever |

Copy comes from the screen, per kind (`ui-patterns`, async states). The
`message` is shown only for `invalid` and `conflict`, where the server
wrote it for the user; never a raw body, code or status.

## errors.ts

```ts
import { Code, ConnectError } from '@connectrpc/connect';
import { BadRequestSchema } from './gen/google/rpc/error_details_pb';
// ApiError and ApiErrorKind as in SKILL.md, also in this file.

const fromCode: Partial<Record<Code, ApiErrorKind>> = {
  [Code.Canceled]: 'canceled',
  [Code.InvalidArgument]: 'invalid',
  [Code.FailedPrecondition]: 'invalid',
  [Code.OutOfRange]: 'invalid',
  [Code.Unauthenticated]: 'unauthenticated',
  [Code.PermissionDenied]: 'forbidden',
  [Code.NotFound]: 'not-found',
  [Code.AlreadyExists]: 'conflict',
  [Code.Aborted]: 'conflict',
  [Code.ResourceExhausted]: 'rate-limited',
  [Code.Unavailable]: 'unavailable',
  [Code.DeadlineExceeded]: 'unavailable',
};

// Proto paths as protovalidate prints them (items[0].unit_price) to the
// form's names (items.0.unitPrice).
const fieldName = (path: string) =>
  path.replace(/\[(\d+)\]/g, '.$1').replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const e = ConnectError.from(err); // AbortError becomes Code.Canceled
  const fieldErrors: Record<string, string> = {};
  for (const bad of e.findDetails(BadRequestSchema)) {
    for (const v of bad.fieldViolations) fieldErrors[fieldName(v.field)] = v.description;
  }
  return new ApiError(
    fromCode[e.code] ?? 'server',
    e.rawMessage,
    fieldErrors,
    e.metadata.get('x-request-id') ?? undefined,
    { cause: e },
  );
}
```

## OpenAPI: Problem Details

The Problem body is RFC 9457 with the `errors` extension from
`api-contract`: `errors: [{ "pointer": "/body/address/postcode", "detail": "Enter a postcode" }]`.

```ts
import type { components } from './gen/schema';

type Problem = components['schemas']['Problem'];

function kindFromStatus(status: number): ApiErrorKind {
  if (status === 400 || status === 422) return 'invalid';
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409 || status === 412) return 'conflict';
  if (status === 429) return 'rate-limited';
  if (status === 502 || status === 503 || status === 504) return 'unavailable';
  return 'server';
}

// JSON Pointer (RFC 6901), with or without a leading '#', to a dotted name:
// /items/0/unitPrice becomes items.0.unitPrice.
function pointerToName(pointer: string): string {
  return pointer
    .replace(/^#/, '')
    .split('/')
    .slice(1)
    .map((s) => s.replaceAll('~1', '/').replaceAll('~0', '~'))
    .join('.');
}

export function fromProblem(response: Response, body: Partial<Problem> | undefined): ApiError {
  const fieldErrors: Record<string, string> = {};
  for (const fe of body?.errors ?? []) fieldErrors[pointerToName(fe.pointer)] = fe.detail;
  return new ApiError(
    kindFromStatus(response.status),
    body?.title ?? response.statusText,
    fieldErrors,
    response.headers.get('x-request-id') ?? undefined,
  );
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof DOMException && err.name === 'AbortError') return new ApiError('canceled', 'Canceled');
  return new ApiError('unavailable', 'Network error', {}, undefined, { cause: err }); // fetch TypeError
}

type Result<T> = { data?: T; error?: unknown; response: Response };

export async function unwrap<T>(call: Promise<Result<T>>): Promise<T> {
  let r: Result<T>;
  try {
    r = await call;
  } catch (err) {
    throw toApiError(err);
  }
  if (!r.response.ok) throw fromProblem(r.response, r.error as Partial<Problem> | undefined);
  return r.data as T;
}
```

A project has one of the two `toApiError` variants, not both.

## Into a form

```svelte
<script lang="ts">
  import type { ApiError } from '$lib/api/errors';
  let { error }: { error: ApiError | undefined } = $props();

  // Field errors on fields; anything without a field goes to the summary.
  const fieldError = (name: string) => error?.fieldErrors[name];
  const summaryOnly = $derived(
    error?.kind === 'invalid' && Object.keys(error.fieldErrors).length === 0 ? error.message : undefined,
  );
</script>
```

The form composition owns the summary, focus and `aria-invalid` rules
(`ui-patterns`, forms). A field name the form does not render (the server
validated something the form does not show) goes to the summary too;
never drop it.
