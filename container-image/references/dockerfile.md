# Dockerfile

Digests are placeholders. Resolve a real one with
`crane digest <image>:<stream>` or `docker buildx imagetools inspect
<image>:<stream>`, and let Renovate keep it current. Write the stream tag
beside the digest so Renovate can follow it.

## build/Dockerfile

```dockerfile
# syntax=docker/dockerfile:1

FROM --platform=$BUILDPLATFORM ghcr.io/rfizzle/node:<stream>-dev@sha256:<digest> AS web
# The -dev image ships pnpm and runs as uid 65532; build stages run as root.
USER root
WORKDIR /src/web
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm run build

FROM --platform=$BUILDPLATFORM ghcr.io/rfizzle/go:<stream>-dev@sha256:<digest> AS build
WORKDIR /src
ARG TARGETOS
ARG TARGETARCH
ARG VERSION=dev
ARG REVISION=unknown
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# The Go embed package reads the built assets from here.
COPY --from=web /src/web/build ./web/build
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath \
    -ldflags "-s -w -X <module>/internal/version.Version=${VERSION} -X <module>/internal/version.Revision=${REVISION}" \
    -o /out/app ./cmd/<name>

# CA certificates, tzdata and a nonroot user (uid 65532); nothing else.
# No RUN in this stage, so the arm64 image needs no emulation.
FROM ghcr.io/rfizzle/static:latest@sha256:<digest>
ARG VERSION
ARG REVISION
LABEL org.opencontainers.image.source="<repository url>" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.version="${VERSION}"
COPY --from=build /out/app /app
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app"]
CMD ["serve"]
```

A project with no frontend drops the `web` stage and the `COPY --from=web`
line. The plain `go` image is a build image too (it runs as root and holds
the toolchain); the runtime is always `static`.

## .dockerignore

```text
.git
.github
.env
.env.*
!.env.example
bin/
dist/
coverage*.out
web/node_modules/
web/build/
```

## The healthcheck subcommand

The runtime image has no shell, curl or wget, so the binary checks itself.
With cobra, beside `serve`:

```go
// newHealthcheckCmd calls the running server's /healthz on the loopback
// address; the container runtime runs it as `/app healthcheck`. With
// --ready it calls /readyz instead, which is what a deploy unit waits on.
func newHealthcheckCmd(cfg *config.Config) *cobra.Command {
	var ready bool
	cmd := &cobra.Command{
		Use:   "healthcheck",
		Short: "Exit non-zero unless the local server answers /healthz (or /readyz with --ready)",
		RunE: func(cmd *cobra.Command, _ []string) error {
			_, port, err := net.SplitHostPort(cfg.HTTPAddr)
			if err != nil {
				return fmt.Errorf("healthcheck: listen address %q: %w", cfg.HTTPAddr, err)
			}
			ctx, cancel := context.WithTimeout(cmd.Context(), 2*time.Second)
			defer cancel()
			path := "/healthz"
			if ready {
				path = "/readyz"
			}
			url := "http://" + net.JoinHostPort("127.0.0.1", port) + path
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
			if err != nil {
				return err
			}
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				return fmt.Errorf("healthcheck: %w", err)
			}
			defer resp.Body.Close()
			if resp.StatusCode != http.StatusOK {
				return fmt.Errorf("healthcheck: status %d", resp.StatusCode)
			}
			return nil
		},
	}
	cmd.Flags().BoolVar(&ready, "ready", false, "check /readyz instead of /healthz")
	return cmd
}
```

It reads only the listen address from configuration, so it starts without
the database or secrets the server needs. The image `HEALTHCHECK` and
Compose use `/app healthcheck`; the deploy unit (`deploy`) uses
`/app healthcheck --ready` so systemd waits for readiness.

## A runtime that needs an interpreter

Build in the `-dev` variant, run on the plain image of the same stream;
never `pip install` or `apk add` into the runtime.

```dockerfile
FROM ghcr.io/rfizzle/python:<stream>-dev@sha256:<digest> AS build
WORKDIR /app
COPY requirements.lock ./
RUN python -m venv /app/venv && /app/venv/bin/pip install --no-deps --require-hashes -r requirements.lock
COPY src/ ./src/

FROM ghcr.io/rfizzle/python:<stream>@sha256:<digest>
WORKDIR /app
COPY --from=build /app /app
USER nonroot:nonroot
ENTRYPOINT ["/app/venv/bin/python", "-m", "<package>"]
```

## Run it the way the deploy does

The image must pass this locally and in CI; `deploy` uses the same flags.

```sh
docker run --rm --read-only --cap-drop=ALL \
  --security-opt=no-new-privileges \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  -p 127.0.0.1:8080:8080 --env-file .env <image>
docker exec <container> /app healthcheck
```

Podman takes the same flags. Anything the service writes (an SQLite file,
uploads) goes to a mounted volume, never into the image's filesystem.

## Inspect the layers

```sh
docker history --no-trunc <image>
syft <image> -o json | jq -r '.artifacts[] | select(.type=="apk") | .name'
crane export <image> - | tar -t
dive <image>
```

Expected: the base's packages (baselayout, CA bundle, tzdata), `/app`, and
nothing else.
