# CI and Renovate

## CI jobs

The shape, independent of the CI system. Every job installs tools with
`make tools` and the Go version from `go.mod`.

| Job | Runs | Fails on |
|---|---|---|
| verify | `make ci` | any target failing |
| integration | `make test-integration` with a PostgreSQL service container | any test failing |
| vuln | `go tool govulncheck ./...` | a called vulnerable symbol |
| image | `make docker-build`, then the image scan | a fixable high or critical finding |
| api-compat | `oasdiff breaking <last-tag spec> api/openapi.yaml --fail-on ERR` | any breaking change in an existing version |
| e2e | `make e2e` | any browser test failing |

The last-tag spec is `git show $(git describe --tags --abbrev=0):api/openapi.yaml`.
With no tag yet, the job passes and says so.

Image scan, either:

```sh
trivy image --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed <image>:<tag>
grype <image>:<tag> --fail-on high --only-fixed
```

## renovate.json

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    "docker:pinDigests",
    ":semanticCommits"
  ],
  "postUpdateOptions": ["gomodTidy", "gomodUpdateImportPaths", "pnpmDedupe"],
  "packageRules": [
    {
      "matchManagers": ["gomod"],
      "matchDepTypes": ["toolchain", "golang"],
      "groupName": "go toolchain"
    },
    {
      "matchManagers": ["dockerfile", "docker-compose"],
      "matchPackageNames": ["/alpine/"],
      "enabled": false
    },
    {
      "matchUpdateTypes": ["digest", "pinDigest"],
      "groupName": "image digests",
      "schedule": ["before 6am on monday"]
    }
  ]
}
```

- `gomodTidy` runs `go mod tidy` after every Go update, so `go.sum` is
  always current. Renovate updates the pnpm lockfile itself.
- A self-hosted Renovate that must run a repository command (a generator,
  a lockfile Renovate does not know) uses `postUpgradeTasks` with the
  command on the instance's `allowedCommands` list:

  ```json
  "postUpgradeTasks": {
    "commands": ["make generate"],
    "fileFilters": ["**/*"],
    "executionMode": "branch"
  }
  ```

- When tidy fails in a Renovate branch, the bot could not fetch a module:
  add `hostRules` for the private host and set `GOPRIVATE` in the bot's
  environment, or move the importing file out of the main module.
