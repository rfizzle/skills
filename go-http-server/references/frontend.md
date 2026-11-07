# Serving the embedded frontend

## Contents

- [The embed](#the-embed)
- [The SPA handler](#the-spa-handler)
- [Cache rules](#cache-rules)
- [Precompressed assets](#precompressed-assets)
- [The CSP](#the-csp)

## The embed

SvelteKit with `adapter-static` in SPA mode writes `build/` with
`index.html` as the fallback page and hashed files under
`_app/immutable/`. The frontend directory carries a one-file Go package,
because `//go:embed` cannot reach a parent directory:

```go
// web/embed.go
package web

import "embed"

// Build is the output of the frontend build. all: keeps _app/, which embed
// otherwise skips because the name starts with an underscore.
//
//go:embed all:build
var Build embed.FS
```

```js
// web/svelte.config.js (the parts this skill depends on)
adapter: adapter({ fallback: 'index.html', precompress: true }),
```

`internal/app` does `dist, err := fs.Sub(web.Build, "build")` and passes
`dist` to `NewHandler`. The build target runs the frontend build before
`go build`; without `build/` the embed pattern fails to compile, and with
only a committed `build/.gitkeep` the binary compiles but `NewHandler`
fails on the missing `index.html`, which is the intended loud failure. The
architecture check lists `web` as an accepted package.

## The SPA handler

```go
const immutable = "public, max-age=31536000, immutable"

// SPA serves the embedded build. Register it as "/" with no method.
func SPA(dist fs.FS, hashedPrefix string) (http.Handler, error) {
	index, err := fs.ReadFile(dist, "index.html")
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256(index)
	etag := `"` + base64.RawURLEncoding.EncodeToString(sum[:12]) + `"`

	serveIndex := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("ETag", etag)
		http.ServeContent(w, r, "index.html", time.Time{}, bytes.NewReader(index))
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
			return
		}
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name == "" || name == "index.html" {
			serveIndex(w, r)
			return
		}
		if serveFile(w, r, dist, name, strings.HasPrefix(name, hashedPrefix)) {
			return
		}
		if path.Ext(name) != "" {
			http.NotFound(w, r) // a missing chunk is a 404, never HTML
			return
		}
		serveIndex(w, r) // a client-side route
	}), nil
}

// serveFile serves one regular file. It never lists a directory and never
// redirects, which is why it is not http.FileServer or http.ServeFileFS.
func serveFile(w http.ResponseWriter, r *http.Request, dist fs.FS, name string, hashed bool) bool {
	info, err := fs.Stat(dist, name)
	if err != nil || !info.Mode().IsRegular() {
		return false
	}
	file := name
	if enc, ext := pickEncoding(r.Header.Get("Accept-Encoding")); enc != "" {
		if s, err := fs.Stat(dist, name+ext); err == nil && s.Mode().IsRegular() {
			file = name + ext
			w.Header().Set("Content-Encoding", enc)
		}
	}
	f, err := dist.Open(file)
	if err != nil {
		return false
	}
	defer f.Close()
	rs, ok := f.(io.ReadSeeker) // embed.FS and fstest.MapFS files seek
	if !ok {
		return false
	}
	h := w.Header()
	h.Add("Vary", "Accept-Encoding")
	if hashed {
		h.Set("Cache-Control", immutable)
	} else {
		h.Set("Cache-Control", "no-cache")
	}
	http.ServeContent(w, r, name, time.Time{}, rs) // type from name, not from .br
	return true
}
```

`http.ServeContent` answers HEAD without a body, handles `Range` and
`If-None-Match` against the ETag, and takes the content type from the
original name. Embedded files have no modification time, so the ETag is the
validator; hashed files need none.

The reserved paths (`/api/`, Connect services, `/healthz`, `/readyz`,
`/metrics`) never reach this handler because the mux matches their longer
patterns first; the routing table test proves it (testing.md).

## Cache rules

| Path | `Cache-Control` | Why |
|---|---|---|
| `_app/immutable/**` (SvelteKit), `assets/**` (plain Vite) | `public, max-age=31536000, immutable` | the name changes when the content does |
| `index.html` and every fallback response | `no-cache` + ETag | revalidated each load, so a deploy is picked up at once |
| `_app/version.json`, `_app/env.js`, `favicon.png`, `robots.txt`, other unhashed files | `no-cache` | same name across builds |

`no-cache` means "revalidate", not "do not store"; with the ETag a repeat
load is a 304. Never `no-store` on `index.html`: it defeats the 304.

## Precompressed assets

`adapter-static` with `precompress: true` writes `.br` and `.gz` beside each
asset. Serve the sibling only when the client accepts it:

```go
func pickEncoding(header string) (enc, ext string) {
	switch {
	case accepts(header, "br"):
		return "br", ".br"
	case accepts(header, "gzip"):
		return "gzip", ".gz"
	}
	return "", ""
}

func accepts(header, enc string) bool {
	for _, part := range strings.Split(header, ",") {
		token, params, _ := strings.Cut(part, ";")
		if strings.TrimSpace(token) == enc {
			q := strings.TrimSpace(params)
			return q != "q=0" && q != "q=0.0" && q != "q=0.00" && q != "q=0.000"
		}
	}
	return false
}
```

Do not compress on the fly in the server when the build already did; a
compressing middleware on a stream also buffers it.

## The CSP

SvelteKit's `index.html` starts the app with one inline `<script>`. Hash it
at startup instead of allowing `'unsafe-inline'`:

```go
var inlineScript = regexp.MustCompile(`(?s)<script(?:\s[^>]*)?>(.+?)</script>`)

func CSP(dist fs.FS) (string, error) {
	index, err := fs.ReadFile(dist, "index.html")
	if err != nil {
		return "", err
	}
	scripts := []string{"'self'"}
	for _, m := range inlineScript.FindAllSubmatch(index, -1) {
		sum := sha256.Sum256(m[1])
		scripts = append(scripts, "'sha256-"+base64.StdEncoding.EncodeToString(sum[:])+"'")
	}
	return "default-src 'self'; script-src " + strings.Join(scripts, " ") +
		"; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'" +
		"; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'", nil
}
```

`style-src 'unsafe-inline'` stays because components set inline styles;
style injection is far weaker than script injection. A project that
loads from another origin (an object store for uploads, a font host) adds
that origin to the one directive that needs it, never to `default-src`.
Check the policy in the browser console of a real build: a violation there
is a blank page in production.
