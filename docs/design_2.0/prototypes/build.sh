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
cat src/celok-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/celok-body.html > celok.html
cat src/kalauz-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/kalauz-body.html > kalauz.html
cat src/growth-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/growth-body.html > growth-tab.html
cat src/rutin-epito-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/rutin-epito-body.html > rutin-epito.html
cat src/mezo-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/minta-reszlet-body.html > minta-reszlet.html
cat src/rutin-formalodas-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/rutin-formalodas-body.html > rutin-formalodas.html
cat src/rutin-formalodas-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/rutin-szerk-body.html > rutin-szerkeszto-valasztas.html
cat src/mezo-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/eszrevetelek-body.html > eszrevetelek.html
cat src/mezo-szerkeszto-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/mezo-szerkeszto-body.html > mezo-szerkeszto.html
cat src/sablonok-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/sablonok-body.html > sablonok.html
cat src/ntf-dropdown-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/ntf-dropdown-body.html > ertesites-dropdown.html
cat src/admin-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/admin-body.html > admin-hub.html
cat src/admin-memory-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/admin-memory-body.html > admin-memory.html
cat src/fuel-kartya-ido-head.html "$A/clay-icons.svg" src/fuel-kartya-ido-body.html > fuel-kartya-ido.html
echo "OK — 36 prototype files assembled."
# Üvegesítés U2 (mezo-me75u.2): dark-only; fuel-uveg.html chrome sprite + the shared 3D sprite (U2 icons now live in it).
{ cat src/uveg-fuel-tobbi-head.html; printf '</head>\n<body>\n'; cat src/uveg-sprite-fuel.svg.part ../../../frontend/src/shared/ui/clay/titanium-icons.svg src/uveg-fuel-tobbi-body.html; } > uveg-fuel-tobbi.html
# Üvegesítés U3 (mezo-me75u.3): Nap. Same chrome + the shared 3D sprite (the U3 icons live in it since the owner's OK).
{ cat src/uveg-nap-head.html; printf '</head>\n<body>\n'; cat src/uveg-sprite-fuel.svg.part ../../../frontend/src/shared/ui/clay/titanium-icons.svg src/uveg-nap-body.html; } > uveg-nap.html
# A napod (brainstorm 2026-09-24): napi nézet + Mai-kártya. Same chrome + the shared 3D sprite.
{ cat src/uveg-napod-head.html; printf '</head>\n<body>\n'; cat src/uveg-sprite-fuel.svg.part ../../../frontend/src/shared/ui/clay/titanium-icons.svg src/uveg-napod-body.html; } > uveg-napod.html
# Üvegesítés U4 (mezo-me75u.4): Edzés I. Same chrome + the shared 3D sprite (the U4 icons live in it since the owner's OK). Anatomy is imported from companion-titanium/ (module script, needs HTTP).
{ cat src/uveg-edzes-head.html; printf '</head>\n<body>\n'; cat src/uveg-sprite-fuel.svg.part ../../../frontend/src/shared/ui/clay/titanium-icons.svg src/uveg-edzes-body.html; } > uveg-edzes.html
# Üvegesítés U5 (mezo-me75u.5): Edzés II — Terv, Sablonok, Egyedi edzés, Hét. Same chrome + the shared 3D sprite; the U5 icons (t-template, t-compare, t-trash) are still inline in the body until the owner OK. Anatomy is imported from companion-titanium/ (module script, needs HTTP).
{ cat src/uveg-edzes2-head.html; printf "</head>\n<body>\n"; cat src/uveg-sprite-fuel.svg.part ../../../frontend/src/shared/ui/clay/titanium-icons.svg src/uveg-edzes2-body.html; } > uveg-edzes2.html
# Üvegesítés U6 (mezo-me75u.6): Én I — hub, célok, súly, alvás, hét. Dark-only; same assembly as U5.
{ cat src/uveg-en-head.html; printf "</head>\n<body>\n"; cat src/uveg-sprite-fuel.svg.part ../../../frontend/src/shared/ui/clay/titanium-icons.svg src/uveg-en-body.html; } > uveg-en.html
