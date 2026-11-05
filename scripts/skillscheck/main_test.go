package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func write(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestHashOf(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "a", "one.txt"), "hello\n")
	write(t, filepath.Join(dir, "a", "sub", "two.txt"), "world")
	write(t, filepath.Join(dir, "single.md"), "solo")

	tests := []struct {
		name string
		path string
		want string
	}{
		// Golden value computed with the directory-only hashOf before -sum.
		{"directory unchanged", filepath.Join(dir, "a"), "bef5088694a36601cedd0c7dd4f6f2d2de1bd6e502ed05d6d4202087c0c294ad"},
		{"single file", filepath.Join(dir, "single.md"), "dd6e77823ae1a2736a36526d40a2905142f858d2e65923566156568819e3d54e"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := hashOf(tt.path)
			if err != nil {
				t.Fatal(err)
			}
			if got != tt.want {
				t.Errorf("hashOf = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestVerify(t *testing.T) {
	tests := []struct {
		name     string
		edit     bool
		noSum    bool
		wantCode int
		wantOut  []string
	}{
		{"passing", false, false, 0, []string{"1 shared path(s) match"}},
		{"one-byte edit fails", true, false, 1, []string{"thing.md", "differs", "abc1234"}},
		{"missing sum file", false, true, 0, []string{"no ", "scaffold.sum"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			t.Chdir(dir)
			write(t, "thing.md", "content")
			h, err := hashOf("thing.md")
			if err != nil {
				t.Fatal(err)
			}
			sum := filepath.Join(dir, "scaffold.sum")
			if !tt.noSum {
				write(t, sum, "# header\nthing.md abc1234 "+h+"\n")
			}
			if tt.edit {
				write(t, "thing.md", "contenT")
			}
			var out, errb bytes.Buffer
			code := verify(sum, &out, &errb)
			if code != tt.wantCode {
				t.Errorf("code = %d, want %d (out %q err %q)", code, tt.wantCode, out.String(), errb.String())
			}
			for _, w := range tt.wantOut {
				if !strings.Contains(out.String(), w) {
					t.Errorf("output %q missing %q", out.String(), w)
				}
			}
		})
	}
}

func TestSumFlag(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "x.md"), "x")
	h, err := hashOf(filepath.Join(dir, "x.md"))
	if err != nil {
		t.Fatal(err)
	}
	t.Chdir(dir)
	write(t, "custom.sum", "x.md deadbee "+h+"\n")
	// Default path is absent, so only an explicit file can have content.
	var out, errb bytes.Buffer
	if code := verify(defaultSumFile, &out, &errb); code != 0 || !strings.Contains(out.String(), "no "+defaultSumFile) {
		t.Errorf("default: code %d out %q", code, out.String())
	}
	out.Reset()
	if code := verify("custom.sum", &out, &errb); code != 0 || !strings.Contains(out.String(), "1 shared path(s)") {
		t.Errorf("custom: code %d out %q", code, out.String())
	}
}
