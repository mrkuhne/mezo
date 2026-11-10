---
title: Boop — native iOS app
type: feature-domain
status: in-progress
updated: 2026-11-10
tags: [ios, swiftui, boop, napkelte, lagy, auth, onboarding, healthkit, eventkit, wearable]
key_files:
  - ios/Boop
  - ios/BoopKit/Sources/BoopCore
  - ios/BoopKit/Sources/BoopDesign/Napkelte
  - ios/Boop/Nap
  - ios/scripts/install-on-phone.sh
  - ios/Boop/Connect
  - backend/src/main/java/io/mrkuhne/mezo/feature/wearable
  - api/feature/wearable/wearable.yml
related: [_platform-auth-security, _platform-api-backend, me, today]
---

# Boop — native iOS app — Feature Documentation

> One-line: the native SwiftUI iPhone app that replaces the web app once complete (epic `mezo-r36n9`).
> Design canon **Napkelte** since S2.5 (dark glass, painted sky, the orb rising as the sun — spec
> [`2026-11-10-boop-napkelte-design.md`](../superpowers/specs/2026-11-10-boop-napkelte-design.md); Lágy before), companion named **Boop**, same backend with a new account. Slice **S1** (the frame)
> is shipped: project, Lágy kit, sign-in / register with invite, onboarding (profile + first weight),
> the five-domain shell, a one-command weekly install. Slice **S2** (data) adds Apple Health (60-day
> backfill, then refresh on every open) and today's + tomorrow's calendar into new `wearable` endpoints;
> plan [`2026-11-09-boop-s2-adatok.md`](../superpowers/plans/2026-11-09-boop-s2-adatok.md). Spec:
> [`2026-11-09-boop-ios-v1-design.md`](../superpowers/specs/2026-11-09-boop-ios-v1-design.md) · plan:
> [`2026-11-09-boop-ios-v1.md`](../superpowers/plans/2026-11-09-boop-ios-v1.md) · approved look:
> [`boop-ios-spike`](../design_2.0/prototypes/boop-ios-spike/README.md) (`Aura*.swift`). Slice **S2.5** (the look) moved
> every shipped screen onto the Napkelte kit; plan [`2026-11-10-boop-napkelte-kit.md`](../superpowers/plans/2026-11-10-boop-napkelte-kit.md).

## 1. Summary

Boop is built in four slices (spec §, plan "Slice map"): **S1 Alap** and **S2 Adatok** (Apple Health +
calendar ingestion) are this doc's current state; S3 Reggel (the morning brief, orb, energy curve),
S4 Lépések (check-in, intention, weight, meal, patterns). The web PWA keeps running until Boop covers
it; in v1 the Edzés, Fuel, Boop and Én tabs open the web app.

## 2. User-facing behavior

- **The look (S2.5, Napkelte):** near-black ground that keeps the page's hue all the way down, a painted landscape
  backdrop per page, white type on glass cards, colour only in the sky and the orbs. Bottom bar = five icons, no
  labels. Sign-in/register, offline, onboarding (profile, first weight, "Szia, Boop vagyok"), Health + calendar
  connect and backfill, the four web-only tabs and Nap · Mai all use it. **Nap · Mai** shows one state until the
  morning brief exists (S3): not connected ("Összekötöm" opens the connect flow), syncing, learning (< 14 nights:
  a still "még tanulom" orb with "9 / 14 éjszaka", no score), no calendar, offline, ready. Bell / "+" / avatar and
  the other Nap tabs answer "hamarosan" until S4.

- **Sign-in** (`SignInView`): e-mail + password; Hungarian problems under each field, cleared on edit;
  server errors in a peach card (wrong password, offline after 20 s, server error). "Van meghívókódom"
  → **Register** (`RegisterView`): invite code, name, e-mail, password (8–72); used invite and taken
  e-mail show under their own field.
- **Onboarding** (`OnboardingFlow`): Pár adat rólad (sex, height ruler, birth date wheel) → Mennyi ma?
  (weight ruler, 0,1 kg) → "Szia, Boop vagyok" → shell. Resumes at the right step after an interruption.
- **Shell** (`ShellView`): floating bottom bar Nap · Edzés · Fuel · Boop · Én. Nap shows the "üres nap"
  page (greeting follows the clock); the other four say they still live in the web app and open it;
  Én adds the account card with a confirmed sign-out.
- **Connect Health + calendar** (`ConnectFlow`, S2): after the first weigh-in, and from Nap's
  "Kössük össze az Egészséget és a naptárat" row. *Kössük össze* lists Apple Egészség and Naptár, hints to
  pick the full data range on the iPhone's Health sheet (iOS 26 offers "last 30 days" vs "all"), then asks
  Health (read: sleep, steps, active energy, heart rate, resting HR, workouts) and calendar (full access,
  read-only). *Behúzom az elmúlt 60 napot* fills Boop's orb with the progress and the live counts, then says
  "Megvan: *58 éjszaka*, 60 nap mozgás és 21 edzés." No Health data → a peach card with where to switch
  it on (Egészség app › Megosztás › Appok › Boop); calendar refused → a line with Beállítások › Boop ›
  Naptárak; the other source still syncs; "Most kihagyom" always leaves.
- **Nap card** once connected: "Beérkezett adatok" with the counts chip — everything synced so far
  (`HealthSync.totals`: distinct night dates / day dates / workout ids kept per user, so re-sent records
  count once; a phone synced before totals existed re-reads the 60 days once, `mezo-r36n9.5`) — and one status chip
  (frissítem… · nem sikerült frissíteni · naptár: nincs engedély · frissítve HH:mm); tapping refreshes.
- **Refresh on open**: every return to the foreground re-syncs (10-minute debounce); a calendar change
  re-sends today + tomorrow. Free team → no background delivery.

## 3. Architecture & data flow

- `ios/Boop.xcodeproj` — app target `Boop` (bundle `io.mrkuhne.boop`, iOS 26) + `BoopTests`; screens
  under `ios/Boop/{Auth,Onboarding,Shell}`; `RootView` switches on `Session.State`
  (`loading · signedOut · offline · needsOnboarding · ready`).
- `ios/BoopKit` (local Swift package):
  - `BoopAPI` — client generated by swift-openapi-generator from `openapi.yaml`, a copy of
    `api/openapi.yml` made by `ios/scripts/sync-openapi.sh` (it rewrites the 3.1-style numeric
    `exclusiveMinimum` the generator rejects); operations filtered in `openapi-generator-config.yaml`.
  - `BoopCore` — `Session` (token + state), `KeychainTokenStore`, `makeClient`/`makeTransport`
    (Bearer middleware, ephemeral URLSession, 20 s request limit), `AuthError` + Hungarian texts,
    `OnboardingModel`, `localDay`; S2: `Health/` (`HealthReader` protocol + `HealthKitReader`,
    `buildNights` — sessions split at > 90 min gaps, 14–18 h wake = nap dropped, per wake day the
    session with most staged minutes wins, 5-min hypnogram letters D/R/L/A ≤ 200 — `mapDays`,
    `mapWorkout`, `HealthSync`) and `Calendar/` (`CalendarReader` + `CalendarKitReader`,
    `buildCalendarDays` → exactly today + tomorrow).
  - `HealthSync` (`@MainActor @Observable`): window = 60 days on first run, afterwards from the
    synced-through day − 2; sends nights (30/batch) → days (60) → workouts (100) → calendar; the
    synced-through mark (`boop.health.syncedThrough.<userId>`) moves only after a fully successful run, so
    an interrupted backfill re-reads the window (the server upserts are idempotent). 401 → sign-out.
    Sleep is read from 18 h before the window and nights waking before it are not re-sent (otherwise
    the window's first night would be overwritten by its after-midnight half). A run that read nothing
    does not move the mark (the 60-day backfill stays available once Health is switched on). The
    calendar is its own step: its failure sets `calendarFailed` and never undoes the Health upload;
    titles are sent as 1…200 UTF-16 units, blank → "(cím nélkül)".
  - `BoopDesign/Napkelte/` (S2.5) — the live kit: `Tokens` (`NK`, `Hue` ×5: sky, orb, glow), `Landscape`
    (`PaintedLandscape`, `MirroredLand`), `Orbs` (`orbPalette`, `riseFraction`, `OrbMotion`, `LivingOrb`, `StillOrb`,
    `RisingOrb`, `MiniOrbRow`), `Glass` (`nkGlass`, `NKPill`, `NKMono`, `Trend`, `NKGlyph`, `nkToast`, `NKBoopCard`,
    `NKField`, `NKSkyScreen`, `NKTag`, `NKRow`), `Frames` (`NKTitleRow`, `NKTabStrip`, `NKTabPage`, `NKFlowFrame`,
    `NKSheetFrame`, `NKNav`, `FloatingLights`, `NKGround`), `Charts`, `Tiles`, `DayPath`.
  - `BoopDesign` (legacy) — what is left of the Lágy kit: tokens, Outfit + Manrope (bundled), glyph assets
    (generated by `ios/tools/genglyphs.mjs` from the Lágy prototype's `G()` table), photos, components,
    page frames (`LagyTabPage`, `LagyFlowFrame`), `BoopFigure` (the Metal orb).

## 4. Data model & API

**S2 — feature `wearable`** (contract tag `Wearable`, `api/feature/wearable/wearable.yml`):

| Operation | Endpoint | Stores |
|---|---|---|
| `ingestSleepNights` | `POST /api/wearable/sleep-nights` → `IngestResult{inserted,updated}` | `sleep_log` upsert by `(created_by, external_id)`, `source = 'apple_health'`, stages + hypnogram |
| `ingestDailyMetrics` | `POST /api/wearable/daily-metrics` | `daily_metric` upsert by `(created_by, date)` — steps, active kcal, resting/avg/min/max HR |
| `ingestWorkouts` | `POST /api/wearable/workouts` | `wearable_workout` upsert by `(created_by, external_id)`; date = local start day (Europe/Budapest) |
| `replaceCalendarDays` | `PUT /api/wearable/calendar-days` → 204 | `calendar_event`: each sent day's rows hard-deleted and replaced |

Caps (`mezo.wearable`): 100 nights, 120 days, 300 workouts, 3 calendar days × 150 events per request →
`WEARABLE_BATCH_TOO_LARGE`. Sleep: one `SleepLogSavedEvent` per batch at most — only for the newest night,
only when newly inserted and dated today or yesterday (a 60-night backfill never floods Boop's messages).
Wearable workouts are display + AI context only (no calorie-target effect). Changesets
`202611092300_mezo-r36n9.2_sleep_log_apple_health.sql`, `202611092310_mezo-r36n9.2_wearable_tables.sql`.

S1 operations used: `login`, `register`, `me`, `completeOnboarding`,
`getBiometricProfile` (always 200; all-null fields = no profile), `upsertBiometricProfile`,
`listWeightLogs`, `logWeight` (201), `getWeightTrend`. JWT lasts 30 days, no refresh: a 401 signs out.

## 5. Integrations

Production API `https://46.225.112.172.sslip.io/api`. Plans (training, meals, calorie target, weight
goal) are set up in the web app with the Boop account (spec §8.1).

## 6. How to use it (consume)

Build/test commands and launch arguments: [`ios/README.md`](../../ios/README.md). Weekly install on the
owner's phone: `ios/scripts/install-on-phone.sh` (team id from `$BOOP_TEAM` or `~/.config/boop/team`;
exit 2 no team, 3 no phone, 4 build, 5 install).

## 7. How to extend it

New API call: add the operationId to the generator config, run `sync-openapi.sh`, wrap it in a
`BoopCore` model with a stub-transport test (`StubTransport` in `BoopCoreTests`). New screen: reuse
`LagyTabPage` / `LagyFlowFrame` and the kit; copy look and copy from the spike's `Lagy*.swift`.

## 8. Testing

- S2.5 kit tests: `NapkelteTokensTests`, `NapkelteRenderTests` (landscape per hue, glass, pills and tabs at
  accessibility sizes, frames, nav labels), `NapkelteOrbTests` (palette padding, rise clamp, learning state,
  reduced motion), `NapkelteChartTests`, `NapkeltePathTests`; core `NapEmptyStateTests`; app `ShellTests`,
  `AuthCopyTests`, `NapCopyTests`.

- `BoopKit-Package` (simulator): generated-client decoding, session states (no token, 401, offline,
  sign-in), error mapping + copy, onboarding order/resume/local day, design kit (fonts, glyph catalog,
  photos, tokens, `hu1`).
- `Boop` app tests: `AuthForm` rules, greeting by time of day, connect copy (`summaryLine`, `countsChip`).
- S2 kit tests: `HealthBuildersTests` (nights across midnight, naps, two sources, hypnogram, workouts, days),
  `CalendarSnapshotTests`, `HealthSyncTests` (60-day first window, 2-day overlap, batching + progress,
  interrupted backfill, idempotent re-send, calendar denied/granted, 401 stops).
- Backend: `WearableSleepServiceIT`, `WearableServiceIT`, `WearableContractIT` (+ existing sleep ITs).
- Not in CI (`ci.yml` does not build `ios/`); run locally.

## 9. Decisions, gotchas & deferred

- **Napkelte traps (S2.5):** the orb shader needs exactly four colours (`orbPalette` pads — three crashed it);
  a `LivingOrb` inside a tap target swallows the tap (`allowsHitTesting(false)` on the orb, tap on the column);
  four Lágy glyphs (check, clock, camera, book) blob when tinted white, so `NKGlyph` draws them as outlines;
  the simulator's network is blocked by the Mac's firewall, so DEBUG `-previewStep profile|weight|hello|connect`
  shows onboarding steps without the server.

- Free Personal Team: 7-day profiles, ≤ 3 sideloaded apps, ≤ 10 App IDs per week — never rename the
  bundle id; the team id is never committed.
- The Debug configuration must carry `SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG` (hand-written
  project); the `-preview onboarding|shell` launch switch is DEBUG-only.
- On the owner's Mac the **LuLu** firewall blocks network calls from the ad-hoc-signed simulator app
  (Safari in the simulator and host processes are fine); allow "Boop" in LuLu to test live calls.
- `confirmationDialog` attached inside scroll content did not present — attach it at page level.
- Presentations: attach sheets/covers/dialogs at page level and let the page read the flag in its body
  (`NapEmptyView` + `connectCover`); reading `scenePhase` on `RootView` itself stopped every presentation,
  so the foreground/calendar triggers live in the invisible `SyncTriggers` view (S2).
- HealthKit: the simulator has no Health data, so the walk-through ends on the no-data card; the
  `-preview` switch uses a DEBUG-only `PreviewTransport` that answers the Wearable endpoints locally.
- Deferred to S3–S4: the morning brief + orb readiness + voice + energy
  curve, the five morning steps, widgets.

## 10. Key files

`ios/Boop/RootView.swift` · `ios/Boop/Auth/AuthFlow.swift` · `ios/Boop/Onboarding/OnboardingFlow.swift` ·
`ios/Boop/Shell/ShellView.swift` · `ios/BoopKit/Sources/BoopCore/Session.swift` ·
`ios/BoopKit/Sources/BoopCore/OnboardingModel.swift` · `ios/BoopKit/Sources/BoopDesign/Pages.swift` ·
`ios/scripts/install-on-phone.sh` · `ios/scripts/sync-openapi.sh` · S2: `ios/Boop/Connect/*` ·
`ios/BoopKit/Sources/BoopCore/Health/HealthSync.swift` · `…/Health/SleepNightBuilder.swift` ·
`…/Calendar/CalendarSnapshotBuilder.swift` · `backend/…/feature/wearable/service/WearableSleepService.java` ·
`backend/…/feature/wearable/controller/WearableController.java`
