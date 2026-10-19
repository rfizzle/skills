# Testing Cobra Commands

Build a fresh command tree per test. Redirect output through Cobra and use standard
`testing` assertions; do not mutate package-global commands across cases.

```go
func TestServeCommand(t *testing.T) {
    t.Parallel()

    root := NewRootCommand(testDependencies(t))
    stdout := new(bytes.Buffer)
    stderr := new(bytes.Buffer)
    root.SetOut(stdout)
    root.SetErr(stderr)
    root.SetArgs([]string{"serve", "--port", "9090"})

    if err := root.Execute(); err != nil {
        t.Fatalf("Execute() error = %v", err)
    }
    if got := stdout.String(); !strings.Contains(got, "listening on :9090") {
        t.Errorf("stdout = %q", got)
    }
    if got := stderr.String(); got != "" {
        t.Errorf("stderr = %q", got)
    }
}
```

## Table tests

Use `SetArgs` and construct a new root inside each subtest. Cover success, argument
validation, flag parsing, dependency failures, and cancellation. Avoid asserting the
entire default help text unless the text itself is a public contract.

## Test seams

- Handlers write to `cmd.OutOrStdout()` / `cmd.ErrOrStderr()`.
- Constructors accept narrow dependencies rather than reaching global state.
- `RunE` returns errors; only the top-level executable chooses an exit code.
- Tests do not call `os.Exit` or execute the compiled binary for ordinary unit coverage.

Use golden files only for deliberately stable generated documentation or custom help
templates. Update goldens explicitly and review the diff.
