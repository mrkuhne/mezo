#!/usr/bin/env bash
# Copies the backend contract into the BoopAPI target (the generator plugin reads it from there).
# The contract says OpenAPI 3.0.3 but a few schemas use the 3.1 numeric form `exclusiveMinimum: 0`,
# which the Swift generator rejects; the copy rewrites them to the 3.0 form
# (`minimum: 0` + `exclusiveMinimum: true`). Same validation meaning.
# --check: exit 1 when the copy is stale.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
src="$root/api/openapi.yml"
dst="$root/ios/BoopKit/Sources/BoopAPI/openapi.yaml"
normalize() { perl -pe 's/^(\s+)exclusive(Minimum|Maximum): (-?[0-9.]+)\s*$/$1\l$2: $3\n$1exclusive$2: true\n/' "$src"; }
if [[ "${1:-}" == "--check" ]]; then
  if cmp -s <(normalize) "$dst"; then echo "openapi.yaml up to date"; exit 0; fi
  echo "openapi.yaml is stale: run ios/scripts/sync-openapi.sh" >&2; exit 1
fi
normalize > "$dst"
echo "synced $dst"
