# Streams and outbound clients

## Contents

- [Connect server streams](#connect-server-streams)
- [SSE](#sse)
- [Outbound clients](#outbound-clients)
- [Retries with a budget](#retries-with-a-budget)

## Connect server streams

The default for live data. The proto and handler shape are `connect-rpc`'s;
the server side here is what keeps a stream alive and bounded:

- A route-table row with `Stream: true` and a lifetime (say 30 minutes).
  The handler loops on `ctx.Done()`, which fires when the client leaves,
  the lifetime ends or shutdown starts. Ending is normal: return `nil`, and
  the client reconnects with its last cursor.
- `WriteTimeout` is 0 on the server (SKILL.md, the server table).
- A heartbeat message every 25 s (a `oneof` member of the response, or an
  empty update), because proxies cut idle streams: Cloudflare at 100 s.
- One subscription to the in-process broker per stream, released by
  `defer`; never a held transaction or pooled connection.
- A per-principal cap on open streams, counted in the handler and refused
  with `ResourceExhausted` when full.
- Every response-writer wrapper in the chain implements `Flush` and
  `Unwrap`, or connect-go fails the stream with "does not implement
  http.Flusher".

## SSE

For a live endpoint outside Connect:

```go
type Event struct {
	ID, Name string
	Data     []byte // one line of JSON
}

// SSE streams until r.Context() ends: client gone, the row's lifetime, or
// shutdown (RouteLimits binds all three).
func SSE(subscribe func(*http.Request) (<-chan Event, func()), heartbeat time.Duration) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rc := http.NewResponseController(w)
		events, unsubscribe := subscribe(r)
		defer unsubscribe()

		h := w.Header()
		h.Set("Content-Type", "text/event-stream")
		h.Set("Cache-Control", "no-cache")
		h.Set("X-Accel-Buffering", "no") // proxies that buffer by default
		w.WriteHeader(http.StatusOK)
		if err := rc.Flush(); err != nil {
			return // a wrapper in the chain lacks Unwrap
		}

		tick := time.NewTicker(heartbeat)
		defer tick.Stop()
		for {
			select {
			case <-r.Context().Done():
				return
			case <-tick.C:
				if _, err := io.WriteString(w, ": ping\n\n"); err != nil {
					return
				}
			case ev, ok := <-events:
				if !ok {
					return
				}
				if _, err := fmt.Fprintf(w, "id: %s\nevent: %s\ndata: %s\n\n", ev.ID, ev.Name, ev.Data); err != nil {
					return
				}
			}
			if err := rc.Flush(); err != nil {
				return
			}
		}
	})
}
```

The browser's `EventSource` reconnects by itself and sends `Last-Event-ID`;
`subscribe` resumes from it. `Data` must not contain a newline; JSON
encoded on one line never does. An SSE route is a GET, so it changes
nothing.

## Outbound clients

```go
// NewClient is the only way the service builds a client for a fixed upstream.
func NewClient(timeout time.Duration, followRedirects bool) *http.Client {
	t := http.DefaultTransport.(*http.Transport).Clone()
	t.MaxIdleConns = 100
	t.MaxIdleConnsPerHost = 10
	t.MaxConnsPerHost = 50
	t.ResponseHeaderTimeout = 10 * time.Second
	c := &http.Client{Transport: t, Timeout: timeout}
	if !followRedirects {
		c.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	}
	return c
}

// NewUserURLClient fetches URLs that came from a user (webhooks, imports):
// no redirects, no proxy, and the dialer checks the resolved address, so DNS
// rebinding and redirects to internal hosts both fail. go-background-jobs'
// webhook delivery uses it.
func NewUserURLClient(timeout time.Duration) *http.Client {
	d := &net.Dialer{Timeout: 5 * time.Second, Control: refusePrivate}
	return &http.Client{
		Transport: &http.Transport{
			Proxy:                 nil, // an environment proxy would dial for us, past the guard
			DialContext:           d.DialContext,
			TLSHandshakeTimeout:   5 * time.Second,
			ResponseHeaderTimeout: 10 * time.Second,
			MaxIdleConnsPerHost:   2,
		},
		Timeout:       timeout,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
}

var cgnat = netip.MustParsePrefix("100.64.0.0/10")

func refusePrivate(network, address string, _ syscall.RawConn) error {
	ap, err := netip.ParseAddrPort(address)
	if err != nil {
		return err
	}
	ip := ap.Addr().Unmap()
	if !ip.IsGlobalUnicast() || ip.IsPrivate() || cgnat.Contains(ip) {
		return fmt.Errorf("dial %s: address not allowed", ip)
	}
	return nil
}
```

Wrap the transport for tracing as `golang-observability` says. Every call
uses `http.NewRequestWithContext`; read bodies through
`io.LimitReader(resp.Body, max)` and close them on every path. The
URL-level checks (scheme, port, allowlist) are in `golang-security`'s
injection reference; the dialer check is the one that holds after DNS.

## Retries with a budget

Retry only a call that is safe to repeat: GET, PUT, DELETE, or a POST that
carries an idempotency key. The budget caps retries across all callers of
one upstream, so an outage does not triple the load on it.

```go
type Budget struct{ tokens chan struct{} }

func NewBudget(n int) *Budget {
	b := &Budget{tokens: make(chan struct{}, n)}
	for range n {
		b.tokens <- struct{}{}
	}
	return b
}

func (b *Budget) take() bool {
	select {
	case <-b.tokens:
		return true
	default:
		return false
	}
}

// Refill returns one token; internal/app calls it on a ticker (say 1/s).
func (b *Budget) Refill() {
	select {
	case b.tokens <- struct{}{}:
	default:
	}
}

func Do(ctx context.Context, c *http.Client, b *Budget, newReq func(context.Context) (*http.Request, error)) (*http.Response, error) {
	const attempts = 3
	backoff := 200 * time.Millisecond
	for i := 0; ; i++ {
		req, err := newReq(ctx) // a fresh request, so the body is new each time
		if err != nil {
			return nil, err
		}
		resp, err := c.Do(req)
		wait, retry := retryable(resp, err)
		if !retry || i == attempts-1 || !b.take() {
			return resp, err
		}
		if resp != nil {
			resp.Body.Close()
		}
		if wait == 0 {
			wait = backoff + rand.N(backoff) // math/rand/v2 jitter
			backoff *= 2
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(wait):
		}
	}
}

func retryable(resp *http.Response, err error) (time.Duration, bool) {
	if err != nil {
		return 0, !errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded)
	}
	switch resp.StatusCode {
	case http.StatusTooManyRequests, http.StatusServiceUnavailable:
		s, err := strconv.Atoi(resp.Header.Get("Retry-After"))
		if err != nil {
			return 0, true // absent, or a date: back off
		}
		return time.Duration(s) * time.Second, s >= 0 && s <= 30
	case http.StatusBadGateway, http.StatusGatewayTimeout:
		return 0, true
	}
	return 0, false
}
```

A `Retry-After` longer than the caller can wait is not retried; the error
goes back with the response.
