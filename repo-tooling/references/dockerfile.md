# Dockerfile and Compose

Digests are placeholders. Resolve a real one with
`docker buildx imagetools inspect <image>:<tag>` and let Renovate keep it
current. No stage, service or CI job uses an Alpine image.

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

Every image comes from [rfizzle/images](https://github.com/rfizzle/images): Wolfi
packages built with apko, rebuilt weekly, signed and published with an SBOM. A stream
tag (`go:1.27`) moves on each rebuild, so the digest is what pins the build; Renovate
bumps it. An image that repository lacks is added there; `cgr.dev/chainguard/*` is the
stopgap until it exists.

## .dockerignore

```text
.git
.env
bin/
dist/
coverage*.out
web/node_modules/
web/build/
```

## compose.yaml

```yaml
name: <project>
services:
  postgres:
    image: ghcr.io/rfizzle/postgres:<stream>@sha256:<digest>
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app   # local only; never a real secret
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \"$$POSTGRES_USER\" -d \"$$POSTGRES_DB\""]
      interval: 5s
      timeout: 5s
      retries: 12
    volumes:
      - postgres-data:/var/lib/postgresql/data

  app:
    profiles: [e2e]
    build:
      context: .
      dockerfile: build/Dockerfile
    env_file: .env.e2e
    ports:
      - "127.0.0.1:8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      # The runtime image has no shell or curl; the binary checks itself.
      test: ["CMD", "/app", "healthcheck"]
      interval: 5s
      retries: 12

volumes:
  postgres-data:
```

`.env.e2e` is committed and holds only throwaway local values.
