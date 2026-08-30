#!/usr/bin/env bash
# Assemble the self-contained prototype HTML files by inlining the clay sprites.
# Edit the parts in src/, then run this script and republish the artifact
# (Artifact tool, passing the matching `url` from README.md).
set -euo pipefail
cd "$(dirname "$0")"
A=../assets
cat src/nap-head.html     "$A/clay-icons.svg" "$A/clay-spots.svg" src/nap-body.html     > nap-gerinc.html
cat src/edzes-head.html   "$A/clay-icons.svg" "$A/clay-spots.svg" src/edzes-body.html   > edzes-tab.html
cat src/meso-head.html    "$A/clay-icons.svg" "$A/clay-spots.svg" src/meso-body.html    > mezociklus.html
cat src/catalog-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/catalog-body.html > clay-csomag.html
cat src/session-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/session-body.html > edzes-session.html
cat src/fuel-head.html    "$A/clay-icons.svg" "$A/clay-spots.svg" src/fuel-body.html    > fuel-tab.html
cat src/mezo-head.html    "$A/clay-icons.svg" "$A/clay-spots.svg" src/mezo-body.html    > mezo-tab.html
cat src/en-head.html      "$A/clay-icons.svg" "$A/clay-spots.svg" src/en-body.html      > en-tab.html
cat src/en-ia-head.html   "$A/clay-icons.svg" "$A/clay-spots.svg" src/en-ia-body.html   > en-ia-valasztas.html
echo "OK — 9 prototype files assembled."
