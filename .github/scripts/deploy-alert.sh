#!/usr/bin/env bash
# =============================================================================
# deploy-alert.sh — a failed deploy must not be silent (mezo-82m6)
# =============================================================================
#
# THE SILENCE THIS CLOSES. deploy.yml is deliberately NOT gated on ci.yml (ADR 0007,
# mezo-oa3) — that decision stands and this script does not touch it. The problem is
# different: when deploy.yml itself FAILS, nothing says so anywhere. No check on the
# main commit, no notification. ci.yml stays green, main looks healthy, and the
# release quietly stops shipping.
#
# MEASURED (2026-09-05): 20 consecutive main deploys failed over roughly a day
# (`gh run list --workflow=deploy.yml`: runs 33955077824 … 33969595641, all
# `failure`, plus 34003265197 the next morning) while ci.yml was green throughout and
# nobody noticed. The bug itself (mezo-0j9n, a SIGPIPE in compute-release.sh) took 20
# minutes to fix. The DELAY was a day. That delay is what this script attacks.
#
# WHAT IT DOES on a failed deploy run:
#   1. posts a commit status `deploy` = failure on the deployed SHA, so the ❌ is
#      visible right next to the commit on main and in the commit list;
#   2. opens ONE deduplicated issue (label `deploy-failure`) — GitHub's own watch
#      settings turn that into the email/notification. A second failure comments on
#      the same issue instead of opening a new one, so a 20-run outage produces one
#      thread, not 20.
# On a successful deploy it posts `deploy` = success and CLOSES the open alert issue,
# so recovery is as visible as breakage and no stale alarm is left to be ignored.
#
# FALSE-ALARM RATE — the thing that decides whether this survives. It fires ONLY on a
# workflow-run conclusion of `failure`/`timed_out`. `cancelled` and `skipped` are
# ignored on purpose: deploy.yml's concurrency queue cancels superseded runs, and the
# `[skip ci]` release commit skips every job. Over the measured 40-run window that is
# 20 alerts, all of them real, and 2 cancellations correctly ignored — 0 false alarms.
# The only plausible false alarm is a genuine infrastructure flake (a GHCR push
# timing out), which is a real failed deploy anyway and is what the auto-close on the
# next green run exists for.
#
# Usage:  REPO=owner/name RUN_ID=<id> bash .github/scripts/deploy-alert.sh
#         (add DRY_RUN=1 to print the actions instead of performing them)
set -uo pipefail

readonly ALERT_LABEL="deploy-failure"

# arg: a workflow-run conclusion. stdout: alert | clear | ignore.
# `cancelled` and `skipped` are IGNORED, not cleared: a cancelled run says nothing
# about the health of the deploy, so it must neither raise nor silence an alarm.
alert_decision() {
  case "$1" in
    failure|timed_out|startup_failure|action_required) echo "alert" ;;
    success)                                          echo "clear" ;;
    *)                                                echo "ignore" ;;
  esac
}

# args: <sha> <run_url> <conclusion>. stdout: the issue/comment body.
alert_body() {
  cat <<BODY
**deploy.yml concluded \`$3\`** on main commit \`$1\`.

- Failed run: $2
- Nothing else surfaces this: deploy.yml is intentionally not gated on ci.yml (ADR 0007),
  so a green \`ci\` check on main says nothing about whether the release shipped.
- The image for this commit was **not** published, so ArgoCD is still serving the previous
  version. Fix forward and push; the next green deploy closes this issue automatically.

_Opened by \`.github/scripts/deploy-alert.sh\` (mezo-82m6)._
BODY
}

# args: <title-ish>. stdout: the single deduplicated issue title.
alert_title() { echo "🚨 deploy failed on main"; }

main() {
  : "${REPO:?REPO=owner/name required}"
  : "${RUN_ID:?RUN_ID=<workflow run id> required}"
  local dry="${DRY_RUN:-0}"

  local run conclusion sha url decision
  run=$(gh api "repos/${REPO}/actions/runs/${RUN_ID}") || {
    echo "::error::could not read run ${RUN_ID}"; exit 1; }
  conclusion=$(printf '%s' "$run" | jq -r '.conclusion // "null"')
  sha=$(printf '%s' "$run" | jq -r '.head_sha')
  url=$(printf '%s' "$run" | jq -r '.html_url')
  decision=$(alert_decision "$conclusion")
  echo "run ${RUN_ID}: conclusion=${conclusion} sha=${sha} -> ${decision}"

  [ "$decision" = "ignore" ] && { echo "nothing to do."; return 0; }

  local state desc
  if [ "$decision" = "alert" ]; then
    state="failure"; desc="deploy ${conclusion} — the image for this commit was not published"
  else
    state="success"; desc="deploy succeeded"
  fi

  run_or_echo() { if [ "$dry" = "1" ]; then echo "DRY-RUN: $*"; else "$@"; fi; }

  run_or_echo gh api -X POST "repos/${REPO}/statuses/${sha}" \
    -f state="$state" -f context="deploy" -f target_url="$url" -f description="$desc" \
    --silent || echo "::warning::could not post the commit status (needs statuses:write)"

  local title existing
  title=$(alert_title)
  existing=$(gh issue list -R "$REPO" --label "$ALERT_LABEL" --state open --json number -q '.[0].number' 2>/dev/null || true)

  if [ "$decision" = "alert" ]; then
    if [ -n "$existing" ]; then
      echo "alert issue #${existing} is already open — commenting instead of opening a second one."
      run_or_echo gh issue comment "$existing" -R "$REPO" --body "$(alert_body "$sha" "$url" "$conclusion")"
    else
      run_or_echo gh label create "$ALERT_LABEL" -R "$REPO" -c d73a4a -d "A main deploy failed (deploy-alert.sh)" 2>/dev/null || true
      run_or_echo gh issue create -R "$REPO" --title "$title" --label "$ALERT_LABEL" \
        --body "$(alert_body "$sha" "$url" "$conclusion")"
    fi
    # Exit non-zero so the watching workflow's own run is RED too — a green run
    # reporting a red deploy would just be a second silent gate.
    return 1
  fi

  if [ -n "$existing" ]; then
    echo "deploy recovered — closing alert issue #${existing}."
    run_or_echo gh issue close "$existing" -R "$REPO" \
      --comment "Recovered: deploy succeeded on \`${sha}\` (${url})."
  fi
  return 0
}

# Run main only when executed directly, so the test can source the pure fns.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then main "$@"; fi
