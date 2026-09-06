#!/usr/bin/env bash
# Regression test for mezo-pl7d: a release tag must never claim source trees that were
# not in the built images.
#
# The race, observed 2026-09-04 (run 33920695717): merge M1 lands, its deploy builds
# images from M1. While it builds, merge M2 lands. M1's `release` job then rebases its
# k8s bump onto the new main and tags THERE — so tag vX contains M2's trees, which were
# never built. The next run computes `tree_changed` against vX, sees no difference, and
# skips the build. M2 silently never ships.
#
# This test replays exactly that sequence against the real scripts, on a throwaway repo
# with a local bare "origin". It asserts the invariant directly (the tag's trees == the
# built commit's trees) AND the consequence (the next run still sees M2 as unbuilt).
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

fail=0
assert_eq() { if [ "$1" = "$2" ]; then echo "ok   - $3"; else echo "FAIL - $3: got '$1' want '$2'"; fail=1; fi; }

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
export GIT_CONFIG_GLOBAL="$tmp/gitconfig" GIT_CONFIG_NOSYSTEM=1
git config --global user.name  tester
git config --global user.email tester@example.com
git config --global init.defaultBranch main
git config --global commit.gpgsign false

git init -q --bare "$tmp/origin.git"
git clone -q "$tmp/origin.git" "$tmp/work"
cd "$tmp/work"

mkdir -p frontend backend api k8s/frontend k8s/backend
echo 1 > frontend/app.txt; echo 1 > backend/app.txt; echo 1 > api/spec.txt
echo "image: ghcr.io/mrkuhne/mezo-frontend:1.0.0" > k8s/frontend/deployment.yaml
echo "image: ghcr.io/mrkuhne/mezo-backend:1.0.0"  > k8s/backend/deployment.yaml
git add -A && git commit -qm "chore: seed"
git tag -a v1.0.0 -m "release v1.0.0"
git push -q origin main --tags

# --- M1 merges: a frontend change. Its deploy run checks out M1 and builds from it. ---
echo 2 > frontend/app.txt; git commit -aqm "feat: fe change"; git push -q origin main
M1="$(git rev-parse HEAD)"
out="$tmp/o1"; GITHUB_OUTPUT="$out" bash "$DIR/compute-release.sh" >/dev/null 2>&1
v1="$(sed -n 's/^version=//p' "$out")"; fe1="$(sed -n 's/^frontend_changed=//p' "$out")"; be1="$(sed -n 's/^backend_changed=//p' "$out")"
assert_eq "$v1/$fe1/$be1" "1.1.0/true/false" "run 1 computes 1.1.0, frontend only"

# --- M2 merges WHILE run 1 is still building: a backend change. ---
echo 2 > backend/app.txt; git commit -aqm "feat: be change"; git push -q origin main
M2="$(git rev-parse HEAD)"

# --- run 1's release job now executes, from the commit it built (M1). ---
git checkout -q "$M1"
VERSION="$v1" FE="$fe1" BE="$be1" BUILT_SHA="$M1" bash "$DIR/release-commit.sh" >/dev/null 2>&1
rc=$?
assert_eq "$rc" "0" "release-commit.sh succeeds"
git fetch -q origin 'refs/tags/*:refs/tags/*' --force
git checkout -q main && git pull -q --rebase origin main

# --- The invariant: the tag must describe the trees that were actually built. ---
for d in frontend backend api; do
  assert_eq "$(git rev-parse "v${v1}:$d")" "$(git rev-parse "${M1}:$d")" \
    "tag v${v1} carries the BUILT ${d}/ tree, not a later one"
done

# --- The consequence: the queued run for M2 must still see the backend as unbuilt. ---
git checkout -q "$M2"
out2="$tmp/o2"; GITHUB_OUTPUT="$out2" bash "$DIR/compute-release.sh" >/dev/null 2>&1
assert_eq "$(sed -n 's/^backend_changed=//p' "$out2")" "true" \
  "run 2 still builds M2's backend change (it was never in an image)"

exit $fail
