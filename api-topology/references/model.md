# The topology model

One JSON file per map, `.agents/topology/<slug>.json`, excluded from git.
`scripts/example.json` is a complete change-mode example (order
cancellation on an orders API); copy it and replace the content rather
than starting from an empty object. `check.mjs` enforces what is marked
*error* below and warns about the rest.

## Top level

| Key | Required | Meaning |
|---|---|---|
| `title` | error | the API or service name, two to four words (`Orders API`) |
| `subtitle` | | the change in a phrase (`Order cancellation`); the page's second line |
| `mode` | error | `change` (markers highlighted, `+ ~ -` in the tree) or `snapshot` (markers ignored, warned) |
| `style` | | `rest` (default) or `connect`; changes how endpoints are labelled and grouped |
| `roots` | error, one or more | the API roots (one per base path or proto package) |
| `endpoints` | | the operations |
| `schemas` | | request, response, resource, enum and value shapes |
| `tables` | | storage, when the change moves a table or the gate is the schema gate |

Every node has an `id`, unique across all four lists, and may carry
`change`, `was`, `breaking` and `note`.

## Change markers

| Key | Values | Rule |
|---|---|---|
| `change` | `unchanged` (default), `added`, `changed`, `removed` | on nodes, fields, columns and enum values; a changed field makes its schema `changed` (error otherwise); an `added` schema's fields are unmarked or `added` |
| `was` | object of the prior values, keyed as the node is (`{ "type": "integer" }`, `{ "path": "/orders/{id}/void" }`) | only on `changed` (error); a changed field without it is a warning |
| `breaking` | the reason, as text | only on `changed` or `removed` (error); the viewer shows a red pill, the tree `[BREAKING]`; the hand-over names the new version |
| `note` | text | why, in one sentence; shown under the inspector header |

A rename is `removed` plus `added` with a `note` on each naming the other.
A move between files or packages is `changed` with `was`.

## Roots

```json
{ "id": "api", "name": "Orders API v1", "base": "/api/v1", "summary": "Public REST surface" }
```

`base` is the path prefix (REST) or the proto package (`acme.orders.v1`).

## Endpoints

```json
{ "id": "cancelOrder", "root": "api", "method": "POST", "path": "/orders/{id}/cancel",
  "summary": "Cancel an order that has not shipped",
  "request": "CancelOrder", "response": "Order",
  "errors": [{ "code": "409 order-already-shipped", "when": "the order left the warehouse" }],
  "auth": "session", "idempotent": true, "paginated": false, "stream": false,
  "change": "added", "note": "An action, not a DELETE: the order stays readable." }
```

| Key | Rule |
|---|---|
| `root` | an existing root id (error) |
| `method`, `path` | required; `path` starts with `/`; method and path unique per root (error). Connect: `path` is the procedure path `/acme.orders.v1.OrderService/CancelOrder`, `method` is `POST`, or `GET` for a read with `NO_SIDE_EFFECTS` |
| `rpc` | Connect only: `OrderService.CancelOrder`; the card and tree show it instead of the path |
| `summary` | one line in the owner's words; a warning when missing |
| `request`, `response` | a schema id, or `Order[]` / `Array<Order>` for a list (error when it names no schema); omit `request` for no body |
| `errors` | `code` (REST: status and Problem type `409 order-already-shipped`; Connect: the code `failed_precondition`) and `when` |
| `auth` | what authenticates the caller: `session`, `api-key`, `none` |
| `idempotent`, `paginated`, `stream` | booleans shown as flags; a list that is not paginated is a decision to raise |

## Schemas

```json
{ "id": "Order", "kind": "resource", "summary": "An order as every read returns it", "change": "changed",
  "fields": [
    { "name": "id", "type": "string", "required": true, "summary": "opaque" },
    { "name": "status", "type": "OrderStatus", "required": true },
    { "name": "lines", "type": "OrderLine[]", "required": true },
    { "name": "total", "type": "Money", "required": true, "change": "changed", "was": { "type": "integer" } },
    { "name": "cancelledAt", "type": "timestamp", "required": false, "change": "added" }
  ] }
```

| Key | Rule |
|---|---|
| `kind` | `resource` (returned whole by reads), `request`, `response`, `enum`, `value` (embedded, never top level) |
| `fields[].name` | unique within the schema (error); camelCase for JSON, as the contract spells it |
| `fields[].type` | a lowercase scalar (`string`, `integer`, `number`, `boolean`, `timestamp`, `date`, `duration`, `bytes`, `uuid`, `map<string, X>`) or a schema id, with `[]` for a list; a capitalised type that is no schema is a warning, because the viewer cannot link it |
| `fields[].required`, `default` | one of them; neither means optional |
| `fields[].example` | a literal the JSON tab uses instead of a generated one |
| `values` | enum only: strings, or `{ "name": "CANCELLED", "change": "added" }` |

A schema no endpoint or schema uses is a warning unless it is a `resource`.

## Tables

```json
{ "id": "orders", "backs": ["Order"], "migration": "0007_orders_cancellation", "change": "changed",
  "columns": [
    { "name": "id", "type": "uuid", "key": "pk" },
    { "name": "tenant_id", "type": "uuid", "key": "fk tenants.id" },
    { "name": "cancelled_at", "type": "timestamptz", "nullable": true, "change": "added" }
  ] }
```

| Key | Rule |
|---|---|
| `name` | the table name when it differs from the id |
| `backs` | schema ids this table stores (error when one is not a schema); draws the `stored in` connector |
| `migration` | the numbered migration that changes it, for the schema gate |
| `columns[].key` | `pk`, `unique`, `index`, or `fk <table>.<column>` |
| `columns[].nullable`, `default` | as the DDL says; omitted means not null |

## What the viewer derives

Connectors: root to each endpoint; endpoint to its request (`Payload`) and
response (`Returns`, or `Array<X>`); schema to the table that backs it
(`stored in`). Schema-to-schema references are not drawn; selecting a
schema outlines the schemas it references and the ones that use it, and
the inspector's Used By tab lists them. Lanes are ordered so each node
sits under the nodes that point at it.
