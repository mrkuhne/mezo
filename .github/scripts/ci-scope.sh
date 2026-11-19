#!/usr/bin/env bash
# =============================================================================
# ci-scope.sh — should this ci.yml job do its expensive work on this commit? (mezo-dubmh)
# =============================================================================
#
# Most pushes to main are iOS / docs / tracker commits. Before this script every one of
# them still ran the full backend suite (~59 min) AND the (since retired, 2026-11-19 #52)
# web frontend suites (~33 + 8 min) against code they had not touched. Today only
# test-backend calls it (`backend/ api/`).
#
# A job calls this with the path prefixes it cares about; the script writes `run=true|false`
# to $GITHUB_OUTPUT and the job's expensive steps carry `if: steps.scope.outputs.run == 'true'`.
#
# WHY A STEP-LEVEL SWITCH, NOT A JOB-LEVEL `if:` OR `on.paths`: require-checks.sh demands a
# SUCCESSFUL check run for every ci.yml job on a PR head. A skipped job concludes `skipped`
# and a path-filtered workflow creates no run at all — both would read as "missing". A job
# that starts, decides it has nothing to test and ends green keeps that gate truthful.
#
# FAIL-SAFE: every doubt resolves to run=true. On a push the diff base is NOT the previous
# commit but the newest ancestor that has a finished GREEN ci.yml run (found through the API).
# By induction a green run at G means everything in scope up to G was tested: either G ran
# the suite, or it skipped because nothing in scope had changed since an earlier green.
# Cancelled and red runs in between do not matter — their commits are inside G..HEAD, so if
# any of them touched the scope this run does the work. A red main therefore stays red: a
# docs-only push after a failing backend push still diffs back past the failure and re-runs.
# (The first version only looked at the immediately previous run; with several sessions
# pushing every few minutes that run was always cancelled or still running, so every push
# ran everything and nothing ever finished — measured on 2026-11-18, runs 44288879356 and
# 44291300029.)
#
# Usage: EVENT=push|pull_request SHA=… [BASE_SHA=…] [REF_NAME=…] REPO=owner/name \
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

# stdin: the workflow-runs API payload (newest first). stdout: head shas of green runs.
green_shas() {
  jq -r '.workflow_runs[]? | select(.status == "completed" and .conclusion == "success") | .head_sha'
}

# stdin: candidate shas, newest first. stdout: the first that is an ancestor of $1; rc 1 if none.
first_ancestor() {
  local head="$1" sha
  while IFS= read -r sha; do
    [ -n "$sha" ] || continue
    if git merge-base --is-ancestor "$sha" "$head" 2>/dev/null; then echo "$sha"; return 0; fi
  done
  return 1
}

decide() { # args: path prefixes. stdout: "true <reason>" or "false <reason>"
  local range files
  case "${EVENT:-}" in
    pull_request)
      [ -n "${BASE_SHA:-}" ] || { echo "true no base sha"; return; }
      range="${BASE_SHA}...${SHA}"
      ;;
    push)
      local base
      base=$(gh api "repos/${REPO}/actions/workflows/ci.yml/runs?branch=${REF_NAME:-main}&event=push&status=success&per_page=30" \
          | green_shas | first_ancestor "${SHA}") || base=""
      [ -n "$base" ] || { echo "true no earlier green ci run found among this commit's ancestors"; return; }
      range="${base}..${SHA}"
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
