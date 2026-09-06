#!/usr/bin/env bash
# =============================================================================
# require-checks.sh — "zero checks ran" must not read as green (mezo-x57b)
# =============================================================================
#
# THE LIE THIS CLOSES. When a pull request head has NO check runs at all, the PR
# page and `gh pr checks` say the same thing they say when nothing failed:
# "no checks reported" / a clean-looking PR. Measured on this repo:
#
#   $ gh api repos/mrkuhne/mezo/commits/28c33c23b/check-runs -q .total_count
#   0
#   $ gh api repos/mrkuhne/mezo/commits/28c33c23b/status      -q .state
#   pending          # <- and 0 statuses. Nothing red. Nothing at all.
#
# TWO known causes, and they are NOT one bounded case:
#   (a) update-visual-baselines.yml pushes with GITHUB_TOKEN, on which GitHub
#       deliberately starts no workflow, and ci.yml has no workflow_dispatch arm;
#   (b) measured 2026-09-06 on PR #504 (head 28c33c23b): GitHub simply created no
#       run for the PR at all — zero runs on the branch — with NO bot commit and
#       the PR MERGEABLE/CLEAN, while other branches' pull_request runs started
#       normally in the same window.
# Until this script existed the only protection was human discipline (empty
# commit, or `gh pr close && gh pr reopen`) — needed four times in one session.
#
# THE RULE. Every job defined in ci.yml must have at least one SUCCESSFUL check
# run on the exact head SHA. The expected set is parsed OUT OF ci.yml rather than
# hardcoded, so adding a job to ci.yml extends this gate for free and the two can
# never drift.
#
# WHY "at least one success" and not "the latest run": ci.yml has
# cancel-in-progress concurrency, so a head legitimately carries both a
# `test-backend:cancelled` and a `test-backend:success` (real example on
# 3fe9cde39). Re-running one failed job on the same SHA is likewise a genuine
# green. No ci.yml job carries an `if:`, so all of them always run — which is why
# "missing" is unambiguous and this gate has no false-positive mode other than
# being asked before the checks have finished.
#
# Usage:  REPO=owner/name SHA=<head sha> bash .github/scripts/require-checks.sh
set -uo pipefail

# stdin/arg: the text of ci.yml. stdout: one job key per line.
# Job keys are the only 2-space-indented `name:` lines after the top-level `jobs:`.
expected_jobs() {
  awk '
    /^jobs:[[:space:]]*$/ { in_jobs = 1; next }
    /^[^[:space:]#]/      { in_jobs = 0 }
    in_jobs && /^  [a-zA-Z0-9_-]+:[[:space:]]*$/ {
      key = $0; sub(/^  /, "", key); sub(/:[[:space:]]*$/, "", key); print key
    }
  '
}

# stdin: the /commits/<sha>/check-runs API payload. stdout: "<name> <conclusion>" lines.
runs_from_json() {
  jq -r '.check_runs[]? | "\(.name) \(.conclusion // "pending")"'
}

# args: <expected jobs, newline separated> <"name conclusion" lines>
# stdout: "<state>\t<job>" for every expected job that has NO successful run, where
# state is one of: absent (no run at all) | running (queued/in_progress) | failed.
# Empty output == pass. The three are separated because they mean different things to
# the human: "absent" is the silent lie this script exists for, "running" just means
# "not yet" (wait, do not merge), "failed" is an ordinary red.
classify_missing() {
  local expected="$1" runs="$2" job states
  while IFS= read -r job; do
    [ -n "$job" ] || continue
    states=$(printf '%s\n' "$runs" | awk -v j="$job" '$1 == j { print $2 }' | tr '\n' ' ')
    case " $states " in
      *" success "*) continue ;;
    esac
    if [ -z "$states" ]; then
      printf 'absent\t%s\n' "$job"
    elif case " $states " in *" pending "*) true ;; *) false ;; esac; then
      printf 'running\t%s\n' "$job"
    else
      printf 'failed\t%s\n' "$job"
    fi
  done <<< "$expected"
}

main() {
  : "${REPO:?REPO=owner/name required}"
  : "${SHA:?SHA=<head sha> required}"
  local ci_yml="${CI_YML:-.github/workflows/ci.yml}"

  local expected runs_json runs total missing
  expected=$(expected_jobs < "$ci_yml")
  [ -n "$expected" ] || { echo "::error::parsed ZERO job names out of ${ci_yml} — this gate would pass vacuously"; exit 1; }

  runs_json=$(gh api --paginate "repos/${REPO}/commits/${SHA}/check-runs?per_page=100") || {
    echo "::error::could not read check runs for ${SHA}"; exit 1; }
  total=$(printf '%s' "$runs_json" | jq -s '[.[].check_runs[]?] | length')
  runs=$(printf '%s' "$runs_json" | jq -s '{check_runs: [.[].check_runs[]?]}' | runs_from_json)

  echo "head ${SHA}: ${total} check run(s); ci.yml defines $(printf '%s\n' "$expected" | wc -l | tr -d ' ') job(s)"
  missing=$(classify_missing "$expected" "$runs")
  if [ -z "$missing" ]; then
    echo "✅ every ci.yml job has a successful check run on this head."
    return 0
  fi

  if [ "$total" -eq 0 ]; then
    echo "::error::ZERO checks ran on head ${SHA}. This is the state that LOOKS green — the PR page and \`gh pr checks\` report it exactly like 'nothing failed'. Nothing has tested this commit. Push an empty commit (\`git commit --allow-empty\`) or \`gh pr close\` + \`gh pr reopen\` to make GitHub create the run, then re-run this (mezo-x57b)."
    return 1
  fi

  printf '%s\n' "$missing" | while IFS=$'\t' read -r state job; do
    case "$state" in
      absent)  echo "::error::ci.yml job '${job}' has NO check run on head ${SHA} — it never started. A head where a job is simply missing reads as 'nothing failed' (mezo-x57b)." ;;
      running) echo "::error::ci.yml job '${job}' is still QUEUED/IN PROGRESS on head ${SHA} — it has not passed yet. Wait for it; merging now merges an untested job. (PR #512 was merged in exactly this state on 2026-09-06: test-frontend and test-backend were in_progress.)" ;;
      failed)  echo "::error::ci.yml job '${job}' has no SUCCESSFUL run on head ${SHA} (latest conclusions: not success)." ;;
    esac
  done
  return 1
}

# Run main only when executed directly, so the test can source the pure fns.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then main "$@"; fi
