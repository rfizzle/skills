# Compatibility mechanics

## The CI check

Run `gorelease` with a pinned version through `go run`, not a `tool`
directive: a tool directive adds its module graph to the library's
`go.mod`, which every caller then downloads. The checkout needs tags
(`fetch-depth: 0`).

```yaml
- name: API compatibility
  run: |
    base=$(git describe --tags --abbrev=0 --match 'v*')
    go run golang.org/x/exp/cmd/gorelease@<pinned version> -base="$base"
```

With no `-version`, gorelease prints the changes and the version it
suggests; the release procedure compares that with the version it plans.
When cutting the release, pass `-version=vX.Y.Z` so a change the planned
number does not allow fails the run. `apidiff` gives the same answer for a
single package when gorelease cannot run.

## Deprecation

```go
// Dial connects with default options.
//
// Deprecated: use NewClient, which takes a context and options.
func Dial(addr string) (*Client, error) { ... }
```

`Deprecated:` starts its own paragraph; `go vet`, gopls and pkg.go.dev read
it. The CHANGELOG lists it under Deprecated in the release that adds it.

## Retracting a version

A published version cannot be deleted. Retract it in `go.mod` and tag a
patch that carries the directive:

```
retract v1.4.0 // Close leaked the connection; use v1.4.1.
```

`go get` then skips the retracted version and `go list -m -u` warns its
users. The comment is the message they see.

## Moving to v2

One commit, then the tag:

1. `go mod edit -module <path>/v2`.
2. Rewrite every import of the module's own packages from `<path>` and
   `<path>/...` to `<path>/v2` and `<path>/v2/...`, `Example` files
   included; `go build ./... && go test ./...` proves none was missed.
3. Update the README install line and the CHANGELOG's upgrade notes.
4. Tag `v2.0.0` through the release procedure.

v1 keeps its own branch only if the owner wants to patch it; otherwise v1
is frozen at its last tag.

## An Example test

```go
func ExampleDo() {
	calls := 0
	err := retry.Do(context.Background(), func(context.Context) error {
		calls++
		if calls < 3 {
			return errors.New("not yet")
		}
		return nil
	}, retry.WithDelay(0))
	fmt.Println(calls, err)
	// Output: 3 <nil>
}
```

It lives in `example_test.go` in package `retry_test`, so it uses only the
exported API, exactly as a caller would.
