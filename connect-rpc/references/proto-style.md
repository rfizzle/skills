# Proto style

One file shows every rule. buf lint `STANDARD` already enforces the naming
(package suffix and directory, `Service` suffix, `<Rpc>Request` and
`<Rpc>Response` unique per RPC, enum prefixes and the `_UNSPECIFIED` zero);
the rest is review.

## Example: proto/acme/orders/v1/orders.proto

```proto
syntax = "proto3";

// Package acme.orders.v1 is version 1 of the orders API.
package acme.orders.v1;

import "buf/validate/validate.proto";
import "google/protobuf/timestamp.proto";

// OrderService places and tracks the caller's orders. It is the API of the
// orders module and nothing else.
service OrderService {
  // GetOrder returns one order. An order the caller cannot see is not_found.
  rpc GetOrder(GetOrderRequest) returns (GetOrderResponse) {
    option idempotency_level = NO_SIDE_EFFECTS;
  }
  // ListOrders returns the caller's orders, newest first.
  rpc ListOrders(ListOrdersRequest) returns (ListOrdersResponse) {
    option idempotency_level = NO_SIDE_EFFECTS;
  }
  // CreateOrder places an order. A retry with the same idempotency_key and
  // request returns the first result.
  rpc CreateOrder(CreateOrderRequest) returns (CreateOrderResponse);
  // CancelOrder cancels an order that has not shipped; a shipped order is
  // failed_precondition.
  rpc CancelOrder(CancelOrderRequest) returns (CancelOrderResponse);
  // WatchOrder sends the order now, on every change, and at least every 25
  // seconds, until the order is delivered or cancelled or the stream's
  // lifetime ends; the client then reconnects.
  rpc WatchOrder(WatchOrderRequest) returns (stream WatchOrderResponse);
}

// Order is a placed order. Shared by the responses that return the resource.
message Order {
  // id is opaque; clients never parse it.
  string id = 1;
  OrderStatus status = 2;
  google.protobuf.Timestamp create_time = 3;
  google.protobuf.Timestamp update_time = 4;
  repeated LineItem items = 5;
  // 6 was the free-text note, removed in v1.4.0.
  reserved 6;
  reserved "note";
}

// LineItem is one product in an order.
message LineItem {
  string sku = 1;
  int32 quantity = 2;
}

// OrderStatus is where an order is in its life.
enum OrderStatus {
  // ORDER_STATUS_UNSPECIFIED means not set; never stored, never sent.
  ORDER_STATUS_UNSPECIFIED = 0;
  ORDER_STATUS_PLACED = 1;
  ORDER_STATUS_SHIPPED = 2;
  ORDER_STATUS_DELIVERED = 3;
  ORDER_STATUS_CANCELLED = 4;
}

message GetOrderRequest {
  string id = 1 [(buf.validate.field).string.min_len = 1];
}

message GetOrderResponse {
  Order order = 1;
}

message ListOrdersRequest {
  // page_size is 1 to 100; 0 means 25.
  int32 page_size = 1 [(buf.validate.field).int32 = {gte: 0, lte: 100}];
  // page_token is the next_page_token of the previous page, or empty.
  string page_token = 2;
}

message ListOrdersResponse {
  repeated Order orders = 1;
  // next_page_token is empty on the last page.
  string next_page_token = 2;
}

message CreateOrderRequest {
  // idempotency_key is a UUID the client makes once per intended order.
  string idempotency_key = 1 [(buf.validate.field).string.uuid = true];
  repeated LineItemInput items = 2 [(buf.validate.field).repeated = {min_items: 1, max_items: 100}];
}

// LineItemInput is what the caller may set on a line item.
message LineItemInput {
  string sku = 1 [(buf.validate.field).string.min_len = 1];
  int32 quantity = 2 [(buf.validate.field).int32 = {gte: 1, lte: 999}];
}

message CreateOrderResponse {
  Order order = 1;
}

message CancelOrderRequest {
  string id = 1 [(buf.validate.field).string.min_len = 1];
}

// CancelOrderResponse carries what the action changed, not the whole order.
message CancelOrderResponse {
  OrderStatus status = 1;
  google.protobuf.Timestamp update_time = 2;
}

message WatchOrderRequest {
  string id = 1 [(buf.validate.field).string.min_len = 1];
}

message WatchOrderResponse {
  Order order = 1;
}
```

## Rules the example shows

- An input enum field carries
  `[(buf.validate.field).enum = {defined_only: true, not_in: [0]}]`.
- A message field the request needs carries `(buf.validate.field).required = true`.
- Use `optional` only where "not sent" differs from the zero value; a
  partial update takes a `google.protobuf.FieldMask update_mask` instead of
  making every field optional.
- int64 values travel as JSON strings; the TypeScript type is `bigint`. Use
  int32 when the range allows.
- Comments are the API documentation the generated Go and TypeScript carry.
  Say what the caller sees, including which code each failure returns.

## A v2 beside v1

`proto/acme/orders/v2/orders.proto` declares `package acme.orders.v2;` with
its own messages; it never imports v1. In v1:

```proto
// OrderService is version 1 of the orders API.
//
// Deprecated: use acme.orders.v2.OrderService. Sunset: 2027-06-30.
service OrderService {
  option deprecated = true;
  // ...
}
```

Both register on the same `connect.Server`. The v1 controller is a thin
adapter over the same module, and an interceptor sets `Sunset` on responses
for procedures under `/acme.orders.v1.` (see `server.md`). Delete the v1
directory, its controller and its registration in the MAJOR release after
the date (`release`).
