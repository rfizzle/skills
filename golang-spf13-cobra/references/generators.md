# Cobra Documentation and Scaffolding Generators

## Doc generation

Cobra can generate documentation from your command tree in multiple formats. Import the `cobra/doc` sub-package:

```bash
go get github.com/spf13/cobra/doc
```

### Markdown

```go
import "github.com/spf13/cobra/doc"

err := doc.GenMarkdownTree(rootCmd, "./bench/docs/")
// generates ./bench/docs/myapp.md, ./bench/docs/myapp_serve.md, etc.

// Single command
var buf bytes.Buffer
doc.GenMarkdown(rootCmd, &buf)
```

### Man pages

```go
header := &doc.GenManHeader{
    Title:   "MYAPP",
    Section: "1",
    Date:    &time.Time{},
    Source:  "myapp v1.0.0",
    Manual:  "User Commands",
}
err := doc.GenManTree(rootCmd, header, "/usr/local/share/man/man1/")
```

### YAML

```go
err := doc.GenYamlTree(rootCmd, "./bench/docs/")
```

### RST (reStructuredText)

```go
err := doc.GenReSTTree(rootCmd, "./bench/docs/")
```

## Help and usage template customization

Override the default help template:

```go
rootCmd.SetHelpTemplate(`
Usage:  {{.UseLine}}
{{if .HasAvailableSubCommands}}
Commands:
{{range .Commands}}{{if .IsAvailableCommand}}  {{rpad .Name .NamePadding }} {{.Short}}
{{end}}{{end}}{{end}}
Flags:
{{.LocalFlags.FlagUsages | trimRightSpace}}
`)
```

Override the usage function entirely:

```go
rootCmd.SetUsageFunc(func(cmd *cobra.Command) error {
    fmt.Fprintf(cmd.OutOrStdout(), "Custom usage for %s\n", cmd.Name())
    return nil
})
```

Common template functions available: `rpad`, `trimRightSpace`, `gt`, `eq`.
