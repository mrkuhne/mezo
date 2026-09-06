#!/usr/bin/env bash
# Unit tests for deploy-alert.sh's pure fns (mezo-82m6). No network.
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy-alert.sh
source "$DIR/deploy-alert.sh"

fail=0
assert_eq() { # <actual> <expected> <name>
  if [ "$1" = "$2" ]; then echo "ok   - $3"; else echo "FAIL - $3: got '$1' want '$2'"; fail=1; fi
}

# ── The alarm must fire on every way a deploy can genuinely break … ───────────
assert_eq "$(alert_decision failure)"        "alert"  "failure => alert"
assert_eq "$(alert_decision timed_out)"      "alert"  "timed_out => alert"
assert_eq "$(alert_decision startup_failure)" "alert" "startup_failure => alert"
assert_eq "$(alert_decision action_required)" "alert" "action_required => alert"

# ── … and on NOTHING else. This is the false-alarm budget, asserted. ──────────
# deploy.yml queues rather than aborts (concurrency cancel-in-progress: false) but a
# cancelled run still happens (2 in the measured 40-run window) and says nothing about
# deploy health; the `[skip ci]` release commit skips every job. Neither may alarm, and
# neither may CLEAR an open alarm either — only a real green deploy clears.
assert_eq "$(alert_decision cancelled)" "ignore" "cancelled => ignore (not alert, not clear)"
assert_eq "$(alert_decision skipped)"   "ignore" "skipped ([skip ci] release commit) => ignore"
assert_eq "$(alert_decision neutral)"   "ignore" "neutral => ignore"
assert_eq "$(alert_decision null)"      "ignore" "still running (null conclusion) => ignore"

assert_eq "$(alert_decision success)"   "clear"  "success => clear the alarm"

# ── One alarm thread, not one per failure: the title must be constant. ────────
# A 20-run outage (2026-09-05) must produce ONE issue with 20 comments. If the title
# ever gained the sha or the run id, dedupe by label would still hold but the thread
# would read as 20 separate incidents.
assert_eq "$(alert_title)" "$(alert_title 'anything')" "the alert title is constant (dedupe)"

# ── The body must name the failing run, or the alert is not actionable. ──────
body=$(alert_body deadbeef https://example.test/run/1 failure)
assert_eq "$(printf '%s' "$body" | grep -c 'https://example.test/run/1')" "1" "body links the failed run"
assert_eq "$(printf '%s' "$body" | grep -c 'deadbeef')"                   "1" "body names the deployed sha"

exit $fail
