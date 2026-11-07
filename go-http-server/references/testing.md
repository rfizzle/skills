# Testing the HTTP layer

Tests call the same `NewHandler(deps)` as `internal/app`, with fakes for
the API handlers and an `fstest.MapFS` standing in for the frontend build.
Mechanics of HTTP tests in general: `golang-testing`.

## Routing table

```go
func testHandler(t *testing.T) http.Handler {
	t.Helper()
	dist := fstest.MapFS{
		"index.html":                 {Data: []byte(`<!doctype html><script>start()</script>`)},
		"_app/immutable/entry.js":    {Data: []byte(`console.log(1)`)},
		"_app/immutable/entry.js.br": {Data: []byte(`BR`)},
		"_app/version.json":          {Data: []byte(`{"version":"1"}`)},
	}
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { io.WriteString(w, "ok") })
	h, err := NewHandler(Deps{
		Logger: slog.New(slog.DiscardHandler),
		Dist:   dist,
		API:    map[string]http.Handler{"/acme.v1.ProjectService/": ok, "/api/v1/": ok},
		Health: ok, Ready: ok, Metrics: ok,
		Auth:    func(h http.Handler) http.Handler { return h },
		RateKey: func(*http.Request) string { return "ip:test" },
		Limits:  []Limits{{Prefix: "/", MaxBody: 1 << 20, Timeout: 30 * time.Second}},
		Streams: t.Context(),
	})
	if err != nil {
		t.Fatal(err)
	}
	return h
}

func TestRouting(t *testing.T) {
	h := testHandler(t)
	tests := []struct {
		method, path, acceptEnc string
		status                  int
		bodyPrefix, cache, enc  string
	}{
		{"GET", "/", "", 200, "<!doctype", "no-cache", ""},
		{"GET", "/projects/42", "", 200, "<!doctype", "no-cache", ""},          // deep link
		{"HEAD", "/projects/42", "", 200, "", "no-cache", ""},                  // no body
		{"GET", "/index.html", "", 200, "<!doctype", "no-cache", ""},           // no redirect
		{"GET", "/_app/immutable/entry.js", "", 200, "console", immutable, ""}, // hashed
		{"GET", "/_app/immutable/entry.js", "gzip, br", 200, "BR", immutable, "br"},
		{"GET", "/_app/version.json", "", 200, "{", "no-cache", ""},   // unhashed
		{"GET", "/_app/immutable/missing.js", "", 404, "404", "", ""}, // missing chunk
		{"GET", "/_app/", "", 200, "<!doctype", "no-cache", ""},       // no listing
		{"POST", "/projects", "", 405, "Method", "", ""},
		{"GET", "/api/v2/nope", "", 404, "404", "", ""}, // not the SPA
		{"POST", "/api/v1/things", "", 200, "ok", "", ""},
		{"POST", "/acme.v1.ProjectService/List", "", 200, "ok", "", ""},
		{"GET", "/acme.v1.ProjectService/List", "", 200, "ok", "", ""}, // reaches Connect, not the SPA
		{"GET", "/healthz", "", 200, "ok", "", ""},
	}
	for _, tc := range tests {
		t.Run(tc.method+" "+tc.path+" "+tc.acceptEnc, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			if tc.acceptEnc != "" {
				req.Header.Set("Accept-Encoding", tc.acceptEnc)
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			if rec.Code != tc.status {
				t.Fatalf("status = %d, want %d", rec.Code, tc.status)
			}
			if !strings.HasPrefix(rec.Body.String(), tc.bodyPrefix) {
				t.Errorf("body = %q, want prefix %q", rec.Body.String(), tc.bodyPrefix)
			}
			if tc.cache != "" && rec.Header().Get("Cache-Control") != tc.cache {
				t.Errorf("Cache-Control = %q, want %q", rec.Header().Get("Cache-Control"), tc.cache)
			}
			if got := rec.Header().Get("Content-Encoding"); got != tc.enc {
				t.Errorf("Content-Encoding = %q, want %q", got, tc.enc)
			}
			if rec.Header().Get("X-Content-Type-Options") != "nosniff" {
				t.Error("security headers missing")
			}
		})
	}
}

// No API path is ever answered by the SPA.
func TestAPINotShadowed(t *testing.T) {
	h := testHandler(t)
	for _, p := range []string{"/api", "/api/", "/api/v1", "/api/unknown/deep/path", "/api/v1.json"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", p, nil))
		if strings.Contains(rec.Body.String(), "<!doctype") {
			t.Errorf("%s answered by the SPA (status %d)", p, rec.Code)
		}
	}
}
```

ServeMux redirects `/api` and `/api/v1` (no trailing slash) to the subtree
with a 307, so they never reach the SPA either; the test pins that.

## Panic and stream

```go
func TestPanicBecomes500WithRequestID(t *testing.T) {
	log := slog.New(slog.DiscardHandler)
	h := Chain(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("boom") }),
		Recover(log), RequestID, AccessLog(log))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	if rec.Code != http.StatusInternalServerError || rec.Header().Get("X-Request-ID") == "" {
		t.Fatalf("status %d, request id %q", rec.Code, rec.Header().Get("X-Request-ID"))
	}
}

func TestStreamHeartbeatsAndEndsOnShutdown(t *testing.T) {
	streams, stop := context.WithCancel(t.Context())
	sse := SSE(func(*http.Request) (<-chan Event, func()) { return make(chan Event), func() {} }, 10*time.Millisecond)
	h := Chain(sse,
		AccessLog(slog.New(slog.DiscardHandler)), // proves the recorder flushes
		RouteLimits([]Limits{{Prefix: "/", MaxBody: 1, Timeout: time.Minute, Stream: true}}, streams))
	srv := httptest.NewServer(h)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/events")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	body := bufio.NewReader(resp.Body)
	if line, err := body.ReadString('\n'); err != nil || !strings.HasPrefix(line, ": ping") {
		t.Fatalf("first line %q, %v", line, err)
	}

	stop()
	done := make(chan error, 1)
	go func() { _, err := io.Copy(io.Discard, body); done <- err }()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("stream did not end when shutdown started")
	}
}
```

A Connect stream gets the same test through the generated client against
`httptest.NewServer(handler)`: read one message, cancel the streams
context, expect the stream to end within a second.
