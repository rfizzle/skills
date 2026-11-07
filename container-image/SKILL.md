---
name: container-image
description: Use this skill when writing, reviewing or hardening a Dockerfile or container image, when choosing a base image for a build stage, runtime, Compose service or CI job container, or when setting up the job that builds, scans, signs and publishes an image. Triggers include "write the Dockerfile", "which base image", "the image uses Alpine", "use Debian/distroless/scratch", "apk add" or "apt-get install" in a Dockerfile, "the scan found CVEs", "Grype/Trivy fails", "ignore this CVE", "pin the image digest", "sign the image", "SBOM", "multi-arch", "run it read-only", "we need an image for X", and "why is the image so big". Holds the rule: one static binary on ghcr.io/rfizzle/static, every base from rfizzle/images pinned by digest, no package installs, a weekly rebuild and scan. Not for the Makefile, Compose and CI layout in general (repo-tooling), running the image on a host (deploy), tagging a release (release), or health endpoints (service-operations).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# Container images

A broad base image is a vulnerability feed: Debian or Alpine brings a shell,
a package manager and a hundred libraries the binary never calls, and every
one of them shows up in the scanner as a CVE someone has to triage. The
owner's images exist so that does not happen: `rfizzle/images` builds
minimal Wolfi images with apko, rebuilds them every Monday with Wolfi's
patches, signs them and publishes an SBOM. A project image built on them
holds the binary, CA certificates and timezone data, and nothing else to
patch. These are the house defaults; a project's `AGENTS.md` or a decision
record may override one, and says why.

## The attack-surface rule

**The runtime image holds one static binary on `ghcr.io/rfizzle/static`
and nothing else**: no shell, no package manager, no distro base.

| Where | Image |
|---|---|
| Go build stage | `ghcr.io/rfizzle/go:<stream>-dev` |
| Frontend build stage | `ghcr.io/rfizzle/node:<stream>-dev` |
| Runtime of a Go binary | `ghcr.io/rfizzle/static:latest` |
| Runtime that needs an interpreter or is a daemon | the plain `ghcr.io/rfizzle/<image>:<stream>` (python, node, ruby, postgres, valkey) |
| Compose service, CI service container, CI job `container:` | the matching `ghcr.io/rfizzle/<image>` |

- Never Debian, Ubuntu, Alpine, `scratch` with hand-copied certificates, or
  the `golang:`/`node:` images, in any stage, Compose service or CI
  container. GitHub-hosted runners are machines, not images, and are fine.
- `-dev` variants (bash, apk-tools, wget, the build toolchain, pnpm on
  node) appear only in build stages, never in the last stage.
- **No `RUN` installs OS packages**, anywhere: no `apk add`, `apt-get
  install`, `curl | sh`. Dependencies from the project's lockfile
  (`go mod download`, `pnpm install --frozen-lockfile`) are the build, not
  an install.
- When no `rfizzle` image fits, the image is added to `rfizzle/images`, not
  improvised in the project's Dockerfile: create `images/<name>/` with
  `versions.yaml` (the Wolfi package family and streams, or
  `unversioned: true`), `apko.yaml`, `apko.dev.yaml` when a build variant is
  needed, and `test.sh`; run `make lock IMAGE=<name> STREAM=<stream>`; open
  a pull request. Merging publishes it; the project pins it afterwards.

## Pinning and rebuild cadence

- Every `FROM`, Compose `image:` and CI image is
  `name:<stream>@sha256:<digest>`: `go:1.27-dev@sha256:…`, `static:latest@sha256:…`
  (`latest` is `static`'s only stream). The stream tag is what Renovate
  follows; the digest is what the build uses.
- The bases rebuild every Monday at 06:00 UTC. Renovate bumps the digests
  after that (schedule and rules: `repo-tooling`, `references/ci-renovate.md`);
  digest-only updates auto-merge when CI is green, stream and major changes
  wait for a human.
- The time between a base rebuild and the project image's rebuild is the
  vulnerability window. So CI also runs a scheduled weekly rebuild and scan
  of `main`, Monday after the Renovate window, even with no code change: a
  CVE disclosed against the pinned packages fails it, and the fix is the
  waiting digest bump.

## Image shape

- Multi-stage: build stages `FROM --platform=$BUILDPLATFORM` and
  cross-compile with `TARGETOS`/`TARGETARCH`; the runtime stage has no `RUN`,
  so amd64 and arm64 build without emulation.
- `CGO_ENABLED=0`, `-trimpath`, version and revision stamped with
  `-ldflags -X`; the frontend is built in its own stage and embedded.
- `USER nonroot:nonroot` (uid 65532), `EXPOSE` the port, `ENTRYPOINT
  ["/app"]` with the subcommand in `CMD ["serve"]`.
- A `healthcheck` subcommand in the binary calls `/healthz`, because the
  image has no shell or curl (`service-operations` owns the endpoint).
- It runs read-only, with all capabilities dropped and `no-new-privileges`;
  anything it writes goes to a tmpfs or a mounted volume. That is how
  `deploy` runs it, and CI smoke-runs it the same way.
- OCI labels `org.opencontainers.image.source`, `.revision`, `.version`;
  a `.dockerignore` keeps `.git`, `.env`, `node_modules` and outputs out.

## Build, verify, sign, publish

Order matters; each step gates the next. CI runs them through make targets.

1. **Verify the bases** before building: `cosign verify` every `FROM`
   reference with `--certificate-identity-regexp
   '^https://github.com/rfizzle/images/\.github/workflows/'` and
   `--certificate-oidc-issuer https://token.actions.githubusercontent.com`
   (or `gh attestation verify oci://<ref> --repo rfizzle/images`).
2. **Build** multi-arch with the version and revision build args.
3. **Scan** with `grype` (default; `trivy` is the alternative): fail on a
   fixable high or critical finding, and fail on an expired exception.
4. **Smoke-run** the host-arch image read-only with capabilities dropped
   and run `/app healthcheck` against it.
5. **Publish** on a `v*` tag (`ghcr.io/<owner>/<app>:vX.Y.Z`) and on
   `main` (the moving `:main` tag): push, sign the pushed digest keyless
   with cosign, attest build provenance, attach the SBOM, and print the
   digest the deploy will pin to the job summary.

`govulncheck` covers the Go module graph separately (`repo-tooling`); the
image scan covers what the image adds.

## Scan exceptions

An exception lives in `.grype.yaml` under `ignore`, one entry per
vulnerability, each with a reason and an expiry date on its line. A check
fails the build on an entry without both or past its date, so an
exception is a dated decision, not a permanent mute. Format and check
script: `references/ci-image.md`.

## Measure it

Before calling an image done, look at what is in it:

- `docker history --no-trunc <image>`: the last stage adds one `COPY`.
- `syft <image> -o json | jq -r '.artifacts[] | select(.type=="apk") | .name'`:
  only the base's packages (baselayout, CA bundle, tzdata).
- `dive <image>` or `crane export <image> - | tar -t`: the files.

A runtime image holding more than the binary, CA certificates and tzdata is
a finding.

## Gotchas

- `latest` without a digest: the build changes under you every Monday.
  `static:latest@sha256:…` is the only `latest` that belongs in a `FROM`.
- A `-dev` image in the runtime stage brings back the shell and apk-tools
  the rule removed; check the last `FROM` in review.
- `COPY . .` or `COPY --from=build /src /src` in the runtime stage ships
  the source tree; copy the one binary.
- A binary built with cgo (`mattn/go-sqlite3`, a cgo DNS resolver) needs
  libc; on `static` it fails with "no such file or directory". Keep
  `CGO_ENABLED=0`; SQLite is `modernc.org/sqlite`.
- A Compose or Dockerfile `HEALTHCHECK` that calls `curl` or `wget` fails
  every time on a shell-less image. Call `/app healthcheck`.
- A tag written without the stream (`go@sha256:…`) or as a dated tag
  (`go:1.27.2-20261013`) gives Renovate nothing to follow; write the stream.
- `scratch` with copied certificates fails TLS at 3am when the copy goes
  stale, and has no tzdata or nonroot user. Use `static`.
- An exceptions entry with no expiry outlives the reason it was added.

## Definition of done (also the review checklist)

- Every `FROM`, Compose and CI image is an `rfizzle` image pinned as
  `name:<stream>@sha256:<digest>`; `-dev` only in build stages; no `RUN`
  installs OS packages.
- The runtime stage is `static` plus one `COPY` of a `CGO_ENABLED=0`
  binary, `USER nonroot:nonroot`, `ENTRYPOINT ["/app"]`, OCI labels.
- The image runs read-only with capabilities dropped and its `healthcheck`
  subcommand passes.
- CI verifies base signatures, scans with no unexcepted fixable high or
  critical finding and no expired exception, and runs the weekly rebuild.
- Published images are signed, attested, carry an SBOM, and the job prints
  the digest.
- The measure-it step shows nothing beyond binary, certificates and tzdata.

## References

- `references/dockerfile.md`: open when writing or changing a Dockerfile:
  the multi-stage file, `.dockerignore`, the `healthcheck` subcommand, an
  interpreter runtime, and the local hardened run.
- `references/ci-image.md`: open when setting up or changing the image CI:
  the make targets, the workflow with verify, scan, sign, attest and
  publish, the weekly schedule, and the exceptions file and its check.
- Related: `repo-tooling` (Makefile, Compose, CI layout, Renovate),
  `deploy` (pulling the pinned digest and running it), `release` (the tag
  that triggers publish), `service-operations` (`/healthz`),
  `golang-security` (govulncheck and secrets).
