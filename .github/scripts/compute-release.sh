#!/usr/bin/env bash
# Computes the next semver and which components changed, for the deploy workflow.
# Pure fns (compute_bump, next_version) are unit-tested; main() reads git + writes GITHUB_OUTPUT.
set -euo pipefail

# stdin: conventional-commit lines (subjects + bodies). stdout: major | minor | patch.
compute_bump() {
  local level="patch" line
  while IFS= read -r line || [ -n "$line" ]; do
    if printf '%s' "$line" | grep -qE '^[a-z]+(\([^)]*\))?!:' \
       || printf '%s' "$line" | grep -qE '^BREAKING[ -]CHANGE:'; then
      echo "major"; return 0
    fi
    if printf '%s' "$line" | grep -qE '^feat(\([^)]*\))?:'; then
      level="minor"
    fi
  done
  echo "$level"
}

# args: <current X.Y.Z> <major|minor|patch>. stdout: bumped X.Y.Z.
next_version() {
  local major minor patch
  IFS='.' read -r major minor patch <<< "$1"
  case "$2" in
    major) major=$((major+1)); minor=0; patch=0 ;;
    minor) minor=$((minor+1)); patch=0 ;;
    patch) patch=$((patch+1)) ;;
  esac
  echo "${major}.${minor}.${patch}"
}

main() {
  git fetch --tags --quiet || true
  local last_tag base_ref base_ver
  last_tag=$(git tag -l 'v*' --sort=-v:refname | head -n1)
  if [ -z "$last_tag" ]; then
    base_ref=$(git rev-list --max-parents=0 HEAD | tail -n1)   # root commit
    base_ver="0.0.0"
  else
    base_ref="$last_tag"; base_ver="${last_tag#v}"
  fi

  local level version fe="false" be="false"
  level=$(git log "${base_ref}..HEAD" --format='%s%n%b' | compute_bump)
  version=$(next_version "$base_ver" "$level")
  # Path-change detection compares each top-level dir's tree-object hash between
  # base and HEAD. Robust where `git diff base..HEAD` is not: actions/checkout
  # presents a merge commit in a way that silently yielded backend_changed=false
  # on the first CI run (the dirs clearly differed). Tree hashes are intrinsic to
  # the commit graph, so this is deterministic in CI and locally alike.
  tree_changed() {  # <dir> -> echoes "true" when the dir tree differs base..HEAD
    local b h
    b=$(git rev-parse -q --verify "${base_ref}:$1" 2>/dev/null || echo absent)
    h=$(git rev-parse -q --verify "HEAD:$1" 2>/dev/null || echo absent)
    [ "$b" != "$h" ] && echo true || echo false
  }
  if [ "$(tree_changed frontend)" = "true" ]; then fe="true"; fi
  if [ "$(tree_changed backend)" = "true" ] || [ "$(tree_changed api)" = "true" ]; then be="true"; fi

  {
    echo "version=${version}"
    echo "frontend_changed=${fe}"
    echo "backend_changed=${be}"
  } >> "${GITHUB_OUTPUT:-/dev/stdout}"
  echo "Resolved v${version} (level=${level}, fe=${fe}, be=${be}) since ${base_ref}" >&2
}

# Run main only when executed directly, so the test can source the pure fns.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then main "$@"; fi
