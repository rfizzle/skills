# Server, errors and tests

connect-go v2 (`connectrpc.com/connect/v2`, `connecthttp`, `connectproto`),
protovalidate (`buf.build/go/protovalidate`), Go 1.26. Names follow the
example in `proto-style.md`.

## Contents

- Mounting the server
- Validation interceptor
- Failure logger and Sunset
- Error mapping in the controller
- A server stream
- Handler tests
- Golden JSON test

## Mounting the server

`internal/app/api.go`. The one place the interceptors and limits are set;
`main` and the handler tests both call it, so tests run the real chain.

The request reaches it through `go-http-server`'s chain: recover, request
id, access log, route limits, then `go-auth`'s middleware (cross-origin
check, session or API key, the required header), which puts the principal
in the context. Inside Connect, the interceptors run outermost first.

```go
// APIDeps are the concretes the API needs, built by the caller.
type APIDeps struct {
	Orders ordersv1connect.OrderServiceHandler
	Logger *slog.Logger
}

// NewAPI builds the Connect server and returns its handler per service
// path, the shape go-http-server's Deps.API takes.
func NewAPI(production bool, deps APIDeps) (map[string]http.Handler, error) {
	telemetry, err := otelconnect.NewServerInterceptor()
	if err != nil {
		return nil, fmt.Errorf("otel interceptor: %w", err)
	}
	server := connect.NewServer( // outermost first
		telemetry,                    // spans and RPC metrics, rejected calls included
		rpc.LogFailures(deps.Logger), // internal and unknown, once, with the cause
		rpc.Validation(),             // protovalidate: invalid_argument + BadRequest
	)
	ordersv1connect.RegisterOrderServiceHandler(server, deps.Orders)
	if !production {
		grpcreflect.Register(server) // connectrpc.com/grpcreflect/v2
	}
	mux := http.NewServeMux()
	connecthttp.Mount(mux, server,
		connecthttp.WithRequireConnectProtocolHeader(), // CSRF, with go-auth and SameSite
		connecthttp.WithReadMaxBytes(1<<20),            // the "/" row's MaxBody
		connecthttp.WithCompressMinBytes(1<<10),
		connecthttp.WithHTTPGet(),                      // NO_SIDE_EFFECTS procedures as cacheable GETs
	)
	routes := make(map[string]http.Handler)
	for spec := range server.Specs() {
		service := spec.Procedure[:strings.LastIndexByte(spec.Procedure, '/')+1]
		routes[service] = mux // "/acme.orders.v1.OrderService/"
	}
	return routes, nil
}
```

`rpc` is `internal/platform/http/rpc`: transport plumbing with no business
meaning, so it imports neither `domain` nor the generated code.

A procedure that takes larger messages gets its own limit, matching its row
in go-http-server's route table, not a raised default:

```go
connecthttp.WithConditionalOptions(func(spec connect.Spec) []connecthttp.Option {
	if spec.Procedure == filesv1connect.FileServiceUploadPartProcedure {
		return []connecthttp.Option{connecthttp.WithReadMaxBytes(8 << 20)}
	}
	return nil
}),
```

Server streams need `WriteTimeout` 0 and a route-table row with
`Stream: true` and a lifetime; both are `go-http-server`'s. Every response
writer wrapper in that chain implements `Flush` and `Unwrap`.

Unencrypted HTTP/2, only when the listener is reachable from the proxy alone
and a gRPC client needs it (go-http-server builds the `http.Server`):

```go
var protocols http.Protocols
protocols.SetHTTP1(true)
protocols.SetUnencryptedHTTP2(cfg.H2C)
srv.Protocols = &protocols
```

## Validation interceptor

Not `connectrpc.com/validate`: its detail is `buf.validate.Violations`, and
the browser reads one shape, `google.rpc.BadRequest`.

```go
// Validation checks every request message against its protovalidate rules
// before the handler sees it.
func Validation() connect.ServerInterceptor {
	return func(next connect.ServerFunc) connect.ServerFunc {
		return func(ctx context.Context, spec connect.Spec, stream connect.ServerStream) error {
			return next(ctx, spec, validatingStream{stream})
		}
	}
}

type validatingStream struct{ connect.ServerStream }

func (s validatingStream) Receive(msg any) error {
	if err := s.ServerStream.Receive(msg); err != nil {
		return err
	}
	m, ok := msg.(proto.Message)
	if !ok {
		return nil
	}
	err := protovalidate.Validate(m)
	if err == nil {
		return nil
	}
	if verr, ok := errors.AsType[*protovalidate.ValidationError](err); ok {
		return BadRequest(verr)
	}
	// A rule that fails to compile is our bug, not the caller's.
	return connect.NewError(connect.CodeInternal, "internal error").WithCause(err)
}

// BadRequest turns violations into invalid_argument with one field
// violation per field, in protovalidate's path form (items[0].sku).
func BadRequest(verr *protovalidate.ValidationError) *connect.Error {
	var detail errdetails.BadRequest
	seen := make(map[string]bool)
	for _, v := range verr.Violations {
		field := protovalidate.FieldPathString(v.Proto.GetField())
		if seen[field] {
			continue
		}
		seen[field] = true
		detail.FieldViolations = append(detail.FieldViolations, &errdetails.BadRequest_FieldViolation{
			Field:       field,
			Description: v.Proto.GetMessage(),
		})
	}
	return WithDetail(connect.NewError(connect.CodeInvalidArgument, "Some fields need attention."), &detail)
}

// WithDetail attaches msg as an error detail; a detail that cannot be
// encoded is dropped rather than replacing the error.
func WithDetail(cerr *connect.Error, msg proto.Message) *connect.Error {
	d, err := connectproto.NewErrorDetail(msg)
	if err != nil {
		return cerr
	}
	return cerr.WithDetail(d)
}
```

## Failure logger and Sunset

```go
// LogFailures logs an RPC that ended internal or unknown, once, with the
// cause the mapping attached. Expected codes are metrics, not log lines.
func LogFailures(logger *slog.Logger) connect.ServerInterceptor {
	return func(next connect.ServerFunc) connect.ServerFunc {
		return func(ctx context.Context, spec connect.Spec, stream connect.ServerStream) error {
			err := next(ctx, spec, stream)
			code := connect.CodeOf(err)
			if err == nil || (code != connect.CodeInternal && code != connect.CodeUnknown) {
				return err
			}
			cause := err
			if cerr, ok := errors.AsType[*connect.Error](err); ok && cerr.Unwrap() != nil {
				cause = cerr.Unwrap()
			}
			logger.ErrorContext(ctx, "rpc failed",
				slog.String("procedure", spec.Procedure),
				slog.String("code", code.String()),
				slog.Any("error", cause))
			return err
		}
	}
}

// Sunset sets the Sunset header (RFC 8594) on every response of a
// deprecated package, such as "/acme.orders.v1.".
func Sunset(prefix string, date time.Time) connect.ServerInterceptor {
	value := date.UTC().Format(http.TimeFormat)
	return func(next connect.ServerFunc) connect.ServerFunc {
		return func(ctx context.Context, spec connect.Spec, stream connect.ServerStream) error {
			if info, ok := connect.CallInfoForServerContext(ctx); ok && strings.HasPrefix(spec.Procedure, prefix) {
				info.ResponseHeader().Set("Sunset", value)
			}
			return next(ctx, spec, stream)
		}
	}
}
```

## Error mapping in the controller

`internal/controller/errors.go`, the only place a domain error becomes a
code. Domain errors themselves: `golang-error-handling`.

```go
// toConnect maps an error from a module to the wire. Messages are fixed
// and user-safe; the original error rides as the cause and is never sent.
func toConnect(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return err // Connect maps these itself
	case errors.Is(err, domain.ErrNotFound):
		return connect.NewError(connect.CodeNotFound, "Not found.").WithCause(err)
	case errors.Is(err, domain.ErrAlreadyExists):
		return connect.NewError(connect.CodeAlreadyExists, "Already exists.").WithCause(err)
	case errors.Is(err, domain.ErrEmailTaken):
		return rpc.WithDetail(connect.NewError(connect.CodeInvalidArgument, "Some fields need attention."),
			&errdetails.BadRequest{FieldViolations: []*errdetails.BadRequest_FieldViolation{
				{Field: "email", Description: "This email is already registered."},
			}})
	case errors.Is(err, domain.ErrWrongState):
		return connect.NewError(connect.CodeFailedPrecondition, "This can no longer be changed.").WithCause(err)
	case errors.Is(err, domain.ErrUnauthenticated): // go-auth: no principal in ctx
		return connect.NewError(connect.CodeUnauthenticated, "Sign in to continue.").WithCause(err)
	case errors.Is(err, domain.ErrForbidden):
		return connect.NewError(connect.CodePermissionDenied, "Not allowed.").WithCause(err)
	case errors.Is(err, domain.ErrRateLimited):
		return connect.NewError(connect.CodeResourceExhausted, "Too many requests. Try again shortly.").WithCause(err)
	default:
		return connect.NewError(connect.CodeInternal, "internal error").WithCause(err)
	}
}
```

The controller implements the generated interface and only maps:

```go
// Orders serves acme.orders.v1.OrderService over the orders module.
type Orders struct {
	ordersv1connect.UnimplementedOrderServiceHandler // new RPCs answer unimplemented
	orders orderStore                                // consumer-side port
}

var _ ordersv1connect.OrderServiceHandler = (*Orders)(nil)

func (c *Orders) CancelOrder(ctx context.Context, req *ordersv1.CancelOrderRequest) (*ordersv1.CancelOrderResponse, error) {
	o, err := c.orders.Cancel(ctx, req.GetId())
	if err != nil {
		return nil, toConnect(err)
	}
	return &ordersv1.CancelOrderResponse{
		Status:     toStatus(o.Status),
		UpdateTime: timestamppb.New(o.UpdatedAt),
	}, nil
}
```

## A server stream

The route table's lifetime, the client leaving and shutdown all cancel
`ctx`; each is a normal end, and the client reconnects.

```go
func (c *Orders) WatchOrder(ctx context.Context, req *ordersv1.WatchOrderRequest,
	stream ordersv1connect.OrderServiceWatchOrderServerStream) error {
	changed, err := c.orders.Subscribe(ctx, req.GetId()) // released when ctx ends
	if err != nil {
		return toConnect(err)
	}
	heartbeat := time.NewTicker(25 * time.Second) // under the proxy's idle cut-off
	defer heartbeat.Stop()
	for {
		o, err := c.orders.Get(ctx, req.GetId())
		if err != nil {
			return toConnect(err)
		}
		if err := stream.Send(&ordersv1.WatchOrderResponse{Order: toOrder(o)}); err != nil {
			return err
		}
		if o.Final() {
			return nil
		}
		select {
		case <-ctx.Done():
			return nil
		case <-changed:
		case <-heartbeat.C:
		}
	}
}
```

## Handler tests

`internal/app/api_test.go`: `NewAPI` as production builds it, behind
go-auth's real middleware over a fake session store, the controller over a
fake port. The Go client speaks the Connect protocol with JSON, as the
browser does.

```go
func newTestServer(t *testing.T, store *fakeOrderStore) *httptest.Server {
	t.Helper()
	routes, err := NewAPI(false, APIDeps{
		Orders: controller.NewOrders(store),
		Logger: slog.New(slog.DiscardHandler),
	})
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	for pattern, h := range routes {
		mux.Handle(pattern, h)
	}
	// go-auth's real middleware (its signature is in go-auth references/sessions.md)
	// over a Sessions built on a fake store that knows "session-1".
	sessions, keys := newFakeAuth(t, map[string]domain.Principal{"session-1": testUser})
	csrf := http.NewCrossOriginProtection()
	srv := httptest.NewServer(auth.Middleware(sessions, keys, csrf, "Connect-Protocol-Version")(mux))
	t.Cleanup(srv.Close)
	return srv
}

func newTestClient(t *testing.T, store *fakeOrderStore) ordersv1connect.OrderServiceClient {
	srv := newTestServer(t, store)
	return ordersv1connect.NewOrderServiceClient(connect.NewClient(
		connecthttp.NewTransport(srv.Client(), srv.URL, connecthttp.WithProtoJSON()),
	))
}

func signedIn(t *testing.T) context.Context {
	ctx, info := connect.NewClientContext(t.Context())
	info.RequestHeader().Set("Cookie", "__Host-session=session-1")
	return ctx
}

func TestCancelOrder_ShippedOrderIsFailedPrecondition(t *testing.T) {
	client := newTestClient(t, &fakeOrderStore{cancelErr: domain.ErrWrongState})
	_, err := client.CancelOrder(signedIn(t), &ordersv1.CancelOrderRequest{Id: "ord_1"})
	if got := connect.CodeOf(err); got != connect.CodeFailedPrecondition {
		t.Fatalf("code = %v, want failed_precondition", got)
	}
}

func TestCreateOrder_NoItemsNamesTheField(t *testing.T) {
	client := newTestClient(t, &fakeOrderStore{})
	_, err := client.CreateOrder(signedIn(t), &ordersv1.CreateOrderRequest{
		IdempotencyKey: "0192f3a4-6b1c-7c3e-9a55-4b8f2d1e6a70",
	})
	cerr, ok := errors.AsType[*connect.Error](err)
	if !ok || cerr.Code() != connect.CodeInvalidArgument {
		t.Fatalf("err = %v, want invalid_argument", err)
	}
	var fields []string
	for _, d := range cerr.Details() {
		m, err := connectproto.UnmarshalErrorDetail(d)
		if br, ok := m.(*errdetails.BadRequest); err == nil && ok {
			for _, v := range br.GetFieldViolations() {
				fields = append(fields, v.GetField())
			}
		}
	}
	if !slices.Equal(fields, []string{"items"}) {
		t.Fatalf("fields = %v, want [items]", fields)
	}
}

func TestPostWithoutProtocolHeaderIsRejected(t *testing.T) {
	srv := newTestServer(t, &fakeOrderStore{})
	res, err := srv.Client().Post(srv.URL+ordersv1connect.OrderServiceCancelOrderProcedure,
		"application/json", strings.NewReader(`{"id":"ord_1"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", res.StatusCode)
	}
}
```

Fakes return domain errors; assert codes and field paths, never message
text. `connectinprocess` skips the HTTP layer, so the header rule, the limits
and the cookie are not tested through it.

## Golden JSON test

One per service, on a representative response with every field set. The
golden file shows the wire the browser reads; a rename or a type change
shows up in the review diff.

```go
var update = flag.Bool("update", false, "rewrite golden files")

func TestOrderJSONShape(t *testing.T) {
	msg := &ordersv1.GetOrderResponse{Order: &ordersv1.Order{
		Id:         "ord_1",
		Status:     ordersv1.OrderStatus_ORDER_STATUS_PLACED,
		CreateTime: timestamppb.New(time.Date(2026, 1, 2, 15, 4, 5, 0, time.UTC)),
		Items:      []*ordersv1.LineItem{{Sku: "sku_1", Quantity: 2}},
	}}
	raw, err := protojson.Marshal(msg) // the options Connect's JSON codec uses
	if err != nil {
		t.Fatal(err)
	}
	// protojson varies its whitespace on purpose; normalise before comparing.
	var got bytes.Buffer
	if err := json.Indent(&got, raw, "", "  "); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join("testdata", "get_order_response.json")
	if *update {
		if err := os.WriteFile(path, got.Bytes(), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	want, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got.Bytes(), want) {
		t.Errorf("JSON shape changed; review, then go test -run TestOrderJSONShape -update\ngot:\n%s", got.Bytes())
	}
}
```
