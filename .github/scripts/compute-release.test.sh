#!/usr/bin/env bash
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=compute-release.sh
source "$DIR/compute-release.sh"

fail=0
assert_eq() { # <actual> <expected> <name>
  if [ "$1" = "$2" ]; then echo "ok   - $3"; else echo "FAIL - $3: got '$1' want '$2'"; fail=1; fi
}

assert_eq "$(printf 'fix: a\nchore: b\n'            | compute_bump)" "patch" "fix+chore => patch"
assert_eq "$(printf 'feat: a\nfix: b\n'             | compute_bump)" "minor" "feat => minor"
assert_eq "$(printf 'feat(fe): a\n'                 | compute_bump)" "minor" "scoped feat => minor"
assert_eq "$(printf 'feat!: a\n'                    | compute_bump)" "major" "feat! => major"
assert_eq "$(printf 'refactor: a\n\nBREAKING CHANGE: x\n' | compute_bump)" "major" "BREAKING body => major"
assert_eq "$(next_version 0.0.1 patch)" "0.0.2" "patch bump"
assert_eq "$(next_version 0.1.3 minor)" "0.2.0" "minor resets patch"
assert_eq "$(next_version 1.2.3 major)" "2.0.0" "major resets minor+patch"
exit $fail
