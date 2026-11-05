// Command skillscheck keeps the shared skills a repository vendors identical
// to their source. The source is the skills repository; a project copies the
// skills it uses into .agents/skills/ and records, in
// .agents/skills/shared.sum, the source commit and a content hash for each.
// This program recomputes the hashes and fails on any mismatch, so an edit
// made to a vendored copy is a red build rather than a silent fork, and a
// copy left behind by a sync is caught the same way.
//
// Run with no arguments from the repository root to verify. Run with
// -sum FILE to verify a different sum file. Run with -hash PATH to print the
// hash of one directory or file; the sync script uses that mode so that there
// is exactly one definition of the hash.
//
// The hash covers every regular file under the directory, in sorted path
// order, as path, NUL, content, NUL. A single file hashes as its base name,
// NUL, content, NUL. Modes and timestamps are not part of it: git does not
// preserve them either.
package main

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const defaultSumFile = ".agents/skills/shared.sum"

func main() {
	hashDir := flag.String("hash", "", "print the content hash of this directory and exit")
	sum := flag.String("sum", defaultSumFile, "verify this sum file")
	flag.Parse()
	if *hashDir != "" {
		h, err := hashOf(*hashDir)
		if err != nil {
			fmt.Fprintln(os.Stderr, "skillscheck:", err)
			os.Exit(2)
		}
		fmt.Println(h)
		return
	}
	os.Exit(verify(*sum, os.Stdout, os.Stderr))
}

// hashOf returns the hex SHA-256 of a directory's files, sorted by path, or
// of a single regular file.
func hashOf(dir string) (string, error) {
	info, err := os.Stat(dir)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return hashFiles(filepath.Dir(dir), []string{filepath.Base(dir)})
	}
	var paths []string
	err = filepath.WalkDir(dir, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.Type().IsRegular() {
			rel, err := filepath.Rel(dir, p)
			if err != nil {
				return err
			}
			paths = append(paths, filepath.ToSlash(rel))
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	sort.Strings(paths)
	return hashFiles(dir, paths)
}

// hashFiles hashes the named files under dir as path, NUL, content, NUL.
func hashFiles(dir string, paths []string) (string, error) {
	h := sha256.New()
	for _, rel := range paths {
		f, err := os.Open(filepath.Join(dir, filepath.FromSlash(rel)))
		if err != nil {
			return "", err
		}
		h.Write([]byte(rel))
		h.Write([]byte{0})
		if _, err := io.Copy(h, f); err != nil {
			f.Close()
			return "", err
		}
		f.Close()
		h.Write([]byte{0})
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// verify reads the sum file and checks every entry. It returns the exit code.
func verify(sumFile string, stdout, stderr io.Writer) int {
	f, err := os.Open(sumFile)
	if err != nil {
		if os.IsNotExist(err) {
			fmt.Fprintln(stdout, "skillscheck: no", sumFile, "so no shared skills to verify")
			return 0
		}
		fmt.Fprintln(stderr, "skillscheck:", err)
		return 2
	}
	defer f.Close()
	problems := 0
	listed := map[string]bool{}
	sc := bufio.NewScanner(f)
	n := 0
	for sc.Scan() {
		n++
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) != 3 {
			fmt.Fprintf(stdout, "%s:%d: want \"<path> <source-commit> <sha256>\", got %q\n", sumFile, n, line)
			problems++
			continue
		}
		path, commit, want := fields[0], fields[1], fields[2]
		listed[path] = true
		if _, err := os.Stat(path); err != nil {
			fmt.Fprintf(stdout, "%s:%d: %s is listed but missing; run make skills-sync\n", sumFile, n, path)
			problems++
			continue
		}
		got, err := hashOf(path)
		if err != nil {
			fmt.Fprintf(stdout, "%s:%d: %s: %v\n", sumFile, n, path, err)
			problems++
			continue
		}
		if got != want {
			fmt.Fprintf(stdout, "%s:%d: %s differs from the copy recorded at %s. Shared skills are edited in the skills repository, then `make skills-sync`; a local edit here is a fork.\n", sumFile, n, path, commit)
			problems++
		}
	}
	if problems > 0 {
		fmt.Fprintf(stdout, "skillscheck: %d problem(s)\n", problems)
		return 1
	}
	fmt.Fprintf(stdout, "skillscheck: %d shared path(s) match their source\n", len(listed))
	return 0
}
