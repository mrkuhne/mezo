#!/usr/bin/env bash
# Unit tests for require-checks.sh's pure fns (mezo-x57b). No network: the check-run
# payloads below are trimmed copies of REAL API responses from this repo.
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=require-checks.sh
source "$DIR/require-checks.sh"

fail=0
assert_eq() { # <actual> <expected> <name>
  if [ "$1" = "$2" ]; then echo "ok   - $3"; else echo "FAIL - $3: got '$1' want '$2'"; fail=1; fi
}

# ── expected_jobs: the gate's expected set comes OUT of ci.yml, never hardcoded ──
CI_JOBS=$(expected_jobs < "$DIR/../workflows/ci.yml")
assert_eq "$(printf '%s\n' "$CI_JOBS" | wc -l | tr -d ' ')" "7" "ci.yml currently defines 7 jobs (lint, lint-k8s, contract-drift, test-frontend, test-visual, test-visual-darwin, test-backend)"
assert_eq "$(printf '%s\n' "$CI_JOBS" | grep -cx 'test-backend')" "1" "test-backend is in the expected set"
assert_eq "$(printf '%s\n' "$CI_JOBS" | grep -cx 'runs-on')" "0" "step/key lines are not mistaken for jobs"

# A workflow with no top-level `jobs:` must yield nothing, so main()'s guard can refuse
# to run a vacuous gate rather than passing everything.
assert_eq "$(printf 'name: x\non:\n  push:\n' | expected_jobs | wc -l | tr -d ' ')" "0" "no jobs: block => empty set"

# ── runs_from_json ────────────────────────────────────────────────────────────
# Real shape of GET /repos/{r}/commits/{sha}/check-runs. `conclusion` is null while a
# run is queued/in_progress — that must not read as a pass.
ZERO='{"total_count":0,"check_runs":[]}'
RUNNING='{"total_count":2,"check_runs":[
  {"name":"lint","status":"completed","conclusion":"success"},
  {"name":"test-backend","status":"in_progress","conclusion":null}]}'
CANCELLED_THEN_GREEN='{"total_count":2,"check_runs":[
  {"name":"test-backend","status":"completed","conclusion":"cancelled"},
  {"name":"test-backend","status":"completed","conclusion":"success"}]}'
RED='{"total_count":1,"check_runs":[
  {"name":"test-backend","status":"completed","conclusion":"failure"}]}'

assert_eq "$(printf '%s' "$ZERO" | runs_from_json | wc -l | tr -d ' ')" "0" "zero check runs => no lines"
assert_eq "$(printf '%s' "$RUNNING" | runs_from_json | grep -c 'test-backend pending')" "1" "null conclusion => pending"

# ── classify_missing: the three states mean different things to the human ──────
assert_eq "$(classify_missing "lint
test-backend" "$(printf '%s' "$ZERO" | runs_from_json)")" \
  "$(printf 'absent\tlint\nabsent\ttest-backend')" "no runs at all => every job absent"

assert_eq "$(classify_missing "lint
test-backend" "$(printf '%s' "$RUNNING" | runs_from_json)")" \
  "$(printf 'running\ttest-backend')" "green lint + in-progress backend => only backend, as 'running'"

# ci.yml has cancel-in-progress concurrency, so a head legitimately carries BOTH a
# cancelled and a successful run of the same job (real example: head 3fe9cde39). If this
# assertion ever flips, the gate starts crying wolf on every superseded run.
assert_eq "$(classify_missing "test-backend" "$(printf '%s' "$CANCELLED_THEN_GREEN" | runs_from_json)")" \
  "" "cancelled + success on the same job => PASS (concurrency supersede is not a failure)"

assert_eq "$(classify_missing "test-backend" "$(printf '%s' "$RED" | runs_from_json)")" \
  "$(printf 'failed\ttest-backend')" "an actual failure is reported as 'failed', not 'absent'"

assert_eq "$(classify_missing "lint" "lint success")" "" "a plain green job => PASS"

exit $fail
