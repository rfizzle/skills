# The e2e CI job

GitHub Actions, every action pinned by commit SHA with the version in a
comment (`repo-tooling`). The job is the `e2e` row of the CI table in
`repo-tooling`'s `ci-renovate.md`.

## Workflow excerpt

```yaml
jobs:
  changes:
    runs-on: ubuntu-24.04
    outputs:
      code: ${{ steps.filter.outputs.code }}
    steps:
      - uses: actions/checkout@<sha> # v5
      - uses: dorny/paths-filter@<sha> # v3
        id: filter
        with:
          predicate-quantifier: every # all patterns must hold, so the ! lines exclude
          filters: |
            code:
              - '**'
              - '!**/*.md'
              - '!docs/**'

  e2e:
    needs: changes
    if: needs.changes.outputs.code == 'true'
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@<sha> # v5
      - uses: pnpm/action-setup@<sha> # v4, version from packageManager
      - uses: actions/setup-node@<sha> # v5
        with:
          node-version-file: .nvmrc
          cache: pnpm
          cache-dependency-path: |
            web/pnpm-lock.yaml
            e2e/pnpm-lock.yaml
      # Restore before make tools, whose browser install is then a no-op.
      - uses: actions/cache@<sha> # v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('web/pnpm-lock.yaml', 'e2e/pnpm-lock.yaml') }}
      - run: make tools
      - name: Browser system dependencies
        run: pnpm --dir e2e exec playwright install-deps chromium
      - run: make e2e
      - if: failure()
        uses: actions/upload-artifact@<sha> # v4
        with:
          name: playwright-report
          path: |
            e2e/playwright-report
            e2e/test-results
          retention-days: 14
```

- The cache holds browser binaries only, keyed on both lockfiles because
  `web/` (vitest browser mode) and `e2e/` each install through their own
  Playwright pin. `install-deps` puts the OS libraries on the runner every
  time; they are not under the cache path.
- The verify job restores the same cache before `make tools`, so
  `web-test` does not download a second copy.
- The filter is a job, not workflow-level `paths-ignore`: a skipped job
  satisfies a required check; a workflow that never started leaves it
  pending and blocks the merge.
- A Go-only change runs e2e; only documentation is filtered out. Add a
  path to the exclusion list only when nothing in it reaches the binary.

## Quarantine

```yaml
  e2e-quarantine:
    needs: changes
    if: needs.changes.outputs.code == 'true'
    continue-on-error: true
    runs-on: ubuntu-24.04
    steps:
      # same steps as e2e, then:
      - run: make e2e E2E_ARGS=--project=quarantine
```

- A test that fails and then passes on retry is flaky. The same day, tag it
  `@quarantine` with an `issue` annotation linking the tracking issue;
  the main run excludes it and this job keeps running it, so the fix can
  be seen working.
- No release goes out while a `@quarantine` tag exists:
  `grep -rn "@quarantine" e2e/tests` prints nothing before tagging.
- Fix the cause (a wait on the wrong marker, shared data, an animation,
  a real race in the app) or delete the test. Raising retries, adding a
  sleep or widening a timeout is not a fix.
