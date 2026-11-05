# Resource management

## Bounded pools

A pool has a fixed maximum. A buffered channel is the simplest bounded pool,
and `Get` honours cancellation:

```go
type ConnPool struct{ conns chan *Conn }

func (p *ConnPool) Get(ctx context.Context) (*Conn, error) {
	select {
	case c := <-p.conns:
		return c, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (p *ConnPool) Put(c *Conn) {
	select {
	case p.conns <- c:
	default:
		_ = c.Close() // pool full; best-effort discard
	}
}
```

Use the pool a driver already provides (pgxpool, `http.Transport`) before
writing one. `sync.Pool` is for reusable scratch memory, not for limiting
how many of something exist.

## `runtime.AddCleanup`

For a non-memory resource tied to an object's lifetime (Go 1.24+). Unlike
`SetFinalizer`, several cleanups can attach to one object, the cleanup gets
a value rather than the object (no resurrection), and cycles do not block
it. It is a backstop; an explicit `Close` is still the contract.

```go
r := &Resource{handle: acquire()}
runtime.AddCleanup(r, release, r.handle)
```

## Shutdown sequence

`main` stays thin: it creates the signal context and hands it to the
composition root (`go-project-layout`), which starts components in
dependency order and stops them in reverse.

```go
func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := app.Run(ctx); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
```

Inside `app.Run`:

1. Build dependencies in order: config, logger, database pool, modules,
   HTTP server.
2. Start the server and background workers in goroutines that report their
   error on a channel or through an errgroup (`golang-concurrency`).
3. Wait for `ctx.Done()` or the first component error.
4. Shut down with a fresh deadline (`context.WithTimeout(context.Background(), 30*time.Second)`),
   since `ctx` is already cancelled: stop accepting requests
   (`srv.Shutdown`), stop and wait for workers, then close the pool.
5. Return the first meaningful error, joined with shutdown errors.
