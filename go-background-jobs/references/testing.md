# Tests

## Contents

- [Classification and backoff](#classification-and-backoff)
- [A handler, with a fake clock](#a-handler-with-a-fake-clock)
- [Integration: claims and leases](#integration-claims-and-leases)

Unit tests use the standard library only (golang-testing). The integration
tests run on the real database behind `//go:build integration`, through the
repository's harness (golang-database's testing reference).

## Classification and backoff

In `internal/platform/jobs`, beside the code:

```go
func TestClassify(t *testing.T) {
	boom := errors.New("boom")
	tests := []struct {
		name string
		err  error
		want Outcome
	}{
		{name: "success", err: nil, want: Done},
		{name: "plain error", err: boom, want: Retry},
		{name: "timeout", err: context.DeadlineExceeded, want: Retry},
		{name: "retry after", err: RetryAfter(boom, time.Minute), want: Retry},
		{name: "permanent", err: Permanent(boom), want: Dead},
		{name: "wrapped permanent", err: fmt.Errorf("send: %w", Permanent(boom)), want: Dead},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Classify(tt.err); got != tt.want {
				t.Errorf("Classify(%v) = %s, want %s", tt.err, got, tt.want)
			}
		})
	}
}

func TestDelay_StaysWithinJitterAndCap(t *testing.T) {
	for attempt := 1; attempt <= 30; attempt++ {
		full := min(baseBackoff<<min(attempt-1, 20), maxBackoff)
		for range 100 {
			if d := delay(errors.New("x"), attempt); d < full/2 || d > full {
				t.Fatalf("delay(attempt %d) = %v, want within [%v, %v]", attempt, d, full/2, full)
			}
		}
	}
	if d := delay(RetryAfter(errors.New("x"), 2*time.Hour), 1); d != maxBackoff {
		t.Errorf("RetryAfter(2h) delay = %v, want the %v cap", d, maxBackoff)
	}
}
```

## A handler, with a fake clock

Each handler has a table that maps what its downstream can say to done,
retry or dead. The clock is a `now func() time.Time` field, so the signed
timestamp is fixed and the receiver's window check is deterministic.

```go
type fakeEndpoints map[string]Endpoint

func (f fakeEndpoints) Endpoint(_ context.Context, id string) (Endpoint, error) {
	ep, ok := f[id]
	if !ok {
		return Endpoint{}, ErrNotFound
	}
	return ep, nil
}

func TestDeliver_ClassifiesResponses(t *testing.T) {
	now := time.Date(2026, 3, 1, 12, 0, 0, 0, time.UTC)
	secret := []byte("0123456789abcdef0123456789abcdef")
	body := []byte(`{"id":"evt_1","type":"order.completed"}`)

	tests := []struct {
		name       string
		status     int
		retryAfter string
		want       jobs.Outcome
	}{
		{name: "accepted", status: http.StatusNoContent, want: jobs.Done},
		{name: "server error", status: http.StatusBadGateway, want: jobs.Retry},
		{name: "rate limited", status: http.StatusTooManyRequests, retryAfter: "30", want: jobs.Retry},
		{name: "receiver timeout", status: http.StatusRequestTimeout, want: jobs.Retry},
		{name: "rejected", status: http.StatusBadRequest, want: jobs.Dead},
		{name: "gone", status: http.StatusGone, want: jobs.Dead},
		{name: "redirect", status: http.StatusFound, want: jobs.Dead},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				got, _ := io.ReadAll(r.Body)
				sig := r.Header.Get("Webhook-Signature")
				if err := Verify(sig, got, [][]byte{secret}, now, 5*time.Minute); err != nil {
					t.Errorf("Verify() = %v", err)
				}
				if tt.retryAfter != "" {
					w.Header().Set("Retry-After", tt.retryAfter)
				}
				if tt.status == http.StatusFound {
					w.Header().Set("Location", "http://169.254.169.254/")
				}
				w.WriteHeader(tt.status)
			}))
			defer srv.Close()

			eps := fakeEndpoints{"ep_1": {URL: srv.URL, Secrets: [][]byte{secret}}}
			// Not GuardedClient: the test server listens on loopback.
			client := srv.Client()
			client.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
			d := NewDeliverer(eps, client, func() time.Time { return now })

			err := d.Deliver(t.Context(), jobs.Job{ID: 42, Attempt: 1, MaxAttempts: 10},
				Delivery{EndpointID: "ep_1", EventID: "evt_1", Body: body})
			if got := jobs.Classify(err); got != tt.want {
				t.Errorf("Classify(%v) = %s, want %s", err, got, tt.want)
			}
		})
	}
}

func TestVerify_RejectsStaleAndForeignSignatures(t *testing.T) {
	now := time.Date(2026, 3, 1, 12, 0, 0, 0, time.UTC)
	oldKey, newKey := []byte("old-secret"), []byte("new-secret")
	body := []byte(`{"id":"evt_1"}`)

	tests := []struct {
		name    string
		header  string
		secrets [][]byte
		wantErr bool
	}{
		{name: "current secret", header: Sign(body, now, [][]byte{newKey}), secrets: [][]byte{newKey}},
		{name: "rotation: sender signs with both", header: Sign(body, now, [][]byte{newKey, oldKey}), secrets: [][]byte{oldKey}},
		{name: "outside the window", header: Sign(body, now.Add(-6*time.Minute), [][]byte{newKey}), secrets: [][]byte{newKey}, wantErr: true},
		{name: "wrong secret", header: Sign(body, now, [][]byte{oldKey}), secrets: [][]byte{newKey}, wantErr: true},
		{name: "no timestamp", header: "v1=00", secrets: [][]byte{newKey}, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := Verify(tt.header, body, tt.secrets, now, 5*time.Minute)
			if (err != nil) != tt.wantErr {
				t.Fatalf("Verify() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
```

## Integration: claims and leases

`dbtest.New(t)` stands for the repository's harness: a fresh migrated
database per test, skipped without a container runtime unless CI requires
it. `store` is the PostgreSQL `Store`; `db` its pool.

```go
//go:build integration

package jobs_test

func TestClaim_TwoWorkersClaimDisjointJobs(t *testing.T) {
	db := dbtest.New(t)
	store := jobs.NewStore(db)
	ctx := t.Context()
	const total = 200
	for i := range total {
		if err := jobs.Enqueue(ctx, db, "test.noop", map[string]int{"n": i}); err != nil {
			t.Fatal(err)
		}
	}

	var mu sync.Mutex
	owner := map[int64]string{}
	var g errgroup.Group
	for _, worker := range []string{"a", "b"} {
		g.Go(func() error {
			for {
				batch, err := store.Claim(ctx, worker, []string{"test.noop"}, 7, time.Minute)
				if err != nil || len(batch) == 0 {
					return err
				}
				mu.Lock()
				for _, j := range batch {
					if prev, dup := owner[j.ID]; dup {
						mu.Unlock()
						return fmt.Errorf("job %d claimed by %s and %s", j.ID, prev, worker)
					}
					owner[j.ID] = worker
				}
				mu.Unlock()
			}
		})
	}
	if err := g.Wait(); err != nil {
		t.Fatal(err)
	}
	if len(owner) != total {
		t.Fatalf("claimed %d jobs, want %d", len(owner), total)
	}
}

func TestLease_ExpiredLeaseIsReclaimed(t *testing.T) {
	db := dbtest.New(t)
	store := jobs.NewStore(db)
	ctx := t.Context()
	if err := jobs.Enqueue(ctx, db, "test.noop", struct{}{}); err != nil {
		t.Fatal(err)
	}
	first := claimOne(t, store, "crashed")

	// The worker died: no renewals, so the lease runs out.
	if _, err := db.Exec(ctx,
		`UPDATE jobs SET leased_until = now() - interval '1 second' WHERE id = $1`, first.ID); err != nil {
		t.Fatal(err)
	}
	if kinds, err := store.ReapExpired(ctx); err != nil || len(kinds) != 1 {
		t.Fatalf("ReapExpired() = %v, %v; want one kind", kinds, err)
	}

	second := claimOne(t, store, "healthy")
	if second.ID != first.ID || second.Attempt != 2 {
		t.Fatalf("reclaimed job %d attempt %d, want job %d attempt 2", second.ID, second.Attempt, first.ID)
	}
	// The crashed worker's late write is fenced off by its attempt number.
	if ok, err := store.Complete(ctx, first); err != nil || ok {
		t.Fatalf("stale Complete() = %v, %v; want false", ok, err)
	}
	if ok, err := store.Complete(ctx, second); err != nil || !ok {
		t.Fatalf("Complete() = %v, %v; want true", ok, err)
	}
}

func TestEnqueue_RolledBackWriteLeavesNoJob(t *testing.T) {
	db := dbtest.New(t)
	ctx := t.Context()
	tx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := jobs.Enqueue(ctx, tx, "test.noop", struct{}{}); err != nil {
		t.Fatal(err)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM jobs`).Scan(&n); err != nil || n != 0 {
		t.Fatalf("jobs after rollback = %d, %v; want 0", n, err)
	}
}

func claimOne(t *testing.T, store *jobs.Store, worker string) jobs.Job {
	t.Helper()
	batch, err := store.Claim(t.Context(), worker, []string{"test.noop"}, 1, time.Minute)
	if err != nil || len(batch) != 1 {
		t.Fatalf("Claim() = %d jobs, %v; want 1", len(batch), err)
	}
	return batch[0]
}
```

Also worth one test each when the code exists: a schedule claimed by two
workers enqueues one job per slot; `nextRun` after a three-day outage
returns the first slot after now; replay moves only `dead` rows.
