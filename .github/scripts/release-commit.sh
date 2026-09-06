#!/usr/bin/env bash
# Release step of deploy.yml, extracted from inline YAML so the concurrency invariant
# it must uphold is testable (see release-commit.test.sh / mezo-pl7d).
#
# env: VERSION, FE, BE ("true"/"false"), BUILT_SHA (the commit the images were built from).
set -euo pipefail
trap 'rc=$?; echo "::error::release-commit.sh aborted (rc=${rc}) at: ${BASH_COMMAND}" >&2' ERR

: "${VERSION:?}"; : "${FE:?}"; : "${BE:?}"; : "${BUILT_SHA:?}"

# Portable in-place edit: `sed -i -E` means different things on GNU and BSD sed, and
# this script now also runs under the local test on macOS.
retag() {  # <image-name> <manifest>
  local t; t="$(mktemp)"
  sed -E "s|(ghcr\.io/mrkuhne/mezo-$1:).*|\1${VERSION}|" "$2" > "$t" && mv -f "$t" "$2"
}
git config user.name  "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

# Reconcile with main by RETRY, never by rebase (mezo-hocr). The bump is an idempotent
# read-modify-write of one line per manifest, so re-applying it on top of whatever main is
# now always converges. A rebase does not: when a parallel deploy has already pushed its own
# `chore(release): v… [skip ci]` touching the SAME line, `git pull --rebase` conflicts and the
# whole job dies — the image is built and in GHCR, but the manifest never moves, so ArgoCD
# keeps serving the old version. Observed 2026-09-06 (run 34003265197, v2.171.0).
pushed=false
for attempt in 1 2 3 4 5; do
  git fetch --quiet origin main
  git checkout --quiet -B release-bump FETCH_HEAD
  if [ "$FE" = "true" ]; then retag frontend k8s/frontend/deployment.yaml; fi
  if [ "$BE" = "true" ]; then retag backend  k8s/backend/deployment.yaml; fi
  git add k8s/frontend/deployment.yaml k8s/backend/deployment.yaml
  if git diff --cached --quiet; then
    echo "No manifest change to commit (main already at v${VERSION}); skipping." >&2
    pushed=true
    break
  fi
  git diff --cached --stat
  git commit --quiet -m "chore(release): v${VERSION} [skip ci]"
  if git push --quiet origin HEAD:main; then
    pushed=true
    break
  fi
  echo "main moved while releasing; re-applying the bump (attempt ${attempt})" >&2
done
if [ "$pushed" != true ]; then
  echo "::error::could not land the v${VERSION} manifest bump on main after 5 attempts" >&2
  exit 1
fi

# The manifest commit follows main, but the TAG must not. compute-release.sh treats the newest
# v* tag as "the source that is already built and released"; tagging the reconciled manifest
# commit makes the tag claim every merge that landed while this run was building, so the next
# run sees those trees as unchanged and skips their build — they ship never, silently
# (mezo-pl7d). Tag the commit the images were actually built from; provenance then matches
# reality by construction.
git tag -a "v${VERSION}" "${BUILT_SHA}" -m "release v${VERSION} (built from ${BUILT_SHA})"
git push origin "v${VERSION}"
echo "Tagged v${VERSION} at built commit ${BUILT_SHA}; manifest bump landed on main." >&2
