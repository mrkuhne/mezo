#!/usr/bin/env bash
# Computes the next semver and which components changed, for the deploy workflow.
# Pure fns (compute_bump, next_version) are unit-tested; main() reads git + writes GITHUB_OUTPUT.
set -euo pipefail

# stdin: conventional-commit lines (subjects + bodies). stdout: major | minor | patch.
# NEVER return before stdin is drained: the caller pipes `git log` into this, and under
# `set -o pipefail` an early return SIGPIPEs the writer, making the whole pipeline exit
# 141 and killing the script (mezo-0j9n). Matching is done with bash's own =~ rather than
# `printf | grep -q` — one less fork per line, and one less pipe to SIGPIPE on.
compute_bump() {
  local level="patch" line
  local re_breaking='^[a-z]+(\([^)]*\))?!:|^BREAKING[ -]CHANGE:'
  local re_feat='^feat(\([^)]*\))?:'
  while IFS= read -r line || [ -n "$line" ]; do
    if [[ $line =~ $re_breaking ]]; then
      level="major"                      # keep draining; do not return here
    elif [ "$level" != "major" ] && [[ $line =~ $re_feat ]]; then
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
  # Any failure from here on must be LOUD: the SIGPIPE bug below killed this script
  # silently (exit 141, not one line on stderr) through 14 consecutive main deploys.
  trap 'rc=$?; echo "::error::compute-release.sh aborted (rc=${rc}) at: ${BASH_COMMAND}" >&2' ERR

  git fetch --tags --quiet || true
  local last_tag base_ref base_ver
  # NOT `git tag -l ... | head -n1`: head exits after line 1 and closes the pipe, so once
  # the tag list outgrew git's 4 KiB stdio buffer (500 tags = 4130 bytes) git's second
  # write() took SIGPIPE -> 141 -> pipefail -> set -e -> silent death (mezo-0j9n).
  # for-each-ref --count=1 does the limiting inside git; no pipe, no reader to race.
  last_tag=$(git for-each-ref --count=1 --sort=-v:refname --format='%(refname:short)' 'refs/tags/v*')
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
