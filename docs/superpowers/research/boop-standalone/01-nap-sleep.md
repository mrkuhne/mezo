# 01 — Day page (Nap / Mai) and sleep: code map

Issue `mezo-r36n9.9`, mapper 01. Date 2026-11-10. Research only.

## TL;DR

1. **There is no Sleep Cycle import.** Sleep Cycle reaches Mezo two ways: (a) a screenshot OCR draft (`POST /api/sleep/screenshot`, web only, user confirms), (b) indirectly through Apple Health sleep samples that Boop reads (the app never records the source name, it keeps "the session with most staged minutes"). Sleep Cycle's own *quality %* never arrives via HealthKit.
2. Prod shape: the **Boop account** has 35 `apple_health` nights (2026-09-11 → today), all with stages + hypnogram + bedtime, **0 with quality**. The old **web account** has 19 screenshot + 5 manual nights (to 2026-10-06 / 10-11). Two separate accounts, so no history is shared with Boop yet.
3. Because Apple Health rows carry no `quality`, Boop's *Alvás* score is **duration-ratio only** (the 0.3 quality term is dead for every Boop night); a high-quality short night and a bad long one read the same.
4. **Sleep calculations that exist:** sleep goal (target + WAKE/BED anchor → derived bed/wake), sleep debt flag (companion rule), regularity ±15 min, efficiency, phase %/reference bands, REM-by-duration, deep front-load, 14-day escalation card, personal sleep-need detector, sleep→performance chain detector, diagnosis recipe, wind-down phases. **No chronotype anywhere** (grep: zero hits). **No "bedtime recommendation" engine** beyond the user-set anchor (bed = wake − target).
5. **Most sleep analytics live only in the web frontend** (regularity, efficiency, phases, escalation, wind-down, education deck: ~10 pure TS files in `features/me/logic`). Backend has the deficit and the rule/detector family; Boop's backend (`feature/boop`) reuses *none* of it except the sleep log, goal and the Alvás formula (duplicated).
6. **Boop S3's Forma/energy curve are bespoke, simple models** (`BoopScores`, `EnergyCurveModel`): Forma = 0.45·Alvás + 0.35·Pulzus + 0.20·load; curve = fixed daytime template × forma scale ± meal/session nudges. Not personalised, no sleep debt, no calendar load, no HRV. The web has *no* equivalent "Forma"; its readiness is a check-in-threshold rule for training only.
7. **Wearable tables (`daily_metric`, `wearable_workout`, `calendar_event`) are read by exactly one class: `BoopDayAssembler`.** The AI chat, companion context, day evaluation, flags, detectors never see HR, steps, Watch workouts or the calendar. This is the biggest gap for core items 7, 8, 11, 12.
8. HealthKit read set is thin: sleep, steps, active energy, HR, resting HR, workouts. **No HRV, SpO2, respiratory rate, wrist temperature, sleeping HR, VO2max, weight/body composition, mindful minutes.** Today's "Pulzus" is resting-HR-vs-14-day-baseline only.
9. The web Nap domain (Mai, A napom, Rutin, Életjelek, Check-in, Napzárás ritual) is **large and mostly orthogonal to sleep**; the only sleep couplings are the "Pihenés" need, the Alvás vial, anchors for routine/ritual/notifications, and the morning `rested` check-in item. Medication is **not** on the day page and the owner tracks none (prod: 0 active).
10. Boop's Mai is a clean re-expression of the day (five orbs, curve, observations, session move); it is a good base but its brain is a thin rules layer + one cheap-tier LLM call for wording; nothing re-examines the day live (core 12) and nothing links check-ins to watch snapshots (core 11).

---

## 1. Scope

Covered: web Nap domain (`frontend/src/features/today`, `frontend/src/data/today`, docs `today.md`, `ritual.md`, `needs.md`, `habit.md` as they feed the day); every sleep entity/calculation across backend and web; readiness/energy computations; the `biometrics` backend feature (sleep, check-in, profile, weight); `medication`; `wearable` ingest; Boop S3 (`feature/boop`, `ios/Boop/Nap`, `ios/BoopKit/.../Morning`, `Health`). Entry points: `docs/CODEMAP.md` (biometrics §200, boop §243, today §1513, wearable §1725), `docs/features/boop-ios.md`, `today.md`. Prod DB read for shape only (no values copied).

Not covered in depth (other mappers): the AI chat/companion, goal engine/diet, train, fuel logging, insights/character detectors beyond their sleep inputs, check-in 2.0 internals.

## 2. What exists

### 2.1 Backend — sleep (`backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep`)

| Thing | Anchor | Notes |
|---|---|---|
| `sleep_log` table / `SleepLogEntity` | `entity/SleepLogEntity.java:1-98` | `date` = **wake morning**; `bedtime`/`wakeup` HH:mm strings; `duration_h` (asleep hours, 2 dp); `quality` 1–10; `awakenings`; stage minutes `in_bed/awake/light/rem/deep_min`; `source_quality_pct` (tracker %), `source` ∈ manual\|screenshot\|apple_health, `external_id` (Apple Health key, unique per owner), `hypnogram` jsonb `{bucketMin, stages [DLRA]+}` |
| Manual/screenshot log | `service/SleepLogService.java:log` → `POST /api/biometrics/sleep` (`api/feature/sleep/sleep.yml`) | Always inserts (no upsert by date); publishes `SleepLogSavedEvent` (→ companion message listener) |
| Sleep goal | `entity/SleepGoalEntity.java`, `service/SleepGoalService.java`, `GET/PUT /api/sleep/goal` | Target minutes + anchor WAKE\|BED + anchor time + regularity band (default 15). **Config-ghost when unset** (`isSet=false`); prod has 1 goal row |
| Anchor resolver | `service/SleepAnchorResolver.java` (`SleepAnchorPort`, `SleepTargetPort`) | The single bed/wake derivation; ungated; used by habit targets, notifications, Boop (`bedtimeTarget`) |
| Anchor shift | `SleepGoalService.shiftAnchor`, `proactive/service/SleepAnchorShiftAdapter.java` | AI/rule advice card "shift anchor ±120 min" (needs a real goal row) |
| Screenshot extraction | `service/SleepShotService.java:32-60` | ONE multimodal LLM call over a **Sleep Cycle** screenshot → draft (bedtime, wake, asleep, in-bed, stages, quality %, hypnogram letters per 15 min). `SleepShotDraftValidator` scores confidence deterministically (span/phase-sum/hypnogram cross-checks); nothing persisted until confirmed; gated `mezo.feature.sleep-shot`; LLM port `SleepShotLlm` ← `companion/llm/SleepShotLlmAdapter` |
| Goal adequacy | `service/GoalSleepAdequacyAdapter.java` | Sleep-debt boolean for the goal engine's adaptive review (deficit ≥ threshold over N nights, long nights don't repay) |
| Apple Health ingest | `wearable/service/WearableSleepService.java` | `POST /api/wearable/sleep-nights` ≤100 nights, native `ON CONFLICT (created_by, external_id)` upsert, source `apple_health`; one `SleepLogSavedEvent` only for the newest night, only if new and ≤1 day old |
| Repos | `repository/SleepLogRepository.java` | window finders; `findExistingExternalIds` spans soft-deleted |

Liquibase: `202611092300_mezo-r36n9.2_sleep_log_apple_health.sql` (external_id + source check). `sleep_goal` created earlier.

### 2.2 Backend — sleep consumers elsewhere

- **Sleep debt flag**: `companion/flags/service/rule/SleepDebtRule.java`, `SleepDeficitCalculator.java` (cumulative deficit = Σ max(0, goal − hours) over N wake-mornings, unlogged nights skipped, `unavailable` below min nights). Also used by `LoggingGapRule` ("gap + suspicion"). Config `FlagProperties.sleepDebt` (nights, minNights, deficitHours, defaultGoalHours). **This is the only "sleep debt" in the system; Boop does not show it.**
- **Metric series**: `companion/service/MetricKey.java` has SLEEP_QUALITY, SLEEP_DURATION_H, BEDTIME_HOUR, WAKEUP_HOUR, SLEEP_AWAKENINGS, BEDTIME_VARIABILITY (derived), CHECKIN_RESTED; `MetricSeriesService` serves them to detectors/diagnoses/week views.
- **Detectors** (character/insights): `SleepNeedDetector` (personal sleep need from morning `rested` vs duration, 30-min buckets, plateau, proposes goal change but never writes), `SleepPerformanceChainDetector` (poor night then gym/run/sport decline same day, ≥2 pairs in 14 d), plus sleep inputs in `LateEatingPatternDetector`, `CravingTriggerDetector`, `WeekendGapDetector`, `SelfCalibrationDetector`.
- **Diagnosis**: `proactive/service/DiagnosisRecipe.SLEEP` (sleep-as-outcome with suspects) + `FatigueEvidenceCollector`; `SetupCheckService` (missing sleep goal card).
- **Day evaluation**: `companion/service/DayEvaluationEngine.sleepDim` (6-dimension day score, sleep weight .15: 0.7·min(1, h/target) + 0.3·(q−1)/9; finalises as soon as logged), `DayScoreService`, `DayReviewService` (+ nightly `DayReviewWarmupJob`, cron `mezo.companion.day-review-warmup.cron`).
- **AI chat tools**: `companion/tools/BiometricsTools.java` `get_recovery(scope=sleep|sleep-goal|checkins)`; `ContextSnapshotAssembler` carries last night.
- **Habit/notification**: `HabitTargets`/`HabitEvaluator` (sleep_wake_window, bedtime_next_day), `notification/service/AnchorResolver` (wake/bed anchors drive evening/morning pushes), `ritual` is bed-anchored.
- Hypnogram is **display-only** by decision (`docs/decisions/0015-hypnogram-display-only.md`).

### 2.3 Backend — rest of `biometrics` and `medication`

- `check_in` (`checkin/entity/CheckInEntity.java`): per day + slot (4 slots), 1–10 items energy, stress, body, mental, mood, rested, soreness, motivation, hunger, craving(+kinds), digestion, connection, dayRating, pain (+regions, intensity), note, `adaptiveItem/Reason`, `quickExit`, `savedAt`. `CheckInPlanService` builds the per-slot question plan (core + time-of-day + adaptive + "question of the day"); `GET/POST /api/biometrics/checkin`, `GET …/checkin/plan`. **No watch/biometric snapshot is stored on a check-in** (core 11 missing).
- `biometric_profile` (`profile/…`, `GET/PUT /api/biometrics/profile`): sex/height/birth/activity etc. `weight_log` + `WeightTrendService` (`GET/POST /api/biometrics/weight`, `/trend`).
- `medication` + `medication_dose` + derived cycle (`MedicationCycleService`): generic dose-cycle domain; **prod has 0 active medications**; it surfaces only in Fuel (Kiegészítők tab) and as a scenario switch input to `useTodayScenario`. Not part of the day page or Boop.

### 2.4 Backend — wearable (`feature/wearable`, Boop S2)

`POST /api/wearable/{sleep-nights,daily-metrics,workouts}`, `PUT /api/wearable/calendar-days` (`api/feature/wearable/wearable.yml`). Tables: `daily_metric` (date, steps, resting/avg/min/max HR, active kcal), `wearable_workout` (external_id, type, start/end, kcal, avgHr, sourceName), `calendar_event` (title, start/end, allDay, calendarName; each sent day wiped and replaced; **only today + tomorrow**, so no calendar history exists). Prod: `daily_metric` 61 rows (steps 61, resting HR only 26), `calendar_event` 9 rows. **Consumed by `BoopDayAssembler` only** (grep over `backend/src/main`).

### 2.5 Backend — Boop brief (`feature/boop`)

`GET /api/boop/brief?date=`, `POST /api/boop/brief/regenerate` (≤3/day, 409), `PUT/DELETE /api/boop/session-time` (`api/feature/boop/boop.yml`, `controller/BoopController.java`).

- `BoopDayAssembler.java:82-142` assembles read-only `BoopDay`: last night, 60-night window, 7-day deep-sleep and resting-HR series, 14-day baselines, wearable day, planned session (override time else gym schedule), yesterday's wearable workout minutes, meals+targets, check-in plan/answers, intention, ≤3 proposed patterns (observations), calendar → 72 busy slots, sleep-goal bed target, recovery period, weight. Same-date duplicate nights collapse by map-merge (`BoopDayAssembler.java:113`) — arbitrary winner (see §4).
- `BoopScores.java` — Alvás (mirrors `DayEvaluationEngine.sleepDim`, duplicated), Pulzus `70 + (baselineRHR − RHR)·6`, Mozgás steps/9000, Fuel kcal vs time-share 07–21 (null before ~07:42), **Forma** `0.45·alvás + 0.35·pulzus(neutral 70 if missing) + 0.20·(100 − min(60, yesterdayWorkoutMin/2))`, null until 14 nights; state good ≥70 / okay 50–69 / tired <50 / learning.
- `EnergyCurveModel.java` — 19 hourly values 06→24: interpolated template (peak 10–11 h 0.82, post-lunch dip 14–15 h 0.38, evening 0.66→0.20) × `0.6 + 0.4·forma/100`; late lunch −0.05; session +0.06 then −0.08 ×2 h. `dipHour` = lowest between 12–18. A model, not a measurement.
- `RuleVerdicts.java` — deterministic fallbacks for every sentence, session↔meeting **conflict rule** (meeting ends <45 min before session → suggest end+60 rounded), tonight/next-meal tips.
- `BoopVerdictWriter.java` + `BoopPrompts.java` — one cheap-tier LLM call (`boop_brief/verdicts`, 8 s timeout, per-field fallback to rules), Hungarian headline/sentence per orb + spoken brief with links `sleep|heart|day` + tonight/next-meal tip; prompt carries calendar as counts/spans only, never titles. The LLM never scores.
- `BoopBriefService/Store` — one `boop_brief` row per user+local day, input-hash cache (`v2|`: night, calendar, meals, weight, session, recovery, observations ids, check-in done flags, intention, time-of-day bucket), 3 regens/day, race-safe. Prod: 1 brief row so far.
- Tests: 7 IT + 6 unit (CODEMAP §243), value-pinning `BoopScoresTest`, `EnergyCurveModelTest`; ArchUnit enforces boop as a leaf.

### 2.6 Web frontend — sleep (`frontend/src/features/me`)

Pages: `SleepPage.tsx` (`/me/sleep`, 315 lines: hero, regularity ring, efficiency ring, escalation card, stat card, phase rail + reference rows, night arc, phase averages, 14d/period trend chart, REM-by-duration, last-7-nights log), `NightPage.tsx` (`/me/sleep/night`, chrome-free: night tools breathing / body scan / walk, wake-trace). Sheets: `SleepLogSheet` (manual + screenshot confirm flow), `SleepGoalSheet`, `SleepStatsSheet`. Pure logic (all FE-only):

- `logic/sleepStats.ts` — `regularityScore` (share of last 14 nights with bed AND wake within ±band of goal), `efficiencyPct` (asleep/in-bed, 85 % target), `bedDeltaMin`.
- `logic/sleepPhases.ts` — `phaseBreakdown`, deep/REM share vs adult reference (13–23 %, 20–25 %), `averageBreakdown` (min 3 nights), `parseHypnogram`, `halfNightSplit`, `deepFrontLoadPct`, `remByDuration` (short vs ≥7 h nights).
- `logic/sleepEscalation.ts` — 14-day avg <6 h or avg quality ≤4 (min 5 samples) → escalation card + 14-day snooze in localStorage; `sleepEducation.ts` stat deck + CBT copy.
- `today/logic/windDown.ts` — wind-down phases off bed anchor: dim bed−90, winddown bed−60, night, morning −30; drives the dark-theme window and "minutes to bed".
- `logic/nightTrace.ts`, `nightFlow.ts`, `nightContent.ts` — middle-of-night wake trace and tool flow.
Hooks: `useSleep`, `useSleepGoal`, `useSleepShot` (`data/me/sleepHooks.ts`, `sleepGoal.ts`, `sleepShot.ts`). Tests exist next to each logic file and component.

### 2.7 Web frontend — Nap domain (`frontend/src/features/today`, `data/today`)

Routes (`today.md` §1): `/nap` **Mai** (`NapHubPage`: tank = mean of six életjel, four vials Kalória/Fehérje/Alvás/Mozgás, "Most következik" stream, one grounded observation, day log, "Továbbiak"), `/nap/napom[/:date]` **A napom** (live day reading + closed-day full review), `/nap/uzenetek` (companion thread: Üzenetek/Életjelek/Észrevételek), `/nap/rutin` (habit chains + builder), `/nap/kuldetesek` (quests), `/nap/checkin` (4 slots), `/nap/eletjel` (six needs), `/nap/gyors` (quick log doors: Étkezés, Víz, Kiegészítők, Edzés, Sport, Súly, Check-in, Napló, Alvás), `/ritual` (Napzárás, 6 acts, bed-anchored; backend `feature/ritual`). Pure logic: `needs.ts` (decay/refill simulation of six needs; "Pihenés" decays 5/h awake and is set by last night's sleep), `needsInputs.ts` (`sleepEvent` from sleep log), `needsNudges.ts`, `napom.ts` (`dayReading`, `nextBestAction` workout/checkin/napzárás, evening window ≥20:00), `dayOrbFill.ts/Tone.ts/Face.ts`, `mezoMessages.ts`. **The six-need simulation is client-side only** (a Java port was deliberately deferred); backend `feature/needs` just snapshots at day close + XP/streak. `DayReview` (6-dim day score + layered LLM review) is the server-side day verdict, produced overnight, so **during the day the web serves no day score** (Mai uses the client mean of needs, owner decision 2026-10-10).

### 2.8 iOS — Boop S3 (`ios/`)

- `ios/BoopKit/Sources/BoopCore/Health/` — `HealthKitReader` (reads `sleepAnalysis`, `stepCount`, `activeEnergyBurned`, `heartRate`, `restingHeartRate`, workouts), `SleepNightBuilder.buildNights` (per source: sessions split at >90 min gaps; 14–18 h wake = nap dropped; per wake-day the session with most staged minutes wins across sources; stages deep/REM/core/unspecified/awake/inBed → 5-min bucket letters D/R/L/A ≤200; `externalId hk-night-<day>`; the **source app name is read but not sent**), `HealthSync` (60-day first window, then synced-through − 2 d; nights→days→workouts→calendar; refresh on every foreground, 10-min debounce, no background delivery on a free team), `WorkoutMapper`, `Calendar/CalendarSnapshotBuilder` (today+tomorrow).
- `BoopCore/Morning/` — `Brief` (decoded contract), `MorningClient/Store`, `PathBuilder` (stations per orb), `Lens` (pill action per orb), `BoopVoice` (hu-HU TTS).
- `ios/Boop/Nap/` (14 files, ~2.5 k lines): `MaiView`, `MaiTiles`, `MaiPath`, `LensActionRow`, `ObservationStack` (swipe confirm/reject → existing `decidePattern`), `SessionMove` (move session time), `MaiMode` (evening ≥18 h, kímélő), `BedtimeReminder` (local notification bed target − 30 min), sheets `SleepSheet` (tiles, hypnogram legend, deep ×7), `PulseSheet` (weekly RHR, today min/avg/max), `DaySheet` (energy curve with magnifier, conflict card), `ANapomView` (strict chronological day). Check-in, intention, weigh-in, meal capture, "+" sheet, Beszélgetés, Rutin are "hamarosan" (S4).
- iOS tests: BoopKit 106 + 48, app 73 (not in CI).

## 3. How it works (flows)

**Sleep in, today.** (a) Web: user opens `SleepLogSheet`, types or uploads a Sleep Cycle screenshot → `POST /api/sleep/screenshot` → draft with confidence/needsReview → user confirms → `POST /api/biometrics/sleep` → row `source=manual|screenshot` → `SleepLogSavedEvent` → companion message. (b) Boop: app open → `HealthSync` reads Health (Sleep Cycle writes its nights into Apple Health) → `buildNights` → `/api/wearable/sleep-nights` upsert → `source=apple_health`, newest night may emit the same event.

**Day recommendations on web.** None are personalised-by-physiology. `dayReading` is a rule sentence from the six-dim evaluation; `nextBestAction` picks workout / next check-in / Napzárás by clock; the six needs produce threaded nudges; the proactive feed (`proactive.md`, 4 k lines, other mapper) + flags (SleepDebtRule etc.) + detectors produce advice/observations; chat tools can pull sleep. Training readiness (`train/service/ReadinessAssessor`) = morning check-in thresholds (`rested ≤ max`, `soreness ≥ min`, `motivation ≤ max`) → "Könnyítsük/Marad" choice + pain→exercise care; it never reads sleep log or wearable data.

**Day on Boop.** Foreground → phone sends local date → `BoopDayAssembler` → `BoopScores` + `EnergyCurveModel` + `RuleVerdicts.conflict` → one LLM call words it (rule fallback) → cached per user/day by input hash → `MaiView` renders orbs (Forma, Alvás, Mozgás, Fuel, Pulzus), path stations, energy sheet, observation swipe, session move, bedtime notification. The only write-back actions in S3: decide observation, move/undo session time.

## 4. Quality assessment

**Solid**
- Sleep storage and the Screenshot→draft pipeline: honest nulls, deterministic validator, idempotent Apple Health upsert (native ON CONFLICT, soft-delete aware), well-tested (CODEMAP lists 19 biometrics ITs incl. `SleepLogEnrichedApiIT`, `SleepLogHypnogramIT`, `SleepShotApiIT`, `GoalSleepAdequacyAdapterIT`, `SleepGoalShiftIT`; FE tests for every sleep logic file).
- Boop brief engineering: input-hash cache, race-safe upsert, per-field LLM fallback, no event titles to the LLM, future-date 400, value-pinned formula tests.
- Wake-morning date convention is consistently documented and used.

**Half-built / limited**
- *Quality is null for all Apple Health nights* (35/35 in prod). Alvás ignores quality; "rested" check-in is not used in Boop scores either. `SleepNeedDetector`/escalation also depend on quality/rested (escalation avg quality on null rows would misbehave if `e.quality` is null; FE types assume number).
- *Source of truth ambiguity:* manual, screenshot and apple_health rows can all exist for one wake date. DB has no unique `(created_by, date)`; `SleepLogService.log` always inserts; `BoopDayAssembler` collapses duplicates arbitrarily (`(newer, older) -> newer`, order is date-only). Today no collision in prod only because the two sources sit on different accounts. Likewise `hk-night-<day>` merging across apps is by "most staged minutes", not by "prefer Sleep Cycle".
- *Duplicated sleep formula* (`BoopScores.alvas` vs `DayEvaluationEngine.sleepDim` vs FE needs) — drift risk, acknowledged in the docs.
- *Sleep analytics stranded in web TS* (regularity, efficiency, phases, escalation, wind-down); backend has no API for them, so Boop cannot show them without a port.
- *Forma is not a readiness model*: no HRV, no sleep debt, no schedule, no personal baseline for sleep; "load" is yesterday's Watch workout minutes only (gym/run sessions logged in Mezo are not counted); Pulzus neutral 70 when resting HR missing (prod: resting HR present on 26 of 61 days).
- *Energy curve* is a fixed template; it does not use chronotype, sleep timing, calendar load or caffeine; documented as "a model, not a measurement".
- *Calendar* kept for today+tomorrow only, titles stored but hidden from the LLM; no per-event scoring exists (core 7 missing).
- Parked minors (bd): `trendUp` on equal values, payload versioning, regen vs in-flight reload (`boop-ios.md` §9). Soft-delete finders on `daily_metric`/`wearable_workout`/`calendar_event` ignore `is_deleted`.
- Web needs engine: client-only, so it cannot run for Boop and has no server snapshot except at day close.

**Dead / legacy**
- Hypnogram stages are display-only by decision; `useDayFace`, `dayFace` have no production consumer (per `today.md`); the old three-state ritual entry is gone.
- `medication` is generic but unused by the owner.

**Production shape (counts only):** `sleep_log` 59 live rows across 2 users: Boop account 35 `apple_health` (2026-09-11→2026-11-10; deep/hypnogram/bedtime 35/35, quality 0/35); web account 19 `screenshot` (quality 19/19, source quality % 19/19, hypnogram only 3/19 — the hypnogram extraction mostly failed validation) + 5 `manual`. `sleep_goal` 1 row. `daily_metric` 61 rows (RHR 26). `calendar_event` 9. `boop_brief` 1. `check_in` 41. `medication` active 0.

## 5. Reuse for native iOS

**Call as-is**
- Sleep goal `GET/PUT /api/sleep/goal` (gives bed/wake targets; Boop already shows the bed target through the brief).
- `POST /api/wearable/*` ingest; `GET /api/boop/brief`, regenerate, session-time endpoints (the whole S3 contract).
- `GET/POST /api/biometrics/checkin` + `…/plan` and `decidePattern` (S4 candidates; web's slot/plan logic is server-side, so this is cheap).
- `POST /api/sleep/screenshot` (would work from Swift unchanged if the owner wants a Sleep Cycle screenshot fallback; likely unnecessary once Health supplies the stages).

**Needs a Boop-shaped API / new backend work**
- Sleep analytics for the native sleep page: regularity, efficiency, phase %, REM-by-duration, deficit/debt, escalation, personal sleep need — either a `GET /api/boop/sleep` aggregate or compute in `BoopCore` (all of it is small pure math; it is currently TS). Sleep-debt is already server-side in `SleepDeficitCalculator` (companion-switch gated) and `GoalSleepAdequacyAdapter` (ungated) — expose one of them.
- Store the Sleep Cycle quality and the source app. Either add a source-name field to the sleep-night contract, or accept that quality is gone and drop the 0.3 weight (decision needed).
- Wearable data into the AI context (chat tools, companion snapshot, day evaluation) — currently invisible.
- Check-in ↔ watch snapshot link (core 11): add columns/side table at `POST checkin` time, fed by the phone at save.
- Calendar scoring and day-units (core 7): needs a history table (keep past days), an LLM scorer, and a capacity model.

**Logic only in web frontend (would have to move to backend or Swift)**
sleepStats/sleepPhases/sleepEscalation/sleepEducation/windDown/nightTrace (see §2.6); the entire needs engine (`needs.ts`, `needsInputs.ts`, `needsNudges.ts`, `needsAverage.ts`); `dayReading`/`nextBestAction` (`napom.ts`); the evening window and Napzárás gating.

## 6. Gaps vs the owner's core

| # | Item | Status | Reason |
|---|---|---|---|
| 1 | Collect every metric from Apple Health (+Huawei) and sleep from Sleep Cycle | **Exists, needs fixing / partly missing** | Sleep stages+hypnogram via Health work (35 nights). Missing: HRV, SpO2, respiratory rate, wrist temp, sleeping HR, VO2max, body metrics; Sleep Cycle quality % and source identity lost; Huawei Health has no code path (would need Health Connect/Huawei SDK; on iPhone Huawei data only arrives if their app writes to Apple Health); background delivery unavailable on a free team (refresh only on open) |
| 6 | Full sleep tracking from Sleep Cycle data, calculations, day recommendations | **Exists, needs fixing** | Rich calculations exist but live in the web app/companion; Boop has display + one formula. No chronotype, no data-driven bedtime/wake recommendation (only user anchor), no sleep-debt display, no regularity on Boop. Dedup/precedence between sources unresolved |
| 7 | Calendar AI scoring → units vs biomarker capacity → doable-day prediction | **Missing** | Calendar ingest + busy slots + a single rule (session conflict) exist; no scoring, no capacity model, only today+tomorrow stored, no history to learn from. Energy curve is a static template |
| 12 | AI re-examines the day live and adjusts | **Missing (foundation partial)** | Brief regenerates on input-hash change (3 time buckets/day) and words precomputed numbers; it never proposes changes to meals/workout/movement; only the session-move rule exists. Web proactive feed/flags are rule/diagnosis based, not live re-planning |
| 11 | Check-ins snapshot watch biometrics | **Missing** | check_in has no biometric snapshot; Boop S3 only reads check-in done flags |
| 10 | Journal/day goal/close-out | **Exists on web (Napzárás, intention, A napom), not in Boop** | S4 scope; day review is nightly and server-side |
| 8/9 | One AI with all data; konzílium | **Exists on web, blind to wearable data** | Wearable/calendar tables are read only by the Boop assembler |
| — | Medication on the day page | **Candidate to drop** | owner tracks none; generic cycle domain adds surface |
| — | Web needs rings / dayOrb / day-face stack | **Candidate to drop / replace** | client-simulated, six-need average is a cosmetic number; Boop's five orbs supersede it |

## 7. Open questions / risks for the re-plan

1. **Which account is canonical?** History (screenshot/manual sleep from Aug 24, check-ins, goals, plans) sits on the web account; Boop's new account holds only Health data. A standalone Boop needs either a data migration/merge or a clean restart; Forma needs ≥14 nights and the sleep-need detector needs 8 weeks.
2. **Sleep Cycle strategy:** rely on Health (no quality %, source unknown), keep screenshot OCR as a manual fallback, or ask whether Sleep Cycle has an export/API route? Decide the one "night of record" rule when two sources exist (add a unique `(created_by, date)` or a source-priority resolver).
3. **What replaces `quality`?** Without Sleep Cycle's %, Alvás could use deep/REM share, efficiency, awakenings, regularity, HRV; the current formula silently degrades to duration-only.
4. **Where should calculations live?** Moving sleep analytics server-side (reusable by AI chat and Boop) vs Swift (offline, instant). Today they are split three ways (TS, Java rules, Swift builders). Duplicate sleep formulas already exist twice.
5. **Wearable data in the AI's eyes:** must extend companion context, tools (`get_recovery` has no HR/steps), flags and detectors, and the day evaluation, or the "one AI with all data" promise is false.
6. **Forma credibility:** with weights chosen by hand and no personal calibration, the headline orb may mislead; consider HRV/RHR z-scores, sleep debt and Mezo-logged training load, and a "show your work" view.
7. **Free Apple ID limits:** 7-day signing, no background delivery, no push → live re-examination (item 12) and watch-triggered check-in snapshots must happen on open or need a paid team / server push.
8. **Calendar privacy:** titles are stored server-side in plain text; per-event AI scoring will want them in the prompt (today deliberately excluded).
9. **Doc/code drift:** `today.md`/`needs.md` call Mai's big number the needs average and mention `useDayFace` consumers inconsistently; `boop-ios.md` says Forma = "old készenlét" but the web has no such score; `docs/features/README` has no sleep feature doc (sleep lives in `me.md`, 840 lines).
