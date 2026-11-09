# Boop S2 · Adatok Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Boop pulls the owner's last 60 days from Apple Health (sleep with stages, steps, heart rate, resting HR, active energy, workouts) and today's + tomorrow's calendar on first connect, then keeps them fresh on every app open, into new idempotent backend endpoints.

**Architecture:** One new backend feature `wearable` (contract tag `Wearable`, package `io.mrkuhne.mezo.feature.wearable`) with four write endpoints: sleep nights upsert into the existing `sleep_log` (new `external_id`, source `apple_health`), daily metrics and workouts into two new tables, calendar days full-replace into a new table. On the phone, `BoopCore` gets pure builders (HealthKit samples → nights / days / workouts; EventKit events → day snapshots) behind reader protocols, and a `HealthSync` model that batches, uploads and reports progress; the app adds a connect flow (permissions → backfill progress) reachable from onboarding and from Nap.

**Tech Stack:** Spring Boot 4 + Liquibase + MapStruct + contract-first OpenAPI (backend); SwiftUI, HealthKit, EventKit, swift-openapi-generator (iOS); Swift Testing, JUnit + Testcontainers.

**Spec:** [`docs/superpowers/specs/2026-11-09-boop-ios-v1-design.md`](../specs/2026-11-09-boop-ios-v1-design.md) §4.4 (data in), §8.2 (60-day backfill), §3 (free team: sync on open). Slice map: [`2026-11-09-boop-ios-v1.md`](2026-11-09-boop-ios-v1.md). S1 code: `ios/`, [`docs/features/boop-ios.md`](../../features/boop-ios.md).

## Global Constraints

- Everything from the S1 plan's Global Constraints (iOS 26, bundle `io.mrkuhne.boop`, team id never committed, Lágy canon, companion "Boop", Hungarian copy, "kalória").
- Free Personal Team: HealthKit is allowed, **background delivery is not relied on** — sync runs on app open/foreground (spec §3).
- Backfill window: **60 days** (spec §8.2); afterwards incremental.
- Ingestion is **idempotent**: re-sending the same night / day / workout never creates a duplicate (spec §4.4). One `sleep_log` row per night.
- Sleep rows from Health carry **`source = 'apple_health'`** (spec §4.4).
- Wearable workouts are **display + AI context only** — they do not touch calorie targets (spec §9 call).
- Calendar: **EventKit, read-only**, snapshot of **today + tomorrow** replaces that day's rows server-side (spec §4.4); Boop never writes to the calendar (spec §8.3).
- `created_by` always from the token (`CurrentUserId`), never the payload. No change to shared AI paths (morning prompt, meal coach).
- Backend house rules: contract first (`api/feature/wearable/wearable.yml` + `api/generate/merge.yml`), changesets in `backend/src/main/resources/db/changelog/1.1.0/` named `{YYYYMMDDHHMM}_{bd-id}_{desc}`, ArchUnit layers, method-level `@Transactional`, no `@Value`, `ResetDatabase` + populator for every new table, `node scripts/gen-codemap.mjs`.

## Review Focus

1. **Re-sync after a backfill** (the next morning re-reads the last days) → row counts stay the same, values update; nothing doubles (sleep, metrics, workouts). Tests in Tasks S2-2 and S2-6.
2. **A 60-night backfill must not flood Boop's messages**: the companion's sleep message fires at most once, for the newest night if it is from today or yesterday — never 60 times. Test in Task S2-2.
3. **Night across midnight, naps and two sources**: a night from 23:40 to 06:50 lands on the wake day; a 15:00 nap is not a night; when Sleep Cycle and another app both write a night, the one with stages wins. Tests in Task S2-4.
4. **Permission denied or no data**: Health access refused (HealthKit then simply returns nothing) or calendar refused → Boop says so in Hungarian with where to fix it, sync of the other source still works, nothing crashes. Tests in Tasks S2-5/S2-7.
5. **Interrupted backfill** (app closed at 40 %) → next open continues; already-sent batches are simply re-sent safely (idempotent), progress restarts from the remaining window. Test in Task S2-6.

---

## File structure

```
api/feature/wearable/wearable.yml                       contract (tag Wearable)
backend/.../feature/wearable/
  controller/WearableController.java                    implements WearableApi
  service/WearableSleepService.java                     nights → sleep_log upsert (+ one event)
  service/DailyMetricService.java                       days upsert
  service/WearableWorkoutService.java                   workouts upsert
  service/CalendarSnapshotService.java                  per-day replace
  entity/DailyMetricEntity.java  WearableWorkoutEntity.java  CalendarEventEntity.java
  repository/DailyMetricRepository.java  WearableWorkoutRepository.java  CalendarEventRepository.java
  config/WearableProperties.java                        batch caps
backend/.../feature/biometrics/sleep/                   entity @Pattern + repository upsert by external id
backend/src/main/resources/db/changelog/1.1.0/script/   2 changesets (sleep_log widen, new tables)
backend/src/test/.../feature/wearable/                  WearableServiceIT, WearableContractIT
backend/src/test/.../support/populator/                 3 populators; ResetDatabase entries
ios/BoopKit/Sources/BoopCore/Health/                    HealthReader, SleepNightBuilder, DailyMetricsBuilder, WorkoutMapper, HealthSync
ios/BoopKit/Sources/BoopCore/Calendar/                  CalendarReader, CalendarSnapshotBuilder
ios/BoopKit/Sources/BoopCore/Health/HealthKitReader.swift  CalendarKitReader.swift  (real readers)
ios/Boop/Connect/                                       ConnectFlow, PermissionsStep, BackfillStep, ConnectCard
ios/Boop/Boop.entitlements                              HealthKit
```

---

### Task S2-1: Contract — the `Wearable` endpoints

**Files:**
- Create: `api/feature/wearable/wearable.yml`; Modify: `api/generate/merge.yml` (append), `api/openapi.yml` (generated), `api/feature/sleep/sleep.yml:116-119,176-179`, `ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml`, `ios/BoopKit/Sources/BoopAPI/openapi.yaml` (sync)

**Interfaces — Produces** (schema name = class name, operationId = method name):
- `POST /api/wearable/sleep-nights` · `ingestSleepNights(SleepNightBatchRequest) → 200 IngestResult`
  - `SleepNightBatchRequest { nights: [SleepNightIn] }`, `maxItems` not set in contract (cap enforced in service, see S2-2).
  - `SleepNightIn` required `externalId` (string 1–64), `date` (date, wake day), `bedtime`, `wakeup` (`^\d{2}:\d{2}$`), `durationH` (number 0–24); optional `inBedMin`, `awakeMin`, `lightMin`, `remMin`, `deepMin` (integer ≥ 0), `hypnogram` (`$ref common Hypnogram`).
- `POST /api/wearable/daily-metrics` · `ingestDailyMetrics(DailyMetricBatchRequest) → 200 IngestResult`
  - `DailyMetricIn` required `date`; optional `steps`, `restingHr`, `avgHr`, `minHr`, `maxHr`, `activeKcal` (integer ≥ 0).
- `POST /api/wearable/workouts` · `ingestWorkouts(WorkoutBatchRequest) → 200 IngestResult`
  - `WorkoutIn` required `externalId` (1–64), `activityType` (`^[a-z_]{1,40}$`), `startAt`, `endAt` (date-time); optional `kcal`, `avgHr` (integer ≥ 0), `sourceName` (≤ 80).
- `PUT /api/wearable/calendar-days` · `replaceCalendarDays(CalendarDaysRequest) → 204`
  - `CalendarDaysRequest { days: [CalendarDayIn] }`, `CalendarDayIn { date, events: [CalendarEventIn] }`, `CalendarEventIn` required `title` (≤ 200), `startAt`, `endAt`, `allDay` (bool); optional `calendarName` (≤ 80).
- `IngestResult { inserted: int, updated: int }`. Every operation: `400/401` → `SystemMessageList`.
- Sleep contract: request and response `source` pattern become `'^(manual|screenshot|apple_health)$'`.
- iOS generator filter adds `ingestSleepNights`, `ingestDailyMetrics`, `ingestWorkouts`, `replaceCalendarDays`.

- [ ] **Step 1:** Write the fragment, append `- inputFile: ../feature/wearable/wearable.yml` to `api/generate/merge.yml`, widen the two sleep patterns.
- [ ] **Step 2:** `cd api/generate && npm run generate:api` → `api/openapi.yml` contains `/api/wearable/sleep-nights` (grep); `cd frontend && pnpm generate:api` (web types stay compilable: `pnpm tsc --noEmit` passes).
- [ ] **Step 3:** `ios/scripts/sync-openapi.sh`, add the four ids to the iOS filter; `cd ios/BoopKit && xcodebuild test …` (S1 command) → builds, all existing tests pass.
- [ ] **Step 4:** Commit `feat(api): Wearable ingestion contract (mezo-r36n9)`.

### Task S2-2: Sleep nights → `sleep_log` upsert

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/{ts}_mezo-r36n9_sleep_log_apple_health.sql` + entry in `1.1.0_master.yml`; `…/feature/wearable/service/WearableSleepService.java`; `…/feature/wearable/config/WearableProperties.java`
- Modify: `…/biometrics/sleep/entity/SleepLogEntity.java:84-86` (`@Pattern("manual|screenshot|apple_health")`, add `externalId`), `…/biometrics/sleep/repository/SleepLogRepository.java` (native upsert)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/wearable/WearableSleepServiceIT.java`

**Changeset:** `alter table sleep_log alter column source type varchar(16)`; drop + re-add `ck_sleep_log_source` with `('manual','screenshot','apple_health')`; `add column external_id varchar(64)`; `create unique index uq_sleep_log_owner_external on sleep_log (created_by, external_id) where external_id is not null` (covers soft-deleted rows on purpose — a deleted night stays deleted).

**Interfaces:**
- Produces: `WearableSleepService.ingest(UUID createdBy, List<SleepNightIn> nights, LocalDate today) → IngestResult`.
- `WearableProperties` (`mezo.wearable.*`, `@Validated`): `maxSleepNights = 100`, `maxDays = 120`, `maxWorkouts = 300`, `maxCalendarDays = 3`, `maxEventsPerDay = 150`. Over cap → `SystemRuntimeErrorException` code **`WEARABLE_BATCH_TOO_LARGE`** (400).
- Upsert: native `insert … on conflict (created_by, external_id) where external_id is not null do update set …` returning `(xmax = 0) as inserted` (precedent `feature/llmlog/repository/AiDraftOutcomeRepository.java:33-46`). Always sets `source = 'apple_health'`.
- Event rule: after the batch, publish **one** `SleepLogSavedEvent` for the newest night only if it was inserted in this call and its `date >= today - 1` (Review Focus 2).

- [ ] **Step 1:** Write `WearableSleepServiceIT` (extends `AbstractIntegrationTest`, `@Transactional`, users via `databasePopulator.populateUser`):
  - `firstIngestInsertsOneRowPerNight` — 3 nights → `IngestResult(3,0)`, 3 rows, `source == "apple_health"`, stage minutes and hypnogram stored.
  - `resendingSameNightsUpdatesNotDuplicates` — same 3 with changed `deepMin` → `IngestResult(0,3)`, still 3 rows, new `deepMin` (Review Focus 1).
  - `sameExternalIdForAnotherUserIsSeparate` — user B same ids → 3 more rows, A's untouched.
  - `backfillPublishesAtMostOneSleepEvent` — 60 nights ending yesterday → exactly 1 `SleepLogSavedEvent` (use `@RecordApplicationEvents`); 60 nights ending 10 days ago → 0 events (Review Focus 2).
  - `overCapIsRejected` — 101 nights → `WEARABLE_BATCH_TOO_LARGE`.
- [ ] **Step 2:** Run `cd backend && ./mvnw test -Dtest='WearableSleepServiceIT' -Dmezo.test.use-testcontainers=true` → fails (no service).
- [ ] **Step 3:** Implement changeset, entity field, repository upsert, service, properties (+ `application.yml` defaults).
- [ ] **Step 4:** Run the same command → 5/5 pass; run `-Dtest='SleepLog*IT,BiometricsContractIT,ArchitectureTest'` → green (manual sleep logging unchanged).
- [ ] **Step 5:** Commit `feat(wearable): sleep nights from Apple Health upsert into sleep_log (mezo-r36n9)`.

### Task S2-3: Daily metrics, workouts, calendar days — tables, services, controller

**Files:**
- Create: changeset `{ts}_mezo-r36n9_wearable_tables.sql` (+ master entry); entities/repositories/services listed in File structure; `controller/WearableController.java`; populators `DailyMetricPopulator`, `WearableWorkoutPopulator`, `CalendarEventPopulator` (+ `@Import` in `AbstractIntegrationTest.java:97-115`); `ResetDatabase.java:48` TRUNCATE gains `daily_metric, wearable_workout, calendar_event`
- Test: `…/feature/wearable/WearableServiceIT.java`, `…/feature/wearable/WearableContractIT.java`

**Tables** (all `OwnedEntity` columns: `id, created_by, created_at, is_deleted`):
- `daily_metric(date date not null, steps int, resting_hr int, avg_hr int, min_hr int, max_hr int, active_kcal int, updated_at timestamptz not null)`, unique `(created_by, date)`.
- `wearable_workout(external_id varchar(64) not null, date date not null, activity_type varchar(40) not null, start_at timestamptz not null, end_at timestamptz not null, kcal int, avg_hr int, source_name varchar(80))`, unique `(created_by, external_id)`; `date` = local start day in the user's timezone (`app_user.timezone`).
- `calendar_event(date date not null, title varchar(200) not null, start_at timestamptz not null, end_at timestamptz not null, all_day boolean not null, calendar_name varchar(80))`, index `(created_by, date)`.

**Interfaces — Produces:**
- `DailyMetricService.ingest(UUID, List<DailyMetricIn>) → IngestResult` — native upsert on `(created_by, date)`, replaces all metric columns.
- `WearableWorkoutService.ingest(UUID, List<WorkoutIn>) → IngestResult` — native upsert on `(created_by, external_id)`.
- `CalendarSnapshotService.replace(UUID, List<CalendarDayIn>)` — per day: native hard `delete from calendar_event where created_by = ? and date = ?`, then insert that day's events (an empty `events` list clears the day).
- `WearableController implements WearableApi` — injects `CurrentUserId`, passes `currentUserId.get()` and `LocalDate.now(user zone)` for the sleep event rule; no mapping annotations.

- [ ] **Step 1:** Write `WearableServiceIT`: `dailyMetricsUpsertByDay` (send 2 days, resend with new steps → 2 rows, new values, result `(0,2)`), `workoutsUpsertByExternalId`, `calendarReplaceClearsTheDay` (day with 3 events, then same day with 1 → 1 row; `events: []` → 0 rows; other day untouched), caps for each (`WEARABLE_BATCH_TOO_LARGE`).
- [ ] **Step 2:** Write `WearableContractIT` (extends `ApiIntegrationTest`, `ownerAuthHeaders()`): each endpoint 200/204 with owner headers; 401 without; 400 on a malformed `bedtime` (`"7:5"`); response `IngestResult` shape.
- [ ] **Step 3:** Run `./mvnw test -Dtest='Wearable*IT' -Dmezo.test.use-testcontainers=true` → fail.
- [ ] **Step 4:** Implement tables, entities, repositories, services, controller, populators, ResetDatabase.
- [ ] **Step 5:** Run `-Dtest='Wearable*IT,ArchitectureTest'` → green; `node scripts/gen-codemap.mjs` (commit the change).
- [ ] **Step 6:** Commit `feat(wearable): daily metrics, workouts and calendar snapshot endpoints (mezo-r36n9)`.

### Task S2-4: iOS — nights, days and workouts from HealthKit samples (pure builders)

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/Health/{HealthReader,SleepNightBuilder,DailyMetricsBuilder,WorkoutMapper}.swift`
- Test: `ios/BoopKit/Tests/BoopCoreTests/HealthBuildersTests.swift`

**Interfaces — Produces:**
- `struct SleepSample: Sendable { let start, end: Date; let stage: Stage; let source: String }`, `enum Stage { inBed, awake, core, deep, rem, asleepUnspecified }`.
- `protocol HealthReader: Sendable { func sleepSamples(from: Date, to: Date) async throws -> [SleepSample]; func dayTotals(from: Date, to: Date, calendar: Calendar) async throws -> [DayTotals]; func workouts(from: Date, to: Date) async throws -> [WorkoutSample] }` with `DayTotals { date: String; steps, activeKcal, restingHr, avgHr, minHr, maxHr: Int? }`, `WorkoutSample { uuid: UUID; activity: String /* HKWorkoutActivityType name */; start, end: Date; kcal, avgHr: Int?; source: String }`.
- `func buildNights(_ samples: [SleepSample], calendar: Calendar) -> [Components.Schemas.SleepNightIn]`:
  - group samples into sessions (gap > 90 min starts a new session); a session whose last asleep sample ends between **14:00 and 18:00** local is a nap → dropped;
  - per wake day keep one session; if several sources cover it, keep the source with the most `deep+rem+core` minutes (Review Focus 3);
  - `date` = local day of the last asleep sample's end; `bedtime`/`wakeup` = first/last asleep `HH:mm`; minutes per stage (`asleepUnspecified` counts as light); `durationH` = asleep minutes / 60 rounded to 2 decimals;
  - hypnogram: `bucketMin = 5`, one letter per bucket from bedtime — the stage covering most of the bucket: `D` deep, `R` rem, `L` core/unspecified, `A` awake/in-bed gap; cap at 200 letters (contract `maxLength`);
  - `externalId = "hk-night-\(date)"` (one row per night per user, stable across re-syncs and source changes). *Planner's call:* the spec says "keyed by the HealthKit sample UUID", but a night is many samples and the source may change; keying by night keeps the spec's harder rule — one row per night, never duplicated.
- `func mapWorkout(_ w: WorkoutSample, calendar: Calendar) -> Components.Schemas.WorkoutIn` — `externalId = "hk-\(uuid)"`, `activityType` from a table: `traditionalStrengthTraining`/`functionalStrengthTraining` → `strength`, `running` → `running`, `walking` → `walking`, `cycling` → `cycling`, `volleyball` → `volleyball`, `highIntensityIntervalTraining` → `hiit`, `yoga` → `yoga`, anything else → `other`.
- `func mapDays(_ d: [DayTotals]) -> [Components.Schemas.DailyMetricIn]` — drops a day whose every metric is nil.

- [ ] **Step 1:** Write `HealthBuildersTests` (calendar = gregorian, Europe/Budapest):
  - `nightAcrossMidnightLandsOnWakeDay` — 2026-11-08 23:40 → 2026-11-09 06:50 → `date == "2026-11-09"`, `bedtime == "23:40"`, `wakeup == "06:50"`.
  - `stageMinutesAndDuration` — 84 deep, 98 rem, 228 core, 22 awake → `deepMin 84, remMin 98, lightMin 228, awakeMin 22, durationH 6.83`.
  - `hypnogramLettersFollowStages` — 30 min core, 10 min deep → `bucketMin 5`, `stages == "LLLLLLDD"`.
  - `afternoonNapIsNotANight` — 15:00–15:40 asleep → `[]` (Review Focus 3).
  - `stagedSourceWinsOverUnstaged` — Sleep Cycle with stages + other app `asleepUnspecified` same night → one night, stage minutes from Sleep Cycle (Review Focus 3).
  - `externalIdIsStablePerNight` — same input twice → equal ids.
  - `workoutTypeMapping` — strength/running/unknown → `strength`/`running`/`other`; `externalId` starts with `hk-`.
  - `emptyDaysAreDropped`.
- [ ] **Step 2:** Run the package tests → fail. **Step 3:** Implement. **Step 4:** Run → pass.
- [ ] **Step 5:** Commit `feat(ios): HealthKit sample builders for nights, days and workouts (mezo-r36n9)`.

### Task S2-5: iOS — calendar snapshot builder + real readers + entitlements

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/Calendar/{CalendarReader,CalendarSnapshotBuilder}.swift`, `ios/BoopKit/Sources/BoopCore/Health/HealthKitReader.swift`, `ios/BoopKit/Sources/BoopCore/Calendar/CalendarKitReader.swift`, `ios/Boop/Boop.entitlements`
- Modify: `ios/Boop.xcodeproj/project.pbxproj` (`CODE_SIGN_ENTITLEMENTS = Boop/Boop.entitlements`, `INFOPLIST_KEY_NSHealthShareUsageDescription`, `INFOPLIST_KEY_NSCalendarsFullAccessUsageDescription`)
- Test: `ios/BoopKit/Tests/BoopCoreTests/CalendarSnapshotTests.swift`

**Interfaces — Produces:**
- `struct CalendarItem: Sendable { title: String; start, end: Date; allDay: Bool; calendar: String }`, `protocol CalendarReader: Sendable { func access() async -> CalendarAccess; func items(from: Date, to: Date) async throws -> [CalendarItem] }`, `enum CalendarAccess { granted, denied, notDetermined }` + `func requestAccess() async -> CalendarAccess`.
- `func buildCalendarDays(_ items: [CalendarItem], today: Date, calendar: Calendar) -> [Components.Schemas.CalendarDayIn]` — exactly two days (today, tomorrow), each with the events that overlap that local day (an event spanning midnight appears on both days with its real start/end); titles trimmed to 200; days without events are still sent with `events: []` (clears stale rows).
- `HealthKitReader: HealthReader` (HKHealthStore; read types: sleepAnalysis, stepCount, activeEnergyBurned, heartRate, restingHeartRate, workoutType; `HKStatisticsCollectionQuery` per local day, `.cumulativeSum` for steps/energy, `.discreteAverage/.discreteMin/.discreteMax` for heart rate) with `func requestAuthorization() async throws`.
- `CalendarKitReader: CalendarReader` (`EKEventStore.requestFullAccessToEvents`, all calendars).
- Copy (Info.plist): Health — "A Boop az alvásodból, a mozgásodból és a pulzusodból mondja meg, milyen napod lesz."; Calendar — "A Boop a naptáradból látja, mennyi időd marad edzésre és evésre."

- [ ] **Step 1:** Write `CalendarSnapshotTests`: `alwaysTwoDays`, `eventAcrossMidnightAppearsOnBothDays`, `emptyDayIsSentEmpty`, `longTitleIsTrimmed`.
- [ ] **Step 2:** Run → fail. **Step 3:** Implement builders, the two real readers, entitlements and plist keys. **Step 4:** Run → pass; build the app for a device destination with the team from `~/.config/boop/team` → signs with HealthKit (free team allows it; S1 probe proved it).
- [ ] **Step 5:** Commit `feat(ios): calendar snapshot builder, HealthKit and EventKit readers (mezo-r36n9)`.

### Task S2-6: iOS — `HealthSync`: backfill, incremental, batching, progress

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/Health/HealthSync.swift`
- Test: `ios/BoopKit/Tests/BoopCoreTests/HealthSyncTests.swift` (fake `HealthReader`, `CalendarReader`, `StubTransport`)

**Interfaces — Produces:**
- `@MainActor @Observable final class HealthSync { enum Phase: Equatable { idle, running(progress: Double), done(Summary), failed(SyncError) }; struct Summary: Equatable { nights, days, workouts, events: Int }; init(client: Client, health: HealthReader, calendar: CalendarReader, store: UserDefaults, userId: UUID, now: () -> Date = Date.init, cal: Calendar = .current); func syncAll() async; func syncCalendar() async }`.
- `enum SyncError: Equatable { offline, server, unauthorized }`.
- Window: no saved mark → **60 days** back from today's start; with a mark (`boop.health.syncedThrough.<userId>`, a `yyyy-MM-dd`) → from mark minus **2 days** (overlap so late Health writes land). The mark is saved **after each successful batch** to the last fully sent day (Review Focus 5).
- Batches: nights 30, days 60, workouts 100; order nights → days → workouts → calendar; progress = sent batches / total batches.
- Calendar: `syncCalendar()` sends `buildCalendarDays` when access is `granted`; `denied` → skipped silently, health sync continues (Review Focus 4).
- Errors map like `Session` (network → `.offline`, 401 → `.unauthorized`, else `.server`).

- [ ] **Step 1:** Write `HealthSyncTests`:
  - `firstRunReadsSixtyDays` — fake reader records `from` = today − 60 days.
  - `laterRunOverlapsTwoDays` — mark `2026-11-08` → `from` = 2026-11-06.
  - `batchesAndProgress` — 61 nights → 3 sleep requests (30,30,1); progress reaches 1.0; `done(Summary(nights: 61, …))`.
  - `interruptedBackfillResumesFromMark` — second batch fails offline → phase `failed(.offline)`, mark = last day of batch 1; next `syncAll` reads from mark − 2 days (Review Focus 5).
  - `rerunSendsSameIdsAgain` — two runs over the same fake data send identical `externalId`s (idempotence is the server's; the client must not invent new ids) (Review Focus 1).
  - `calendarDeniedStillSyncsHealth` — `denied` → no `replaceCalendarDays` call, health requests sent, `done` (Review Focus 4).
  - `unauthorizedStops` — 401 on nights → `failed(.unauthorized)`, no further calls.
- [ ] **Step 2:** Run → fail. **Step 3:** Implement. **Step 4:** Run → pass.
- [ ] **Step 5:** Commit `feat(ios): health and calendar sync with 60-day backfill (mezo-r36n9)`.

### Task S2-7: iOS — connect flow, Nap card, sync on open

**Files:**
- Create: `ios/Boop/Connect/{ConnectFlow,PermissionsStep,BackfillStep,ConnectCard}.swift`
- Modify: `ios/Boop/Onboarding/OnboardingFlow.swift` (after weight: `ConnectFlow` before the hello), `ios/Boop/Shell/NapEmptyView.swift` (card), `ios/Boop/BoopApp.swift` (scene `.active` → `syncAll()` when connected, debounced 10 min; `EKEventStoreChanged` → `syncCalendar()`)
- Test: `ios/BoopTests/ConnectCopyTests.swift`

**Screens (Lágy, copy exact):**
- **PermissionsStep** — `LagyFlowFrame`, photo `reggelfeny.jpg`, crumb "Első lépések › Összekötés", eyebrow "Egészség és naptár", title "Kössük össze", sub "Ebből tudom, milyen napod lesz."; two `PhotoRow`s with glyphs: "Apple Egészség" (heart-berry, chip "alvás, mozgás, pulzus"), "Naptár" (clock-sky, chip "ma és holnap"); `WidePill` "Engedélyezem" → Health authorization then calendar access; soft link "Most kihagyom".
- **BackfillStep** — title "Behúzom az elmúlt 60 napot", `BoopFigure(size: 160, level: progress)` filling with the progress, a line "Éjszakák · napok · edzések" with live counts, on `done`: Boop card "Megvan: *58 éjszaka*, 60 nap mozgás és 21 edzés." + `WidePill` "Tovább".
- **No data** (summary all zero after a granted request): peach card "Nem látok adatot az Egészségből. Nézd meg: Egészség app › Megosztás › Appok › Boop, és kapcsold be." + "Újra" (Review Focus 4). **Calendar denied**: chip under the Naptár row "nincs engedély · Beállítások › Boop › Naptárak".
- **ConnectCard on Nap** (replaces the "Egészség és naptár bekötése" row): not connected → `PhotoRow` "Kössük össze az Egészséget és a naptárat" → opens `ConnectFlow` as a full-screen cover; connected → `PhotoRow` "Beérkezett adatok" with chips from the last `Summary` and "frissítve HH:mm".
- Connected state = `UserDefaults` `boop.health.connected.<userId>` set when the permission step finishes.

- [ ] **Step 1:** Write `ConnectCopyTests` for the summary sentence builder `func summaryLine(_ s: HealthSync.Summary) -> (String, String, String)` → `("Megvan: ", "58 éjszaka", ", 60 nap mozgás és 21 edzés.")`, and the zero case → `nil` (shows the no-data card).
- [ ] **Step 2:** Run app tests → fail. **Step 3:** Implement the flow, the card, the foreground sync. **Step 4:** Run → pass; simulator check with the DEBUG `-preview shell` switch: card, permission page, backfill page (the simulator has no Health data → the no-data card must show).
- [ ] **Step 5:** Commit `feat(ios): connect Health and calendar — permissions, backfill progress, Nap card (mezo-r36n9)`.

### Task S2-8: Gates, review, merge, deploy, live check, docs

- [ ] **Step 1:** Backend: `./mvnw test -Dtest='Wearable*IT,SleepLog*IT,BiometricsContractIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true` green; iOS package + app tests green; `sync-openapi.sh --check` 0; web `pnpm tsc --noEmit` passes.
- [ ] **Step 2:** `node scripts/gen-codemap.mjs`, `node scripts/lint-docs.mjs` 0/0; docs: `docs/features/boop-ios.md` (S2 sections), `docs/features/_platform-api-backend.md` stays true, a new `wearable` paragraph in `boop-ios.md` §4 (endpoints, tables, event rule), feature index row status "S2 adatok", roadmap row + milestone entry.
- [ ] **Step 3:** Final whole-branch review (fresh reviewer, most capable model) with this plan's Review Focus; fix Critical/Important with RED→GREEN tests.
- [ ] **Step 4:** Merge per AGENTS.md, push; `deploy` workflow green for the merge commit; backend version live (`GET /api/actuator/info` or the deployed tag).
- [ ] **Step 5:** With the owner: `install-on-phone.sh`; Nap → "Kössük össze" → allow → backfill finishes. Verify read-only in production for his Boop account: `sleep_log` rows with `source = 'apple_health'` ≈ number of nights shown, `daily_metric` ≈ 60 rows, `wearable_workout` count = shown, `calendar_event` rows for today; re-open the app → counts unchanged (Review Focus 1).
- [ ] **Step 6:** Hungarian report walking the *Kész, ha…* list.

---

## Kész, ha… (S2 done-checklist; goes into the S2 bd issue's acceptance)

**What the owner sees**
- [ ] Nap shows "Kössük össze…"; the permission page asks once for Health and calendar in Hungarian; the backfill page fills Boop's orb with the progress and ends with the real counts.
- [ ] Refusing Health or calendar, or having no Health data, shows a Hungarian sentence with where to fix it; the other source still syncs.
- [ ] After connecting, Nap shows "Beérkezett adatok" with the counts and the last refresh time; opening the app later refreshes it.

**Data**
- [ ] Production holds his last 60 days: one `sleep_log` row per night (`apple_health`, stages + hypnogram), `daily_metric` per day, his workouts, today's + tomorrow's calendar; re-opening does not duplicate anything.
- [ ] The backfill caused at most one Boop sleep message.
- [ ] The web app's manual sleep logging still works (existing ITs green).

**Gates** — backend focused ITs + `ArchitectureTest`, iOS tests, web type check, codemap, lint-docs, review fixes, no team id committed.

**Docs** — `boop-ios.md` updated, feature index + roadmap rows true, milestone entry.

**Shipped** — merged, `ci` and `deploy` green, new backend live, installed on his phone, production rows checked.
