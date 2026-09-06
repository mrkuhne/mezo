#!/usr/bin/env bash
# =============================================================================
# cheap-gates.sh — every convention gate that is fast AND merge-sensitive
# =============================================================================
#
# ONE definition, TWO callers:
#   • ci.yml's `lint` job          — on the PR merge ref, when the run was queued
#   • premerge.yml                 — on the merge ref AS IT IS NOW, right before merging
#
# "Merge-sensitive" means: two PRs can each be green on their own and the MERGE of
# them still be red. That is not hypothetical here — it is what happened:
#   • docs/CODEMAP.md went stale on main for three commits because two branches each
#     regenerated it correctly against their own base (mezo-l4am);
#   • api/openapi.yml goes stale the same way when two branches each add a fragment;
#   • two branches can add Liquibase changesets that only collide once merged.
# A PR's green check can predate the base it will actually merge into: GitHub
# recomputes refs/pull/N/merge when main moves but does NOT re-run the workflow
# (mezo-mxrc). Re-running THESE gates costs ~45s, so it is worth doing at merge time.
#
# Keep this list to gates that are (a) seconds, not minutes, and (b) able to fail on
# a merge result that both sides passed individually. Anything slow belongs in ci.yml.
set -euo pipefail

run() { echo "::group::$*"; "$@"; echo "::endgroup::"; }

run node scripts/lint-docs.mjs --errors-only
run node scripts/lint-liquibase.mjs
run node scripts/check-generator-toolchain.mjs --manifests
run node scripts/lint-conflict-markers.mjs
run node --test scripts/gen-codemap.test.mjs
run node scripts/gen-codemap.mjs --check
run bash .github/scripts/compute-release.test.sh
run bash .github/scripts/compute-release.sigpipe.test.sh
run bash .github/scripts/release-commit.test.sh

echo "✅ cheap gates passed."
