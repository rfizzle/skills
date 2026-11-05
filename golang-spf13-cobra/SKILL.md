---
name: golang-spf13-cobra
description: Use this skill when building, extending, testing or reviewing a Go command-line tool built on spf13/cobra (the code imports github.com/spf13/cobra), including adding a subcommand, a flag, a run hook, an argument check or a command test. Not for configuration layering (use golang-spf13-viper) or where the CLI package sits in the tree (use go-project-layout).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# spf13/cobra

Conventions and gotchas only. Use the version pinned in `go.mod`.

## Rules

1. **`RunE`, never `Run`**, and the `*E` form of every hook: `Run` cannot
   return an error, so failures skip deferred cleanup via `os.Exit` or panic.
2. **Root sets `SilenceUsage: true` and `SilenceErrors: true`.** A runtime
   failure must not print the usage wall; `main` prints the error once and
   sets the exit code.
3. **All output goes through `cmd.OutOrStdout()` and `cmd.ErrOrStderr()`**,
   never `os.Stdout`, `fmt.Println` or the global logger's default writer.
   Tests call `SetOut` and `SetErr` with buffers and assert on them.
4. **Build the tree in a constructor**, `newRootCmd(deps) *cobra.Command`,
   with flags bound to fields of a local options struct. No package-level
   command variables, no `init()` that calls `AddCommand`: cobra keeps flag
   state between `Execute` calls, so each test builds a fresh tree.
5. **Positional arguments are checked by `Args`** (`cobra.ExactArgs(1)`,
   `cobra.MatchAll(...)`), never by `len(args)` inside `RunE`.
6. **A child's `PersistentPreRunE` replaces the parent's**; it does not chain.
   Either call the parent's hook explicitly or set
   `cobra.EnableTraverseRunHooks = true` once in the root constructor.
7. **`RunE` stays thin**: parse, build the dependencies, call into a package
   that knows nothing of cobra, map its result to output. Business logic
   never takes a `*cobra.Command`.
8. **`AddGroup` before the `AddCommand` calls that use the group**; cobra
   does not assign groups retroactively.
9. **`main` calls `ExecuteContext`** with a `signal.NotifyContext` context;
   `RunE` uses `cmd.Context()`.

## Test shape

```go
func TestServe_PrintsAddress(t *testing.T) {
	var out, errOut bytes.Buffer
	cmd := newRootCmd(fakeDeps(t))
	cmd.SetOut(&out)
	cmd.SetErr(&errOut)
	cmd.SetArgs([]string{"serve", "--port", "9090"})
	if err := cmd.ExecuteContext(t.Context()); err != nil {
		t.Fatalf("Execute: %v (stderr %q)", err, errOut.String())
	}
	if !strings.Contains(out.String(), ":9090") {
		t.Errorf("stdout = %q", out.String())
	}
}
```

Configuration flags are bound to viper in the root's `PersistentPreRunE`
(`golang-spf13-viper`).
