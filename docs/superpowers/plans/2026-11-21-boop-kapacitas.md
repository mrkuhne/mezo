# Boop B7 Napi kapacitás + Átrendezés — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every morning Boop says whether the day fits (calendar + training + food demand against capacity from sleep,
pulse, recent load, check-in and close); when a day or week is too much it proposes concrete moves on a new
**Átrendezés** page with every cross-effect; accepted moves change that day/week everywhere, never the season plan; every
move and outcome is logged and patterns warn ahead, also at the season level.

**Architecture:** New backend feature `capacity` (event scoring, a pure load model, proposals, one `day_adjustment`
ledger, the move log + patterns) reading other features through consumer-owned ports; readers of "what is planned on a
day" (train, fuel, boop brief, season adherence, AI context) consult the ledger through their own ports. iOS: the brief
gains a `capacity` block (generated client), the rest is a hand-written lenient client over `RawJSONClient` cached in
`ServerCache` (the Évad/Pénz pattern). Four slices K1 → K4, each shipped alone.

**Tech Stack:** Spring Boot 3 / Java 21, Liquibase, OpenAPI-first, JUnit + Testcontainers; SwiftUI iOS 26, BoopKit
(BoopCore, BoopDesign/Napkelte), Swift Testing with `StubTransport`.

**Spec:** `docs/superpowers/specs/2026-11-21-boop-kapacitas-design.md` (owner-approved 2026-11-21) — read §5 before any
task. **Spike (look + copy, throwaway):** branch `feat/b7-kapacitas-spike`, `ios/Boop/KapacitasDemo/KapacitasDemo.swift`,
screenshots `docs/superpowers/specs/assets/kapacitas/01–08`. Copy strings come from the spike verbatim unless a task says
otherwise. **Status:** waiting for the owner's OK.

## Global Constraints

- B = `backend/src/main/java/io/mrkuhne/mezo`; tests under `backend/src/test/java/io/mrkuhne/mezo`. I = `ios/BoopKit/Sources`.
- New package `B/feature/capacity/{controller,entity,repository,service,mapper,port}`. Cross-feature reads only through
  consumer-owned ports with the adapter in the consumer (the `feature/season` pattern: `SeasonGoalPort` +
  `SeasonGoalAdapter`). `boop` stays a leaf: nothing imports `boop`; `boop` reads capacity through `BoopCapacityPort`.
- Liquibase: `backend/src/main/resources/db/changelog/1.1.0/script/yyyyMMddHHmm_mezo-r36n9.17_<slug>.sql`, registered in
  `1.1.0_master.yml` (`id: "1.1.0:<stem>"`, `author: daniel.kuhne`); standard columns `id uuid default gen_random_uuid()`,
  `created_by`, `is_deleted`, `created_at`, `updated_at`; `pk_<t>_id`, `fk_<t>_created_by_app_user_id`; no bare jsonb `?`
  (use `jsonb_exists()`). Every new table in `support/ResetDatabase.java`.
- Contract first: `api/feature/capacity/capacity.yml` (tag `Capacity`) appended to `api/generate/merge.yml`;
  `CapacityController implements CapacityApi`. Brief changes in `api/feature/boop/boop.yml`; calendar in
  `api/feature/wearable/wearable.yml`. Regenerate `api/openapi.yml`; iOS generator filter gets new ops; run
  `node scripts/check-ios-contract.mjs`.
- Typed errors via `SystemRuntimeErrorException(SystemMessage.error("CODE").build(), status)`, codes in
  `messages_en.properties` + `messages_hu.properties`: `CAPACITY_PROPOSAL_STALE` (409), `CAPACITY_MOVE_NOT_EMPTY_DAY` (422),
  `CAPACITY_MOVE_OTHER_WEEK` (422), `CAPACITY_DAY_STARTED` (409), `CAPACITY_ADJUSTMENT_NOT_UNDOABLE` (409).
- The owner's zone is `mezo.wearable.zone`; "week" = Monday–Sunday in that zone; the server never calls
  `LocalDate.now()` for a day the phone names.
- **No invented number:** every number on a card comes from the engines (fuel day service, `SleepNeedRule`, the load
  model, the season preview). The LLM scores events and words lines; it never produces a number. Unknown → `null` → "–".
- **Nothing moves without his accept; the season plan, the gym schedule, the mesocycle and the goal are never written by
  `capacity`.** A moved session goes only onto a day of the **same Mon–Sun week with no gym session** (decision #71).
- All calendar fields go to the scoring model (decision #69). Calendar to-dos never write the calendar (#68).
- Thresholds/config under `mezo.capacity.*` (`@ConfigurationProperties`, no `@Value`): `verdict.laza=0.6`,
  `verdict.rendben=0.9`, `verdict.szoros=1.0`, `headroom=1.25`, `sequence-factor=1.3`, `sequence-block-min=90`,
  `gap-credit-min=15`, `learning.min-days=14`, `learning.min-labels=5`, `proposals.max-per-week=5`,
  `live.min-interval=PT3H`, `sunday.cron="0 0 18 * * SUN"`, `notes-max-chars=2000`, `enabled=true`.
- iOS: never "Mezo" or emoji visible; no SF Symbols except chevrons/arrows; reduced motion = still; right at 375 pt;
  Átrendezés + day-page blocks use hue `.pulzus`, Évad blocks the Évad hue.
- Wall: one source id `kapacitas`; Átrendezés card `.improves` rank 0.85; a today-proposal with a deadline < 3 h may be
  `.expires` (two-a-day ring cap applies). No second card surface, notification policy or "miért?".
- Gates per slice: focused ITs + `ArchitectureTest` with `-Dmezo.test.use-testcontainers=true`; `xcodebuild test` for
  BoopKit and Boop when iOS changed; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` 0 errors / 0 stale.
  K3 additionally takes the optional pre-merge cloud check (`premerge.yml`).
- No personal health values in docs, commits, Notion; examples marked „például".

## Review Focus

1. **No calendar access, or an empty calendar** — the verdict still comes from the body signals and says the calendar is
   missing; never a crash or a "laza" that pretends to know (Task 5 test `noCalendarStillGivesVerdictAndSaysSo`).
2. **An accepted move goes stale** — the target day later gets a gym session, the day starts, or the session is already
   running — it must expire, never produce two sessions or move a running one (Task 14 tests
   `targetDayGainedSessionExpiresMove`, `runningSessionIsNeverMoved`).
3. **Week and day boundaries in his zone** — Sunday 23:30 local vs UTC, the Sunday job, "same week" checks (Task 14
   `sundayLateLocalIsStillThisWeek`, Task 23 `sundayJobUsesOwnerZone`).
4. **Model down or quota spent** — rule scores, the verdict still shows, no proposal text missing (Task 3
   `llmFailureFallsBackToRuleScore`, Task 16 `wordingFallsBackToTemplate`).
5. **Offline accept replayed** — the Outbox resends; the same `clientRef` must not move twice (Task 17
   `acceptIsIdempotentByClientRef`, Task 19 `outboxReplayDoesNotDoubleAccept`).

---

## File structure

**Backend `B/feature/capacity/`**
- `entity/` `CalendarEventScoreEntity`, `EventFeedbackEntity`, `DayAdjustmentEntity`, `CapacityProposalEntity`,
  `CapacityPatternEntity`; `repository/` one each.
- `service/` pure: `RuleEventScore`, `DemandCalculator`, `CapacityCalculator`, `Verdicts`, `LearningState`,
  `ProposalGenerator`, `CapacityPatterns`, `SeasonLoadModel`; services: `EventScoringService`, `CapacityDayService`,
  `CrossEffectCalculator`, `ProposalWordingWriter`, `ProposalService`, `DayAdjustmentService`, `CalendarTodoWatcher`,
  `LiveReplanListener`, `OutcomeJob`, `SundayPreviewJob`, `CapacityContextRenderer`, `CapacityProperties`.
- `port/` (consumer-owned, adapters beside them in `service/`): `CapacityCalendarPort`, `CapacitySleepPort`,
  `CapacityMetricsPort`, `CapacityTrainPort`, `CapacityMealPort`, `CapacityCheckinPort`, `CapacitySeasonPort`.
- `controller/CapacityController`, `mapper/CapacityMapper`.
- Ledger readers (each owns its port + adapter): `feature/train/port/TrainDayAdjustmentPort`,
  `feature/meal/port/MealDayAdjustmentPort`, `feature/boop/port/BoopCapacityPort`, `feature/season/port/SeasonAdjustmentPort`,
  `feature/companion/port/CapacityContextPort` (+ `companion/tools/CapacityTools`).

**iOS**
- `I/BoopCore/Calendar/` (fields + window), `I/BoopCore/Kapacitas/` `KapacitasWire.swift`, `KapacitasClient.swift`,
  `KapacitasStore.swift` (cache `kapacitas/week`), `KapacitasLogic.swift` (pure row builders), `KapacitasWall.swift`.
- `ios/Boop/Kapacitas/` `AtrendezesPage.swift`, `ProposalCard.swift`, `MindenHatasaPage.swift`, `WeekStrip.swift`,
  `KapacitasPreview.swift` (preview transport, `-previewKapacitas` routes); day-page blocks in `ios/Boop/Nap/DayCapacity.swift`;
  Évad block `ios/Boop/Evad/EvadTeher.swift`; kit `I/BoopDesign/Napkelte/LoadCharts.swift` (`NKWeekLoadStrip`,
  `NKSeasonLoadChart` from the spike's `KapWeekStrip`/`KapLoadChart`).
- Changed: `Boop/Nap/MaWall.swift` (+1 registration, hue), `BoopCore/Morning/WallSources.swift` (`kapacitas`), the Ma
  briefing row, `Boop/Nap/DaySheet.swift`, `Boop/Evad/EvadOverviewTab.swift`, `BoopCore/Ritmus/Outbox.swift`
  (`OutboxKind.dayAdjustment`), `Boop/RootView.swift` (store).

---

# Slice K1 — Alap: calendar fields, event scores, the load model, the brief block

### Task 1: The calendar sends everything, 8 days ahead

**Files:** modify `api/feature/wearable/wearable.yml` (`CalendarEventIn`); create
`.../202611211200_mezo-r36n9.17_calendar_event_fields.sql`; modify `B/feature/wearable/entity/CalendarEventEntity.java`,
`service/CalendarSnapshotService.java`, `WearableProperties` (none — 31-day cap stays); iOS `I/BoopCore/Calendar/
{CalendarReader,CalendarKitReader,CalendarSnapshotBuilder}.swift`, `I/BoopCore/Health/HealthSync.swift:299-322`.
Tests `feature/wearable/WearableContractIT.java`, `ios/BoopKit/Tests/BoopCoreTests/{CalendarSnapshotTests,HealthSyncTests}.swift`.

**Interfaces — Produces:** `CalendarEventIn` + optional `attendeeCount int ≥0`, `attendeeNames [string ≤120] ≤50`,
`organizerIsMe bool`, `location string ≤200`, `recurring bool`, `availability enum [busy, free, tentative, unavailable]`,
`notes string ≤2000`; same nullable columns on `calendar_event` (`attendee_names jsonb`). `CalendarItem` gains
`attendeeNames: [String]`, `organizerIsMe: Bool`, `location: String?`, `recurring: Bool`, `availability: String`,
`notes: String?` (defaults keep old initialisers compiling). `HealthSync` sends **yesterday … today+8**
(`static let aheadDays = 8`).

- [ ] **Step 1: Tests** — `WearableContractIT.calendarEventKeepsNewFields` (PUT one event with all fields, row has them;
  notes of 2 001 chars → 400); `CalendarSnapshotTests.sendsAllEventFields`; `HealthSyncTests.calendarWindowReachesEightDaysAhead`
  (stub reader records `to` = start of today + 9 days; days list has today+8).
- [ ] **Step 2: Run** `cd backend && ./mvnw -q test -Dtest=WearableContractIT -Dmezo.test.use-testcontainers=true` and the
  BoopKit tests (`cd ios/BoopKit && xcodebuild test -scheme BoopKit-Package -destination 'platform=iOS Simulator,name=<own sim>' -skipPackagePluginValidation -derivedDataPath ../build/kit`) → FAIL.
- [ ] **Step 3: Implement** (EventKit: `attendees?.map(\.name)`, `organizer?.isCurrentUser`, `location`, `hasRecurrenceRules`,
  `availability`, `notes`); regenerate the generated client.
- [ ] **Step 4: Run both** → PASS. Remove the "stays on the phone" comment in `CalendarReader.swift:15`.
- [ ] **Step 5: Commit** `feat(wearable): calendar sends all event fields, 8 days ahead (mezo-r36n9.17)`.

### Task 2: The capacity feature: contract skeleton, tables, entities

**Files:** create `api/feature/capacity/capacity.yml`, modify `api/generate/merge.yml`; create
`.../202611211210_mezo-r36n9.17_capacity.sql`; entities + repositories (File structure); `CapacityProperties`;
modify `ResetDatabase.java`, messages. Test `feature/capacity/CapacityRepositoryIT.java`.

**Interfaces — Produces (tables):**
- `calendar_event_score (event_id uuid fk calendar_event, input_hash varchar(64), mental smallint 0..3, social 0..3,
  physical 0..3, restores bool, kind varchar(12), confidence numeric(3,2), source varchar(8) check in ('llm','rule'))`,
  unique `(event_id, input_hash)`.
- `capacity_event_feedback (event_key varchar(200) = calendar external_id without the occurrence part, effect varchar(8)
  check in ('drains','neutral','feeds'))`, unique `(created_by, event_key)`.
- `day_adjustment (date date, kind varchar(24), payload jsonb, bundle_id uuid, proposal_id uuid null, state varchar(8)
  check in ('active','undone','waiting','done','expired'), reason text, client_ref uuid)`, unique `(created_by, client_ref)`,
  index `(created_by, date) where is_deleted=false`.
- `capacity_proposal (week_start date, day date null, kind varchar(24), bundle jsonb, facts jsonb, effects jsonb,
  title text, why jsonb, generator_version smallint, status varchar(9) check in ('open','accepted','declined','ignored',
  'undone','expired'), decided_at timestamptz null, outcome jsonb null)`.
- `capacity_pattern (key varchar(60), evidence int, consistent int, payload jsonb, last_seen date)`, unique `(created_by, key)`.
- Kinds (Java enum `AdjustmentKind`): `MOVE_SESSION_DAY, SHIFT_SESSION_TIME, SHORTEN_SESSION, LIGHTEN_SESSION,
  SWAP_SESSION_KIND, SKIP_SESSION, SHIFT_BEDTIME, MOVE_MEAL_ENERGY, CALENDAR_TODO`.

- [ ] **Step 1: Test** `CapacityRepositoryIT.adjustmentClientRefIsUnique` (two rows, same owner + client_ref → violation) and
  `scoreKeyedByEventAndHash` (two hashes for one event both stored).
- [ ] **Step 2: Run** `./mvnw -q test -Dtest=CapacityRepositoryIT -Dmezo.test.use-testcontainers=true` → FAIL.
- [ ] **Step 3: Implement** SQL, entities, repos, empty `capacity.yml` (tag + components only), merge entry, ResetDatabase, codes.
- [ ] **Step 4: Run** → PASS; `./mvnw -q generate-sources` builds.
- [ ] **Step 5: Commit** `feat(capacity): tables and entities (mezo-r36n9.17)`.

### Task 3: Event demand scoring

**Files:** create `service/RuleEventScore.java` (pure), `service/EventScoringService.java`, `port/CapacityCalendarPort.java`
+ `service/CapacityCalendarAdapter.java`. Tests `RuleEventScoreTest`, `EventScoringServiceIT`.

**Interfaces — Produces:** `record EventScore(UUID eventId, int mental, int social, int physical, boolean restores,
String kind, double confidence, String source)`; `RuleEventScore.score(CalendarEventView e): EventScore`;
`EventScoringService.scoresFor(UUID owner, LocalDate from, LocalDate to): Map<UUID, EventScore>` (scores missing/changed
events in one cheap-tier batch via `ObjectProvider<CompanionLlm>` + `LlmCallContext` feature `capacity_event_score`,
45 s timeout, background only — final fix: `EventScoringRunner` runs it after a calendar PUT
(`CalendarDaysReplacedEvent`, AFTER_COMMIT + `@Async`, single-flight per owner) for today..today+8; the day read uses
`storedOrRule` and never waits; rule fallback, all-day events always rule; feedback rows override the three components: `drains` → max(component,2) on its main
component, `feeds` → `restores=true`, all components ≤1, `neutral` → all ≤1); `inputHash(e)` = SHA-256 over title, start,
end, attendeeNames, location, notes.

- [ ] **Step 1: Tests** — `RuleEventScoreTest`: 60-min meeting with 4 attendees → mental 2, social 2, physical 0;
  "Edzés"/sport calendar → physical 2; all-day free event → all 0. `EventScoringServiceIT.scoresOnceThenCaches` (stub
  LLM counts calls: second call same hash → 0 new calls), `changedTitleRescores`, `llmFailureFallsBackToRuleScore`
  (source `rule`), `feedbackFeedsWins` (restores true).
- [ ] **Step 2: Run** `-Dtest='RuleEventScoreTest,EventScoringServiceIT'` → FAIL.
- [ ] **Step 3: Implement**; prompt lists every field per event and asks for the JSON schema above only.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(capacity): event demand scoring with rule fallback (mezo-r36n9.17)`.

### Task 4: The load model (pure)

**Files:** create `service/{DemandCalculator,CapacityCalculator,Verdicts,LearningState}.java`. Tests
`DemandCalculatorTest`, `CapacityCalculatorTest`, `VerdictsTest`, `LearningStateTest`.

**Interfaces — Produces:**
- `DemandCalculator.day(List<TimedDemand> items, CapacityProperties p): Demand` where `TimedDemand(Instant start,
  Instant end, int mental, int social, int physical, boolean restores, String label, String kind)`, `Demand(double units,
  double mental, double social, double physical, List<DemandItem> items, double[] hourly19)`. Unit = minutes ×
  (mental+social+physical)/3 / 60; minutes inside an unbroken run of meetings ≥ `sequence-block-min` × `sequence-factor`;
  each gap ≥ `gap-credit-min` between meetings −0.1 unit; `restores` items count −0.5 × their units (floor 0 for the day).
  `hourly19` = units per hour 06–24.
- Training as a `TimedDemand`: planned session physical 2 (heavy compound day 3), duration from the plan; logged session
  uses logged duration and RPE ≥ 8 → physical 3.
- `CapacityCalculator.today(CapacityInputs in, CapacityProperties p): Capacity` with `CapacityInputs(double baseUnits,
  Integer sleepMin, Integer sleepNeedMin, Integer restingHr, Double rhrBaseline, Double hrv, Double hrvBaseline,
  double yesterdayUnits, Boolean underAteYesterday, boolean recovery, Integer checkinEnergy, Integer checkinMental)`;
  `Capacity(double units, List<Factor> factors)`, `Factor(String key, String label, String valueText, int effect /* -1,0,1 */,
  double multiplier)`. Base × `headroom`; multipliers: sleep short ≥ 45 min ×0.85, ≥ 90 ×0.75; RHR ≥ +3 ×0.93, ≥ +6
  ×0.85; HRV < 0.8 × baseline ×0.9 (only when both present); yesterday > 1.3 × base ×0.9; under-ate ×0.93; recovery ×0.6;
  check-in energy ≤ 3/10 ×0.85, ≥ 8 ×1.05. Missing input → factor omitted, never guessed.
- `Verdicts.word(double ratio, CapacityProperties p): String` → `laza|rendben|szoros|túl sok`.
- `LearningState.of(int fullDays, int labelledDays, CapacityProperties p): boolean tanulo`.

- [ ] **Step 1: Tests** with the spec's values — `fourBackToBackMeetingsCostMoreThanSpread` (4×60 min no gap > same with
  15-min gaps); `ordinaryDayReadsRendben` (demand = median base → ratio 0.8 → `rendben`); `shortSleepLowersCapacity`
  (need 450, slept 360 → ×0.75); `missingHrvAddsNoFactor`; `thresholdsMapToWords` (0.59 laza, 0.6 rendben, 0.9 szoros,
  1.0 szoros, 1.01 túl sok); `learningUntilFourteenDaysAndFiveLabels`.
- [ ] **Step 2: Run** `-Dtest='DemandCalculatorTest,CapacityCalculatorTest,VerdictsTest,LearningStateTest'` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(capacity): pure load model (mezo-r36n9.17)`.

### Task 5: The capacity day (inputs through ports)

**Files:** create ports + adapters `CapacitySleepPort` (sleep_log, `SleepNeedRule`), `CapacityMetricsPort` (daily_metric
28-day baselines), `CapacityTrainPort` (planned + logged sessions, skips, recovery period), `CapacityMealPort` (fuel day
target vs logged), `CapacityCheckinPort` (check-ins, day closes); `service/CapacityDayService.java`. Test
`CapacityDayServiceIT`.

**Interfaces — Produces:** `CapacityDayService.day(UUID owner, LocalDate date): CapacityDay` with
`CapacityDay(LocalDate date, String verdict, double ratio, boolean tanulo, int fullDays, int labelledDays,
boolean calendarKnown, Demand demand, Capacity capacity, String reasonFacts /* top two drivers, rule-built */)`;
`CapacityDayService.week(UUID owner, LocalDate monday): List<CapacityDay>`. Base = 28-day median of day units on days
with close rating ≥ 4, else of all full days, else the configured default 6.0 units with `tanulo=true`.

- [ ] **Step 1: Tests** — `packedDayIsTulSok` (fixture: 6 h meetings incl. a 4-h block + leg session + 6 h sleep →
  `túl sok`); `noCalendarStillGivesVerdictAndSaysSo` (`calendarKnown=false`, verdict from body only);
  `recoveryPeriodFloorsCapacity`; `weekReturnsSevenDaysMondayFirst`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(capacity): day and week capacity from all signals (mezo-r36n9.17)`.

### Task 6: The brief's capacity block and the demand-bent curve

**Files:** modify `api/feature/boop/boop.yml` (`BoopBrief.capacity`, new `BoopCapacity`), `B/feature/boop/service/
{EnergyCurveModel,BoopBriefService,BoopPrompts}.java`, `B/feature/boop/mapper/BoopBriefMapper.java`; create `B/feature/boop/port/BoopCapacityPort.java`
+ `service/BoopCapacityAdapter.java` (in boop, reads `CapacityDayService` through the capacity feature's public service).
Tests `EnergyCurveModelTest`, `BoopBriefCapacityIT`.

**Interfaces — Produces:** `BoopCapacity {verdict enum [laza, rendben, szoros, tulSok], reason string, ratio number,
tanulo bool, labelledDays int, calendarKnown bool, demand: [{label, start, kind, level enum [kicsi, kozepes, nagy, tolt],
eventKey?}], factors: [{key, label, value, effect enum [jo, semleges, rossz]}]}` (nullable on the brief).
`EnergyCurveModel.hourly(Integer forma, LocalTime sessionTime, LocalTime lunch, double[] demandHourly19)`: each hour's
value × (1 − min(0.35, 0.08 × demand units in that hour and the hour before)); peak/dip **hours unchanged**. The brief
cache hash adds the capacity verdict + demand units. `BoopPrompts` gets the verdict + reason (no numbers invented); the
LLM may rephrase `reason`, falls back to the rule text.

- [ ] **Step 1: Tests** — `EnergyCurveModelTest.demandLowersHeightNotTiming` (argmax/argmin hour identical with and
  without demand; loaded hours strictly lower); `BoopBriefCapacityIT.briefCarriesCapacityBlock` and
  `briefWithoutCapacityStillServes` (capacity null when the feature is off).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; regenerate the iOS generated client (brief op already in the filter).
- [ ] **Step 4: Run** → PASS, plus `ArchitectureTest`.
- [ ] **Step 5: Commit** `feat(boop): capacity block on the brief, curve bends with demand (mezo-r36n9.17)`.

### Task 7: Ship K1

- [ ] Gates (Global Constraints) → rebase → local `--no-ff` merge → push → deploy green, pod tag = release → install on
  the phone (calendar fields) → prod check → docs: create `docs/features/capacity.md` (10-section format), update
  `docs/features/boop-ios.md` calendar paragraphs (fix the stale `:916,962,966,1200` lines), feature index row, handbook
  page state *Részben kész* → Notion sync → `_kiadasok.json` row.

**Kész, ha… (K1)**
- [ ] `calendar_event` rows in prod for today+8 carry attendee/location/notes fields (SELECT count, no content copied).
- [ ] `calendar_event_score` has rows for the today..today+8 events (scored in the background after a calendar PUT, never
  on the brief request); `source='llm'` for most; a forced quota error gives `rule`; all-day events are always `rule`.
- [ ] `GET /api/boop/brief` in prod returns `capacity` with a verdict and `tanulo=true`.
- [ ] Curve: peak/dip hours of today's brief equal the template's; values lower in the meeting block.
- [ ] Gates green; `docs/features/capacity.md` exists; lint-docs 0/0; codemap regenerated.

---

# Slice K2 — Reggel és az Évad: the morning sentence, the day page, the season chart, the AI

### Task 8: BoopCore capacity models and row builders

**Files:** create `I/BoopCore/Kapacitas/KapacitasLogic.swift`; tests `ios/BoopKit/Tests/BoopCoreTests/KapacitasLogicTests.swift`.

**Interfaces — Produces:** `func verdictLine(_ c: Components.Schemas.BoopCapacity) -> (word: String, reason: String,
learning: String?)` — words `Laza nap` / `Rendben lesz` / `Szoros, de belefér` / `Túl sok lenne`; learning
`"Még tanulom, mennyit bírsz: \(n) napnyi adatom van."` when `tanulo`; `func demandRows(_:) -> [NKAreaRowModel]`,
`func factorRows(_:) -> [NKAreaRowModel]` (labels/values verbatim from the server).

- [ ] **Step 1: Tests** `tulSokReadsTulSokLenne`, `learningLineShowsCount`, `noCalendarAddsNaptarNelkul` (reason gets
  " · naptár nélkül"). **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(boop-ios): capacity row builders (mezo-r36n9.17)`.

### Task 9: Ma briefing row, the day page blocks, event correction

**Files:** modify the Ma briefing row (`ios/Boop/Nap/MaPhases.swift` "A napod" fold + briefing row), `ios/Boop/Nap/DaySheet.swift`;
create `ios/Boop/Nap/DayCapacity.swift`; capacity op `PUT /api/capacity/events/{eventKey}/feedback` (body `{effect}`) in
`capacity.yml` + `CapacityController` + `EventFeedbackService`; create `I/BoopCore/Kapacitas/{KapacitasWire,KapacitasClient}.swift`.
Tests `CapacityFeedbackIT.feedbackRescoresEvent`, `KapacitasClientTests.feedbackSendsEffect`.

**Interfaces — Produces:** `KapacitasClient(raw: RawJSONClient)` with `func feedback(eventKey: String, effect: String) async throws`.
Day page order under the curve (spike 06): *Mennyit bírsz ma* (`NKLevelBar(level: ratio clamped 0…1.2 / 1.2, ticks
"szoros" at 0.9/1.2, "határ" at 1.0/1.2)` + one sentence), *Mi visz el ma energiát* (rows, tap → three-chip sheet
"Merít · Semleges · Feltölt"), *Amiből gazdálkodsz*, the learning `NKNote`, action *Mit tennél át?* (hidden until K3).

- [ ] **Step 1: Tests** (above) → **Step 2: Run** → FAIL → **Step 3: Implement** (feedback re-scores via Task 3 rules and
  invalidates the brief hash) → **Step 4: Run** → PASS; screenshots of the briefing row and the day page on your own
  simulator at 375 pt and 440 pt, reduced motion on.
- [ ] **Step 5: Commit** `feat(boop-ios): morning verdict and day-page capacity blocks (mezo-r36n9.17)`.

### Task 10: Season load (server)

**Files:** create `service/SeasonLoadModel.java` (pure), `port/CapacitySeasonPort.java` + adapter (reads the active season's
start, weeks, planned weekly sessions, deload week); op `GET /api/capacity/season` in `capacity.yml`. Tests
`SeasonLoadModelTest`, `CapacitySeasonIT`.

**Interfaces — Produces:** `SeasonLoad {weeks: [{week int, load number?, recovery number?, planned bool, over bool,
trainingOnly bool}], nowWeek int, stats: {overloadedDays4w int, moves int, movesGood int}, headline string?}`. Load =
weekly sum of day units; recovery = mean over the week of (sleep/need clamped 0.6…1.1) × (rhrBaseline/rhr clamped
0.85…1.1) × base × 7; acute = 7-day EWMA, chronic = 28-day EWMA; `over` when load > recovery; planned weeks beyond the
synced calendar: training units only, `trainingOnly=true`. Separate endpoint instead of the overview section so B6 S3's
files stay untouched (spec §5.10 deviation, intentional).

- [ ] **Step 1: Tests** `overWhenLoadExceedsRecovery`, `futureWeeksAreTrainingOnly`, `noSeasonIs404`. **Step 2–4.**
- [ ] **Step 5: Commit** `feat(capacity): season load vs recovery (mezo-r36n9.17)`.

### Task 11: Évad *Teher és pihenés* block

**Files:** create `I/BoopDesign/Napkelte/LoadCharts.swift` (`NKSeasonLoadChart(weeks:nowIndex:hue:)`, `NKWeekLoadStrip(days:lit:hue:)`
from the spike, kit-quality: VoiceOver label per bar "N. hét: több, mint amit pihentél"), `ios/Boop/Evad/EvadTeher.swift`;
modify `ios/Boop/Evad/EvadOverviewTab.swift` (block after *Hogy megy*); client op + `KapacitasStore.season`. Tests
`KapacitasClientTests.seasonDecodesTrainingOnly`.

- [ ] Steps: test → fail → implement (block hidden when 404; "trainingOnly" weeks faint with the footnote „A 7. hét után a
  terv, halványan.") → pass → screenshots → **Commit** `feat(boop-ios): Évad load and recovery block (mezo-r36n9.17)`.

### Task 12: Capacity in every AI context

**Files:** create `service/CapacityContextRenderer.java`, `feature/companion/port/CapacityContextPort.java` + adapter,
`feature/companion/tools/CapacityTools.java` (`get_capacity(week?)`); modify `ContextSnapshotAssembler.java` (one
`capacityLines(userId, today)` after `seasonLines`), `CompanionToolRegistry.java` (one line). Tests
`CapacityContextRendererTest`, `CapacityToolsIT`.

**Interfaces — Produces:** lines `[Kapacitás] ma: szoros (rövid éjszaka, 4 megbeszélés délelőtt) · tanuló` and, from K3,
`[Kapacitás] ezen a héten áttettük: lábnap cs → szo`; "" without data.

- [ ] Steps: tests (`rendersVerdictAndReason`, `emptyWithoutData`) → fail → implement → pass → **Commit**
  `feat(companion): capacity in the AI context and a get_capacity tool (mezo-r36n9.17)`.

### Task 13: Ship K2

- [ ] Ship steps as Task 7; handbook page *Részben kész* with the morning sentence + day page + Évad block.

**Kész, ha… (K2)**
- [ ] On the phone: the Ma briefing row shows the verdict + reason; the day page shows the three blocks + the learning
  note; an event's correction sticks after relaunch; the Évad tab shows *Teher és pihenés* (or nothing without a season).
- [ ] Empty / loading / error / offline: offline / no capacity → the Ma row and day page show exactly what they showed
  before K2, no crash; 375 pt and reduced motion checked by screenshot.
- [ ] Parity: every existing control and field of Ma, the day page and Évad still present.
- [ ] Chat answers "milyen napom lesz ma?" with the verdict (prod LLM log shows the `[Kapacitás]` line).
- [ ] Gates green; boop-ios.md + capacity.md updated.

---

# Slice K3 — Átrendezés: proposals, the ledger, the page, everywhere

### Task 14: The day-adjustment ledger

**Files:** create `service/DayAdjustmentService.java`; ops in `capacity.yml`: `DELETE /api/capacity/adjustments/{id}` (undo),
`GET /api/capacity/adjustments?from=&to=`. Tests `DayAdjustmentServiceIT`.

**Interfaces — Produces:** `DayAdjustmentService.applyBundle(UUID owner, UUID proposalId, UUID clientRef): List<DayAdjustmentView>`,
`undo(UUID owner, UUID adjustmentId)`, `activeFor(UUID owner, LocalDate date): List<DayAdjustmentView>`,
`activeForRange(UUID owner, LocalDate from, LocalDate to)`, `expireStale(UUID owner, LocalDate today)`.
Payloads: `MOVE_SESSION_DAY {templateSessionId, fromDate, toDate}`, `SHIFT_SESSION_TIME {date, time}`,
`SHORTEN_SESSION {date, minutes}`, `LIGHTEN_SESSION {date, setsFactor}`, `SWAP_SESSION_KIND {date, to: walk|mobility}`,
`SKIP_SESSION {date}` (delegates to the planned-skip path, reason `KAPACITAS`), `SHIFT_BEDTIME {night, bedtime}`,
`MOVE_MEAL_ENERGY {date, slotKcal: {slot: kcal}}` (day total unchanged, validated), `CALENDAR_TODO {eventKey, action:
move|cancel, toStart?, toEnd?}` (state `waiting`).

- [ ] **Step 1: Tests** — `moveOnlyToEmptyDaySameWeek` (target with a gym session → `CAPACITY_MOVE_NOT_EMPTY_DAY`;
  next week → `CAPACITY_MOVE_OTHER_WEEK`); `sundayLateLocalIsStillThisWeek` (zone Europe/Budapest, Sunday 23:30 local);
  `pastDayIsRefused` (`CAPACITY_DAY_STARTED`); `runningSessionIsNeverMoved` (409 `TRAIN_DAY_WORKOUT_RUNNING` surfaced);
  `targetDayGainedSessionExpiresMove` (`expireStale` → `expired`); `undoRestores` and `undoAfterDayStartRefused`;
  `mealSplitMustKeepDayTotal`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(capacity): day-adjustment ledger with week rules and undo (mezo-r36n9.17)`.

### Task 15: Every reader honours the ledger

**Files:** create `feature/train/port/TrainDayAdjustmentPort.java` + adapter; modify `WorkoutService.getToday`/
`findPlannedTemplateForDate` (`:187-229`), `WorkoutWindowQueryService.java:163`, `SessionTimingCalculator` (time shift),
`SessionExerciseAssembler` (shorten/lighten), done-this-week counting; `feature/meal/port/MealDayAdjustmentPort.java` +
adapter, `FuelDayService` (expected movement follows the session's effective date; meal-slot split), `DayPlanService`;
`BoopDayAssembler` (session + `day.bedtimeTarget` from `SHIFT_BEDTIME`); `feature/season/port/SeasonAdjustmentPort.java`
+ `AdherenceService` (a moved session counts once, on its new day). Tests `LedgerReadersIT` (one test per reader).

**Interfaces — Consumes:** `DayAdjustmentService.activeFor/activeForRange` (Task 14). **Produces:** `TrainDayAdjustmentPort.
effectiveSession(UUID owner, LocalDate date): Optional<EffectiveSession>`; `MealDayAdjustmentPort.slotSplit(owner, date)`.

- [ ] **Step 1: Tests** — `movedSessionAppearsOnNewDayNotOld` (train today for both dates), `movedSessionCountsOnceThisWeek`,
  `fuelExpectedExtraFollowsSession` (`pendingMovementKcal` on the new day, 0 on the old; target still unchanged until
  logged), `mealSplitShowsInDayPlan`, `briefBedtimeUsesNightOverride`, `adherenceCountsMovedSessionOnNewDay`,
  `undoneAdjustmentIsIgnoredEverywhere`.
- [ ] **Step 2: Run** `-Dtest=LedgerReadersIT -Dmezo.test.use-testcontainers=true` → FAIL. **Step 3: Implement** — decide
  here whether `workout_time_override` / `workout_day_adjustment` are read alongside or migrated (spec §10: fewer reader
  changes wins; the ledger is the list the UI shows either way). **Step 4: Run** → PASS + `ArchitectureTest`.
- [ ] **Step 5: Commit** `feat(train,meal,boop,season): readers honour the day-adjustment ledger (mezo-r36n9.17)`.

### Task 16: Proposal generator, cross-effects, wording

**Files:** create `service/ProposalGenerator.java` (pure), `service/CrossEffectCalculator.java`,
`service/ProposalWordingWriter.java`. Tests `ProposalGeneratorTest`, `CrossEffectCalculatorIT`, `ProposalWordingWriterTest`.

**Interfaces — Produces:** `ProposalGenerator.forWeek(WeekPicture w, List<Pattern> patterns, CapacityProperties p):
List<ProposalDraft>` with `WeekPicture(List<CapacityDay> days, List<PlannedSession> sessions, List<SportSlot> sport,
List<CalendarEventView> events, Set<LocalDate> startedDays, boolean recovery)`, `ProposalDraft(String kind,
List<AdjustmentDraft> bundle, Map<String,Object> facts, double relief)`; rules: only days ≥ `szoros`; `MOVE_SESSION_DAY` to the
lightest empty day of the same week with ≥ 1 rest day before a sport slot when possible and no same-region heavy session on
the adjacent day; `SHIFT_BEDTIME` + linked `SHIFT_SESSION_TIME` when an event ends after 21:00 and a session starts before
08:00 next day; `MOVE_MEAL_ENERGY` (+200/−200 kcal lunch/dinner) on a `túl sok` day with an afternoon block;
`CALENDAR_TODO` for a meeting ≤ 60 min immediately before a session; never add load in recovery; max 5, ranked by relief.
`CrossEffectCalculator.effects(UUID owner, ProposalDraft d): Effects` — per touched day: verdict before/after (load model),
expected kcal (fuel day service), bedtime + sleep need (`SleepNeedRule`), rest days before sport; week totals (sessions,
kcal, sleep h); season target date (unchanged). `ProposalWordingWriter.word(ProposalDraft, Effects): Wording(title,
move, effectLines[3..4], why[])` — LLM cheap tier rephrases the template text built from facts; on failure the template.

- [ ] **Step 1: Tests** — `packedThursdayProposesMoveToEmptySaturday` (spike week fixture → `MOVE_SESSION_DAY` cs → szo);
  `noProposalOnRendbenWeek`; `lateCallBundlesBedtimeAndMorningShift`; `recoveryNeverAddsLoad`; `atMostFive`;
  `crossEffectsComeFromEngines` (kcal lines equal the fuel day service values); `wordingFallsBackToTemplate`;
  `wordingNeverIntroducesNumbers` (every digit in the LLM text must appear in the facts, else template).
- [ ] **Step 2–4.** **Step 5: Commit** `feat(capacity): proposals with engine-computed cross-effects (mezo-r36n9.17)`.

### Task 17: Proposal API

**Files:** `capacity.yml` ops `GET /api/capacity/week?monday=` (`CapacityWeek {days: [...verdict, ratio, label], proposals:
[...], adjustments: [...], patterns: [...]}`), `POST /api/capacity/proposals/{id}/accept` (body `{clientRef}`),
`POST /api/capacity/proposals/{id}/decline`, `POST /api/capacity/proposals/regenerate?monday=`; `ProposalService`,
controller, mapper. Tests `CapacityApiIT`.

- [ ] **Step 1: Tests** — `weekListsProposalsWithEffects`, `acceptIsIdempotentByClientRef` (same clientRef twice → one
  bundle), `acceptStaleProposalIs409` (week changed since generation → `CAPACITY_PROPOSAL_STALE`), `declineSuppressesKindForTheDay`,
  `regenerateKeepsAccepted`. **Step 2–4.** **Step 5: Commit** `feat(capacity): week, accept, decline, regenerate API (mezo-r36n9.17)`.

### Task 18: Calendar to-dos watched in the sync

**Files:** modify `CalendarSnapshotService` to publish `CalendarDaysReplacedEvent(owner, dates)` (wearable-owned event);
create `service/CalendarTodoWatcher.java` (`@EventListener`). Tests `CalendarTodoWatcherIT`.

- [ ] **Step 1: Tests** — `movedEventMarksTodoDone` (event with the same `eventKey` now at the agreed time → `done`, day
  recomputed), `cancelledEventMarksDone`, `dayPassedExpiresTodo`. **Step 2–4.** **Step 5: Commit**
  `feat(capacity): calendar to-dos resolved by the sync (mezo-r36n9.17)`.

### Task 19: The Átrendezés page and Minden hatása

**Files:** create `ios/Boop/Kapacitas/{AtrendezesPage,ProposalCard,MindenHatasaPage,WeekStrip,KapacitasPreview}.swift`,
`I/BoopCore/Kapacitas/KapacitasStore.swift` (`ServerCache` key `kapacitas/week`); modify `I/BoopCore/Ritmus/Outbox.swift`
(`OutboxKind.dayAdjustment`, payload `{proposalId, clientRef}` → accept op), `Boop/RootView.swift` (store), day page
action *Mit tennél át?*, Évad *A jövő heted* row (`NKInfoRow("N javaslatom van rá · Átrendezés")`). Tests
`KapacitasStoreTests.{weekFallsBackToCache,outboxReplayDoesNotDoubleAccept,undoCallsDelete}`, `ProposalCardTests` (Boop
target: the calendar to-do button reads „Felírom teendőnek", a settled to-do says „Várom, hogy átkerüljön a naptáradban").

**Look:** spike screens 02–05 verbatim (copy, block order, `NKAreaSubPage` hue `.pulzus`, card layout, settled row with
„vissza"). Empty: „Ezen a héten nincs mit átrendezni." Offline: cached week with its age; accept queues; „minden hatása"
works from cache. `-previewKapacitas YES -kapOpen atrendezes|hatas` routes for simulator review.

- [ ] Steps: tests → fail → implement → pass → screenshots (375/440 pt, reduced motion, empty, offline) → **Commit**
  `feat(boop-ios): Átrendezés and Minden hatása pages (mezo-r36n9.17)`.

### Task 20: Wall source and the live loop

**Files:** create `I/BoopCore/Kapacitas/KapacitasWall.swift` (`kapacitasWallCandidates(week:now:) -> [WallCandidate]`),
modify `WallSources.swift` (`kapacitas`), `MaWall.swift` (+1 registration, hue `.pulzus`); backend
`service/LiveReplanListener.java` listening to `CheckInSavedEvent`, a meal-logged event (add one in `meal` if none exists), `SportSessionLoggedEvent`,
`WorkoutFinishedEvent`, `CalendarDaysReplacedEvent`, Health sync (`daily_metric` upsert event; add one if missing, in its
owning feature). Tests `KapacitasWallTests`, `LiveReplanListenerIT`.

**Interfaces:** candidate `id "kapacitas-het"`, `.improves`, rank 0.85, `kind .teendo`, text from the top proposal
(„A csütörtök túl sok lenne. Négy dolgot tennék át a héten."), opens Átrendezés; a today-proposal whose session starts
in < 3 h → `.expires` with `expiresAt` = session start. Live: recompute today; create a today-proposal only when the
verdict worsens by a step or a constraint breaks; at most one per `live.min-interval`.

- [ ] **Step 1: Tests** — `openProposalsGiveOneImprovesCard`, `todayProposalBeforeSessionExpires`, `noCardWithoutProposals`;
  `worseningByAStepCreatesTodayProposal`, `sameVerdictCreatesNothing`, `rateLimitedToOnePerThreeHours`. **Step 2–4.**
- [ ] **Step 5: Commit** `feat(capacity): wall card and live re-plan loop (mezo-r36n9.17)`.

### Task 21: Ship K3 (with the pre-merge cloud check)

- [ ] Self-PR + `gh workflow run premerge.yml -f pr=<n>`, read per-step outcomes, then the Task 7 ship steps.

**Kész, ha… (K3)**
- [ ] On the phone: the wall card opens Átrendezés; accepting a session move shows the session on the new day on Ma, the
  day page, Edzés (Napok + the player offers it there), Étel's expected extra, and Évad's *Hogy megy* counts it once;
  undo restores everywhere; a calendar to-do turns „kész" after moving the event in the iPhone calendar.
- [ ] The season plan, gym schedule, mesocycle and goal rows are unchanged after accept (prod SELECT before/after on
  `updated_at`).
- [ ] Empty / offline / error states as Task 19; 375 pt; reduced motion.
- [ ] Prod: `day_adjustment` and `capacity_proposal` rows appear for his accepts (counts only).
- [ ] Gates + premerge green.

---

# Slice K4 — Előrejelzés: outcomes, patterns, the Sunday preview, the season

### Task 22: Outcomes and patterns

**Files:** create `service/OutcomeJob.java` (nightly 03:30 owner zone: fills `capacity_proposal.outcome` for yesterday —
session done/short/skipped, verdict vs close rating, sleep that night; also logs undecided as `ignored`),
`service/CapacityPatterns.java` (pure); op adds `patterns` to `CapacityWeek`. iOS: *Korábban áttettük* + *Ebből tanulok*
on Átrendezés, *Amit a mozgatásokból tanultam* + *Mennyit bírsz az évadban* stats on Évad. Tests `CapacityPatternsTest`,
`OutcomeJobIT`, `KapacitasLogicTests.patternRowsShowEvidence`.

**Interfaces — Produces:** patterns `weekday-overload:<dow>`, `meetings-over:<hours>-skips-session`, `late-call-sleep-loss`,
`back-to-back-evening-energy`, `move-kind-works:<kind>`; shown only with `evidence ≥ 3` and `consistent ≥ 2`; each carries
`{evidence, consistent, text facts}`; the LLM may phrase, never create.

- [ ] **Step 1: Tests** `twoOfThreeConsistentShows`, `twoOccurrencesStayHidden`, `outcomeFilledFromLoggedSession`,
  `undecidedBecomesIgnored`. **Step 2–4.** **Step 5: Commit** `feat(capacity): outcomes and learned patterns (mezo-r36n9.17)`.

### Task 23: The Sunday preview and season proposals

**Files:** create `service/SundayPreviewJob.java` (`sunday.cron`, owner zone, generates next week's proposals so the wall
card appears Sunday evening / Monday morning); season proposals in `ProposalGenerator` (`SEASON_DELOAD_FORWARD` when 3
consecutive `over` weeks and a deload week ahead → an advisory card on Évad's Teher that only tells and offers
„Megbeszélem Boop-pal" (owner decision #121, 2026-11-27; the one-tap move is `mezo-r36n9.187`); **no write from
capacity**); new-season hints op `GET /api/capacity/season-hints` read by `EvadNewSeason.swift` beside the
weekday picker. Tests `SundayPreviewJobIT.sundayJobUsesOwnerZone`, `ProposalGeneratorTest.threeOverWeeksProposeDeloadForward`,
`SeasonHintsIT.hintsListWeekdayOverload`.

- [ ] Steps 1–4 → **Commit** `feat(capacity): Sunday preview, season proposals, new-season hints (mezo-r36n9.17)`.

### Task 24: Ship K4 and close B7

- [ ] Ship steps; final fresh-context review on the most capable model over the whole B7 diff; Critical/Important fixed
  with failing tests first; minors filed under the epic; `docs/features/capacity.md` complete, `boop-ios.md`, feature
  index, roadmap row + dated milestone, the boop skill §6 B7 row, handbook page *Élesben*; close `mezo-r36n9.17`.

**Kész, ha… (K4)**
- [ ] Sunday 18:00 (his zone) the wall shows next week's card when a day is `túl sok`; prod shows the job ran.
- [ ] Átrendezés shows *Korábban áttettük* with outcomes and *Ebből tanulok* only for patterns with ≥ 3 evidence.
- [ ] Évad shows the patterns and stats; a deload-forward card only tells (advisory, decision #121) and offers
  „Megbeszélem Boop-pal", writing nothing; Új évad shows the hints.
- [ ] Gates green; docs + Notion true; B7 closed.

---

## Execution notes

- Slices land in order. B6 S2 is merged, so nothing outside B7 blocks K2.
- Before K3 and K4: re-read this plan against what K1/K2 showed (real score spread, label counts) and adjust thresholds
  in config, not code; go back to the owner only if what he sees changes.
- Shared files (`api/openapi.yml`, `merge.yml`, `ResetDatabase`, `1.1.0_master.yml`, `MaWall.swift`, `WallSources.swift`,
  `ContextSnapshotAssembler`, `CompanionToolRegistry`, `AdherenceService`): check `bd list --parent mezo-r36n9 --status
  in_progress` Owns lists before each task; B6 S3/S4 may hold `AdherenceService`/`DayPlanService` — coordinate or wait.
- Own simulator per session (`Boop · mezo-r36n9.17`); phone install only by the shipping session.
