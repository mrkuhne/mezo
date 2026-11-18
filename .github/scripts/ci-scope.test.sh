#!/usr/bin/env bash
# Unit tests for ci-scope.sh's pure fns (mezo-dubmh). No network.
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ci-scope.sh
source "$DIR/ci-scope.sh"

fail=0
assert_rc() { # <actual rc> <expected rc> <name>
  if [ "$1" = "$2" ]; then echo "ok   - $3"; else echo "FAIL - $3: got rc $1 want $2"; fail=1; fi
}
assert_eq() { # <actual> <expected> <name>
  if [ "$1" = "$2" ]; then echo "ok   - $3"; else echo "FAIL - $3: got '$1' want '$2'"; fail=1; fi
}

# ── touches_scope ──
printf 'docs/a.md\nios/Boop/App.swift\n' | touches_scope backend/ api/; assert_rc $? 1 "docs + ios only => backend out of scope"
printf 'docs/a.md\nbackend/pom.xml\n' | touches_scope backend/ api/; assert_rc $? 0 "one backend file => in scope"
printf 'api/feature/train.yml\n' | touches_scope frontend/ api/; assert_rc $? 0 "contract change => frontend in scope"
printf '.github/workflows/ci.yml\n' | touches_scope backend/; assert_rc $? 0 "a CI change is always in scope"
printf 'backendish/file\n' | touches_scope backend/; assert_rc $? 1 "prefix match needs the slash"
printf '' | touches_scope backend/; assert_rc $? 1 "empty diff => out of scope"

# ── green_shas: only finished green runs count ──
RUNS='{"workflow_runs":[{"id":4,"head_sha":"ddd","status":"in_progress","conclusion":null},
  {"id":3,"head_sha":"ccc","status":"completed","conclusion":"cancelled"},
  {"id":2,"head_sha":"bbb","status":"completed","conclusion":"success"},
  {"id":1,"head_sha":"aaa","status":"completed","conclusion":"failure"}]}'
assert_eq "$(printf '%s' "$RUNS" | green_shas)" "bbb" "running, cancelled and red runs are not a base"
assert_eq "$(printf '%s' '{"workflow_runs":[]}' | green_shas)" "" "no runs => no base"
assert_eq "$(printf '%s' 'not json' | green_shas 2>/dev/null)" "" "unreadable API answer => no base"

# ── first_ancestor: against a real throwaway history  A - B - C,  X unrelated ──
REPO_DIR=$(mktemp -d); trap 'rm -rf "$REPO_DIR"' EXIT
g() { git -C "$REPO_DIR" -c user.email=t@t -c user.name=t "$@"; }
g init -q
g commit -q --allow-empty -m A; A=$(g rev-parse HEAD)
g commit -q --allow-empty -m B; B=$(g rev-parse HEAD)
g commit -q --allow-empty -m C; C=$(g rev-parse HEAD)
g checkout -q --orphan other; g commit -q --allow-empty -m X; X=$(g rev-parse HEAD)
assert_eq "$(cd "$REPO_DIR" && printf '%s\n%s\n' "$X" "$B" | first_ancestor "$C")" "$B" "skips a green run that is not an ancestor"
assert_eq "$(cd "$REPO_DIR" && printf '%s\n%s\n' "$B" "$A" | first_ancestor "$C")" "$B" "newest green ancestor wins"
(cd "$REPO_DIR" && printf '%s\n' "$X" | first_ancestor "$C" >/dev/null); assert_rc $? 1 "no green ancestor => rc 1"
(cd "$REPO_DIR" && printf 'deadbeef\n' | first_ancestor "$C" >/dev/null); assert_rc $? 1 "unknown sha => rc 1"

# ── decide: the doubt cases never touch git or the network ──
assert_eq "$(EVENT=workflow_dispatch SHA=x decide backend/ | cut -d' ' -f1)" "true" "unknown event => run"
assert_eq "$(EVENT=pull_request SHA=x BASE_SHA= decide backend/ | cut -d' ' -f1)" "true" "no base sha => run"
assert_eq "$(EVENT=pull_request SHA=nope BASE_SHA=nope2 decide backend/ | cut -d' ' -f1)" "true" "undiffable range => run"

[ "$fail" -eq 0 ] && echo "✅ ci-scope tests passed." || { echo "❌ ci-scope tests failed."; exit 1; }
