# Deploy runbook

The template for `docs/runbooks/deploy.md`. Fill every placeholder, run
every command once against staging while writing it, and keep it to what
the person deploying needs. Alert runbooks link its Rollback heading for
their bad-deploy fix.

````markdown
# Deploy

Takes a release tag to staging, then the same digest to prod. Run on the
target host as the service user (`sudo machinectl shell <app>@<host>`, or
SSH as `<app>`).

## Preconditions

- The tag `vX.Y.Z` is pushed and the release workflow is green; it printed
  the image digest `sha256:...`.
- The release notes are read: migrations are expand-only, or the contract
  step and any manual down step are written out there.
- Prod only: staging runs this digest and passed Verify.
- A dump from the last 24 hours exists (`ls -t ~/backups | head -n 1`)
  when the release carries a migration.
- No incident is open, unless this deploy is its fix.

## Deploy

```sh
APP=<app> OWNER=<owner> REPO=<repo> TAG=vX.Y.Z
DIGEST=sha256:<digest from the release workflow>
REF=ghcr.io/$OWNER/$APP

# The signature binds the digest to this tag's release workflow; a branch
# build or another repository's image fails here. Never skip it.
cosign verify "$REF@$DIGEST" \
  --certificate-identity-regexp "^https://github\.com/$OWNER/$REPO/\.github/workflows/.+@refs/tags/$TAG\$" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com >/dev/null
podman pull "$REF@$DIGEST"

# If the release changed deploy/quadlet/, copy the tag's units in first.
cd ~/.config/containers/systemd
sed -i "s|^Image=$REF@.*|Image=$REF@$DIGEST|" $APP.container $APP-migrate.container
grep -h '^Image=' $APP.container $APP-migrate.container | sort -u   # exactly one line
systemctl --user daemon-reload

systemctl --user start $APP-migrate.service     # migrations, old release still serving
systemctl --user restart $APP.service           # returns once /readyz passes
echo "$(date -u +%FT%TZ) deploy $TAG $DIGEST" >> ~/.local/state/$APP/deploys.log
```

A failed `start` of the migration leaves the old release running: stop,
read `journalctl --user -u $APP-migrate -n 100`, and do not restart the
app. A failed `restart` means the new release never became ready: go to
Rollback.

## Verify

1. `systemctl --user is-active $APP`: `active`.
2. `curl -fsS http://127.0.0.1:<port>/readyz`: 200.
3. `curl -fsS https://<public hostname>/<smoke path>`: <expected result>.
4. `journalctl --user -u $APP --since -10min -p warning`: nothing new.
5. <dashboard>: error ratio and p99 latency at their pre-deploy level for
   15 minutes.

## Rollback

```sh
DIGEST=sha256:<digest on the line before the bad one in deploys.log>
cd ~/.config/containers/systemd
sed -i "s|^Image=$REF@.*|Image=$REF@$DIGEST|" $APP.container $APP-migrate.container
systemctl --user daemon-reload
systemctl --user restart $APP.service
echo "$(date -u +%FT%TZ) rollback $TAG $DIGEST" >> ~/.local/state/$APP/deploys.log
```

The schema stays where the bad release left it; the previous release runs
against it. Only when the release notes say so does the owner run the down
migration, as written there. Then run Verify.

## Who to tell

<channel or person>: environment, tag, digest, whether it carried a
migration, and the result. A rollback or a failed deploy is an incident:
see the incident steps in `service-operations`.

## Recent deploys

`tail ~/.local/state/<app>/deploys.log` on the host.
````

Rules:

- `deploys.log` is the record of what ran where; nothing else edits it.
- A deploy step that becomes routine is scripted in the repository and
  this page shrinks to the script call.
