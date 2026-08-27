#!/usr/bin/env bash
# Clay asset pipeline (mezo-d20.1.2): docs/design_2.0/assets/ is the single source of
# truth for the clay sprites. New/changed art lands THERE first, then this script
# re-copies the sprites verbatim into the frontend module. Run from anywhere.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/docs/design_2.0/assets"
DST="$ROOT/frontend/src/shared/ui/clay"

cp "$SRC/clay-icons.svg" "$SRC/clay-spots.svg" "$DST/"
echo "Sprites synced. If symbols were added/removed:"
echo "  - update ClayIconName/ClaySpotName in $DST/index.tsx"
echo "  - update the symbol counts in Clay.test.tsx"
echo "PWA icons (public/pwa-*.png, maskable, apple-touch) are generated from"
echo "$SRC/logo-orb.svg — see mezo-d20.1.2 notes (qlmanage + sips recipe)."
