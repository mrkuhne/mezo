# Boop B1 · Adatalap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Boop's data foundation: the paid Apple team, one account (the original web account, Boop's data merged into it), ~24 Apple Health types with their source, background delivery, deletions, one night per date, Watch/Huawei workouts reconciled with logged sessions, calendar history, and APNs device registration ready for later push.

**Issue:** `mezo-r36n9.11` · **Spec:** [`2026-11-11-boop-standalone-design.md`](../specs/2026-11-11-boop-standalone-design.md) §5 B1 · **Evidence:** research `boop-standalone/09-wearable-health.md` (main), `01`, `05`, `10` · decisions log `14-decisions.md` #2, #3.

**Architecture:** Hybrid storage (design call, below). The phone keeps computing **day rollups** with HealthKit statistics (Apple de-duplicates cumulative types by the user's Health source order) and adds the new discrete types to the wide `daily_metric` row; **raw discrete samples** (heart rate in 5-minute buckets, HRV, respiratory rate, SpO2, wrist temperature, VO2max, HR recovery, body mass/fat/lean, mindful sessions, State of Mind) go to a new per-sample table `health_sample` with source + HealthKit uuid, for B3's check-in snapshot and for baselines. Sync becomes anchored (`HKAnchoredObjectQueryDescriptor` per type, anchor saved only after the server acks) and is driven by `HKObserverQuery` + `enableBackgroundDelivery` registered at launch, plus the existing on-open run as a catch-up.

**Tech stack:** Spring Boot 4 + Liquibase + contract-first OpenAPI; SwiftUI / HealthKit / EventKit / UserNotifications, swift-openapi-generator; Swift Testing (`StubTransport`, fake readers), JUnit + Testcontainers.

## Design calls (mine, documented)

| Topic | Call | Why |
|---|---|---|
| Schema | **Hybrid**: wide `daily_metric` for day rollups (+ distance, basal kcal, exercise min, HRV, resp. rate, SpO2, wrist temp, VO2max, walking HR, mindful min, daylight min) **and** per-sample `health_sample` (metric code, start/end, value, unit, source name, source bundle, device, user-entered, `meta` jsonb, external id = HK uuid). | Prior art (Open Wearables, Sahha, research 09 §5): cumulative types are best summed on the phone by Apple's source order; discrete types need raw samples with provenance for snapshots, baselines and deletes. A wide-only row loses provenance; samples-only needs a server aggregation layer nobody consumes yet. |
| Heart rate volume | HR stored as **5-minute buckets** (avg/min/max in one row, `meta`), key `hr-<bucket start epoch>`; dense Watch workout HR stays inside the bucket. Backfill 14 days for HR, 60 days for everything else. | A Watch writes up to ~700 HR samples per workout hour; buckets keep ~290 rows/day max and are enough for a check-in snapshot. |
| Sleeping HR | Computed **on the phone** per night (HR statistics over the winning session's asleep intervals) and stored on `sleep_log.sleeping_hr`; the winning app's name in `sleep_log.source_app`. | The phone already assembles the night; one extra statistics query per night. |
| Night source priority | Apple Watch (Apple's own bundle, Watch device) → ring apps (Oura/Ultrahuman/RingConn) → Sleep Cycle → any other app → tie-break: most staged minutes (today's rule). | Watch staging is sensor-validated; Sleep Cycle uses the phone mic. Owner has no Watch yet, so today nothing changes for him. |
| **One night per date** | A live-row unique index `(created_by, date) WHERE is_deleted = false` on `sleep_log`; both writers merge instead of inserting. **Sensor fields** (bed/wake, duration, stages, hypnogram, in-bed, sleeping HR, source app) come from Apple Health; **subjective fields** (quality, Sleep Cycle quality %, awakenings) from a manual/screenshot entry. A manual/screenshot entry on a date that has a Health night only fills the subjective fields. | Fixes the arbitrary pick in `BoopDayAssembler:113` and ~17 other readers at once (DB guarantee instead of 17 reader edits); keeps the owner's own quality score. Consequence: a hand-edited bed time on a night the phone tracked does not override the sensor. |
| Health deletions | Workouts + samples: deleted uuids from the anchored queries → `POST /api/wearable/deletions` (soft delete). Nights: any sleep deletion → the phone re-sends the whole 60-day window with `windowFrom/windowTo`, and Health nights in that window that are missing from the payload are soft-deleted (subjective fields from a merged manual entry survive as a manual row). HR buckets: not propagated (documented). | `HKDeletedObject` has only a uuid; a night is built from many samples. |
| Workout reconciliation | **Read-time pure matcher** in `wearable` (`WorkoutReconciler`): a Health workout matches a logged gym session (`workout_session.started_at/finished_at`, `active_seconds` fallback) or sport session (`date+time+duration_min`) when the overlap is ≥ 50 % of the shorter one or the starts are ≤ 20 min apart, and the activity fits (strength/HIIT/functional ↔ gym; volleyball/other ↔ sport). The logged session wins; the Health workout lends kcal / avg HR. Used by `BoopDayAssembler`'s yesterday load (no double count). Thresholds in `WearableProperties`. | Prod check: 13 of 16 Huawei strength workouts sit within minutes of a logged gym session. Read-time avoids a stale stored link when the session is logged after the sync. wearable reads train through a port in train (no cycle). |
| Calendar history | `calendar_event.external_id` (EventKit `calendarItemExternalIdentifier` + occurrence start), upsert by `(created_by, external_id)`; for each sent day, live rows missing from the payload are soft-deleted (cancelled). Past days are never touched again. First sync backfills **60 past days**, afterwards yesterday + today + tomorrow. Readers filter `is_deleted`. | Keeps weeks of history for B7 (capacity) without unbounded growth. |
| Weight from Health | `weight_log` gets `source` (`manual`/`apple_health`) + `external_id`; `bodyMass` samples upsert there through a dedicated path: **one** goal recompute and **one** companion event per batch, only for a new weigh-in from today/yesterday. Manual and Health rows on one day both stay (readers already take the day mean). | `WeightLogService.log` triggers a recompute + event per call — a 60-day backfill must not flood. |
| APNs | New `apns_device` table in the `notification` feature (device id from the keychain, token, environment `sandbox|production`, bundle id, app version, last seen, invalidated at); `PUT /api/devices/apns` upsert (a token registered by another account is moved, like `PushSubscriptionRebindIT`), `DELETE /api/devices/apns/{deviceId}` on sign-out. No sending in B1. | Ready for later push; nothing user-visible yet. |
| Background | `BoopCore.HealthBackground` registers one `HKObserverQuery` per observed type + `enableBackgroundDelivery` (`.immediate` for sleep/workouts/body mass where allowed, `.hourly` otherwise) from the app delegate's `didFinishLaunching`; each wake runs one coalesced incremental sync and always calls the completion handler. On-open sync stays (catch-up). Data-protection: locked-phone reads fail → leave anchors, retry later. | Apple's documented pattern; 3 missed completions stop delivery. |
| Migration | One-off SQL in a single transaction (`scripts/ops/boop-b1-merge-accounts.sql`), backup tables first, rollback script alongside. **Not Liquibase** (owner-specific ids). | Production write → owner's explicit OK with counts + rollback before running. |

## Ownership (bd `mezo-r36n9.11` notes)

Owns: backend `feature/wearable/**`, `notification` APNs parts, new `1.1.0` changesets, `BoopCore/Health|Calendar|Sync|Push/**` + tests, `ios/Boop/Connect/HealthLink.swift`, a new `ios/Boop/App/BoopAppDelegate.swift` (+ one adaptor line in `BoopApp.swift`), entitlements, install script, README signing. **Hot spots taken:** `api/openapi.yml` + `merge.yml`, `BoopAPI/**`, `1.1.0_master.yml` (append-only), `ResetDatabase.java`, `Boop.xcodeproj` (capabilities/signing only). No screens (B2), no memory/konzílium (B0).

## Review Focus

1. **One night per date** — a manual night and a Health night on the same date end as one row with the sensor times and the manual quality; re-sync and the web log never create a second live row; deleted-and-revived external ids do not trip the date index.
2. **No floods** — a 60-day backfill of weight or sleep raises at most one goal recompute / one companion event.
3. **Anchors** — an anchor moves only after the server acknowledged that batch; an interrupted run re-sends, never loses; deletions arrive server-side.
4. **Background delivery** — completion handler called on every path (success, failure, locked phone, signed out).
5. **No double count** — a Huawei strength workout overlapping a logged gym session is counted once in Boop's load.
6. **Migration** — counts before/after match, the 12 overlapping nights merge per the rule, rollback restores byte-for-byte.

---

## File structure

```
api/feature/wearable/wearable.yml               + samples, deletions, widened schemas, calendar externalId, night window
api/feature/device/device.yml (new)             PUT/DELETE /api/devices/apns  (tag Device)
api/generate/merge.yml                           + device fragment
backend/.../feature/wearable/
  service/HealthSampleService.java  WearableDeletionService.java  WorkoutReconciler.java  WeightFromHealthService (in biometrics.weight, called via port)
  entity/HealthSampleEntity.java   repository/HealthSampleRepository.java
backend/.../feature/biometrics/sleep/service/SleepNightMerge.java   (pure merge rule, used by both writers)
backend/.../feature/notification/{controller,service,entity,repository}/ApnsDevice*
backend/.../feature/train/service/LoggedSessionPort (read-only port for the reconciler)
backend/src/main/resources/db/changelog/1.1.0/script/202611111*_mezo-r36n9.11_*.sql
scripts/ops/boop-b1-merge-accounts.sql  scripts/ops/boop-b1-merge-accounts-rollback.sql
ios/BoopKit/Sources/BoopCore/Health/  HealthKitReader (24 types, anchors, buckets), HealthReader (+ HealthChange), SleepNightBuilder (priority, sleeping HR), HealthSync (anchored), HealthBackground
ios/BoopKit/Sources/BoopCore/Calendar/ CalendarItem.externalId, 60-day backfill
ios/BoopKit/Sources/BoopCore/Push/PushRegistrar.swift
ios/Boop/App/BoopAppDelegate.swift   ios/Boop.entitlements   ios/scripts/install-on-phone.sh   ios/README.md
```

## Tasks

### Task B1-1: Contract
- [ ] `wearable.yml`: `DailyMetricIn` + distanceM, basalKcal, exerciseMin, hrvMs, respRate, spo2Pct, wristTempC, vo2max, walkingHr, mindfulMin, daylightMin; `SleepNightIn` + sourceApp, sleepingHr; `SleepNightBatchRequest` + optional windowFrom/windowTo; `WorkoutIn` + distanceM, maxHr, sourceBundle; `CalendarEventIn` + externalId (required); new `POST /api/wearable/samples` (`HealthSampleIn`: externalId, metric enum, start, end, value, unit, sourceName, sourceBundle, device, userEntered, meta object) and `POST /api/wearable/deletions` (`externalIds[]`).
- [ ] `device.yml`: `PUT /api/devices/apns` (`ApnsDeviceIn`: deviceId uuid, token hex, environment enum, bundleId, appVersion) → 204; `DELETE /api/devices/apns/{deviceId}` → 204.
- [ ] merge.yml, `npm run generate:api`, `pnpm generate:api`, `ios/scripts/sync-openapi.sh`, iOS filter + `ingestHealthSamples`, `deleteHealthRecords`, `registerApnsDevice`, `unregisterApnsDevice`.

### Task B1-2: Schema (Liquibase, one file per concern) + ResetDatabase + populators
- [ ] `health_sample` (+ named constraints, full unique `(created_by, external_id)`, index `(created_by, metric, start_at)`), metric check list.
- [ ] `daily_metric` widened (nullable, named `>= 0` checks; wrist temp signed).
- [ ] `wearable_workout` + distance_m, max_hr, source_bundle, updated_at.
- [ ] `sleep_log` + source_app, sleeping_hr; generic dedup (merge rule in SQL, soft-delete losers) then `uq_sleep_log_owner_date_live`.
- [ ] `calendar_event` + external_id, updated_at; backfill existing rows `legacy-<id>`; unique `(created_by, external_id)`.
- [ ] `weight_log` + source (check, default manual), external_id + partial unique.
- [ ] `apns_device`.
- [ ] Tests first: a migration IT that seeds duplicates and asserts one live row after the dedup changeset.

### Task B1-3: One night per date (TDD)
- [ ] `SleepNightMerge` pure rule + unit tests (manual→Health, Health→manual, screenshot quality %, revived external id).
- [ ] `WearableSleepService` upsert merges into the live date row; window deletion; event rule unchanged.
- [ ] `SleepLogService.log` (web/manual + screenshot confirm) merges by date instead of inserting.
- [ ] `BoopDayAssemblerIT`: `nightsKnown` counts dates; the duplicate-pick case pinned.

### Task B1-4: Samples, deletions, weight from Health (TDD)
- [ ] `HealthSampleService` upsert (cap `mezo.wearable.max-samples=1000`), counts inserted/updated.
- [ ] `body_mass` samples → weight upsert via a port in `biometrics.weight` (one recompute + one event per batch, recent only).
- [ ] `WearableDeletionService`: soft-delete samples, workouts (`hk-<uuid>`), Health weights by external id; idempotent.
- [ ] ITs: re-send idempotent, delete then re-add revives, 60 weights → one event.

### Task B1-5: Day rollups, workouts, reconciliation (TDD)
- [ ] Daily metric + workout upserts carry the new columns.
- [ ] `WorkoutReconciler` pure unit tests (overlap, 20-min start, activity mismatch, auto-closed session with null finish → `active_seconds`, sport `time+duration`).
- [ ] `BoopDayAssembler` yesterday load uses it; finders filter `is_deleted`.

### Task B1-6: Calendar history (TDD)
- [ ] Upsert by external id; missing-on-sent-day → soft delete; past days untouched; reader + brief hash read live rows only.
- [ ] IT: two syncs a day apart keep yesterday; a cancelled event disappears from today only.

### Task B1-7: APNs device registration (TDD)
- [ ] Entity/repo/service/controller (`DeviceApi`), upsert by `(device_id)`, token moved between accounts, delete on sign-out; contract IT.

### Task B1-8: iOS readers (TDD with fakes)
- [ ] `HealthReader` protocol: `changes(kind:anchor:from:)` → `HealthChange(added, deletedIds, anchor: Data)`; value types for samples (metric, source bundle/device, userEntered, meta), workouts (+ distance, max HR, HR range fallback when the writer did not attach HR), day rollups (new fields), nights (+ sourceApp, sleepingHr).
- [ ] `HealthKitReader`: 24 read types (sleepAnalysis, stepCount, distanceWalkingRunning, activeEnergyBurned, basalEnergyBurned, appleExerciseTime, timeInDaylight, heartRate, restingHeartRate, walkingHeartRateAverage, heartRateVariabilitySDNN, heartRateRecoveryOneMinute, respiratoryRate, oxygenSaturation, appleSleepingWristTemperature, vo2Max, sleepingBreathingDisturbances, bodyMass, bodyFatPercentage, leanBodyMass, mindfulSession, stateOfMind, workouts); anchored descriptors; HR 5-minute buckets.
- [ ] `SleepNightBuilder` source priority + sleeping HR; tests for Watch vs Sleep Cycle vs tie.

### Task B1-9: iOS HealthSync v2 (TDD with `StubTransport`)
- [ ] Per-kind anchors in `UserDefaults` (keyed by user), saved after the ack; first run backfill windows (60 d / HR 14 d); nights window on sleep change, full 60-day window on sleep deletion; deletions endpoint; samples batches of 500; calendar 60-day backfill once then −1…+1 with external ids; summary counts keep working for the existing card.
- [ ] Tests: interrupted run re-sends; anchor not saved on 5xx; deletion path; unauthorized → sign-out; calendar failure isolated.

### Task B1-10: iOS background + push plumbing
- [ ] `HealthBackground` (observer per type, `enableBackgroundDelivery`, coalesced run, completion on every path; testable core with a fake observer source).
- [ ] `PushRegistrar` (device id in keychain, token hex, environment from the build's `aps-environment`, `PUT` on every launch when signed in, `DELETE` on sign-out) + tests.
- [ ] `BoopAppDelegate` (`didFinishLaunching` → background registration; remote-notification token callbacks) + `@UIApplicationDelegateAdaptor` line; `HealthLink` asks authorization for newly added types once (system sheet only shows new ones).
- [ ] Entitlements: `com.apple.developer.healthkit.background-delivery`, `aps-environment`; usage string broadened (body, mood, mindful).

### Task B1-11: Paid team + signing
- [ ] Owner subscribes (Hungarian steps given 2026-11-11); team id → `~/.config/boop/team` only.
- [ ] Register `io.mrkuhne.boop` (+ `.tests`) under the paid team via `-allowProvisioningUpdates`; if Apple reports the id taken by the free team, fall back to `io.mrkuhne.boopapp` and record why.
- [ ] Install script: no 7-day text, prints profile expiry; README "Telepítés" rewritten; `git grep DEVELOPMENT_TEAM ios/` empty.

### Task B1-12: Account switch + migration (production write — owner OK first)
- [ ] Script: backup tables `b1_backup_*` (copies of every touched row), then in one transaction: merge 35 Health nights (12 into existing owner nights per the merge rule, 23 moved), move `daily_metric` 61, `wearable_workout` 16, `calendar_event` 9, `boop_brief` 1, `weight_log` 1 (`workout_time_override`: 0 rows); assert counts; commit. Rollback script restores from the backups.
- [ ] Rehearse on a Testcontainers DB with the same shape (synthetic data).
- [ ] Owner OK → run → verify counts → the phone signs in with the original account; the Boop account is left in place (its auto-generated habits/AI logs untouched), sign-in to it disabled only after the owner confirms all is well.

### Task B1-13: Gates, review, merge, deploy, install, verify, docs
- [ ] Backend focused ITs (`Wearable*,Boop*,SessionTimeIT,SleepLog*,WeightLog*,ApnsDevice*,ArchitectureTest`, Testcontainers); BoopKit tests; app build; `gen-codemap`; `lint-docs`; FE contract-drift (`api.gen.ts`) + FE tests both modes if the generated client changed.
- [ ] Fresh-context review (most capable model), fix Critical/Important test-first.
- [ ] Merge (detached, `--no-ff`), push, deploy green, fast-forward primary `main`.
- [ ] Install on the phone (exclusive), owner opens Boop and grants the new Health types.
- [ ] Prod: rows in `health_sample` for the new metrics, `daily_metric` new columns filled, one live night per date, `apns_device` row, calendar history kept across a day.
- [ ] `docs/features/boop-ios.md`, feature index row, roadmap milestone, skill §6, `me.md:374` drift fix.

## Kész, ha… (B1 done-checklist; copied into the bd acceptance)

- [ ] A Boop a **fizetős** Apple-csapattal van aláírva, a telefonon fut, nincs heti újratelepítés; csapatazonosító nincs a repóban.
- [ ] A Boop az **eredeti fiókkal** van belépve; a Boop-fiók 35 éjszakája (12 összefésülve), 61 napja, 16 edzése, 9 naptáreseménye, 1 reggeli összefoglalója, 1 súlya az eredeti fiókban van; visszaállító szkript kipróbálva.
- [ ] Prodban megérkeztek az új mérések (legalább: pulzus-blokkok, nyugalmi/séta pulzus, távolság, alap kcal, súly; HRV/légzés/SpO2/csuklóhő/VO2max ha van forrásuk) a forrás nevével.
- [ ] Háttérben is jön adat (a telefon zárva, egy óra múlva új sor van) — vagy dokumentálva, mi akadályozza.
- [ ] Egy dátumra egy éjszaka él (DB-szabály), a manuális minőség megmarad; a Healthben törölt edzés eltűnik a szerverről.
- [ ] A Huawei-edzés és a naplózott edzés nem számít duplán a Boop terhelésében.
- [ ] A naptár tegnapi eseményei megmaradnak; 60 nap naptármúlt feltöltve.
- [ ] `apns_device` sor a telefonhoz.
- [ ] Kapuk: backend fókuszált IT + ArchitectureTest (Testcontainers), BoopKit tesztek, app build, codemap, lint-docs 0/0, FE drift + FE tesztek két módban ha a kliens változott.
- [ ] Merge main-re, deploy zöld, élő ellenőrzés; `boop-ios.md`, feature index, roadmap, skill §6 frissítve; magyar jelentés.
