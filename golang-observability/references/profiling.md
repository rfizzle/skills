# Profiling in a Running Service

Capturing and reading profiles (profile types, `top`/`list`, flamegraphs, heap diffs, traces): `golang-performance` (`references/pprof.md`, `trace.md`). This file is only the production-exposure side.

## Exposing pprof

pprof endpoints MUST be protected with basic auth (or network isolation) and NEVER exposed publicly: they leak goroutine stacks and memory contents, and CPU profiling is expensive enough to DoS the service. Toggle with `PPROF_ENABLED`. Register the handlers explicitly on a mux; do not rely on `import _ "net/http/pprof"` on a public listener (it registers on `DefaultServeMux`). Locally, `localhost:6060` with the blank import is fine.

```go
import "net/http/pprof"

func setupPprof(mux *http.ServeMux) {
    if os.Getenv("PPROF_ENABLED") != "true" {
        return
    }
    auth := basicAuth(os.Getenv("PPROF_USERNAME"), os.Getenv("PPROF_PASSWORD"))
    mux.Handle("/debug/pprof/", auth(http.HandlerFunc(pprof.Index)))
    mux.Handle("/debug/pprof/cmdline", auth(http.HandlerFunc(pprof.Cmdline)))
    mux.Handle("/debug/pprof/profile", auth(http.HandlerFunc(pprof.Profile)))
    mux.Handle("/debug/pprof/symbol", auth(http.HandlerFunc(pprof.Symbol)))
    mux.Handle("/debug/pprof/trace", auth(http.HandlerFunc(pprof.Trace)))
    slog.Info("pprof endpoints enabled (basic auth required)")
}

func basicAuth(username, password string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            u, p, ok := r.BasicAuth()
            if !ok || u != username || subtle.ConstantTimeCompare([]byte(p), []byte(password)) != 1 {
                w.Header().Set("WWW-Authenticate", `Basic realm="pprof"`)
                http.Error(w, "unauthorized", http.StatusUnauthorized)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

- The server's `WriteTimeout` must exceed the capture length (`?seconds=30` for CPU, and for `/trace`), or the profile is cut off.
- Heap is a snapshot and cheap; a 30s CPU profile is the expensive one. Mutex and block profiles are empty until `runtime.SetMutexProfileFraction` / `SetBlockProfileRate` is set (`golang-performance`).
- During an incident capture before restarting: goroutine dump (`/debug/pprof/goroutine?debug=2`), heap, 30s CPU, mutex.

## Continuous Profiling with Pyroscope

On-demand profiling requires you to be there when the problem happens. Continuous profiling runs always-on in the background with low overhead (~2-5% CPU), so you can look at profiles after the fact. Toggle it with an environment variable.

```go
import "github.com/grafana/pyroscope-go"

func setupContinuousProfiling() {
    if os.Getenv("PROFILING_ENABLED") != "true" {
        return
    }

    _, err := pyroscope.Start(pyroscope.Config{
        ApplicationName: "my-service",
        ServerAddress:   os.Getenv("PYROSCOPE_URL"), // e.g., http://user:pass@pyroscope:4040
        ProfileTypes: []pyroscope.ProfileType{
            pyroscope.ProfileCPU,
            pyroscope.ProfileAllocObjects,
            pyroscope.ProfileAllocSpace,
            pyroscope.ProfileInuseObjects,
            pyroscope.ProfileInuseSpace,
            pyroscope.ProfileGoroutines,
            pyroscope.ProfileMutexCount,
            pyroscope.ProfileMutexDuration,
            pyroscope.ProfileBlockCount,
            pyroscope.ProfileBlockDuration,
        },
    })
    if err != nil {
        slog.Error("failed to start pyroscope", "error", err)
    } else {
        slog.Info("continuous profiling enabled", "server", os.Getenv("PYROSCOPE_URL"))
    }
}
```

## Cost of Continuous Profiling

Continuous profiling adds overhead to every running instance — CPU for collecting stack samples, memory for buffering, and network for transmitting profiles to the backend. While typically low (~2-5% CPU), this cost is **per-instance and always-on**.

**Cost factors:**

- **CPU overhead** — profiling itself consumes CPU cycles. In CPU-bound services, even 2-5% overhead matters.
- **Network/storage** — profile data is continuously shipped to Pyroscope/your backend. High-replica services multiply this.
- **All profile types enabled** — each additional profile type (mutex, block, goroutine) adds incremental overhead.

**Mitigation:**

- Toggle via environment variable (`PROFILING_ENABLED`) — enable only when needed or on a subset of instances
- Start with CPU + heap profiles only; add mutex/block/goroutine profiles when investigating specific issues
- In large deployments, enable continuous profiling on a fraction of replicas (e.g., 1 in 10) rather than all of them

### Other continuous-profiling backends

| Tool | Model | Overhead | Best for |
| --- | --- | --- | --- |
| **Grafana Pyroscope** | push SDK, or pull via Grafana Alloy scraping `/debug/pprof/*` (no code change) | ~2-5% | Grafana ecosystem, historical flamegraph comparison |
| **Parca** (Polar Signals) | eBPF-based pull | <1% | Infrastructure-wide profiling, no code changes |
| **Datadog Continuous Profiler** | push (agent) | ~1-2% | Existing Datadog users |
| **Google Cloud Profiler** | push (agent) | ~1-2% | GCP-hosted Go services |

Continuous profiles also feed PGO (`golang-performance`, `runtime.md`). For library API details use the library's own documentation.

## When to Profile

1. Metrics show high CPU/memory usage → look at CPU/heap profiles
2. P99 latency spikes → CPU profile + mutex profile to find contention
3. Goroutine count growing → goroutine profile to find leaks
4. Before and after an optimization → compare profiles to verify improvement
