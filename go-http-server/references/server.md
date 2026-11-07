# Server, chain and limits

## Contents

- [Package shape](#package-shape)
- [Server and Run](#server-and-run)
- [Assembling the handler](#assembling-the-handler)
- [Recover and request ID](#recover-and-request-id)
- [Client IP](#client-ip)
- [Access log and the route holder](#access-log-and-the-route-holder)
- [Route table: body limit and deadline](#route-table-body-limit-and-deadline)
- [Security headers and CORS](#security-headers-and-cors)
- [Rate limiter](#rate-limiter)

The code is the shape, not a library to copy blindly: metric and span
wiring follow `golang-observability`, Problem bodies follow `api-contract`
or `connect-rpc`, and `http.Error` stands in for them below.

## Package shape

```
internal/platform/http/
  server.go       NewServer, Run
  handler.go      Deps, NewHandler: the mux and the chain
  middleware.go   Recover, RequestID, ClientIP, AccessLog, Route
  limits.go       the route table, SecurityHeaders
  ratelimit.go    the per-client limiter
  spa.go          the embedded frontend and the CSP (frontend.md)
  client.go       outbound clients and retries (streaming-and-clients.md)
```

`platform/` imports neither `domain` nor `modules` (`go-project-layout`), so
anything that needs the principal (the auth middleware, the rate-limit key)
arrives as a function from `internal/app`. The package clause matches the
directory (`package http`); a file that also needs `net/http` imports it as
`httpx`.

## Server and Run

```go
type Config struct {
	Addr      string
	Streaming bool          // any route streams
	Drain     time.Duration // shorter than the platform's grace period
}

func NewServer(cfg Config, h http.Handler, logger *slog.Logger, base context.Context) *http.Server {
	write := 60 * time.Second
	if cfg.Streaming {
		write = 0 // connection-wide; unary rows set a write deadline per request
	}
	return &http.Server{
		Addr:              cfg.Addr,
		Handler:           h,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      write,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    64 << 10,
		BaseContext:       func(net.Listener) context.Context { return base },
		ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelWarn),
	}
}

// Run serves until ctx is cancelled, then drains. internal/app has already
// turned /readyz to 503 and cancelled the streams context before ctx ends.
func Run(ctx context.Context, srv *http.Server, ln net.Listener, drain time.Duration) error {
	errc := make(chan error, 1)
	go func() { errc <- srv.Serve(ln) }()

	select {
	case err := <-errc:
		return err // Serve failed before shutdown was asked for
	case <-ctx.Done():
	}

	sctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), drain)
	defer cancel()
	if err := srv.Shutdown(sctx); err != nil {
		return errors.Join(err, srv.Close())
	}
	if err := <-errc; !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
```

`internal/app` owns the listener (`net.Listen`), so tests and the
`healthcheck` subcommand can bind `127.0.0.1:0`. The streams context is a
separate `context.WithCancel` that the app cancels at the first step of
shutdown (or through `srv.RegisterOnShutdown`); the route table binds every
stream to it.

## Assembling the handler

```go
type Deps struct {
	Logger                 *slog.Logger
	Dist                   fs.FS                   // fs.Sub(web.Build, "build")
	API                    map[string]http.Handler // Connect paths, "/api/v1/" for ogen
	Health, Ready, Metrics http.Handler
	Auth                   func(http.Handler) http.Handler // go-auth, wired in internal/app
	RateKey                KeyFunc
	Trusted                []netip.Prefix // APP_HTTP_TRUSTED_PROXIES
	IPHeader               string         // "CF-Connecting-IP" behind Cloudflare, else "X-Forwarded-For"
	HSTS                   bool           // the public origin is https
	Limits                 []Limits
	Streams                context.Context // cancelled when shutdown starts
}

func NewHandler(d Deps) (http.Handler, error) {
	spa, err := SPA(d.Dist, "_app/immutable/")
	if err != nil {
		return nil, err
	}
	csp, err := CSP(d.Dist)
	if err != nil {
		return nil, err
	}

	mux := http.NewServeMux()
	handle := func(p string, h http.Handler) { mux.Handle(p, Route(h)) }
	handle("GET /healthz", d.Health)
	handle("GET /readyz", d.Ready)
	handle("GET /metrics", d.Metrics)
	for p, h := range d.API {
		handle(p, h)
	}
	handle("/api/", apiNotFound) // a Problem 404; never the SPA
	handle("/", spa)             // no method: "GET /" conflicts with the subtrees above

	rl := NewRateLimiter(10, 20, d.RateKey)
	return Chain(mux,
		Recover(d.Logger),
		RequestID,
		ClientIP(d.Trusted, d.IPHeader),
		AccessLog(d.Logger),
		RouteLimits(d.Limits, d.Streams),
		SecurityHeaders(csp, d.HSTS),
		// CORS here, only when the SPA is served from another origin
		d.Auth,
		rl.Middleware,
	), nil
}

type Middleware = func(http.Handler) http.Handler

// Chain applies ms so that ms[0] is the outermost.
func Chain(h http.Handler, ms ...Middleware) http.Handler {
	for i := len(ms) - 1; i >= 0; i-- {
		h = ms[i](h)
	}
	return h
}
```

## Recover and request ID

```go
func Recover(logger *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				v := recover()
				if v == nil {
					return
				}
				if v == http.ErrAbortHandler {
					panic(v) // net/http's own signal to abort the response
				}
				logger.ErrorContext(r.Context(), "panic",
					"panic", fmt.Sprint(v),
					"request_id", w.Header().Get("X-Request-ID"), // set by the next layer
					"stack", string(debug.Stack()))
				http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			}()
			next.ServeHTTP(w, r)
		})
	}
}

type ctxKey int

const (
	requestIDKey ctxKey = iota
	clientIPKey
	routeKey
)

var safeID = regexp.MustCompile(`^[A-Za-z0-9._-]{1,64}$`)

func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if !safeID.MatchString(id) {
			id = rand.Text() // crypto/rand
		}
		w.Header().Set("X-Request-ID", id)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), requestIDKey, id)))
	})
}

func RequestIDFrom(ctx context.Context) string { s, _ := ctx.Value(requestIDKey).(string); return s }
```

The logger with the request ID and trace ID attached goes into the context
here as well, per `service-operations` and `golang-observability`.

## Client IP

```go
func ClientIP(trusted []netip.Prefix, header string) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := peer(r.RemoteAddr)
			if header != "" && isTrusted(ip, trusted) {
				ip = fromHeader(r.Header.Values(header), trusted, ip)
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), clientIPKey, ip)))
		})
	}
}

func ClientIPFrom(ctx context.Context) netip.Addr {
	a, _ := ctx.Value(clientIPKey).(netip.Addr)
	return a
}

func peer(remote string) netip.Addr {
	ap, err := netip.ParseAddrPort(remote)
	if err != nil {
		return netip.Addr{}
	}
	return ap.Addr().Unmap()
}

func isTrusted(ip netip.Addr, trusted []netip.Prefix) bool {
	for _, p := range trusted {
		if p.Contains(ip) {
			return true
		}
	}
	return false
}

// fromHeader walks right to left and returns the first address that is not a
// trusted proxy: everything left of it was written by the client.
func fromHeader(values []string, trusted []netip.Prefix, fallback netip.Addr) netip.Addr {
	parts := strings.Split(strings.Join(values, ","), ",")
	for i := len(parts) - 1; i >= 0; i-- {
		ip, err := netip.ParseAddr(strings.TrimSpace(parts[i]))
		if err != nil {
			return fallback
		}
		if ip = ip.Unmap(); !isTrusted(ip, trusted) {
			return ip
		}
	}
	return fallback
}
```

The trusted list is empty by default, so the peer address is the client.
Behind Cloudflare Tunnel the peer is `cloudflared` (loopback or the
container network): trust that prefix and read `CF-Connecting-IP`. Leave
`r.RemoteAddr` untouched; consumers read `ClientIPFrom(ctx)`.

## Access log and the route holder

```go
type route struct{ pattern string }

// Route wraps every handler at registration. The mux sets r.Pattern on the
// request it received, which is a copy once any middleware called WithContext.
func Route(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if rt, ok := r.Context().Value(routeKey).(*route); ok {
			rt.pattern = r.Pattern
		}
		h.ServeHTTP(w, r)
	})
}

type recorder struct {
	http.ResponseWriter
	status int
	bytes  int64
}

func (rw *recorder) WriteHeader(code int) {
	if rw.status == 0 {
		rw.status = code
	}
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *recorder) Write(b []byte) (int, error) {
	if rw.status == 0 {
		rw.status = http.StatusOK
	}
	n, err := rw.ResponseWriter.Write(b)
	rw.bytes += int64(n)
	return n, err
}

// Flush: connect-go asserts http.Flusher for server streams.
func (rw *recorder) Flush() { _ = http.NewResponseController(rw.ResponseWriter).Flush() }

// Unwrap: http.ResponseController reaches deadlines and Flush through it.
func (rw *recorder) Unwrap() http.ResponseWriter { return rw.ResponseWriter }

func AccessLog(logger *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start, rt, rw := time.Now(), &route{}, &recorder{ResponseWriter: w}
			done := false
			defer func() {
				status := rw.status
				switch {
				case !done:
					status = http.StatusInternalServerError // panicking; Recover answers
				case status == 0:
					status = http.StatusOK
				}
				logger.InfoContext(r.Context(), "request",
					"method", r.Method, "route", rt.pattern, "status", status,
					"bytes", rw.bytes, "duration", time.Since(start),
					"request_id", RequestIDFrom(r.Context()))
			}()
			next.ServeHTTP(rw, r.WithContext(context.WithValue(r.Context(), routeKey, rt)))
			done = true
		})
	}
}
```

RED metrics read the same `rt.pattern` after `next` returns; an unmatched
request has an empty pattern, recorded as one `unmatched` label value, never
the raw path. The server span is started here and renamed from the pattern
(`golang-observability`).

## Route table: body limit and deadline

```go
// Limits is one row. The first row whose Prefix matches wins; the last row
// has Prefix "/" and is the default.
type Limits struct {
	Prefix  string
	MaxBody int64
	Timeout time.Duration // unary: request deadline; stream: lifetime
	Stream  bool
}

var DefaultLimits = []Limits{
	{Prefix: "/acme.v1.LiveService/", MaxBody: 64 << 10, Timeout: 30 * time.Minute, Stream: true},
	{Prefix: "/api/v1/uploads", MaxBody: 50 << 20, Timeout: 5 * time.Minute},
	{Prefix: "/", MaxBody: 1 << 20, Timeout: 30 * time.Second},
}

func RouteLimits(table []Limits, streams context.Context) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			l := match(table, r.URL.Path)
			r.Body = http.MaxBytesReader(w, r.Body, l.MaxBody)
			ctx, cancel := context.WithTimeout(r.Context(), l.Timeout)
			defer cancel()
			if l.Stream {
				stop := context.AfterFunc(streams, cancel) // end at shutdown, not at the drain deadline
				defer stop()
			} else {
				_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(l.Timeout + 5*time.Second))
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func match(table []Limits, path string) Limits {
	for _, l := range table {
		if strings.HasPrefix(path, l.Prefix) {
			return l
		}
	}
	return table[len(table)-1]
}
```

An upload row that outlives `ReadTimeout` also calls
`SetReadDeadline` through the `ResponseController`. Connect handlers take
`connecthttp.WithReadMaxBytes` at the same value as their row, so an oversized
message fails as a Connect error, not a bare 413.

## Security headers and CORS

```go
func SecurityHeaders(csp string, hsts bool) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := w.Header()
			h.Set("Content-Security-Policy", csp) // includes frame-ancestors 'none'
			h.Set("X-Content-Type-Options", "nosniff")
			h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
			if hsts {
				h.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
			}
			next.ServeHTTP(w, r)
		})
	}
}
```

`frame-ancestors` works only as a header (a `<meta>` policy ignores it), so
the header is the source of the policy. HSTS is sent when the configured
public origin is https, whether TLS ends here or at a proxy.

CORS, only when the SPA is served from another origin: an exact origin
allowlist from config (never `*`, never the reflected `Origin`),
`Vary: Origin`, credentials allowed only for listed origins, preflight
answered with 204 before auth. Allow Connect's request headers
(`Connect-Protocol-Version`, `Connect-Timeout-Ms`, plus the project's CSRF
header) and expose `Grpc-Status`, `Grpc-Message` when gRPC-web is used;
`connectrpc.com/cors` lists them. The auth middleware's
`http.CrossOriginProtection` must trust the same origins (`go-auth`).

## Rate limiter

```go
// KeyFunc names the client: "user:<id>", "key:<id>", else "ip:<addr or /64>".
type KeyFunc func(*http.Request) string

type client struct {
	lim  *rate.Limiter
	seen time.Time
}

type RateLimiter struct {
	mu      sync.Mutex
	clients map[string]*client
	every   rate.Limit
	burst   int
	key     KeyFunc
}

func NewRateLimiter(perSecond float64, burst int, key KeyFunc) *RateLimiter {
	return &RateLimiter{clients: map[string]*client{}, every: rate.Limit(perSecond), burst: burst, key: key}
}

func (rl *RateLimiter) get(k string, now time.Time) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	c, ok := rl.clients[k]
	if !ok {
		c = &client{lim: rate.NewLimiter(rl.every, rl.burst)}
		rl.clients[k] = c
	}
	c.seen = now
	return c.lim
}

func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		now := time.Now()
		res := rl.get(rl.key(r), now).ReserveN(now, 1)
		if d := res.DelayFrom(now); d > 0 {
			res.CancelAt(now)
			w.Header().Set("Retry-After", strconv.Itoa(int(math.Ceil(d.Seconds()))))
			http.Error(w, http.StatusText(http.StatusTooManyRequests), http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Sweep drops clients idle longer than idle; internal/app runs it in its errgroup.
func (rl *RateLimiter) Sweep(ctx context.Context, idle time.Duration) {
	t := time.NewTicker(idle)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-t.C:
			rl.mu.Lock()
			for k, c := range rl.clients {
				if now.Sub(c.seen) > idle {
					delete(rl.clients, k)
				}
			}
			rl.mu.Unlock()
		}
	}
}
```

The key function in `internal/app`:

```go
func rateKey(r *http.Request) string {
	if p := domain.CurrentUser(r.Context()); p.Authenticated() {
		if p.Via == domain.AuthAPIKey {
			return "key:" + p.KeyID
		}
		return "user:" + fmt.Sprint(p.UserID)
	}
	ip := httpx.ClientIPFrom(r.Context())
	if ip.Is6() {
		pfx, _ := ip.Prefix(64)
		return "ip:" + pfx.String()
	}
	return "ip:" + ip.String()
}
```

Expensive operations (export, search) get a second, stricter limiter on
their routes with the same key function.
