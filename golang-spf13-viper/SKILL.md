---
name: golang-spf13-viper
description: Use this skill when loading, layering, testing or reviewing Go configuration built on spf13/viper (the code imports github.com/spf13/viper), including env prefixes and key replacers, binding cobra flags with BindPFlag, unmarshalling into a config struct, optional config files, and a key that "should" be set but reads empty. Not for command structure (use golang-spf13-cobra), the configuration rules themselves such as one env prefix and secret types (use repo-tooling), or where the config package sits (use go-project-layout).
license: MIT
metadata:
  author: rfizzle
  standard: agentskills.io
---

# spf13/viper

Conventions and gotchas only. Use the version pinned in `go.mod`.
Configuration policy (one env prefix, one typed struct, secret types) is
`repo-tooling`; this is how viper implements it.

## Rules

1. **One `viper.New()` instance, never the package-level functions.** It is
   built in the config package (or the root command's setup) and passed
   explicitly; tests build their own. The global leaks state across tests.
2. **Viper stops at the config package.** Load once at startup into a typed
   `Config` struct, validate it, fail naming the bad key, and pass the struct
   (or the slice of it each package needs) down. Business packages never
   import viper or call `GetString`.
3. **Env needs all three, together:** `SetEnvPrefix("APP")`,
   `SetEnvKeyReplacer(strings.NewReplacer(".", "_"))`, `AutomaticEnv()`.
   Without the replacer, `database.host` looks for `APP_DATABASE.HOST`.
4. **`AutomaticEnv` does not make `Unmarshal` see a key viper has never
   heard of.** Every key needs a `SetDefault` (or `BindEnv`), or an
   env-only value silently stays zero in the struct.
5. **Defaults live in one place**, the `SetDefault` calls. A bound flag wins
   only when the user set it; its own default ranks below `SetDefault`, so a
   second, different default in the flag makes `--help` lie. Take both from
   one constant.
6. **Bind flags in the root's `PersistentPreRunE`** with
   `v.BindPFlag("server.port", cmd.Flags().Lookup("port"))`, checking the
   error, before anything unmarshals.
7. **Every struct field has a `mapstructure` tag**, and a config file is
   decoded with `UnmarshalExact` so a misspelt key fails instead of being
   ignored.
8. **A config file is optional unless the project says otherwise.** With
   `SetConfigName` search, ignore only `viper.ConfigFileNotFoundError`
   (`errors.As`); with an explicit `SetConfigFile`, a missing file is an
   error.
9. **No `WatchConfig`.** Configuration is read once; a change is a restart.

## Test shape

```go
func TestLoad_EnvOverridesDefault(t *testing.T) {
	t.Setenv("APP_SERVER_PORT", "9090") // no t.Parallel with t.Setenv
	cfg, err := config.Load(viper.New(), nil)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Server.Port != 9090 {
		t.Errorf("Server.Port = %d, want 9090", cfg.Server.Port)
	}
}
```
