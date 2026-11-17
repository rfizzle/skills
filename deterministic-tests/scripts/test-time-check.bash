#!/usr/bin/env bash
# Fails when a test reads or waits on the wall clock without saying why.
#
# In a directory whose *_test.go files hold no `synctest.Test(` call, a line
# that calls time.Sleep, time.Since or time.Until must carry a `// wall-clock:`
# comment with its reason, or the gate prints `file:line: text` and fails.
# Files tagged `integration` (a real runtime, sockets, a firewall) are exempt,
# and so are comment-only lines. Needs GNU find and awk.
#
# usage: test-time-check.bash [root]    (default: the working directory)
#        test-time-check.bash --self-test

set -euo pipefail

# scan prints each unjustified line under $1 as file:line: text.
scan() {
  local root="$1" dir file
  while IFS= read -r dir; do
    # A package that runs under synctest keeps the fake clock for its tests.
    if grep -qs --include='*_test.go' -r 'synctest\.Test(' "${dir}"; then
      continue
    fi
    for file in "${dir}"/*_test.go; do
      [[ -e "${file}" ]] || continue
      if grep -qE '^//go:build .*\bintegration\b' "${file}"; then
        continue
      fi
      awk -v f="${file}" '
        /^[[:space:]]*\/\// { next }
        /time\.(Sleep|Since|Until)\(/ && !/\/\/ wall-clock:/ { printf "%s:%d:%s\n", f, NR, $0 }
      ' "${file}"
    done
  done < <(find "${root}" -name '*_test.go' -not -path '*/node_modules/*' -not -path '*/.git/*' -printf '%h\n' | sort -u)
}

work=""
cleanup() {
  [[ -n "${work}" ]] && rm -rf -- "${work}"
  return 0
}

self_test() {
  work="$(mktemp -d)"
  trap cleanup EXIT
  mkdir "${work}/flagged" "${work}/justified" "${work}/synctested" "${work}/tagged"
  printf 'package a\n\nfunc T() {\n\ttime.Sleep(time.Second)\n}\n' >"${work}/flagged/a_test.go"
  printf 'package a\n\nfunc T() {\n\ttime.Sleep(time.Second) // wall-clock: real socket\n}\n' >"${work}/justified/a_test.go"
  printf 'package a\n\nfunc T() {\n\tsynctest.Test(t, nil)\n}\n' >"${work}/synctested/a_test.go"
  printf 'package a\n\nfunc U() {\n\ttime.Sleep(1)\n}\n' >"${work}/synctested/b_test.go"
  printf '//go:build integration\n\npackage a\n\nfunc T() {\n\ttime.Since(x)\n}\n' >"${work}/tagged/a_test.go"
  local out
  out="$(scan "${work}")"
  [[ "${out}" == "${work}/flagged/a_test.go:4:"* && "$(wc -l <<<"${out}")" -eq 1 ]] || {
    echo "test-time-check: self-test expected only the flagged line, got: ${out:-nothing}" >&2
    exit 1
  }
  echo "test-time-check: self-test passed"
}

if [[ "${1:-}" == "--self-test" ]]; then
  self_test
  exit 0
fi

found="$(scan "${1:-.}")"
if [[ -n "${found}" ]]; then
  echo "${found}" >&2
  echo "test-time-check: wall-clock calls above; wait on a signal, run under synctest, or add '// wall-clock: <reason>'" >&2
  exit 1
fi
