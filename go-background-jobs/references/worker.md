# Worker, handlers and enqueue

## Contents

- [Package shape](#package-shape)
- [Errors, classification and backoff](#errors-classification-and-backoff)
- [Registry](#registry)
- [The worker loop](#the-worker-loop)
- [Enqueue and LISTEN](#enqueue-and-listen)
- [Schedules](#schedules)
- [Wiring and shutdown](#wiring-and-shutdown)

PostgreSQL through pgx/v5; metrics calls are left out except where a value
is only known there. The SQL behind each `Store` method is in
[schema.md](schema.md). For SQLite, swap `Execer` for the
`database/sql` equivalent, drop `Listen`, and pass the clock into the
statements.

## Package shape

`internal/platform/jobs/` holds everything below. Its `Store` has one
method per statement in schema.md:

```go
Claim(ctx context.Context, worker string, kinds []string, n int, lease time.Duration) ([]Job, error)
Renew(ctx context.Context, j Job, lease time.Duration) (bool, error)   // false: lease lost
Complete(ctx context.Context, j Job) (bool, error)
Fail(ctx context.Context, j Job, state string, delay time.Duration, msg string) (bool, error)
Release(ctx context.Context, j Job) (bool, error)
ReapExpired(ctx context.Context) (kinds []string, err error)
```

Every `bool` is "the fenced update matched a row"; `false` is not an error,
it means another worker owns the job now.

## Errors, classification and backoff

```go
// Job is one claimed row. Attempt is the attempt number this claim set; it
// fences every later write for the job.
type Job struct {
	ID          int64
	Kind        string
	Payload     json.RawMessage
	Attempt     int
	MaxAttempts int
}

// Outcome is what happens to a job after its handler returns.
type Outcome string

const (
	Done  Outcome = "done"
	Retry Outcome = "retry"
	Dead  Outcome = "dead"
)

type permanentError struct{ err error }

func (e permanentError) Error() string { return e.err.Error() }
func (e permanentError) Unwrap() error { return e.err }

// Permanent marks err as one no retry can fix: the job goes to dead.
func Permanent(err error) error { return permanentError{err} }

type retryAfterError struct {
	err   error
	after time.Duration
}

func (e retryAfterError) Error() string { return e.err.Error() }
func (e retryAfterError) Unwrap() error { return e.err }

// RetryAfter retries after d (capped at maxBackoff) instead of the backoff.
func RetryAfter(err error, d time.Duration) error { return retryAfterError{err, d} }

// Classify maps a handler's error to an outcome. Timeouts, panics and
// unmarked errors retry.
func Classify(err error) Outcome {
	var perm permanentError
	switch {
	case err == nil:
		return Done
	case errors.As(err, &perm):
		return Dead
	default:
		return Retry
	}
}

const (
	baseBackoff = 10 * time.Second
	maxBackoff  = time.Hour
)

// delay is the wait before the next attempt, after attempt failed.
func delay(err error, attempt int) time.Duration {
	var ra retryAfterError
	if errors.As(err, &ra) {
		return min(ra.after, maxBackoff)
	}
	d := min(baseBackoff<<min(attempt-1, 20), maxBackoff)
	return d/2 + rand.N(d/2+1) // equal jitter: never less than half
}

// jitter spreads d over [d/2, 3d/2) so replicas do not poll in step.
func jitter(d time.Duration) time.Duration { return d/2 + rand.N(d) }
```

## Registry

```go
type handler struct {
	timeout time.Duration
	run     func(context.Context, Job) error
}

// Registry maps kinds to handlers. It is filled in the composition root
// before the worker starts and read-only after.
type Registry struct{ kinds map[string]handler }

func NewRegistry() *Registry { return &Registry{kinds: map[string]handler{}} }

// Kinds lists the registered kinds; the worker claims only these.
func (r *Registry) Kinds() []string {
	kinds := make([]string, 0, len(r.kinds))
	for k := range r.kinds {
		kinds = append(kinds, k)
	}
	return kinds
}

// Handle registers fn for kind. The payload is decoded into P, and
// validated when P has a Validate method, before fn runs; a payload that
// fails either is permanent, since a retry decodes the same bytes.
func Handle[P any](r *Registry, kind string, timeout time.Duration,
	fn func(ctx context.Context, job Job, payload P) error) {
	if _, dup := r.kinds[kind]; dup {
		panic("jobs: kind registered twice: " + kind) // wiring bug in the composition root
	}
	r.kinds[kind] = handler{timeout: timeout, run: func(ctx context.Context, j Job) error {
		var p P
		if err := json.Unmarshal(j.Payload, &p); err != nil {
			return Permanent(fmt.Errorf("decode %s payload: %w", kind, err))
		}
		if v, ok := any(p).(interface{ Validate() error }); ok {
			if err := v.Validate(); err != nil {
				return Permanent(fmt.Errorf("invalid %s payload: %w", kind, err))
			}
		}
		return fn(ctx, j, p)
	}}
}
```

A handler in a module, registered from `internal/app`:

```go
// SendConfirmation emails the order confirmation. Idempotent: the provider
// receives the job id as its idempotency key, so a second run sends nothing.
func (s *Service) SendConfirmation(ctx context.Context, job jobs.Job, p ConfirmationPayload) error {
	order, err := s.orders.Get(ctx, p.OrderID)
	if errors.Is(err, domain.ErrNotFound) {
		return jobs.Permanent(err) // the order is gone; nothing to confirm
	}
	if err != nil {
		return err
	}
	msg, err := renderConfirmation(order)
	if err != nil {
		return jobs.Permanent(err)
	}
	msg.IdempotencyKey = fmt.Sprintf("job-%d", job.ID)
	return s.mailer.Send(ctx, msg)
}
```

## The worker loop

```go
type Worker struct {
	store    *Store
	reg      *Registry
	log      *slog.Logger
	id       string        // host and a random suffix; for operators, not fencing
	limit    int           // concurrent handlers
	poll     time.Duration // default 2s
	lease    time.Duration // default 30s
	drain    time.Duration // bounded wait for running handlers at shutdown
	wake     <-chan struct{}
	inflight atomic.Int64
	freed    chan struct{} // buffered 1
	metrics  *metrics      // the counters in operations.md
}

// Run claims and runs jobs until ctx is cancelled, then stops claiming,
// waits up to w.drain for running handlers, cancels the rest and releases
// their leases.
func (w *Worker) Run(ctx context.Context) error {
	// Handlers get their own context so shutdown can let them finish.
	work, stopWork := context.WithCancel(context.WithoutCancel(ctx))
	defer stopWork()
	var g errgroup.Group
	g.SetLimit(w.limit)
	kinds := w.reg.Kinds()

	for {
		if free := w.limit - int(w.inflight.Load()); free > 0 {
			w.claim(ctx, work, &g, kinds, free)
		}
		select {
		case <-ctx.Done():
			done := make(chan struct{})
			go func() { _ = g.Wait(); close(done) }()
			select {
			case <-done:
			case <-time.After(w.drain):
				stopWork() // handlers see cancellation; process releases their leases
				<-done
			}
			return nil
		case <-w.wake: // LISTEN fired: new work committed
		case <-w.freed: // a slot opened
		case <-time.After(jitter(w.poll)):
			w.reap(ctx)
		}
	}
}

func (w *Worker) claim(ctx, work context.Context, g *errgroup.Group, kinds []string, n int) {
	batch, err := w.store.Claim(ctx, w.id, kinds, n, w.lease)
	if err != nil {
		if ctx.Err() == nil {
			w.log.ErrorContext(ctx, "claim jobs", "err", err)
		}
		return
	}
	for _, j := range batch {
		w.inflight.Add(1)
		g.Go(func() error {
			defer func() {
				w.inflight.Add(-1)
				select {
				case w.freed <- struct{}{}:
				default:
				}
			}()
			w.process(work, j)
			return nil
		})
	}
}

func (w *Worker) process(work context.Context, j Job) {
	h := w.reg.kinds[j.Kind] // claimed by kind, so always present
	ctx, cancel := context.WithTimeout(work, h.timeout)
	renewing := make(chan struct{})
	go func() { defer close(renewing); w.keepLease(ctx, cancel, j) }()

	err := call(ctx, h, j)
	cancel()
	<-renewing

	// The outcome must land even when shutdown cancelled the handler.
	wctx, wcancel := context.WithTimeout(context.WithoutCancel(work), 5*time.Second)
	defer wcancel()
	var werr error
	switch o := Classify(err); {
	case work.Err() != nil && o != Done:
		_, werr = w.store.Release(wctx, j)
	case o == Done:
		_, werr = w.store.Complete(wctx, j)
	case o == Retry && j.Attempt < j.MaxAttempts:
		_, werr = w.store.Fail(wctx, j, "queued", delay(err, j.Attempt), err.Error())
	default:
		_, werr = w.store.Fail(wctx, j, "dead", 0, err.Error())
	}
	if werr != nil {
		w.log.ErrorContext(wctx, "record job outcome", "job", j.ID, "kind", j.Kind, "err", werr)
	}
}

// keepLease renews j's lease every third of its length until ctx ends. A
// renewal that matches no row means another worker owns the job now, so
// the handler is cancelled.
func (w *Worker) keepLease(ctx context.Context, cancel context.CancelFunc, j Job) {
	t := time.NewTicker(w.lease / 3)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			ok, err := w.store.Renew(ctx, j, w.lease)
			if err == nil && !ok {
				w.log.WarnContext(ctx, "job lease lost", "job", j.ID, "kind", j.Kind)
				cancel()
				return
			}
			// An error is retried on the next tick; the lease has two left.
		}
	}
}

// call runs the handler and turns a panic into a retryable error.
func call(ctx context.Context, h handler, j Job) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("panic: %v\n%s", r, debug.Stack())
		}
	}()
	return h.run(ctx, j)
}

func (w *Worker) reap(ctx context.Context) {
	kinds, err := w.store.ReapExpired(ctx)
	if err != nil && !errors.Is(err, context.Canceled) {
		w.log.ErrorContext(ctx, "reap expired leases", "err", err)
	}
	for _, kind := range kinds {
		w.metrics.leaseExpired.WithLabelValues(kind).Inc()
	}
}
```

Why each piece is there:

- `context.WithoutCancel(ctx)` for `work`: the root context is cancelled the
  moment shutdown starts, but running handlers get `w.drain` to finish. The
  worker owns `work`, cancels it on drain timeout, and waits for every
  goroutine, which is what golang-context asks of `WithoutCancel`.
- The claim is sized to the free slots, so `g.Go` never blocks the loop and
  a claimed job never waits in memory with its lease running.
- `freed` and `wake` are buffered with one slot and written without
  blocking: several signals collapse into one claim.
- The reaper runs on the poll branch only, so a busy `LISTEN` stream does not
  add a statement per job.
- Release is chosen whenever shutdown cancelled the handler, so a deploy
  does not burn attempts.

## Enqueue and LISTEN

```go
// MaxPayload bounds a job's payload. Large content is stored elsewhere and
// the payload carries its key.
const MaxPayload = 64 << 10

// Execer is the part of pgx.Tx and *pgxpool.Pool that Enqueue needs.
type Execer interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

type enqueueOptions struct {
	delay       time.Duration
	maxAttempts int
}

type EnqueueOption func(*enqueueOptions)

func After(d time.Duration) EnqueueOption { return func(o *enqueueOptions) { o.delay = d } }
func MaxAttempts(n int) EnqueueOption     { return func(o *enqueueOptions) { o.maxAttempts = n } }

// Enqueue writes a job through q. Pass the caller's transaction when the job
// is a side effect of a write in it: the job then commits or rolls back with
// that write.
func Enqueue(ctx context.Context, q Execer, kind string, payload any, opts ...EnqueueOption) error {
	o := enqueueOptions{maxAttempts: 10}
	for _, opt := range opts {
		opt(&o)
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("encode %s payload: %w", kind, err)
	}
	if len(b) > MaxPayload {
		return fmt.Errorf("%s payload is %d bytes, over %d: store the data and enqueue its key",
			kind, len(b), MaxPayload)
	}
	const insert = `INSERT INTO jobs (kind, payload, run_at, max_attempts)
		VALUES ($1, $2, now() + make_interval(secs => $3), $4)`
	if _, err := q.Exec(ctx, insert, kind, b, o.delay.Seconds(), o.maxAttempts); err != nil {
		return fmt.Errorf("enqueue %s: %w", kind, err)
	}
	if _, err := q.Exec(ctx, `SELECT pg_notify('jobs', $1)`, kind); err != nil {
		return fmt.Errorf("notify %s: %w", kind, err)
	}
	return nil
}

// Listen wakes the worker when a job commits. It holds one pool connection
// for its lifetime and reconnects after a failure; the worker's poll covers
// any notification lost in between.
func Listen(ctx context.Context, pool *pgxpool.Pool, log *slog.Logger, wake chan<- struct{}) {
	for ctx.Err() == nil {
		err := listenOnce(ctx, pool, wake)
		if ctx.Err() == nil {
			log.WarnContext(ctx, "job listener stopped; reconnecting", "err", err)
			select {
			case <-ctx.Done():
			case <-time.After(jitter(5 * time.Second)):
			}
		}
	}
}

func listenOnce(ctx context.Context, pool *pgxpool.Pool, wake chan<- struct{}) error {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return err
	}
	// LISTEN state must not return to the pool: close the connection after.
	defer func() { _ = conn.Hijack().Close(context.Background()) }()
	if _, err := conn.Exec(ctx, "LISTEN jobs"); err != nil {
		return err
	}
	for {
		if _, err := conn.Conn().WaitForNotification(ctx); err != nil {
			return err
		}
		select {
		case wake <- struct{}{}: // buffered 1; a pending wake already covers this one
		default:
		}
	}
}
```

The listener's connection counts against the pool: size `MaxConns` one
higher. A transaction that enqueues thousands of jobs sends one
notification per `Enqueue`; for a bulk insert, enqueue with a plain
`INSERT ... SELECT` and one `pg_notify` at the end.

## Schedules

```go
// cronSpec is the parse result of a five-field expression; Next returns the
// first slot strictly after t.
type cronSpec interface{ Next(t time.Time) time.Time }

type schedule struct {
	Every     time.Duration // or Cron
	Cron      cronSpec
	NextRunAt time.Time // the slot just enqueued
}

// nextRun is the slot after the one just enqueued, from the database's
// clock. Missed slots are skipped: downtime produces one catch-up run.
func nextRun(s schedule, dbNow time.Time) time.Time {
	if s.Every > 0 {
		// Stay on the original grid.
		missed := dbNow.Sub(s.NextRunAt) / s.Every
		return s.NextRunAt.Add((missed + 1) * s.Every)
	}
	return s.Cron.Next(dbNow.UTC())
}
```

Each poll, the worker claims due schedules (schema.md), and for each one
runs one transaction: insert the job for the slot, set `next_run_at =
nextRun(s, dbNow)`, fenced by `locked_until`. `cronSpec` is the parse
result of a five-field expression: the parser of a cron package already in
`go.mod` (only its parser, never its scheduler) or a small in-repo parser
with a table test. An interval schedule needs neither.

## Wiring and shutdown

In `internal/app`, after the pool and the modules are built:

```go
reg := jobs.NewRegistry()
jobs.Handle(reg, orders.KindSendConfirmation, 30*time.Second, ordersSvc.SendConfirmation)
jobs.Handle(reg, webhooks.KindDeliver, 15*time.Second, deliverer.Deliver)
jobs.Handle(reg, jobs.KindPrune, 5*time.Minute, jobs.Prune(store, 7)) // days of done rows kept

schedules := []jobs.Schedule{
	{Name: "jobs.prune", Kind: jobs.KindPrune, Every: 24 * time.Hour},
	{Name: "billing.close_day", Kind: billing.KindCloseDay, Cron: "5 0 * * *"},
}
```

Start order: pool, migrations check, modules, worker (and listener), HTTP
server. Stop order is the reverse, inside service-operations' sequence:

1. Readiness turns 503; the HTTP server drains.
2. The worker's context is cancelled: it stops claiming and polling
   schedules; the listener returns.
3. Running handlers get `drain` (default 20 s; it must fit inside what is
   left of the platform's grace period, the unit's `TimeoutStopSec`, after
   the HTTP drain), then are
   cancelled and their leases released.
4. The pool closes after the worker's `Run` returns.

A handler that ignores its context keeps the process alive past the grace
period; the platform kills it and the lease expires. That is the recovery
path, not the plan.
