#!/usr/bin/env bash
# =============================================================================
# ci-scope.sh — should this ci.yml job do its expensive work on this commit? (mezo-dubmh)
# =============================================================================
#
# The web frontend is frozen (owner decision #48, 2026-11-17) and most pushes to main are
# iOS / docs / tracker commits. Before this script every one of them still ran the full
# backend suite (~59 min) AND both frontend suites (~33 + 8 min) against code they had
# not touched.
#
# A job calls this with the path prefixes it cares about; the script writes `run=true|false`
# to $GITHUB_OUTPUT and the job's expensive steps carry `if: steps.scope.outputs.run == 'true'`.
#
# WHY A STEP-LEVEL SWITCH, NOT A JOB-LEVEL `if:` OR `on.paths`: require-checks.sh demands a
# SUCCESSFUL check run for every ci.yml job on a PR head. A skipped job concludes `skipped`
# and a path-filtered workflow creates no run at all — both would read as "missing". A job
# that starts, decides it has nothing to test and ends green keeps that gate truthful.
#
# FAIL-SAFE: every doubt resolves to run=true. In particular, on a push to main the job is
# only allowed to skip when the PREVIOUS ci.yml run on main (a) is for exactly this push's
# `before` commit and (b) completed with success. ci.yml cancels in-progress runs per ref,
# so without (b) a docs push landing on top of a backend push would cancel the backend run
# and then skip — leaving the backend change untested and main looking green. With (b) a
# cancelled or red predecessor forces the next push to run everything, whatever it touched:
# main stays red until something actually passes.
#
# Usage: EVENT=push|pull_request SHA=… [BEFORE=…] [BASE_SHA=…] REPO=owner/name RUN_ID=… \
#        bash .github/scripts/ci-scope.sh <path-prefix>...
set -uo pipefail

# Changes here can alter what every job does, so they are always in scope.
ALWAYS_IN_SCOPE=".github/"

# stdin: changed file paths, one per line. args: path prefixes. Exit 0 if any file matches.
touches_scope() {
  local file prefix
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    for prefix in "$ALWAYS_IN_SCOPE" "$@"; do
      case "$file" in "$prefix"*) return 0 ;; esac
    done
  done
  return 1
}

# stdin: the workflow-runs API payload (newest first). args: <this run id> <before sha>.
# Exit 0 only if the newest run other than this one is a completed success on <before sha>.
predecessor_is_green() {
  local run_id="$1" before="$2"
  jq -e --arg id "$run_id" --arg before "$before" '
    [.workflow_runs[]? | select((.id | tostring) != $id)] | first
    | . != null and .head_sha == $before and .status == "completed" and .conclusion == "success"
  ' > /dev/null
}

decide() { # args: path prefixes. stdout: "true <reason>" or "false <reason>"
  local range files
  case "${EVENT:-}" in
    pull_request)
      [ -n "${BASE_SHA:-}" ] || { echo "true no base sha"; return; }
      range="${BASE_SHA}...${SHA}"
      ;;
    push)
      case "${BEFORE:-}" in
        ""|0000000000000000000000000000000000000000) echo "true no previous commit (new ref or force push)"; return ;;
      esac
      if ! gh api "repos/${REPO}/actions/workflows/ci.yml/runs?branch=${REF_NAME:-main}&event=push&per_page=5" \
          | predecessor_is_green "${RUN_ID}" "${BEFORE}"; then
        echo "true the previous ci run on this branch is not a finished green run of ${BEFORE}"; return
      fi
      range="${BEFORE}..${SHA}"
      ;;
    *) echo "true unhandled event '${EVENT:-}'"; return ;;
  esac
  files=$(git diff --name-only "$range" 2>/dev/null) || { echo "true could not diff ${range}"; return; }
  if printf '%s\n' "$files" | touches_scope "$@"; then
    echo "true ${range} touches: $*"
  else
    echo "false ${range} touches none of: $*"
  fi
}

main() {
  [ "$#" -gt 0 ] || { echo "::error::ci-scope.sh needs at least one path prefix"; exit 1; }
  : "${SHA:?SHA required}"
  local verdict run reason
  verdict=$(decide "$@")
  run="${verdict%% *}"
  reason="${verdict#* }"
  echo "run=${run} — ${reason}"
  echo "run=${run}" >> "${GITHUB_OUTPUT:-/dev/null}"
  if [ "$run" = "false" ]; then
    echo "Skipped the expensive steps: ${reason}." >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  fi
}

# Run main only when executed directly, so the test can source the pure fns.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then main "$@"; fi
