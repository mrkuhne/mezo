#!/usr/bin/env bash
# Builds Boop and installs it on the cabled iPhone with the owner's free Personal Team.
# Weekly: the free signing profile lasts 7 days, so run this once a week.
# Exit codes: 0 ok · 2 no team id · 3 no iPhone · 4 build failed · 5 install failed
set -euo pipefail
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
root="$(cd "$(dirname "$0")/../.." && pwd)"

team="${BOOP_TEAM:-$(cat "$HOME/.config/boop/team" 2>/dev/null || true)}"
team="$(echo "$team" | tr -d '[:space:]')"
if [[ -z "$team" ]]; then
  echo "Hiányzik a fejlesztői csapat azonosítója. Írd be egy sorba ide: ~/.config/boop/team" >&2
  exit 2
fi

devices="$(mktemp)"
xcrun devicectl list devices --json-output "$devices" >/dev/null 2>&1 || true
udid="$(python3 - "$devices" <<'PY'
import json, sys
try:
    devs = json.load(open(sys.argv[1]))["result"]["devices"]
except Exception:
    devs = []
phones = [d for d in devs
          if d.get("hardwareProperties", {}).get("platform") == "iOS"
          and d.get("connectionProperties", {}).get("transportType") not in (None, "sameMachine")
          and d.get("connectionProperties", {}).get("pairingState") == "paired"
          and (d["connectionProperties"].get("transportType") == "wired"
               or d["connectionProperties"].get("tunnelState") == "connected")]
phones.sort(key=lambda d: d["connectionProperties"].get("transportType") != "wired")
print(phones[0]["hardwareProperties"]["udid"] if phones else "")
PY
)"
rm -f "$devices"
if [[ -z "$udid" ]]; then
  echo "Nem látok iPhone-t. Dugd be kábellel, oldd fel a képernyőt, és ha kérdezi, bízz meg a gépben." >&2
  exit 3
fi

echo "Építem a Boopot a telefonodra…"
if ! xcodebuild -project "$root/ios/Boop.xcodeproj" -scheme Boop -configuration Release \
     -destination "id=$udid" -allowProvisioningUpdates -skipPackagePluginValidation \
     -derivedDataPath "$root/ios/build/device" DEVELOPMENT_TEAM="$team" build > "$root/ios/build/install.log" 2>&1; then
  echo "Az építés nem sikerült. A részletek: ios/build/install.log" >&2
  exit 4
fi

app="$root/ios/build/device/Build/Products/Release-iphoneos/Boop.app"
echo "Telepítem…"
if ! xcrun devicectl device install app --device "$udid" "$app" >> "$root/ios/build/install.log" 2>&1; then
  echo "A telepítés nem sikerült. Ha az első alkalom: Beállítások › Általános › VPN és eszközkezelés › Megbízom. Részletek: ios/build/install.log" >&2
  exit 5
fi
xcrun devicectl device process launch --device "$udid" io.mrkuhne.boop >> "$root/ios/build/install.log" 2>&1 || true

until="$(date -v+7d '+%Y. %m. %d.')"
echo "Kész: a Boop 7 napig fut a telefonodon (lejár: $until)."
