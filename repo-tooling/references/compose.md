# Compose

Digests are placeholders; Renovate keeps them current. Every image is an
`rfizzle` image pinned as `name:<stream>@sha256:<digest>` (`container-image`).
The Dockerfile itself is in `container-image`, `references/dockerfile.md`.

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
      - "127.0.0.1:${POSTGRES_PORT:-5432}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \"$$POSTGRES_USER\" -d \"$$POSTGRES_DB\""]
      interval: 5s
      timeout: 5s
      retries: 12
    volumes:
      - postgres-data:/var/lib/postgresql/data

  app:
    profiles: [e2e]
    image: ${APP_IMAGE:-<project>:dev}
    build:
      context: .
      dockerfile: build/Dockerfile
    env_file: .env.e2e
    ports:
      - "127.0.0.1:8080:8080"
    # Run it the way deploy does: read-only, no capabilities.
    read_only: true
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    tmpfs:
      - /tmp:rw,noexec,nosuid,size=16m
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

- `.env.e2e` is committed and holds only throwaway local values.
- The `postgres` healthcheck may use `CMD-SHELL` because the postgres image
  ships a shell for its entrypoint; the app's may not.
- `make e2e` and `make image-smoke` (`container-image`) start the `app`
  service, so the hardened flags are tested on every CI run, not first at
  deploy.
- The file works with Docker Compose and Podman's compose provider.
