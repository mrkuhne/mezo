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

# ── predecessor_is_green ──
GREEN='{"workflow_runs":[{"id":2,"head_sha":"bbb","status":"in_progress","conclusion":null},
  {"id":1,"head_sha":"aaa","status":"completed","conclusion":"success"}]}'
printf '%s' "$GREEN" | predecessor_is_green 2 aaa; assert_rc $? 0 "previous run green on the before sha"
printf '%s' "$GREEN" | predecessor_is_green 2 zzz; assert_rc $? 1 "previous run is for another commit"
CANCELLED='{"workflow_runs":[{"id":2,"head_sha":"bbb","status":"in_progress","conclusion":null},
  {"id":1,"head_sha":"aaa","status":"completed","conclusion":"cancelled"}]}'
printf '%s' "$CANCELLED" | predecessor_is_green 2 aaa; assert_rc $? 1 "cancelled predecessor forces a run"
RUNNING='{"workflow_runs":[{"id":2,"head_sha":"bbb","status":"queued","conclusion":null},
  {"id":1,"head_sha":"aaa","status":"in_progress","conclusion":null}]}'
printf '%s' "$RUNNING" | predecessor_is_green 2 aaa; assert_rc $? 1 "still-running predecessor forces a run"
RED='{"workflow_runs":[{"id":1,"head_sha":"aaa","status":"completed","conclusion":"failure"}]}'
printf '%s' "$RED" | predecessor_is_green 2 aaa; assert_rc $? 1 "red predecessor forces a run"
printf '%s' '{"workflow_runs":[]}' | predecessor_is_green 2 aaa; assert_rc $? 1 "no predecessor forces a run"
printf '%s' 'not json' | predecessor_is_green 2 aaa 2>/dev/null; [ $? -ne 0 ]; assert_rc $? 0 "unreadable API answer forces a run"

# ── decide: the doubt cases never touch git or the network ──
assert_eq "$(EVENT=workflow_dispatch SHA=x decide backend/ | cut -d' ' -f1)" "true" "unknown event => run"
assert_eq "$(EVENT=push SHA=x BEFORE=0000000000000000000000000000000000000000 decide backend/ | cut -d' ' -f1)" "true" "new ref => run"
assert_eq "$(EVENT=pull_request SHA=x BASE_SHA= decide backend/ | cut -d' ' -f1)" "true" "no base sha => run"
assert_eq "$(EVENT=pull_request SHA=nope BASE_SHA=nope2 decide backend/ | cut -d' ' -f1)" "true" "undiffable range => run"

[ "$fail" -eq 0 ] && echo "✅ ci-scope tests passed." || { echo "❌ ci-scope tests failed."; exit 1; }
