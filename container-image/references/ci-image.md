# Image CI

## Contents

- Make targets
- Workflow
- Scan exceptions
- Renovate

Action SHAs below are placeholders. Resolve each with
`gh api repos/<owner>/<action>/commits/<tag> --jq .sha` and keep the tag in
the trailing comment; Renovate keeps both current.

## Make targets

cosign, grype and syft are pinned in `scripts/tool-versions.env` and
installed by `make tools` (`repo-tooling`).

```make
IMAGE ?= ghcr.io/<owner>/<app>

image-verify-base: ## Verify the signature of every base image
	@./scripts/verify-base-images.bash build/Dockerfile compose.yaml

image-scan: ## Scan the built image; fail on fixable high or critical, or an expired exception
	@./scripts/check-image-exceptions.bash .grype.yaml
	@grype $(IMAGE):dev --fail-on high --only-fixed

image-smoke: ## Run the built image hardened, as deploy does, until its healthcheck passes
	@APP_IMAGE=$(IMAGE):dev $(COMPOSE) -p $(E2E_PROJECT) --profile e2e up --detach --wait --no-build app; \
	 status=$$?; $(COMPOSE) -p $(E2E_PROJECT) --profile e2e down --volumes; exit $$status

image-check: image-verify-base docker-build image-scan image-smoke ## Everything the image job runs
```

`docker-build`, `COMPOSE` and `E2E_PROJECT` come from `repo-tooling`'s
Makefile; the smoke run uses the e2e Compose project so it never touches
the developer's `dev-up` database. The Compose `app` service is the hardened run: read-only,
`cap_drop: [ALL]`, `no-new-privileges`, a tmpfs for `/tmp`, and a
healthcheck of `/app healthcheck` (`repo-tooling`, `references/compose.md`).

`scripts/verify-base-images.bash`:

```bash
#!/usr/bin/env bash
# Verifies that every FROM and Compose image is an rfizzle image signed by
# the rfizzle/images workflows. Arguments: the files to read.
set -euo pipefail
identity='^https://github.com/rfizzle/images/\.github/workflows/'
issuer='https://token.actions.githubusercontent.com'
refs=$(
  sed -nE 's/^FROM[[:space:]]+(--platform=[^[:space:]]+[[:space:]]+)?([^[:space:]]+).*/\2/p' "$1"
  if [ $# -gt 1 ] && [ -f "$2" ]; then
    # The app's own image is interpolated (${APP_IMAGE}) and is not a base.
    sed -nE 's/^[[:space:]]+image:[[:space:]]+([^$[:space:]][^[:space:]]*).*/\1/p' "$2"
  fi
)
status=0
for ref in $(printf '%s\n' "$refs" | sort -u); do
  case "$ref" in
    ghcr.io/rfizzle/*@sha256:*) ;;
    *) echo "not a digest-pinned rfizzle image: $ref" >&2; status=1; continue ;;
  esac
  if cosign verify "$ref" --certificate-identity-regexp "$identity" \
      --certificate-oidc-issuer "$issuer" >/dev/null 2>&1; then
    echo "verified $ref"
  else
    echo "signature check failed: $ref" >&2; status=1
  fi
done
exit $status
```

The script also enforces the rule: a `FROM` that is not a digest-pinned
`rfizzle` image fails the build.

## Workflow

`.github/workflows/image.yml`:

```yaml
name: image
on:
  pull_request:
  push:
    branches: [main]
    tags: ['v*']
  schedule:
    # Monday, after the base rebuild (06:00 UTC) and the Renovate window.
    - cron: '0 13 * * 1'
  workflow_dispatch:
permissions:
  contents: read
jobs:
  image:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha> # v<x.y.z>
      - uses: actions/setup-go@<sha> # v<x.y.z>
        with:
          go-version-file: go.mod
      - uses: actions/setup-node@<sha> # v<x.y.z>
        with:
          node-version-file: .nvmrc
      - run: make tools
      - run: make image-check

  publish:
    if: github.event_name == 'push'
    needs: [image]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      id-token: write
      attestations: write
    env:
      REPO: ghcr.io/${{ github.repository }}
    steps:
      - uses: actions/checkout@<sha> # v<x.y.z>
        with:
          fetch-depth: 0
      - uses: sigstore/cosign-installer@<sha> # v<x.y.z>
      - uses: anchore/sbom-action/download-syft@<sha> # v<x.y.z>
      - uses: docker/setup-buildx-action@<sha> # v<x.y.z>
      - uses: docker/login-action@<sha> # v<x.y.z>
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        run: |
          if [[ "$GITHUB_REF" == refs/tags/v* ]]; then tag="$GITHUB_REF_NAME"; else tag=main; fi
          echo "tag=$tag" >> "$GITHUB_OUTPUT"
          echo "version=$(git describe --tags --always)" >> "$GITHUB_OUTPUT"
      - id: build
        uses: docker/build-push-action@<sha> # v<x.y.z>
        with:
          context: .
          file: build/Dockerfile
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ env.REPO }}:${{ steps.meta.outputs.tag }}
          build-args: |
            VERSION=${{ steps.meta.outputs.version }}
            REVISION=${{ github.sha }}
          provenance: false  # the GitHub attestation below is the provenance
      - name: Sign
        env:
          DIGEST: ${{ steps.build.outputs.digest }}
        run: cosign sign --yes "$REPO@$DIGEST"
      - uses: actions/attest-build-provenance@<sha> # v<x.y.z>
        with:
          subject-name: ${{ env.REPO }}
          subject-digest: ${{ steps.build.outputs.digest }}
          push-to-registry: true
      - name: SBOM
        env:
          DIGEST: ${{ steps.build.outputs.digest }}
        run: |
          syft "$REPO@$DIGEST" -o spdx-json > sbom.spdx.json
          cosign attest --yes --type spdxjson --predicate sbom.spdx.json "$REPO@$DIGEST"
      - name: Digest for the deploy
        env:
          DIGEST: ${{ steps.build.outputs.digest }}
        run: echo "Deploy pins: $REPO@$DIGEST" | tee -a "$GITHUB_STEP_SUMMARY"
```

- Only `publish` gets `packages: write`, `id-token: write` and
  `attestations: write`; the workflow default is `contents: read`.
- GHCR names are lowercase; a repository with capitals sets `REPO` by hand.
- Values from `${{ }}` reach scripts through `env`, never spliced into
  `run:` text.
- The scheduled run rebuilds and scans `main` with no code change; a
  failure there means a new CVE in the pinned packages, fixed by merging
  the waiting Renovate digest bump.

Verify a published image, as `deploy` does before pulling it:

```sh
cosign verify ghcr.io/<owner>/<app>@sha256:<digest> \
  --certificate-identity-regexp '^https://github\.com/<owner>/<app>/\.github/workflows/.+@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
gh attestation verify oci://ghcr.io/<owner>/<app>@sha256:<digest> --repo <owner>/<app>
```

## Scan exceptions

`.grype.yaml` at the repository root; grype reads it on every scan. Each
entry names one vulnerability and, on the same line, its expiry and reason:

```yaml
fail-on-severity: high
only-fixed: true
ignore:
  - vulnerability: CVE-2026-12345 # expires: 2026-12-31; reason: the binary never calls the affected parser
    package:
      name: example.com/affected/module
```

`scripts/check-image-exceptions.bash`:

```bash
#!/usr/bin/env bash
# Fails on an ignore entry without "# expires: YYYY-MM-DD; reason: ..." or past its date.
set -euo pipefail
file=${1:-.grype.yaml}
[ -f "$file" ] || exit 0
today=$(date -u +%F)
status=0
while IFS= read -r line; do
  expires=$(sed -nE 's/.*# expires: ([0-9]{4}-[0-9]{2}-[0-9]{2}); reason: .+/\1/p' <<<"$line")
  if [ -z "$expires" ]; then
    echo "exception without expiry and reason: $line" >&2; status=1
  elif [[ "$expires" < "$today" ]]; then
    echo "exception expired on $expires: $line" >&2; status=1
  fi
done < <(grep -E '^[[:space:]]*- vulnerability:' "$file" || true)
exit $status
```

An expiry is at most 90 days out. Renewing one is a reviewed change that
says why the fix is still not available.

With `trivy` instead, the file is `.trivyignore.yaml`, each entry carries
`statement` (the reason) and `expired_at`, and an expired entry stops
suppressing on its own:

```sh
trivy image --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed \
  --ignorefile .trivyignore.yaml <image>:<tag>
```

## Renovate

The image rules (digest bumps after the Monday rebuild, auto-merge for
digests, a group per base, streams held for a human) are in
`repo-tooling`, `references/ci-renovate.md`.
