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
if [ "$FE" = "true" ]; then retag frontend k8s/frontend/deployment.yaml; fi
if [ "$BE" = "true" ]; then retag backend  k8s/backend/deployment.yaml; fi
git diff --stat

git config user.name  "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add k8s/frontend/deployment.yaml k8s/backend/deployment.yaml
if git diff --cached --quiet; then
  echo "No tag change to commit (already at v${VERSION}); skipping."
  exit 0
fi
git commit -m "chore(release): v${VERSION} [skip ci]"
# The manifest commit MUST rebase (main may have moved on), but the TAG must not follow
# it there. compute-release.sh treats the newest v* tag as "the source that is already
# built and released"; tagging the rebased commit makes the tag claim every merge that
# landed while this run was building, so the next run sees those trees as unchanged and
# skips their build — they ship never, silently (mezo-pl7d). Tag the commit the images
# were actually built from instead; provenance then matches reality by construction.
git pull --rebase origin main
git tag -a "v${VERSION}" "${BUILT_SHA}" -m "release v${VERSION} (built from ${BUILT_SHA})"
git push origin HEAD:main
git push origin "v${VERSION}"
echo "Tagged v${VERSION} at built commit ${BUILT_SHA}; manifest commit $(git rev-parse HEAD) pushed to main." >&2
