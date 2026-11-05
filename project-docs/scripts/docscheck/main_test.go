package main

import (
	"os"
	"path/filepath"
	"regexp"
	"testing"
)

func TestSlugify(t *testing.T) {
	tests := []struct{ in, want string }{
		{"Go core", "go-core"},
		{"3. Assignment & delegation", "3-assignment--delegation"},
		{"SQL Injection — Critical", "sql-injection--critical"},
		{"Graphical / Web UI", "graphical--web-ui"},
		{"app WILL NOT (in this product)", "app-will-not-in-this-product"},
	}
	for _, tt := range tests {
		if got := slugify(tt.in); got != tt.want {
			t.Errorf("slugify(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestDefaultWorkItem(t *testing.T) {
	re := regexp.MustCompile(`\b[SE]-\d{3,4}\b`)
	tests := []struct {
		in   string
		want bool
	}{
		// Built by concatenation so this file does not fail its own check.
		{"S-" + "0001", true}, {"E-" + "001", true}, {"S-" + "123", true},
		{"ES-1", false}, {"S-" + "12", false}, {"HS-" + "0001", false}, {"S-" + "00012", false},
	}
	for _, tt := range tests {
		if got := re.MatchString(tt.in); got != tt.want {
			t.Errorf("workitem(%q) = %v, want %v", tt.in, got, tt.want)
		}
	}
}

func TestCitationRe(t *testing.T) {
	// The literal is split so this file does not cite anything itself.
	m := citationRe.FindStringSubmatch("// See " + "docs/architecture.md#go-core")
	if m == nil || m[1] != "docs/architecture.md" || m[2] != "go-core" {
		t.Fatalf("citation with anchor: got %q", m)
	}
	if m := citationRe.FindStringSubmatch("// See " + "docs/decisions.md."); m == nil || m[1] != "docs/decisions.md" || m[2] != "" {
		t.Fatalf("bare citation ending a sentence: got %q", m)
	}
	if m := citationRe.FindStringSubmatch("// Sees docs/x.md"); m != nil {
		t.Fatalf("prose is not a citation: got %q", m)
	}
}

func TestMakeRe(t *testing.T) {
	if m := makeRe.FindStringSubmatch("run `make test` first"); m == nil || m[1] != "test" {
		t.Fatalf("backticked target: got %q", m)
	}
	if m := makeRe.FindStringSubmatch("make sure the gate is green"); m != nil {
		t.Fatalf("prose matched: got %q", m)
	}
	if m := makeLineRe.FindStringSubmatch("    make ci VERBOSE=true"); m == nil || m[1] != "ci" {
		t.Fatalf("fenced line: got %q", m)
	}
}

func TestLoadMakefileFollowsIncludes(t *testing.T) {
	dir := t.TempDir()
	write := func(name, body string) {
		t.Helper()
		if err := os.MkdirAll(filepath.Dir(filepath.Join(dir, name)), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("Makefile", "build:\n\tgo build\ninclude mk/gates.mk\n-include mk/*.local.mk\ninclude $(EXTRA)\n")
	write("mk/gates.mk", "ci: check\ncheck:\ninclude Makefile\n")
	write("mk/dev.local.mk", "dev-up:\n")
	t.Chdir(dir)

	c := &checker{targets: map[string]bool{}}
	c.loadMakefile()
	for _, want := range []string{"build", "ci", "check", "dev-up"} {
		if !c.targets[want] {
			t.Errorf("target %q not found; got %v", want, c.targets)
		}
	}
}
