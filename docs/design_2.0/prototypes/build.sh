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
cat src/napzaras-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/napzaras-body.html > napzaras.html
cat src/review-head.html   "$A/clay-icons.svg" "$A/clay-spots.svg" src/review-body.html   > edzes-review.html
cat src/fuel-mely-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/fuel-mely-body.html > fuel-mely.html
cat src/en-mely-head.html   "$A/clay-icons.svg" "$A/clay-spots.svg" src/en-mely-body.html   > en-mely.html
cat src/karakter-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/karakter-body.html > karakter-tab.html
cat src/mezo-chat-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/mezo-chat-body.html > mezo-chat.html
cat src/emberek-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/emberek-body.html > emberek.html
cat src/fuel-log-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/fuel-log-body.html > fuel-logolas.html
cat src/fuel-log-multinap-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/fuel-log-multinap-body.html > fuel-log-multinap.html
cat src/mezo-memoar-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/mezo-memoar-body.html > mezo-memoar.html
cat src/receptmuhely-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/receptmuhely-body.html > receptmuhely.html
cat src/fuel-log-oldal-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/fuel-log-oldal-body.html > fuel-log-oldal.html
cat src/tudastar-egyben-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/tudastar-egyben-body.html > tudastar-egyben.html
cat src/rutin-epito-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/rutin-epito-body.html > rutin-epito.html
echo "OK — 23 prototype files assembled."
