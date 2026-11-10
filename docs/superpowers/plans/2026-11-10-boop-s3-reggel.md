# Boop S3 · Reggel — morning brief + the real Mai — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Boop tells the owner his morning: a new backend **Boop brief** (five metric scores + verdicts, Boop's spoken brief, energy curve, the day's data for the paths) and the real **Nap · Mai** in the Napkelte look — rising orb, mini-orb lens with per-orb actions, tiles and short paths, detail sheets, A napom full path, evening and kímélő variants.

**Architecture:** A new leaf backend feature `feature/boop` reads the existing features (sleep, wearable, train, meal, checkin, intention, companion observations, recovery, sleep goal), computes scores and the energy curve deterministically, asks the cheap LLM tier once for the words (with a rule-based fallback), and caches one `boop_brief` row per user and local day. iOS fetches it, builds the per-orb paths with pure builders in `BoopCore/Morning`, and renders with the S2.5 kit.

**Tech Stack:** Spring Boot + Liquibase + MapStruct + generated OpenAPI interfaces (backend); SwiftUI + swift-openapi-generator + AVSpeechSynthesizer + UserNotifications (iOS).

**Spec:** look `docs/superpowers/specs/2026-11-10-boop-napkelte-design.md` (§5.1–§5.5, §9, §10); data `docs/superpowers/specs/2026-11-09-boop-ios-v1-design.md` (§4.3 row 1, §7, §8). Recon facts used below come from the S3 terrain report (2026-11-10).

## Global Constraints

- New table/endpoint, **not** a new `companion_message` kind (the web would receive it). Feature package `io.mrkuhne.mezo.feature.boop`; nothing imports it back (ArchUnit cycle-free).
- The client sends its **local date** (`date=YYYY-MM-DD`); the server never uses `LocalDate.now()` for the brief.
- Reads carry no `@Transactional`; writes are method-level. Generation failures must not mark a read rollback-only.
- LLM: cheap tier (`CompanionLlm.complete`), billed as `LlmCallContext("boop_brief", …)`, defensive `{…}` JSON parse; on any failure a rule-based verdict is used — the brief never fails because of the LLM.
- Regeneration: automatic when the brief's input hash changes (new night, calendar change, meal/weight logged); manual `regenerate` at most **3 per day**.
- Thin data: fewer than **14** nights → Forma score null ("még tanulom"), no rise.
- "Készenlét" is **Forma** everywhere; companion is **Boop**; Hungarian copy; Napkelte kit only (no Lágy views).
- Liquibase: `1.1.0/script/{YYYYMMDDHHMM}_mezo-r36n9.7_{desc}.sql` in `1.1.0/1.1.0_master.yml`; never a bare `?` in SQL (use `jsonb_exists()`).
- New tables in `ResetDatabase` TRUNCATE list + a populator, same commit.
- iOS: new operationIds in `openapi-generator-config.yaml` + `sync-openapi.sh`; `PreviewTransport` answers every new op (DEBUG `-preview`).
- S4 owns the inner steps (check-in, szándék, mérlegelés, étkezés capture, quick food log, "+" sheet, notifications list, settings): in S3 their entry points show "hamarosan".

## Review Focus

1. **Thin or missing data** (no night today, < 14 nights, no calendar, no planned session, no meals) → every metric has a display and a sentence; nothing renders "nil", "0 %" as a fake score, or crashes (BoopScoreService and PathBuilder tests).
2. **LLM returns garbage or times out** → rule verdicts, same schema (BoopVerdictWriter test with the fake returning junk).
3. **Day boundary / time zone**: brief requested at 00:30 local for the new day, server in UTC → the right night and day (BoopDayAssembler IT with an explicit date).
4. **Moving the session twice / undo** → last write wins; DELETE restores the planned time; the brief's conflict card disappears after a move (SessionTime IT + brief IT).
5. **Reduced motion and Dynamic Type on the Mai** → orb still, no typing, layout grows (render tests at accessibility sizes, `animated:false`).

---

### Task 1: Contract

**Files:** Create `api/feature/boop/boop.yml`; modify `api/generate/merge.yml` (inputs), `api/openapi.yml` (generated).

- [ ] **Step 1:** Write the fragment, tag `Boop`:
  - `GET /api/boop/brief` `operationId: getBoopBrief`, query `date` (string, pattern `^\d{4}-\d{2}-\d{2}$`, required) → 200 `BoopBrief`.
  - `POST /api/boop/brief/regenerate` `regenerateBoopBrief`, query `date` → 200 `BoopBrief`; 409 `SystemMessageList` when the daily limit is reached.
  - `PUT /api/boop/session-time` `setSessionTime`, body `SessionTimeRequest {date, time (^\d{2}:\d{2}$)}` → 200 `SessionTime {date, time, plannedTime}`; `DELETE /api/boop/session-time` `clearSessionTime`, query `date` → 204.
  - `BoopBrief`: `date`, `generatedAt`, `state` (`good|okay|tired|learning`), `nightsKnown`, `metrics[]` (`key` `forma|alvas|mozgas|fuel|pulzus`, `score` int nullable 0–100, `display` string, `caption` nullable, `headline`, `sentence`, `trendUp` bool nullable), `brief[]` (`text`, `link` nullable `sleep|heart|day`), `energy` (`hourly[19]` 0..1 for 06:00…24:00, `dipHour` nullable), `tonightTip`, `nextMealTip` nullable, `conflict` nullable (`text`, `suggestedTime`), `day` (`sleep` nullable {`bedtime`,`wakeup`,`totalMin`,`deepMin`,`remMin`,`lightMin`,`awakeMin`,`hypnogram[]{stage 0..3, minutes}`}, `bedtimeTarget` nullable, `deepSleepWeek[7]`, `restingHrWeek[7]` (nullable ints), `steps`, `stepsGoal`, `activeKcal`, `session` nullable {`title`,`time`,`plannedTime`,`minutes`,`exercises[]{name, sets}`}, `meals[]` {`time`,`title`,`kcal`,`proteinG`,`logged`}, `kcalSoFar`,`kcalTarget`,`proteinG`,`proteinTarget`,`carbsG`,`fatG`, `checkins[]` {`slot` `morning|midday|afternoon|evening`, `time`, `done`, `summary` nullable}, `intention` {`creed` nullable, `foci[]`}, `observations[]` {`id`, `lead`, `bold`, `tail`, `strength` 0..5}, `calendar` {`count`, `busySlots[72]`}, `weight` nullable {`kg`,`trendKg`}, `recovery` nullable {`reason`, `day`}).
- [ ] **Step 2:** Add to `merge.yml` inputs after wearable; `cd api/generate && npm run generate:api`; Expected: `api/openapi.yml` contains `getBoopBrief`, build compiles the generated `BoopApi`.
- [ ] **Step 3:** Commit `feat(api): Boop brief and session-time contract (mezo-r36n9.7)`.

### Task 2: Tables, entities, repositories

**Files:** Create `backend/src/main/resources/db/changelog/1.1.0/script/<ts>_mezo-r36n9.7_boop_brief.sql` (+ master entry); `feature/boop/entity/{BoopBriefEntity,WorkoutTimeOverrideEntity}.java`, `feature/boop/repository/{BoopBriefRepository,WorkoutTimeOverrideRepository}.java`; modify `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`; create `support/populator/{BoopBriefPopulator,WorkoutTimeOverridePopulator}.java`; add read finders to `feature/wearable/repository/{DailyMetricRepository,WearableWorkoutRepository}.java` (`findByCreatedByAndDateBetweenOrderByDate`).

- `boop_brief`: UUID pk, `created_by` FK cascade, soft-delete, `date`, `payload jsonb` (the `BoopBrief` DTO as JSON), `input_hash varchar(64)`, `regen_count int default 0`, `generated_at`; `uq_boop_brief_user_date` partial unique (not deleted).
- `workout_time_override`: UUID pk, `created_by`, soft-delete, `date`, `time time`; `uq_workout_time_override_user_date` partial unique.
- [ ] **Step 1:** Repository IT `BoopRepositoriesIT` (`findByCreatedByAndDate` returns the row; a second insert for the same user/day violates the unique index). Run → FAIL. **Step 2:** Implement SQL + entities + repos + TRUNCATE + populators. **Step 3:** `./mvnw clean test -Dtest='BoopRepositoriesIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true` → PASS. **Step 4:** Commit.

### Task 3: The day assembler (reads only)

**Files:** Create `feature/boop/service/BoopDayAssembler.java` + record `BoopDay`; test `BoopDayAssemblerIT`.

**Interfaces:** Produces `BoopDay assemble(UUID user, LocalDate date)` with: last night (`SleepLogRepository` night ending on `date`), 7-day deep-sleep and resting-HR series, 14-night baselines (avg resting HR, avg deep), today's daily metric, planned session (`WorkoutService.findPlannedTemplateForDateUnlessSkipped`, time = `WorkoutTimeOverride` else `GymScheduleService` weekday time), yesterday's workout load (wearable workouts kcal/min), meals + targets (`FuelDayService.getDay`), check-in plan + answers (`CheckInPlanService.plan`, `listCheckInsForDay`), intention (`IntentionService.getDay`), open observations (companion observation service, newest 3), calendar events of `date` → 72 busy slots, sleep goal bedtime, recovery (`RecoveryPeriodService` protected dates), weight (`WeightTrendService`). Never calls `WorkoutService.getToday` (it writes).
- [ ] **Step 1:** IT seeding a night (stages), 14 nights of history, a calendar day, a meal, a planned session and an override; asserts each field; plus `requestAt0030LocalPicksTheNewDay` (Review Focus 3: explicit `date`, server zone UTC). Run → FAIL. **Step 2:** Implement. **Step 3:** focused IT → PASS. **Step 4:** Commit.

### Task 4: Scores and the energy curve (pure)

**Files:** Create `feature/boop/service/{BoopScores,EnergyCurveModel}.java`; tests `BoopScoresTest`, `EnergyCurveModelTest` (plain unit tests).

**Interfaces:** `BoopScores.compute(BoopDay d, LocalTime now) -> Scores{forma?, alvas?, mozgas, fuel?, pulzus?, pulzusBpm?, state}`; `EnergyCurveModel.hourly(Integer forma, LocalTime sessionTime, LocalTime lunch) -> double[19]`.
Formulas (*call*, documented in `docs/features/boop-ios.md`):
- alvas = sleep dimension of `DayEvaluationEngine` (duration vs target 0.7 + quality 0.3) × 100; null without a night.
- pulzus = clamp(70 + (baseline14 − restingHr) × 6, 0, 100); display = bpm.
- mozgas = min(100, steps / stepsGoal × 100) (goal from `BoopProperties.stepsGoal`, default 9000).
- fuel = min(100, kcalSoFar / (kcalTarget × expectedShare(now)) × 100), expectedShare linear 07:00→21:00 (0 before 07:00 → fuel null).
- forma = round(0.45 alvas + 0.35 pulzus + 0.20 load), load = 100 − min(60, yesterdayWorkoutMin / 2); null when nights < 14 or alvas null. state: ≥70 good, 50–69 okay, < 50 tired, null → learning.
- energy: circadian template (06 0.35 → 10–11 0.82 peak → 14–15 dip 0.38 → 17–18 0.66 → 24 0.2), scaled 0.6 + 0.4 × forma/100 (0.8 when null), post-lunch dip deepened 0.05 if lunch after 13:30, training hour +0.06 then −0.08 for two hours.
- [ ] **Step 1: tests** — `noNightMeansNoSleepScore`, `thinNightsMeansLearning` (13 nights → forma null, state learning), `pulseBelowBaselineScoresHigh` (rhr 57, baseline 59 → 82), `fuelNullBeforeSeven`, `stepsCapAt100`, `dipIsTheLowestBetweenNoonAndSix`, `higherFormaRaisesTheCurve`, `curveHas19Points`. Run → FAIL. **Step 2:** Implement. **Step 3:** PASS. **Step 4:** Commit.

### Task 5: The words — LLM verdicts with a rule fallback

**Files:** Create `feature/boop/service/{BoopVerdictWriter,BoopPrompts,RuleVerdicts}.java`; modify `feature/companion/llm/FakeCompanionLlm.java` (marker `BOOP_BRIEF_V1` → canned valid JSON); test `BoopVerdictWriterIT`.

**Interfaces:** `Verdicts write(BoopDay d, Scores s, LocalTime now)`: five `{headline, sentence}`, `brief` segments with links (`sleep|heart|day`), `tonightTip`, `nextMealTip`, `conflict` (rule-detected: session start < 45 min after the last meeting → text + suggested time rounded to :00/:30 after the meeting + 60 min). Prompt gives the computed numbers (never asks the model to score), Hungarian, Boop voice, ≤ 2 sentences per metric. Parse first `{`…last `}`; any missing field → that field from `RuleVerdicts`.
- [ ] **Step 1:** IT: fake returns valid JSON → used; fake returns `"nem json"` → rule verdicts, schema complete (Review Focus 2); learning state → Forma headline "Még tanulom a ritmusod". Run → FAIL. **Step 2:** Implement. **Step 3:** PASS. **Step 4:** Commit.

### Task 6: Brief service + controller

**Files:** Create `feature/boop/service/BoopBriefService.java`, `feature/boop/mapper/BoopBriefMapper.java`, `feature/boop/controller/BoopController.java` (`implements BoopApi`), `feature/boop/config/BoopProperties.java` (`stepsGoal 9000`, `regenPerDay 3`, `nightsNeeded 14`) in `application.yml` under `mezo.boop`; message code `boop.brief.regenLimit`; tests `BoopBriefServiceIT`, `BoopContractIT`.

Behaviour: `get(date)` → assemble day → input hash (night id + updated, calendar count/hash, meals count, weight log id, session time, recovery) → existing row with same hash: return payload; else compute scores + curve + verdicts, upsert row (method-level `@Transactional` on the write only, generation outside it), return. `regenerate(date)`: `regen_count < 3` else 409.
- [ ] **Step 1:** ITs: first call creates one row; second call same hash → no LLM call (fake counter); new night → regenerated; 4th regenerate → 409 with `boop.brief.regenLimit`; contract round-trip `GET /api/boop/brief?date=…` 200 schema. Run → FAIL. **Step 2:** Implement. **Step 3:** focused ITs + `ArchitectureTest` → PASS. **Step 4:** Commit.

### Task 7: Move today's session

**Files:** Create `feature/boop/service/SessionTimeService.java`; extend `BoopController`; test `SessionTimeIT`.
- [ ] **Step 1:** IT: PUT 18:30 → `{time 18:30, plannedTime 18:00}`; PUT 19:00 → last wins; DELETE → brief `day.session.time == plannedTime`; brief `conflict` null after the move (Review Focus 4); no planned session → 404. Run → FAIL. **Step 2:** Implement (upsert by user+date). **Step 3:** PASS. **Step 4:** Commit; run the backend full suite `./mvnw clean test -Dmezo.test.use-testcontainers=true` → green.

### Task 8: iOS client and models

**Files:** Modify `ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml` (+ `getBoopBrief`, `regenerateBoopBrief`, `setSessionTime`, `clearSessionTime`, `decidePattern`), run `ios/scripts/sync-openapi.sh`; create `ios/BoopKit/Sources/BoopCore/Morning/{MorningClient,Brief}.swift`; modify `ios/Boop/Connect/PreviewTransport.swift` (canned brief); test `ios/BoopKit/Tests/BoopCoreTests/MorningClientTests.swift`.

**Interfaces:** `struct Brief: Sendable` (plain mirror of `BoopBrief`, `metric(_ key: Hue) -> Metric`), `@MainActor @Observable final class MorningStore { var brief: Brief?; var problem: MorningProblem?; func load(date: Date) async; func regenerate() async; func moveSession(to: String) async; func undoMove() async; func decide(observation: String, true: Bool) async }`; `Hue` ↔ metric key mapping `forma|alvas|mozgas|fuel|pulzus`.
- [ ] **Step 1:** StubTransport tests: `loadSendsLocalDate` (query `date` = device local day), `loadMapsMetrics`, `regenerateLimitShowsProblem` (409 → `.limit`), `moveSessionUpdatesBrief`, `unauthorizedSignsOut`. Run → FAIL. **Step 2:** Implement. **Step 3:** PASS. **Step 4:** Commit.

### Task 9: Per-orb paths and the lens (pure builders)

**Files:** Create `ios/BoopKit/Sources/BoopCore/Morning/{PathBuilder,Lens}.swift`; tests `PathBuilderTests`, `LensTests`.

**Interfaces:** `PathBuilder.stations(for: Hue?, brief: Brief, now: Date, evening: Bool) -> [PathStation]` (nil = A napom full day); `Lens.action(for: Hue, brief: Brief, now: Date, evening: Bool) -> LensAction { glyph, title, kind }` (`checkin`, `bedtime`, `workout`, `photo`, `breath`, `eveningCheckin`, `windDown`). Station rules per orb exactly as spec §5.1a table and §10 (Forma: MOST → morning check-in → szándék → observations → later check-ins; Alvás: last bedtime → night → wake → MOST → bedtime; Mozgás: MOST → dip walk → session; Fuel: meals only; Pulzus: MOST → breath before the densest calendar block → that block; done steps carry a summary; kímélő drops the session and adds water/walk/early bed).
- [ ] **Step 1:** tests: `formaListsAllCheckIns`, `fuelShowsOnlyMeals`, `mozgasWithoutSessionHasOnlyTheWalk`, `nowSitsAtTheRightPlace`, `doneCheckInCarriesSummary`, `recoveryDropsTheSession`, `eveningFormaPillIsEveningCheckin`, `emptyBriefStillHasNow`. Run → FAIL. **Step 2:** Implement. **Step 3:** PASS. **Step 4:** Commit.

### Task 10: Boop's voice

**Files:** Create `ios/BoopKit/Sources/BoopCore/Morning/BoopVoice.swift` (port of the spike `Typer`: best hu-HU voice, word-by-word `shown` via `willSpeakRangeOfSpeechString`, mute persisted, `replay()`, reduced motion → instant); test `BoopVoiceTests` (`segmentsJoinIntoTheSpokenText`, `instantWhenReducedMotion`, `mutedDoesNotSpeak` with an injected synthesizer protocol).
- [ ] Steps: tests → FAIL → implement → PASS → commit.

### Task 11: The Mai hero and the lens

**Files:** Create `ios/Boop/Nap/MaiView.swift`, `ios/Boop/Nap/LensActionRow.swift`; modify `ios/Boop/Nap/NapView.swift` (ready/learning with a brief → `MaiView`; not-connected/syncing/failed/offline stay); test `ios/BoopTests/MaiCopyTests.swift` (no "Mezo"; Forma label).
Hero per spec §5.1: title row, tabs, `MiniOrbRow` (five metrics from the brief), `RisingOrb` (selected metric; Pulzus shows bpm), name caps, headline, sentence, lens action row (white pill morphing + Boop voice circle with mute/replay long-press menu), Fuel quick chips (S4: toast "hamarosan"), breathing (Pulzus) as in the spike; tap a mini orb re-colours page (backdrop hue, ground, lights). Compact capsule from the brief.
- [ ] Steps: copy test → FAIL → implement → PASS; launch `-preview shell` (PreviewTransport brief), screenshot all five orbs against the spike `AuraSunrise`; commit.

### Task 12: Below the hero — tiles, paths, cards, observations, session move

**Files:** Create `ios/Boop/Nap/{MaiTiles,MaiPath,ObservationStack,SessionMove}.swift`.
Per-orb tiles (§5.1a table), `DayPath(stations: PathBuilder…)` with cards (check-in, szándék, observations swipe → `decide`, hypnogram, bedtime, dip, session strip + "Áttolom HH:mm" → `moveSession` + toast + undo, meals, meetings ribbon, breath), Boop mondja card (segments tappable → sheets) on Forma, mirrored land.
- [ ] Steps: implement; `-preview shell` screenshots for each orb top and bottom; observation swipe and Áttolom tapped in the simulator; commit.

### Task 13: Sheets and A napom

**Files:** Create `ios/Boop/Nap/{SleepSheet,PulseSheet,DaySheet,ANapomView}.swift`.
Sleep (tiles, hypnogram + legend, deep-sleep week), Pulse (week resting HR, daily min/avg/max — per-night HR is not stored, spec §9.3), Day (energy `GlowLine` with press-and-drag magnifier showing time · energy % · what is on, busy ribbon, conflict card with move/keep). A napom tab = full-day `DayPath`. Beszélgetés/Rutin keep "hamarosan".
- [ ] Steps: implement; screenshots of each sheet at medium/large and A napom; magnifier dragged in the simulator; commit.

### Task 14: Evening, kímélő, bedtime reminder

**Files:** Create `ios/Boop/Nap/BedtimeReminder.swift` (UserNotifications: request on first tap, schedule at bedtime − 30 min, cancel on untap), modify `MaiView`/`PathBuilder` callers for `evening = local hour ≥ 18` (dusk sky = Pulzus sky, Forma pill "Esti check-in" (S4 toast), Alvás pill "Esti levezetés") and `brief.day.recovery` (kímélő banner "Kímélő mód · N. nap · <reason>", calm grey-blue sky as spike `FrameMaiMode`); test `BedtimeReminderTests` (trigger time = target − 30 min, crosses midnight).
- [ ] Steps: test → FAIL → implement → PASS; screenshots of evening and kímélő via DEBUG `-previewEvening`, `-previewRecovery`; commit.

### Task 15: Ship

- [ ] Kit + core + app tests green; backend full suite green with Testcontainers; `ArchitectureTest`; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` 0/0; `node scripts/lint-liquibase.mjs`.
- [ ] Docs: `docs/features/boop-ios.md` (brief, formulas, paths, traps), new `docs/features/boop-brief.md` or a §4 section (*call*: section in boop-ios.md), feature index rows, roadmap milestone, `proactive.md` note that the Boop brief is separate.
- [ ] Fresh-context final review (most capable model); fix Critical/Important test-first; minors → bd under `mezo-r36n9`.
- [ ] Rebase, local `--no-ff` merge, push, fast-forward the primary checkout; `deploy` workflow green; production: `GET /api/boop/brief` for the owner's date returns 200 and `boop_brief` has one row for today (read-only query); install on the phone; live check on the device (brief, five orbs, a sheet, moving the session, then undo).

## Kész, ha…

**Amit a tulajdonos lát (a telefonon):**
- [ ] Reggel a Mai a valódi számait mutatja: öt kis gömb (Forma, Alvás, Mozgás, Fuel, Pulzus), a kiválasztott felkel vagy lebukik, a cím és a mondat a Boop szavaival.
- [ ] Gömbváltáskor az egész lap átszíneződik, és a fő gomb, a csempék és a rövid ösvény az adott gömbé (spec §5.1a táblázat).
- [ ] „Boop elmondja”: magyarul felolvassa és szóról szóra gépeli; némítás és „Mondd újra”; a kiemelt szavak részletlapot nyitnak (alvás, pulzus, a napod — nagyítóval).
- [ ] „Áttolom 18:30-ra” áthelyezi a mai edzést, a figyelmeztetés eltűnik, visszavonható.
- [ ] „Boop észrevette” kártyák lapozhatók (jobbra igaz, balra nem rólam szól), a válasz eltárolódik.
- [ ] Lefekvés-emlékeztető értesítést kér és beállít; a Pulzus légzés működik.
- [ ] Este (18 óra után) az esti változat, kímélő módban a kímélő változat jelenik meg.
- [ ] Kevés adatnál „még tanulom”, adat nélkül a megfelelő üres állapot; semmi nem mutat hamis számot.
- [ ] A napom fül a teljes napot mutatja; a többi S4-es belépő „hamarosan”.
- [ ] Nagy betűméret és csökkentett mozgás mellett is rendben.

**Parity:** S2.5 states (not connected, syncing, failed, offline) and the Connect card unchanged; web app untouched (no new feed kind).

**Gates:** backend full suite (Testcontainers) + ArchitectureTest; kit/core/app tests; codemap; lint-docs 0/0; liquibase lint.

**Docs:** feature doc (formulas!), feature index, roadmap milestone, proactive note.

**Shipped:** merged, CI + deploy green, production `boop_brief` row for today, installed on the phone, checked there; `mezo-r36n9.7` closed; tracker backup pushed.
