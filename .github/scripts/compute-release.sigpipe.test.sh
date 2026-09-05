#!/usr/bin/env bash
# Regression test for mezo-0j9n: compute-release.sh must not die of SIGPIPE.
#
# The bug: `git tag -l 'v*' --sort=-v:refname | head -n1` under `set -euo pipefail`.
# `head` exits after the first line and closes the pipe; once the tag list grew past
# git's 4 KiB stdio buffer (500 tags = 4130 bytes) git needed a SECOND write(), got
# EPIPE/SIGPIPE, exited 141, and pipefail + set -e killed the script BEFORE it printed
# anything. 14 of the last 15 main deploys died this way. Same hazard in compute_bump,
# which used to `return 0` on the first breaking-change line while `git log` was still
# writing into it.
#
# The test drives main() against a fake `git` that streams a LARGE, line-flushed tag
# list and commit log. Any early-exiting pipe reader therefore SIGPIPEs deterministically
# on every platform (>64 KiB, so the pipe buffer cannot absorb it) — not only on the
# Linux/glibc runner where the real bug happened.
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

fail=0
assert_eq() { if [ "$1" = "$2" ]; then echo "ok   - $3"; else echo "FAIL - $3: got '$1' want '$2'"; fail=1; fi; }

shim="$(mktemp -d)"
trap 'rm -rf "$shim"' EXIT
cat > "$shim/git" <<'FAKE'
#!/usr/bin/env bash
# Faithful-enough git stand-in: streams big output line by line (so every line is its
# own write(2)) and honours --count=N the way `git for-each-ref` does.
emit_tags() {
  local count=0 limit=0 i
  for a in "$@"; do case "$a" in --count=*) limit="${a#--count=}" ;; esac; done
  for ((i=5000; i>=1; i--)); do
    printf 'v2.%d.0\n' "$i"
    count=$((count+1))
    [ "$limit" -gt 0 ] && [ "$count" -ge "$limit" ] && return 0
  done
}
case "$1" in
  fetch)        exit 0 ;;
  tag)          emit_tags "$@" ;;
  for-each-ref) emit_tags "$@" ;;
  log)          for ((i=0; i<5000; i++)); do printf 'feat!: breaking %d\n' "$i"; done ;;
  rev-list)     echo 0000000000000000000000000000000000000000 ;;
  rev-parse)    echo deadbeef ;;
  *)            exit 0 ;;
esac
FAKE
chmod +x "$shim/git"

out="$(mktemp)"
GITHUB_OUTPUT="$out" PATH="$shim:$PATH" bash "$DIR/compute-release.sh" 2>/dev/null
rc=$?
assert_eq "$rc" "0" "main() survives a tag list larger than the pipe buffer (no SIGPIPE)"
assert_eq "$(grep -c '^version=' "$out" 2>/dev/null || echo 0)" "1" "main() wrote a version to GITHUB_OUTPUT"
assert_eq "$(sed -n 's/^version=//p' "$out" 2>/dev/null)" "3.0.0" "breaking-change log still bumps major (early-exit removed, not the rule)"
rm -f "$out"

exit $fail
