# Testing and Isolating Viper

Create a new Viper instance for each test. The package-global instance retains state and
prevents safe parallel tests.

```go
func TestLoadConfig_EnvironmentWins(t *testing.T) {
    t.Setenv("APP_DATABASE_HOST", "db.test")

    v := viper.New()
    configureViper(v)
    v.SetDefault("database.host", "localhost")

    if got := v.GetString("database.host"); got != "db.test" {
        t.Fatalf("database.host = %q, want db.test", got)
    }
}
```

For file tests, write a small YAML fixture under `t.TempDir()`, set it with
`SetConfigFile`, and check every error.

```go
if err := v.ReadInConfig(); err != nil {
    t.Fatalf("ReadInConfig() error = %v", err)
}
```

Test the repository's precedence contract directly: flags, environment, file, and
defaults. Do not use `viper.Reset()` as a substitute for per-test instances. Hot-reload
tests must synchronize with the callback and must run under the race detector; never use
arbitrary sleeps as proof that reload completed.
