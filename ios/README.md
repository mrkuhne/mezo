# Boop — native iOS app

Boop is the native iPhone app that replaces the Mezo web app once complete (epic `mezo-r36n9`).
Spec: [`docs/superpowers/specs/2026-11-09-boop-ios-v1-design.md`](../docs/superpowers/specs/2026-11-09-boop-ios-v1-design.md) ·
Plan: [`docs/superpowers/plans/2026-11-09-boop-ios-v1.md`](../docs/superpowers/plans/2026-11-09-boop-ios-v1.md) ·
Look: **Napkelte** — [spec](../docs/superpowers/specs/2026-11-10-boop-napkelte-design.md), reference spike
[`docs/design_2.0/prototypes/boop-ios-spike/`](../docs/design_2.0/prototypes/boop-ios-spike/README.md) (`Aura*.swift`).

## Layout

- `Boop.xcodeproj` — app target `Boop` (bundle `io.mrkuhne.boop`) + unit tests `BoopTests`.
- `Boop/` — screens, one folder per area (file-system synchronized group: new files are picked up automatically).
- `BoopKit/` — local Swift package: `BoopAPI` (client generated from the backend contract),
  `BoopCore` (session, token, API wiring), `BoopDesign` (the Napkelte kit in `Napkelte/`, plus the remaining Lágy tokens and glyph assets).
- `scripts/sync-openapi.sh` — copies `api/openapi.yml` into `BoopKit/Sources/BoopAPI/openapi.yaml`
  (rewriting the 3.1-style `exclusiveMinimum: N` the Swift generator rejects); `--check` fails when stale.

## Build and test

Xcode 27 is installed but `xcode-select` may point at the Command Line Tools, so export the path:

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
```

```bash
cd ios/BoopKit && xcodebuild test -scheme BoopKit-Package -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -skipPackagePluginValidation -derivedDataPath ../build/kit
```

```bash
cd ios && xcodebuild test -project Boop.xcodeproj -scheme Boop -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -skipPackagePluginValidation -derivedDataPath build/app
```

Adding an API operation: add its `operationId` to `BoopKit/Sources/BoopAPI/openapi-generator-config.yaml`
and run `scripts/sync-openapi.sh` whenever `api/openapi.yml` changes.

Signing uses the owner's free Personal Team. **Never commit a team id**; pass it at build time.

## Telepítés a telefonra (hetente)

1. Dugd be az iPhone-t kábellel a Macbe, és oldd fel a képernyőt.
2. Futtasd: `ios/scripts/install-on-phone.sh`
3. Csak az első alkalommal: a telefonon *Beállítások › Általános › VPN és eszközkezelés* → a fejlesztői
   profilnál *Megbízom*.
4. Kész. Az app 7 napig fut; utána ugyanezt kell lefuttatni újra (a szkript kiírja a lejárat napját).
