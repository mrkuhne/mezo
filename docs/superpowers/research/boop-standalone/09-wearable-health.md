# 09 — Wearable / Apple Health / watch integration (mapper report)

Issue `mezo-r36n9.9`, area: wearable ingestion today and future. Date 2026-11-10. Research only.

## TL;DR

1. Today Boop reads **6 HealthKit types** only: sleepAnalysis, stepCount, activeEnergyBurned, heartRate, restingHeartRate, workouts. **No HRV, respiratory rate, wrist temperature, SpO2, VO2max, HR recovery, mindful minutes or State of Mind.** Read-only, nothing is written back (`HealthKitReader.swift:13-16`, `requestAuthorization(toShare: [])`).
2. The pipeline is **foreground-pull**: `scenePhase == .active` → `syncIfStale` (10 min debounce) → re-read a window (60 days first run, then last mark − 2 days) → idempotent upserts. **No HKObserverQuery, no `enableBackgroundDelivery`, no BGTaskScheduler, no HKAnchoredObjectQuery** (spec §4.4 promised anchored queries; code does a statistics re-read instead — drift).
3. Backend side is small and clean: `wearable` feature = 4 endpoints (`POST /api/wearable/sleep-nights|daily-metrics|workouts`, `PUT calendar-days`), 3 new tables (`daily_metric`, `wearable_workout`, `calendar_event`) + `sleep_log` widened with `source='apple_health'` + `external_id`. Only consumer: `BoopDayAssembler` (morning brief) — the **web app and the check-in never read wearable data**.
4. Daily metric is a **thin row**: steps, resting/avg/min/max HR, active kcal. Workouts: type/start/end/kcal/avgHr/source — **no HR series, no zones, no distance, no route**; production: all 16 workouts are Huawei "strength", **avg_hr is NULL on every one**.
5. Production shape: `daily_metric` 61 rows (steps 61/61, active kcal 61/61, **resting HR 26/61, avg HR 32/61**), `sleep_log` apple_health 35 nights (all with stages + hypnogram + in-bed), 19 legacy Sleep Cycle screenshot nights (Aug 24–Oct 6), 5 manual. The Huawei→Health HR feed is **patchy**.
6. Sleep Cycle → Apple Health works well for stages (probe 2026-11-09: REM/core/deep/awake/in-bed); Huawei Health writes steps, HR, resting HR, active energy, workouts (and weight) but **no HRV and (per the probe) no sleep**; stages from Huawei are not available at all.
7. Item 11 (check-in ↔ biomarker snapshot) is **missing**: `check_in` has no wearable columns; nothing snapshots HR/HRV at check-in time.
8. A real Apple Watch app (live workout session, HR zones, haptics) is a **new target + new data path** (HKWorkoutSession, WatchConnectivity/mirroring); it is the only way to get *real-time* HR in a guided workout (core 4) and works with the Apple Watch's own sensors (HRV, resp rate, wrist temp, SpO2 — all absent today).
9. A smart ring later: Oura/Ultrahuman/RingConn all route through HealthKit on iOS (read via the same `HKHealthStore`); Oura additionally has a cloud API (OAuth, server-side). Plan the schema for **per-metric samples with a source field**, not one wide row per day.
10. Biggest cheap wins: widen read types (HRV SDNN, respiratory rate, wrist temp, SpO2, VO2max, sleeping breathing disturbances) + store `source`; add HKObserverQuery/background delivery (needs paid team to be reliable); persist per-workout HR statistics; add check-in snapshot.

---

## 1. Scope

Covered: `ios/` Health/Calendar sync code and Connect UI, backend `feature/wearable` + `feature/biometrics` (sleep, checkin, weight, profile), the contract `api/feature/wearable/wearable.yml`, Liquibase 1.1.0 wearable scripts, Boop day assembler consumers, web-side imports (Sleep Cycle screenshot), docs (`docs/features/boop-ios.md`, `ios/README.md`, spec `2026-11-09-boop-ios-v1-design.md`), production DB shape (counts only), small web research for Sleep Cycle and Huawei Health behaviour.

Search result for older imports: there is **no** Huawei file import, Health Auto Export, CSV or webhook integration anywhere in the repo. The only non-manual sleep import before Boop S2 is the **Sleep Cycle screenshot → LLM-vision** path (`SleepShotService.java:26-68`, `POST /api/sleep/screenshot`, web `SleepLogSheet.tsx:151-164`). Grep hits for "webhook"/"huawei" elsewhere are unrelated (admin labels, plans, docs).

## 2. What exists

### 2.1 iOS (all in `ios/`)

| Piece | Anchor | What it does |
|---|---|---|
| Entitlement | `ios/Boop.entitlements` | `com.apple.developer.healthkit = true`, `healthkit.access = []`. **No** `healthkit.background-delivery`, no background modes in the project (grep of pbxproj: no `UIBackgroundModes`). `TARGETED_DEVICE_FAMILY = 1` (iPhone only), no watch target. |
| Usage string | `project.pbxproj:164,187` | `NSHealthShareUsageDescription` only (no `NSHealthUpdateUsageDescription`, since nothing is written). |
| Reader protocol | `BoopCore/Health/HealthReader.swift:43-47` | `sleepSamples`, `dayTotals`, `workouts`; value types `SleepSample`, `DayTotals`, `WorkoutSample`. Fake in tests. |
| HealthKit reader | `BoopCore/Health/HealthKitReader.swift:7-112` | read types at `:13-16`; `requestAuthorization` `:19`; sleep via `HKSampleQueryDescriptor` `:23-32` (stages inBed/awake/core/deep/REM/unspecified `:34-44`); day totals via `HKStatisticsCollectionQueryDescriptor` (daily buckets): steps & active kcal `cumulativeSum`, resting HR `discreteAverage`, HR avg/min/max `:46-67`; workouts `:85-97` with kcal from `statistics(for: activeEnergyBurned)` and avgHR from `statistics(for: heartRate)`; activity name mapping `:99-111` (8 types, rest → `other`). |
| Sync engine | `BoopCore/Health/HealthSync.swift:13-172` | `syncAll()` order nights → days → workouts → calendar; **60-day first window** `:143`, afterwards `markDay − 2 days` `:141`; batches 30 nights / 60 days / 100 workouts `:81-91`; mark moves only if something was read `:103`; local `UserDefaults` id sets for the "Beérkezett adatok" counts `:46-55`; calendar is a separate step whose failure never undoes Health `:93-99`. |
| Night builder | `BoopCore/Health/SleepNightBuilder.swift:12-113` | Per-source sessions split at >90 min gaps; 14:00–18:00 wake = nap, dropped; several sessions same wake day → most staged minutes wins; `externalId = hk-night-<wake day>`; builds in-bed/awake/light(core+unspecified)/REM/deep minutes + a ≤200-letter hypnogram (D/R/L/A buckets, 5-min multiples). |
| Mapper | `BoopCore/Health/WorkoutMapper.swift:4-24` | 8 activity types (strength, running, walking, cycling, volleyball, hiit, yoga, other); `externalId = hk-<uuid>`; days with no metric dropped. |
| Link/UX | `Boop/Connect/HealthLink.swift:10-58`, `BackfillStep.swift`, `ConnectFlow.swift`, `PermissionsStep.swift` | One-shot permission request (Health then calendar), `syncIfStale` on foreground with 10 min debounce (`:21,:46`), calendar-change re-send. `RootView.swift:58-61` wires `scenePhase` → sync. Hungarian error copy; unauthorized → sign-out. |
| Calendar | `BoopCore/Calendar/*` (EventKit reader, full access, today + tomorrow snapshot) | Out of this report's core but shares the sync run. |
| Tests | `BoopCoreTests/HealthSyncTests.swift` (13 tests), `HealthBuildersTests.swift`, `CalendarSnapshotTests.swift` | Fake reader; the real `HealthKitReader` is not unit-testable off-device (guarded `#if canImport(HealthKit) && os(iOS)`). |

### 2.2 HealthKit metrics: read now vs. available / would matter

Read **now**: `HKCategoryType(.sleepAnalysis)` (all stage values), `stepCount`, `activeEnergyBurned`, `heartRate` (day avg/min/max), `restingHeartRate`, `HKWorkout` (type, start, end, active kcal, mean HR).

Exists in HealthKit and **not** read (ordered by relevance to the owner's core):

| Metric (HK identifier) | Why it matters | Who writes it |
|---|---|---|
| `heartRateVariabilitySDNN` | Recovery/readiness core signal; core items 6, 7, 11, 12; today brief has "no HRV" (`boop-ios.md` Pulzus sheet) | Apple Watch (nightly + spot); Oura/Ultrahuman/RingConn rings; **not Huawei Health**; not Sleep Cycle |
| `respiratoryRate` | Sleep/illness detection (kímélő trigger), item 6 | Apple Watch (sleep); some rings |
| `appleSleepingWristTemperature` (iOS 16+) / `bodyTemperature` | Illness / cycle / overreaching; item 7/12 | Apple Watch S8+/Ultra; rings (Oura temp deviation) |
| `oxygenSaturation` | Sleep breathing, altitude | Apple Watch S6+; rings |
| `vo2Max` | Long-term fitness for running plans (core 4/5) | Apple Watch outdoor workouts |
| `heartRateRecoveryOneMinute` | Training-recovery metric after workouts | Apple Watch |
| `walkingHeartRateAverage`, `heartRate` series | Baselines, zones | Apple Watch |
| `appleExerciseTime`, `appleStandTime`, `basalEnergyBurned`, `distanceWalkingRunning`, `flightsClimbed` | Total daily energy (basal+active) for the calorie/weight loop (core 3, 12); today only *active* kcal is stored | iPhone/Watch |
| Running metrics: `runningSpeed`, `runningPower`, `runningStrideLength`, `runningGroundContactTime`, `runningVerticalOscillation` (iOS 16+), `HKWorkoutRoute` | Running plans (core 4) | Apple Watch |
| Per-workout `heartRate` samples (time series) + HR zones computed client-side | In-workout guidance / post-workout journaling (core 4) | Watch live workout |
| `workoutEffortScore` / `estimatedWorkoutEffortScore` (iOS 18) | Effort for load management | Apple Watch / apps |
| `sleepingBreathingDisturbances` (iOS 18), sleep apnea events | Sleep quality | Apple Watch |
| `HKCategoryType(.mindfulSession)` | Boop already has a one-minute breathing action (Pulzus lens, `boop-ios.md` §2) — it could **write** mindful minutes (`toShare`) | App-written |
| `HKStateOfMind` (iOS 18, read **and write**) | Natural fit for core 11 (daily feel check-in): Boop could write the check-in to Health and read Apple's own logs | Mindfulness/Health |
| `bodyMass`, `bodyFatPercentage`, `leanBodyMass` | Weight goal (core 3): scale data (Withings etc.) arrives via Health instead of manual entry; Boop could also write weight | scales / apps |
| `dietaryEnergyConsumed`, macros, water | Writing meals back to Health (optional) | apps |
| `environmentalAudioExposure`, `daylight` (iOS 17 `timeInDaylight`) | Light exposure for sleep/mood | iPhone/Watch |
| Cycle tracking, symptoms | Out of scope unless wanted | — |

Notes on how the current queries behave:
- `stepCount`/`activeEnergyBurned` use HealthKit **statistics** collection with `cumulativeSum`, which de-duplicates overlapping sources by the user's source priority (so iPhone + Watch are not double counted) — fine, but **per-source detail is lost** (cannot tell Huawei steps from iPhone).
- `avgHr` is a `discreteAverage` over *samples*, not time-weighted; with patchy Huawei HR it is biased to whenever the watch measured. Production: avg HR present 32/61 days, resting 26/61.
- Resting HR from Huawei is written only on some days (see §4).
- Workout `avgHr`: `w.statistics(for: heartRate)` is only populated when the writer **associates** HR samples to the workout. Huawei apparently does not → **avg_hr is NULL on all 16 production workouts** (own DB check). A fix is an additional range query for HR samples within `[start,end]`.
- Deleted / edited HealthKit samples are not handled (no anchored query, no `HKDeletedObject`); a sample the user deletes later in Health stays in the backend until the 2-day overlap re-upserts the day (days are replaced; **workouts and nights deleted in Health are never removed server-side**).

### 2.3 Backend `feature/wearable`

| Item | Anchor |
|---|---|
| Controller implementing generated `WearableApi` | `wearable/controller/WearableController.java:23-50` |
| Sleep ingest: upsert `sleep_log` by `external_id`; publishes **one** `SleepLogSavedEvent` per call for the newest night if inserted and ≥ yesterday (anti-flood of the companion) | `service/WearableSleepService.java:33-56` |
| Daily metric upsert by (owner,date) | `service/DailyMetricService.java:24-39` |
| Workout upsert by (owner, external_id), `date` = local start day in `mezo.wearable.zone` | `service/WearableWorkoutService.java:25-42` |
| Calendar day replace (hard delete + insert; snapshot not history) | `service/CalendarSnapshotService.java:23-33` |
| Batch caps (400 `WEARABLE_BATCH_TOO_LARGE`) | `service/WearableBatches.java`, `config/WearableProperties.java:15-22` |
| Tables | `db/changelog/1.1.0/script/202611092310_mezo-r36n9.2_wearable_tables.sql` (`daily_metric`: steps, resting_hr, avg_hr, min_hr, max_hr, active_kcal; `wearable_workout`; `calendar_event`), `...202611092300_..._sleep_log_apple_health.sql` (source CHECK `manual|screenshot|apple_health`, `external_id`, partial unique index), `...202611100100_..._wearable_check_naming.sql` |
| Contract | `api/feature/wearable/wearable.yml` (4 operations) |
| Tests | `backend/src/test/.../wearable/WearableContractIT`, `WearableServiceIT`, `WearableSleepServiceIT` |
| **Only reader** | `feature/boop/service/BoopDayAssembler.java:86-131,262` (today's metrics, 7-day resting-HR series, 14-day baseline, workouts, calendar) → `BoopScores.java:43-58` (Pulzus score = resting HR vs baseline), `BoopPrompts.java:82`, `BoopBriefMapper.java:82-84` |

Not in the schema: HRV, respiratory rate, temperature, SpO2, per-sample data, the HealthKit sample source of a night (the `source` name is read, used to choose between apps, then **dropped** — `SleepNightIn` has no source), device identity, timezone of the night.

### 2.4 Backend `feature/biometrics`

- `sleep` (`SleepLogEntity.java:29-98`): date, bedtime/wakeup `HH:mm`, `duration_h`, quality 1–10, awakenings, in-bed/awake/light/REM/deep minutes, `source_quality_pct`, `source`, `external_id`, `hypnogram` jsonb (ADR 0015: display only). Sleep goal + anchor (`SleepGoalService`, `SleepAnchorResolver`, `GoalSleepAdequacyAdapter`), screenshot import (`SleepShotService` + deterministic `SleepShotDraftValidator`), `SleepLogRepository` (incl. `upsertAppleHealthNight`). Regularity/efficiency scores are **FE-pure** (`me.md`, `features/me/logic/sleepStats.ts`) — backend has no consumer.
- `checkin` (`CheckInEntity.java`, `CheckInPlanService`, `AdaptiveItemChooser`): self-report items (pain regions, cravings…). **No wearable fields.** `grep` for resting HR / daily_metric outside `feature/wearable` and `feature/boop` returns nothing — check-in and companion/pattern engine do not use wearable data (companion.md only mentions deep sleep "permanently empty without a wearable").
- `weight` (`WeightLogService`, `WeightTrendService`): manual entries; no HealthKit bodyMass path.
- `profile`: biometric profile (used by training adapters).

### 2.5 Web side

The web app has **no** Apple Health / watch import; it can display `sleep_log` rows with `source:'apple_health'` (written only by Boop). Sleep Cycle enters only through the screenshot sheet (+ validator). No CSV/Huawei/Health Auto Export/webhook receiver exists.

## 3. How it works (end to end)

1. Owner opens Boop → `RootView` `scenePhase .active` → `HealthLink.syncIfStale` (connected, ≥10 min since last) → `HealthSync.syncAll`.
2. Window start = last-success day − 2 (or 60 days back on first run).
3. `HealthKitReader` reads sleep samples from `window start − 18 h`, day statistics, workouts. Nights are assembled on the phone (session split, nap drop, source dedupe, hypnogram). Days and workouts are mapped.
4. Batches go to the four `/api/wearable/*` endpoints with the JWT; backend upserts (nights by `hk-night-<day>`, days by date, workouts by `hk-<uuid>`; calendar days replaced). A new sleep night from today/yesterday raises `SleepLogSavedEvent` for the companion.
5. The mark advances only when ≥1 record was read; `UserDefaults` keeps sums for the "Beérkezett adatok" card.
6. Boop's morning brief (`/api/boop/...`) is built server-side from `sleep_log` + `daily_metric` + `wearable_workout` + `calendar_event` + the training plan + meals (`BoopDayAssembler`).

Source chain: Huawei Watch → Huawei Health iOS app → HealthKit (steps/HR/resting HR/active kcal/workouts) ; Sleep Cycle iPhone app (mic/accelerometer, optionally Apple Watch) → HealthKit sleep analysis with stages; Boop reads HealthKit. Boop never talks to Huawei or Sleep Cycle directly.

## 4. Quality assessment

**Solid**: idempotent upserts keyed on stable ids; server-enforced batch caps; mark-only-on-success; separate calendar failure; night builder handles two apps writing the same night, naps, window edges (unit-tested); one-event anti-flood; PII never in URL; entity ownership from the principal.

**Half-built / gaps / drift**
- Spec §4.4 says "anchored HealthKit query … background refresh"; code is a windowed statistics re-read, foreground only. Background refresh was not built (README: "free team → no background delivery").
- Thin day row (6 numbers) and thin workout row — cannot answer HRV/recovery/respiratory/temperature questions (core 1, 7, 11, 12) and cannot do HR zones or load (core 4).
- No `source` stored per night/day; no way to distinguish Sleep Cycle vs Apple Watch vs Huawei data, or to flag sleep-from-manual vs sensor.
- Workout `avg_hr` always NULL for Huawei workouts (production, 16/16). Workout types in production: only `strength` from `HUAWEI Health: Europe`; last workout date 2026-11-02 (the Huawei workout feed seems to lag or the owner stopped logging).
- Resting HR present 26 of 61 days; avg HR 32 of 61 → the Pulzus score and its 14-day baseline rest on sparse data (`BoopScores.java:43`).
- Deleted samples never removed server-side (nights, workouts).
- `HealthKitReader` has no tests of the real HK queries (device-only); timezone: day buckets use the device `Calendar`, workout `date` uses server zone `mezo.wearable.zone` — a travel/DST mismatch is possible (night `date` is device-local, workout date is server-zone).
- Docs: `me.md:374` still lists `source varchar(10)` / `manual|screenshot` in one place (drift vs the S2 widening to `varchar(16)` + `apple_health`).
- Hungarian-only user strings in the Health flow (fine for Boop v1).

**Production usage (own read-only queries, counts only)**

| Table | Rows | Range | Filled |
|---|---|---|---|
| `daily_metric` | 61 | 2026-09-11 → 2026-11-10 | steps 61, active kcal 61, resting HR 26, avg HR 32 |
| `wearable_workout` | 16 | 2026-09-11 → 2026-11-02 | kcal 16, avg HR 0; 1 activity type, 1 source |
| `calendar_event` | 9 | today + tomorrow | snapshot only |
| `sleep_log` apple_health | 35 | 2026-09-11 → 2026-11-10 | deep 35, hypnogram 35, in-bed 35, quality 0 (no subjective score) |
| `sleep_log` screenshot | 19 | 2026-08-24 → 2026-10-06 | deep 19, hypnogram 3, quality 19 |
| `sleep_log` manual | 5 | 2026-09-13 → 2026-10-11 | quality 5 |

## 5. Reuse for native iOS

- **As-is**: all four wearable endpoints, `sleep_log` apple_health rows, `BoopDayAssembler` inputs. The idempotency design (stable external ids, replace-by-date) is the right shape to keep.
- **Needs a Boop-shaped extension**: richer metrics → either widen `daily_metric` or (better for rings + watch + more types) add a generic **`health_sample`/`metric_day` table** (owner, date, metric code, value, unit, source, device, start/end) and an endpoint `POST /api/wearable/metrics`; per-workout HR summary/zones/distance/route-hash columns on `wearable_workout`; store `source_name` on nights/days; a deletion channel (`DELETE /api/wearable/workouts/{externalId}` or a "present ids in window" reconciliation).
- **Check-in biomarker snapshot (core 11)**: simplest = the phone sends a `biomarkers` object (latest HR, HRV, resting HR, resp. rate, steps so far, last sleep) with `POST` check-in; alternative = server joins `daily_metric` at `created_at`. Today neither exists.
- **Logic only in web**: sleep regularity/efficiency scores (`sleepStats.ts`); the Boop scores are already backend (`BoopScores`), so the iOS app does not need FE logic from this area.

## 6. Gaps vs. the owner's core

| # | Status | Reason |
|---|---|---|
| 1 Collect every metric from Apple Health (+Huawei/Watch) + Sleep Cycle sleep | **Exists, needs widening** | 6 of ~25 relevant types; no HRV/resp/temp/SpO2/VO2max/exercise time/basal energy/distance; no source stored; Huawei HR patchy; no background delivery. Sleep Cycle nights work well (stages + hypnogram + in-bed). |
| 6 Full sleep tracking with calculations + day recommendations | **Exists, partially** | Nights with stages/hypnogram land; Pulzus/Alvás scores + brief are server-side (S3). Missing: sleep quality score from Sleep Cycle (not in HealthKit — `quality` is NULL for all apple_health rows; Sleep Cycle's own "quality %" is only in the screenshot path), respiratory rate/HRV overnight, sleep-debt/regularity on the backend, restfulness/latency fields. Decide whether to keep the **screenshot import** as a fallback to get Sleep Cycle quality% (candidate to drop if the owner accepts a self-computed score). |
| 11 Check-in + watch biomarker snapshot | **Missing** | No wearable columns on `check_in`; no snapshot; possible new HRV/HR pair read at check-in; could also write `HKStateOfMind`. |
| 7, 12 (biomarker capacity, live adjustment) | **Missing inputs** | Need HRV/resp/temp trends; today only resting HR vs a 14-day baseline. |
| 4 In-workout guided logging | **Missing (watch)** | HR in a live session requires a watch workout session; today workouts are post-hoc and without an HR series. |

## 7. Research notes

### 7.1 Sleep Cycle → Apple Health
- Sleep Cycle's support page "Does Sleep Cycle support the Apple Health app?" says the app writes **sleep analysis and heart rate** to Apple Health and **only reads** steps/heart rate/temperature (support.sleepcycle.com, article ~a year old; sources disagree on REM). Third-party sources (Yahoo Health 2026 review) list light/deep/REM stages; a competitor (RISE) claims no REM — treat as marketing. The owner's own probe of 2026-11-09 (spec §5, `Probe results`) confirms **REM/core/deep/awake/in-bed** reach Health, and production has 35 nights with deep/REM minutes, so stage writing works for him.
- Sleep Cycle writes `HKCategoryTypeIdentifierSleepAnalysis` samples; respiratory rate is **not** documented as written (unconfirmed). Quality% and snore/cough data stay inside the Sleep Cycle app (only reachable via the screenshot path or Sleep Cycle's own export). May lag until a few nights of use before the Health permission prompt (RISE help article).
- Two writers on the same night (Sleep Cycle + Apple Watch sleep tracking) produce duplicate overlapping sessions — the night builder's "most staged minutes wins" rule exists for this; storing the winning `source` would make it auditable.

### 7.2 Huawei Health → Apple Health (iOS)
- Huawei Health's iOS store listing and Sahha's integration page agree it syncs **steps, heart rate, workouts/exercise data, weight** (weight both ways) to HealthKit; Sahha also claims **sleep (duration only)**, but the owner's probe shows **no Huawei sleep** in Health. **No HRV** (confirmed by probe and absent from every source). No respiratory rate/SpO2/temperature found as written.
- Writing **into** Huawei Health is limited (weight, blood pressure, blood glucose) — irrelevant for a read-only Boop.
- Sync is app-driven (Huawei Health must open/sync from the watch over Bluetooth; cloud-backed third-party bridges like Health Sync mention "a few hours" delay) — consistent with the patchy HR days seen in production. Workouts arrive as `HKWorkout` with source `HUAWEI Health: Europe`, **without associated HR samples** (avg_hr NULL).
- Implication: the Huawei watch can never give HRV/respiration/temperature to Boop. A true HRV/readiness story needs an **Apple Watch** (or ring) — the owner's own plan.

### 7.3 Background delivery / observers
- Not implemented (grep: no `HKObserverQuery`, `enableBackgroundDelivery`, `HKAnchoredObjectQuery`, `BGTaskScheduler`). Spec §5: "HealthKit background delivery on a free team is unconfirmed" — design is sync-on-open.
- To add: `enableBackgroundDelivery(for:frequency:)` per type (needs the `com.apple.developer.healthkit.background-delivery` entitlement — a capability checkbox in Xcode that the **free Personal Team may not provision**; Apple lists HealthKit as allowed but the background-delivery sub-capability is unverified), an `HKObserverQuery` registered at launch, an `HKAnchoredObjectQuery` with persisted anchors to fetch only new/deleted samples, and a short background run to POST (the app is woken for ~30 s). HealthKit data is encrypted while the phone is locked: delivery may be deferred until first unlock after a reboot. Best to prototype on a paid team (US$99/yr) since free-team profiles also expire weekly (spec §3), which kills any background pipeline after 7 days without reinstall.
- Alternative without background delivery: server-side nothing can pull HealthKit (it is on-device only). A BGAppRefreshTask opportunistic refresh is allowed on free teams, but iOS schedules it unreliably.

### 7.4 Real Apple Watch companion (watchOS)
Requires:
1. A **watchOS app target** in `Boop.xcodeproj` (watchOS 11/12 SwiftUI, companion to the iOS app, shared `BoopKit` packages; `TARGETED_DEVICE_FAMILY` adds Watch). Free-team provisioning can install watch apps via Xcode but with the same 7-day expiry and App ID limits (10/7 days, 3 apps per device — a watch app is another App ID).
2. HealthKit on the watch: `HKWorkoutSession` + `HKLiveWorkoutBuilder` (live HR, active energy, distance, zones computed by Boop), workout-processing background mode, `NSHealthShareUsageDescription` + `NSHealthUpdateUsageDescription` (the app now **writes** workouts/effort to Health), HK authorisation on the watch.
3. Link to the phone: **WatchConnectivity** (`WCSession` — transferUserInfo for a finished session, sendMessage for live) or iOS 17+ **workout mirroring** (`startMirroringToCompanionDevice`) so the iPhone sees the live HR stream.
4. Data model: planned session (mesocycle exercise/sets) pushed phone → watch; per-set confirmation, rest timers, HR zones live; post-session sync of the structured log + HR series to the backend (needs the §5 workout extension: HR series/zones, per-set data).
5. Optional: complications/Smart Stack (WidgetKit — needs an **App Group**, allowed on free teams), haptics for zones/rest timer, the Boop orb as a watch face, standalone use without the phone, `HKStateOfMind` check-in on the wrist.
6. Apple Watch would also supply the missing metrics (HRV SDNN, respiratory rate while asleep, wrist temperature, SpO2, VO2max, HR recovery) and its own sleep stages — meaning Sleep Cycle could become a second source rather than the only one (decide source-priority rules).
Risks: significant effort (new target, simulator limits for HR/live session — need a real watch), App Store-free distribution constraints, battery/CPU of live workouts, a watch means two writers (Apple Watch + Huawei) for steps/HR (statistics queries de-dupe by source priority — owner sets that in Health).

### 7.5 Smart ring later (Oura / Ultrahuman / RingConn)
- **Via HealthKit** (iOS-only, recommended): all three have iOS apps that can write to Apple Health. From memory (unverified for each vendor's current build — confirm with a probe like the 2026-11-09 one): Oura writes sleep analysis (with stages), heart rate, HRV, respiratory rate, wrist/body temperature, steps, workouts; Ultrahuman and RingConn write sleep, HR, HRV, SpO2, steps. No code change except reading the extra types and handling a **third source** (source-priority and de-dup rules; today the night builder dedupes per source by staged minutes).
- **Via vendor API**: Oura has a REST API v2 (OAuth2; sleep, readiness, HRV, temperature deviation, webhooks) that a **server** (not the app) can pull — needs an OAuth connect screen, tokens in the backend, and a poller; richer than HealthKit (readiness/sleep scores, contributors). Ultrahuman and RingConn have little or no public API. Treat HealthKit as the ring path, Oura API as an optional enrichment.
- Schema need: per-metric samples with `source`/`device`, since ring HRV (nightly average) and Watch HRV (many spot readings) differ and need distinct baselines.

## 8. Open questions / risks for the re-plan

1. **Paid Apple Developer Program?** Free team = 7-day reinstall, no reliable background delivery, no push, watch-app friction. A standalone Boop with Watch + background sync + (later) Live Activities realistically needs the paid team. Biggest owner decision for this area.
2. Which source wins when several write the same metric (Huawei vs Apple Watch vs ring vs Sleep Cycle)? Decide before widening (store `source` now).
3. Keep or drop the Sleep Cycle **screenshot** import? Its unique value is Sleep Cycle's quality% and snore/cough; Health stages already come through HealthKit. If sleep score is self-computed, the screenshot path (LLM vision + validator + web sheet) is a drop candidate.
4. Is the Huawei watch kept after the Apple Watch arrives (two wrist devices)? If not, Huawei-specific gaps (no HRV, patchy HR, no workout HR) disappear on their own — avoid investing in Huawei-specific fixes (e.g., workout HR range queries are still useful for any source).
5. Data model: wide `daily_metric` columns vs generic metric samples. Generic is better for HRV/temperature/ring baselines and the AI "see all data" (core 8); cost: new aggregation queries and a baseline service.
6. Deletion/edit reconciliation (anchored queries with deleted objects) — needed once HR-zone/workout data drives AI advice.
7. Privacy: sleep/HR/calendar titles go to the LLM (accepted for owner's own data) — more biomarkers widen that surface; keep payloads minimal.
8. Live-workout latency and watch simulator limits mean any watch work must be verified on hardware; plan owner time for that.
9. Check-in snapshot needs a decision: phone-side snapshot (most accurate, offline-safe) vs server-side join (simpler, depends on sync recency, e.g. last foreground sync ≤ 10 min stale).
10. Doc drift to clean in the re-plan: spec §4.4 (anchored query claimed), `me.md:374` source column description.
