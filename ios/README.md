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

### Simulator review flags (DEBUG builds only)

Pass them after the bundle id: `xcrun simctl launch <sim> io.mrkuhne.boop -preview shell -previewEvening YES`.

| Flag | What it does |
|---|---|
| `-previewNotify checkin\|este` | rings the real check-in / close reminder at the next whole minute (background the app; a tap opens the cover) |
| `-preview shell` / `-preview onboarding` | signs in a local preview user; the brief and Health endpoints answer from `PreviewTransport` |
| `-previewEmpty YES` | Nap shows the empty states instead of the brief |
| `-previewTab ma\|terv\|naplo\|boop` | opens that place of the spine |
| `-previewPhase reggel\|napkozben\|este` | Ma's clock reads 08:10 / 13:40 / 21:10 today (the phase strip, plan card, MOST, close-out follow) |
| `-previewWhy YES` | opens the first proposal's *miért?* page |
| `-previewOrb alvas` | opens Ma on that orb (`forma`, `alvas`, `mozgas`, `fuel`, `pulzus`) |
| `-previewDrill alvas` | opens Ma with that orb's room (the domain drill-down) pushed (`forma`, `alvas`, `mozgas`, `fuel`, `pulzus`) |
| `-previewSheet sleep\|heart\|day`, `-previewDetent large` | opens that detail sheet (at the large detent) |
| `-previewKept YES`, `-previewScrub 15.5` | A napod sheet: conflict kept; magnifier held at 15:30 |
| `-previewStep <step>` | onboarding opens on that step |
| `-previewEvening YES` | the clock reads 21:10 and the brief is an evening one: dusk sky, *Esti check-in* / *Esti levezetés* pills, evening paths |
| `-previewRecovery YES` | kímélő mód, day 2 of a cold: calm grey-blue sky, the banner, no session |
| `-previewScroll 850` | tab pages open scrolled to that offset |
| `-previewOpen capture\|account` | opens the "+" capture sheet or the account sheet |
| `-previewOpen checkin\|checkinDone` | opens the check-in (its first item / its payoff after every item is answered and saved), the clock reads 16:02 |
| `-previewOpen este\|esteDone` | opens the evening close (esteDone: already closed), the clock reads 21:32 and the day has its goal |
| `-previewOpen naploDay` | Napló opens yesterday's day |
| `-previewOpen chatAnswer\|chatAsk\|chatQueued` | the Boop tab: one answered question / one asked at launch whose answer takes 8 s / one question waiting for the net (use with `-previewOffline YES`) |
| `-previewOffline YES` | no network: captures stay pending on the phone (waiting glyph), the mic keeps a recording for later upload |
| `-previewColdTap checkin\|este` | simulates a notification tap from a cold launch: the cover is asked for before any view exists |
| `-previewRefuse YES` | the server refuses the daily loop's writes (check-in, goal, close, journal line) with 400: the quiet "nem sikerült elküldeni · Újra" rows |
| `-previewSwitch terv\|naplo\|boop` | switches to that place after 3 s and back to Ma 3 s later (record the backdrop slide + blend without taps) |

Adding an API operation: add its `operationId` to `BoopKit/Sources/BoopAPI/openapi-generator-config.yaml`
and run `scripts/sync-openapi.sh` whenever `api/openapi.yml` changes.

## Signing

- Today: the owner's **free Personal Team** (7-day profiles). **Never commit a team id**; pass it at build time (or `~/.config/boop/team`).
- `Boop.entitlements` = HealthKit + HealthKit background delivery (the free team accepts both; the background wake code is present but **unverified on a device**). Push is not in it — the free team refuses the Push Notifications capability.
- `Boop-Paid.entitlements` = the same plus `aps-environment`. When the paid team is active, `touch ~/.config/boop/paid` and `install-on-phone.sh` builds with it (`CODE_SIGN_ENTITLEMENTS=Boop-Paid.entitlements`). Follow-up: `mezo-r36n9.19`.

## Telepítés a telefonra (hetente)

1. Dugd be az iPhone-t kábellel a Macbe, és oldd fel a képernyőt.
2. Futtasd: `ios/scripts/install-on-phone.sh`
3. Csak az első alkalommal: a telefonon *Beállítások › Általános › VPN és eszközkezelés* → a fejlesztői
   profilnál *Megbízom*.
4. Kész. Az app 7 napig fut; utána ugyanezt kell lefuttatni újra (a szkript kiírja a lejárat napját).
