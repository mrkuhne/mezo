# B5 Edzés — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The whole training domain as a native room on the Napkelte spine — four tabs, a set-by-set workout player, and a block builder — that keeps working in a gym with no signal and never hides how stale its numbers are.

**Architecture:** The backend already computes every prescription, the volume ramp, the reports and the skip policy, so the Swift side is a stepper UI, a rest timer, an outbox and a read cache. Writes ride B3's `Outbox` in a new per-workout ordering group; reads go through a new general last-known-good `ServerCache` that is a sibling of `Outbox`/`DayLedger`, never merged into either. The room is `NKDrillPage` with `NKCapsuleTabs`; the player is a full-screen cover at page level.

**Tech Stack:** Swift 6, SwiftUI (iOS 26), swift-openapi-generator against `/api/train/*`, Swift Testing with `StubTransport`, Spring Boot + Liquibase for the one contract change.

**Spec:** [`docs/superpowers/specs/2026-11-13-boop-b5-edzes-design.md`](../specs/2026-11-13-boop-b5-edzes-design.md)

**Approved prototype (the build target):** `docs/design_2.0/prototypes/boop-ios-spike/edzes-1…17-*.png`, spike sources `BoopSpike/Edzes*.swift`, commit `a8339460b`.

## Global Constraints

- **Hungarian, Boop's voice, business language.** No emoji anywhere. No SF Symbols except chevrons and arrows.
- **Napkelte look**: dark glass, the hue's painted/photo sky, white type, serif headlines, Outfit numbers, mono labels. **No progress rings** — a circle is a real clock only.
- **Képek**: a photo in the sky, a photo on the card, nothing in between. Tone every photo `saturation(0.8) brightness(-0.06)`; gradient before any white type; every screen must be right with **no photo at all**. Only CC0 / public-domain photos ship (see `BoopSpike/Res/CREDITS.md`).
- **Nothing applies without the owner's tap.** Every proposal carries *miért?*.
- **Phone only.** No watchOS target, no `ActivityKit`, no per-set HR, no running. Do not touch `ios/Boop.xcodeproj`.
- **Offline**: every write goes through the `Outbox`; every read that a screen depends on goes through `ServerCache` and shows its age.
- `OutboxKind` raw values are persisted in `queue.json` — **never rename an existing case**.
- Dates: the phone's local day is the day; `capturedAt` carries the phone's local offset, **never `Z`**.
- Presentations sit at **page level** and the page reads the flag in its body; a cover whose binding is already true on first render does not fire.
- Every new operation must be answered in `ios/Boop/Connect/PreviewTransport.swift` — it **asserts** on an unanswered call, and the Mac's firewall means the simulator sees nothing else.
- Shared hot spots (`openapi-generator-config.yaml`, `api/openapi.yml`, `api/generate/merge.yml`, `1.1.0_master.yml`): one writer at a time; rebase on `origin/main` immediately before touching them.

## Review Focus

Five things the spec implies, no task's happy path exercises, and a person would feel:

1. **A set logged while offline, then the app is killed before the network returns.** The queue is on disk; the set must still be there and still go up. Test in Task 3.
2. **A workout logged offline on a trip longer than 7 days.** `Outbox.maxAgeDays = 7` fails it unsent and the server window is today−7…today+1 — it must surface as a visible refusal the owner can retry, never a silent drop. Test in Task 3.
3. **The cache is empty on the very first offline open** (new phone, or never fetched). The room must say it has nothing rather than render zeroes as if they were data. Test in Task 2 and Task 6.
4. **`startWorkout` succeeds on the server but the response never reaches the phone.** A retry must not create a second workout; the client must re-learn the server id instead. Test in Task 3.
5. **An exercise swapped for the rest of the block while offline.** The scope is a server-side plan edit — it must either queue in the right order behind the session or be refused with a reason, never silently apply locally and diverge. Test in Task 5.

## Open decision, carried from the spec §5.4 — do not decide it silently

**Workout reconciliation across the two wrists.** The owner wears an Apple Watch *and* a Huawei band. An
overlap check across sources returns **zero rows today**, so duplicates are not a live bug; the pattern
(Huawei workouts stop 2026-11-02, one Watch workout 2026-11-12) reads as a switch in progress. It was put to
him as a choice — pre-empt it now, or wait for the first collision and accept one messy day — and **he has
not answered**.

- If he says **pre-empt**: add a task after Task 7 that surfaces the server's existing `WorkoutReconciler`
  (overlap ≥ 50 %) in Előzmények, so a Health workout and a logged session that are the same session appear
  once, with the kept source named. Known limit to handle: cross-midnight double counting.
- If he says **wait**, or does not answer before Stage 6: ship without it and say so plainly in the report.

Either way **nothing in this plan assumes it**, and no task may quietly implement half of it.

---

## File Structure

| File | Responsibility |
|---|---|
| `ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml` | +20 train operationIds (append after B4's block) |
| `ios/BoopKit/Sources/BoopCore/Train/TrainClient.swift` | every `/api/train/*` call the room makes; maps responses to the models below |
| `ios/BoopKit/Sources/BoopCore/Train/TrainModels.swift` | `MesoTemplate`, `TodayWorkout`, `PlannedExercise`, `PrescribedSet`, `LoggedSet`, `SetKind`, `CatalogExercise`, `SwapScope`, `BlockPlan`, `MuscleVolume`, `BlockReport`, `GeneratedPlan`, `WorkoutHistoryDay`, `ExerciseRecord` (`KimeloPeriod` and `SkipReason` stay where B4 defined them and move with `RecoveryClient` in Task 11) |
| `ios/BoopKit/Sources/BoopCore/Train/WorkoutSession.swift` | the pure in-workout model (order, current set, logging, advance, skip, swap) |
| `ios/BoopKit/Sources/BoopCore/Train/TrainPayloads.swift` | outbox payloads for the new kinds |
| `ios/BoopKit/Sources/BoopCore/ServerCache.swift` | the general last-known-good read cache |
| `ios/BoopKit/Sources/BoopCore/RecoveryClient.swift` | lifted out of `Etel/FoodClient.swift` (recovery + kímélő), used by both rooms |
| `ios/BoopKit/Sources/BoopDesign/Napkelte/Train.swift` | new kit pieces: `NKStepper`, `NKRestOrb`, `NKVolumeBar`, `NKWeekDots` |
| `ios/Boop/Edzes/EdzesRoom.swift` | the room frame: `NKDrillPage` + the four capsule tabs |
| `ios/Boop/Edzes/EdzesMa.swift` · `EdzesTerv.swift` · `EdzesGyakorlatok.swift` · `EdzesElozmenyek.swift` | one file per tab |
| `ios/Boop/Edzes/WorkoutPlayer.swift` | the five player states |
| `ios/Boop/Edzes/EdzesSheets.swift` | swap, skip-with-reason, kímélő, exercise, block report, compare, muscle map, sport |
| `ios/Boop/Edzes/MesoWizard.swift` | the four-step block builder |
| `ios/Boop/Edzes/EdzesStore.swift` | the room's observable state; owns `TrainClient`, `ServerCache`, the outbox hand-off |

Tests mirror these under `ios/BoopKit/Tests/BoopCoreTests/`, `BoopDesignTests/` and `ios/BoopTests/`.

**Commands** (`export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` first):
- Kit: `cd ios/BoopKit && xcodebuild test -scheme BoopKit-Package -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -skipPackagePluginValidation -derivedDataPath ../build/kit`
- App: `cd ios && xcodebuild test -project Boop.xcodeproj -scheme Boop -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -skipPackagePluginValidation -derivedDataPath build/app`

---

## Stage 1 — Foundations (nothing the owner sees)

### Task 1: Train operations in the generated client, and the read side of `TrainClient`

**Files:**
- Modify: `ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml` (append after B4's block)
- Create: `ios/BoopKit/Sources/BoopCore/Train/TrainModels.swift`, `ios/BoopKit/Sources/BoopCore/Train/TrainClient.swift`
- Test: `ios/BoopKit/Tests/BoopCoreTests/TrainClientReadTests.swift`

**Interfaces:**
- Consumes: `makeClient(baseURL:tokens:transport:)` and `StubTransport` as `MorningClient`/`MorningClientTests` use them.
- Produces: `TrainClient.init(client:)`; `func todayWorkout() async throws -> TodayWorkout`; `func history(from: Date, to: Date) async throws -> [WorkoutHistoryDay]`; `func blockPlan() async throws -> BlockPlan`; `func catalog() async throws -> [CatalogExercise]`; `func records() async throws -> [ExerciseRecord]`; model types as listed in the File Structure.

Operations to append to the filter: `getTodayWorkout`, `startWorkout`, `logWorkoutSet`, `updateWorkoutSet`, `deleteWorkoutSet`, `saveWorkoutFeedback`, `skipWorkoutExercise`, `changeWorkoutExercise`, `addPlanWorkingSets`, `saveExerciseNote`, `saveWorkoutNote`, `finishWorkout`, `listWorkouts`, `getWorkoutDetail`, `getExerciseCatalog`, `getExerciseRecords`, `listMesocycles`, `getMesocycleReport`, `getMesocycleVolumeArc`, `generateMesoPlan`, `createMesoTemplate`, `startMesoTemplate`, `listMesoTemplates`, `getGymSchedule`, `getTodayReadiness`, `chooseTodayReadiness`, `listSportSessions`, `logSportSession`, `getSportSchedule`.

- [ ] **Step 1: Write the failing tests** in `TrainClientReadTests.swift`, with `StubTransport`:
  - `todayWorkoutMapsPrescribedSetsAndRationale` — stub `getTodayWorkout` with two exercises, the first carrying two warmups and three working sets and `progression.rationale`; assert `result.exercises[0].sets.filter { $0.kind == .warmup }.count == 2`, `result.exercises[0].sets.filter { $0.kind == .working }.count == 3`, and `result.exercises[0].rationale == "<the stubbed string>"`.
  - `todayWorkoutKeepsNilApartFromZero` — stub an exercise whose `anchorWeightKg` is absent; assert `result.exercises[0].sets[0].targetKg == nil` (**not** `0`).
  - `historyRangeIsPassedThrough` — assert the recorded request path carries the `from`/`to` the caller gave.
- [ ] **Step 2: Run the kit tests; expect FAIL** (`TrainClient` undefined).
- [ ] **Step 3: Append the operationIds** above to `filter.operations` in `openapi-generator-config.yaml`, keeping the existing order and B4's block untouched. Rebase on `origin/main` first.
- [ ] **Step 4: Run `ios/scripts/sync-openapi.sh --check`**; if it reports the committed `openapi.yaml` is stale, run it without `--check` and commit the result.
- [ ] **Step 5: Implement `TrainModels.swift` and the read half of `TrainClient.swift`.** Keep honest nulls — an absent server value stays `nil`, never `0`. Use `FlexibleISO8601Transcoder` via `makeClient`, never a bare decoder.
- [ ] **Step 6: Run the kit tests; expect PASS.** Also record the clean-build time before and after this task; if it has grown unreasonably, trim the operation list to what the room actually calls and note it here.
- [ ] **Step 7: Commit** (`feat(boop): train read client (mezo-r36n9.15)`).

### Task 2: `ServerCache` — the last-known-good read cache

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/ServerCache.swift`
- Test: `ios/BoopKit/Tests/BoopCoreTests/ServerCacheTests.swift`

**Interfaces:**
- Produces: `actor ServerCache` with
  `init(directory: URL, clock: @escaping @Sendable () -> Date = { Date() })`;
  `func put<T: Codable & Sendable>(_ value: T, endpoint: String, date: String) async throws`;
  `func get<T: Codable & Sendable>(_ type: T.Type, endpoint: String, date: String, maxAge: TimeInterval) async -> Cached<T>?`;
  `struct Cached<T: Sendable>: Sendable { public let value: T; public let fetchedAt: Date; public var age: TimeInterval }`;
  `func purge(olderThan: TimeInterval) async`.
  It is **read-only toward the server**: it has no sender, no retry and no link to `Outbox`.

- [ ] **Step 1: Write the failing tests:**
  - `roundTripsAValueWithItsFetchInstant` — `put` then `get` returns the value and a `fetchedAt` equal to the clock at `put`.
  - `returnsNilPastMaxAge` — with a clock advanced beyond `maxAge`, `get` returns `nil` (the caller renders „nincs friss adat", it does not get a stale value silently).
  - `returnsNilWhenNothingWasEverStored` — the first-run case; `get` on an empty directory returns `nil` and does not throw.
  - `keysByEndpointAndDate` — two `put`s with the same endpoint and different dates do not overwrite each other.
  - `survivesAProcessRestart` — a second `ServerCache` over the same directory reads what the first wrote.
  - `purgeDropsOldEntriesOnly`.
- [ ] **Step 2: Run the kit tests; expect FAIL.**
- [ ] **Step 3: Implement `ServerCache`** as one JSON file per `endpoint|date` key under `directory`, each wrapping `{fetchedAt, payload}`. Corrupt or undecodable files are treated as absent and removed, the way `Outbox` sets aside an undecodable element.
- [ ] **Step 4: Run the kit tests; expect PASS.**
- [ ] **Step 5: Wire the directory** into `RitmusEnvironment.directories(for:base:)` as a third folder (`cache`) beside `ledger` and `outbox`, so it is per-user.
- [ ] **Step 6: Run the kit and app tests; expect PASS.**
- [ ] **Step 7: Commit** (`feat(boop): last-known-good read cache (mezo-vxjj9, mezo-r36n9.15)`), and message the B4 session the API surface.

### Task 3: The write side — outbox kinds, ordering, and idempotent start

**Files:**
- Modify: `ios/BoopKit/Sources/BoopCore/Ritmus/Outbox.swift` (new `OutboxKind` cases and `group(of:)`)
- Create: `ios/BoopKit/Sources/BoopCore/Train/TrainPayloads.swift`
- Modify: `ios/BoopKit/Sources/BoopCore/Train/TrainClient.swift` (the write half + `OutboxSender` branch)
- Modify: `ios/Boop/Ritmus/RitmusEnvironment.swift:102` (the `onSent` hook: relink the server workout id)
- Test: `ios/BoopKit/Tests/BoopCoreTests/TrainOutboxTests.swift`

**Interfaces:**
- Consumes: `Outbox`, `OutboxItem` (its `id` **is** the `clientRef`), `OutboxSendResult`, the relink pattern at `RitmusEnvironment.swift:207`.
- Produces: new cases `workoutStart`, `workoutSet`, `workoutSetEdit`, `workoutSkipExercise`, `workoutFeedback`, `workoutNote`, `workoutFinish`, `sportSession` (appended — existing raw values untouched);
  `TrainClient.send(_ item: OutboxItem) async -> OutboxSendResult`;
  `func startWorkout(templateSessionId: UUID, clientRef: UUID) async throws -> UUID`.

**Decision this task settles:** `/api/train/*` has no `clientRef`. Use the **natural key** `(templateSessionId, local date)` for `startWorkout` — the server already refuses a second open workout with `409 TRAIN_WORKOUT_OPEN_ELSEWHERE` and a second completion of the same day with `409 TRAIN_DAY_DONE_THIS_WEEK`. Treat those 409s as *success, re-learn the id* (the `sendGoal` trick at `RitmusClient.swift:133`), not as failures. No contract change, no Liquibase.

- [ ] **Step 1: Write the failing tests:**
  - `setsOfOneWorkoutKeepTheirOrder` — enqueue start, three sets and finish; assert `group(of:)` returns the same key for all five and `waits == true`, and that the sender sees them in enqueue order.
  - `twoWorkoutsOnOneDayAreSeparateGroups` — two different workout ids on the same date get different keys (today every group key is date-based; this is the first non-date group).
  - `startRetryDoesNotCreateASecondWorkout` — the stub answers `409 TRAIN_WORKOUT_OPEN_ELSEWHERE` carrying the open workout's id; assert the result is `.sent` and the learned id equals the one in the 409 body. *(Review Focus 4.)*
  - `aSetSurvivesAProcessRestart` — enqueue offline, drop the `Outbox` actor, re-create it over the same directory, assert the item is still pending with the same `id`. *(Review Focus 1.)*
  - `anItemOlderThanSevenDaysFailsVisibly` — with the clock advanced past `maxAgeDays`, assert the item moves to `failed` with a non-nil `failure`, so `RefusedRow` can show it, and is **not** removed. *(Review Focus 2.)*
- [ ] **Step 2: Run the kit tests; expect FAIL.**
- [ ] **Step 3: Add the `OutboxKind` cases** (append only) and extend `group(of:)` with the workout-id key.
- [ ] **Step 4: Implement `TrainPayloads` and the write half of `TrainClient`**, including the 409-means-learn-the-id branch and the `isNoConnection` mapping already used by `RitmusClient.map(_:)`.
- [ ] **Step 5: Wire the relink** in `RitmusEnvironment`'s `onSent` so queued sets pick up the server workout id, mirroring B3's `relinkIfNeeded`.
- [ ] **Step 6: Run the kit and app tests; expect PASS.**
- [ ] **Step 7: Commit** (`feat(boop): offline workout writes (mezo-r36n9.15)`).

---

## Stage 2 — The player and the Ma tab (the first stage the owner can use)

### Task 4: `WorkoutSession` — the pure in-workout model

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/Train/WorkoutSession.swift`
- Test: `ios/BoopKit/Tests/BoopCoreTests/WorkoutSessionTests.swift`

**Interfaces:**
- Produces: `struct WorkoutSession: Codable, Sendable` with `init(today: TodayWorkout)`;
  `var currentExerciseId: UUID?`; `var currentSetIndex: Int`;
  `mutating func log(kg: Double, reps: Int, rir: Int) -> LoggedSet`;
  `mutating func advance() -> WorkoutStep` where `enum WorkoutStep { case set, rest(TimeInterval), debrief(UUID), finish }`;
  `mutating func skipExercise(_ id: UUID)`; `mutating func addSet(to id: UUID)`;
  `mutating func swap(_ id: UUID, for replacement: CatalogExercise, scope: SwapScope)`;
  `var isComplete: Bool`; `var loggedSets: [LoggedSet]`.
  **Keyed by exercise id, never by array position** — the web twin's bug (`workoutState.ts`) was that two places assumed linear order.

- [ ] **Step 1: Write the failing tests:**
  - `advancesThroughWarmupsThenWorkingSets`
  - `lastSetOfAnExerciseGoesToDebriefNotRest`
  - `debriefThenNextExerciseStartsWithRest`
  - `skippingTheCurrentExerciseMovesOn` and `skippingTheLastRemainingExerciseFinishes`
  - `restoresFromCodableMidSession` — encode after two logged sets, decode, assert `currentExerciseId` and `currentSetIndex` are unchanged (the player must survive a relaunch).
  - `swapKeepsTheRemainingSetCount`
- [ ] **Step 2: Run the kit tests; expect FAIL.**
- [ ] **Step 3: Implement `WorkoutSession`.**
- [ ] **Step 4: Run the kit tests; expect PASS.**
- [ ] **Step 5: Commit.**

### Task 5: The player UI

**Files:**
- Create: `ios/BoopKit/Sources/BoopDesign/Napkelte/Train.swift` (`NKStepper`, `NKRestOrb`), `ios/Boop/Edzes/WorkoutPlayer.swift`, `ios/Boop/Edzes/EdzesSheets.swift` (swap + skip only in this task)
- Test: `ios/BoopKit/Tests/BoopDesignTests/NapkelteTrainTests.swift`, `ios/BoopTests/WorkoutPlayerTests.swift`

**Interfaces:**
- Consumes: `WorkoutSession`, `TrainClient`, `ServerCache`, `NKFlowFrame`, `NKPhotoSky`, `NKCardPhoto`, `StillOrb`.
- Produces: `WorkoutPlayer(session:offlineAge:onToast:)` presented as a **full-screen cover at page level** from `ShellView`, following the B3 `RitmusRouter`/`RitmusCover` pattern; `NKStepper(label:value:unit:onDown:onUp:)`; `NKRestOrb(hue:remaining:total:)`.

- [ ] **Step 1: Write the failing tests:**
  - `NKStepper` renders at accessibility sizes without truncation (the `NapkelteRenderTests` pattern).
  - `restOrbLevelIsRemainingOverTotal` and `restOrbClampsAtZero`.
  - `playerShowsPrescriptionAgeWhenCacheIsStale` — with a cached-plan age of two days, the view model exposes a loud age string; with a fresh plan it exposes none.
  - `swapForTheWholeBlockWhileOfflineIsRefusedWithAReason` — the whole-block scope is a server-side plan edit; assert the view model returns a refusal naming the reason rather than applying locally. *(Review Focus 5.)*
- [ ] **Step 2: Run the tests; expect FAIL.**
- [ ] **Step 3: Implement the kit pieces, then the five player states** to match `edzes-6…10-*.png`: briefing, set, rest, debrief, close. Rest uses a draining orb and `Text(timerInterval:)`, **never a ring**.
- [ ] **Step 4: Answer every new operation in `PreviewTransport`.**
- [ ] **Step 5: Run the kit and app tests; expect PASS.**
- [ ] **Step 6: Verify in the simulator** against `edzes-6…10-*.png`: launch, open the player, log a set, let the rest timer run, reach the debrief, finish. Take screenshots. **One screenshot per shell invocation** — `simctl` reuses the previous launch's arguments otherwise, and every shot in a batch comes out identical.
- [ ] **Step 7: Commit.**

### Task 6: The room frame, the Ma tab, and the entry points

**Files:**
- Create: `ios/Boop/Edzes/EdzesRoom.swift`, `EdzesMa.swift`, `EdzesStore.swift`
- Modify: `ios/Boop/Nap/MaiView.swift` (the Mozgás destination), `ios/Boop/Capture/CaptureSheet.swift:37`, `ios/Boop/Nap/LensActionRow.swift:19`, `ios/Boop/Nap/MaDrill.swift:50,:150`
- Add: the Mozgás mood photo to `BoopDesign/Resources/Photos.xcassets` + its row in `CREDITS.md`
- Test: `ios/BoopTests/EdzesMaTests.swift`

**Interfaces:**
- Consumes: `NKDrillPage(…tabs:selectedTab:headPhoto:…)`, `NKCapsuleTabs`, `TrainClient`, `ServerCache`.
- Produces: `EdzesRoom(tab:)`; `@Observable final class EdzesStore` with `func load() async`, `var today: Cached<TodayWorkout>?`, `var ageText: String?`.

- [ ] **Step 1: Write the failing tests:**
  - `fourTabsInOrder` — `["Ma", "Terv", "Gyakorlatok", "Előzmények"]`.
  - `emptyCacheOfflineSaysSoRatherThanRenderingZeroes` — with no cache and no network, `EdzesStore.today == nil` and the room's copy is the "nincs friss adat" line, not a session card with zeroes. *(Review Focus 3.)*
  - `staleCacheProducesALoudAgeString` — a two-day-old cached plan yields „2 napos terv".
  - `briefingLinesComeFromTheServerRationale` — not from a local template.
- [ ] **Step 2: Run the app tests; expect FAIL.**
- [ ] **Step 3: Implement `EdzesStore`, `EdzesRoom` and the Ma tab** to match `edzes-1-ma.png` and `edzes-2-ma-offline.png`.
- [ ] **Step 4: Replace the three "hamarosan" entry points** so the `+` sheet tile, the Mozgás lens menu and the Mozgás room's week/days sections open the room for real.
- [ ] **Step 5: Run the kit and app tests; expect PASS.**
- [ ] **Step 6: Verify in the simulator**, both with and without the network, against the two screenshots; check 320 pt width and reduced motion.
- [ ] **Step 7: Commit.**

---

## Stage 3 — Előzmények

### Task 7: History, the four-week load, and the deeper reads

**Files:**
- Create: `ios/Boop/Edzes/EdzesElozmenyek.swift`; extend `EdzesSheets.swift` with the block report, compare and the muscle map
- Modify: `ios/BoopKit/Sources/BoopCore/Train/TrainClient.swift` (`getMesocycleReport`, `getMesocycleVolumeArc`, `listWorkouts`)
- Test: `ios/BoopKit/Tests/BoopCoreTests/TrainHistoryTests.swift`, `ios/BoopTests/EdzesElozmenyekTests.swift`

**Interfaces:**
- Produces: `func mesocycleReport(_ id: UUID) async throws -> BlockReport`; `func volumeArc(_ id: UUID) async throws -> [MuscleVolume]`; `EdzesElozmenyek(store:)`.

- [ ] **Step 1: Write the failing tests:** `skippedWeekIsLabelledNotCountedAsAGap` (a week whose sessions were excused renders the reason, not a silent dip); `reportKeepsTheServersAiEvaluationVerbatim`; `compareTwoBlocksMarksTheBetterSideOnlyWhenComparable` (a block in week 2 of 8 is **not** compared on totals).
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement**, matching `edzes-5-elozmenyek.png` and `edzes-15-jelentes.png`.
- [ ] **Step 4: Run both suites; expect PASS.**
- [ ] **Step 5: Verify in the simulator; commit.**

---

## Stage 4 — Gyakorlatok

### Task 8: The catalog, the records and an exercise page

**Files:**
- Create: `ios/Boop/Edzes/EdzesGyakorlatok.swift`; extend `EdzesSheets.swift` with the exercise page
- Test: `ios/BoopTests/EdzesGyakorlatokTests.swift`

- [ ] **Step 1: Write the failing tests:** `searchMatchesNameAndMuscleZone`; `emptySearchResultOffersAddingANewExercise`; `exerciseWithoutAPhotoKeepsItsGlyph` (Képek §3.3 rule 6); `durableNoteSurvivesAnEdit`.
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement**, matching `edzes-4-gyakorlatok.png` and `edzes-16-gyakorlat.png`. The 248 instructional exercise images are used **inside an exercise only, never as a head**.
- [ ] **Step 4: Run both suites; expect PASS.**
- [ ] **Step 5: Verify in the simulator; commit.**

---

## Stage 5 — Terv and the block builder

### Task 9: The Terv tab

**Files:**
- Create: `ios/Boop/Edzes/EdzesTerv.swift`; add `NKVolumeBar`, `NKWeekDots` to `BoopDesign/Napkelte/Train.swift`
- Test: `ios/BoopKit/Tests/BoopDesignTests/NapkelteTrainTests.swift`, `ios/BoopTests/EdzesTervTests.swift`

- [ ] **Step 1: Write the failing tests:** `volumeBarPlacesBothLandmarks` (MEV and MAV ticks at their fractions of MRV); `volumeBarClampsAboveMrv`; `weekRowMarksTheCurrentWeekAndItsPhase`; `deloadWeekIsShorterNotMissing`.
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement**, matching `edzes-3-terv.png`.
- [ ] **Step 4: Run both suites; expect PASS.**
- [ ] **Step 5: Verify in the simulator; commit.**

### Task 10: The block builder

**Files:**
- Create: `ios/Boop/Edzes/MesoWizard.swift`
- Modify: `TrainClient.swift` (`generateMesoPlan`, `createMesoTemplate`, `startMesoTemplate`)
- Test: `ios/BoopKit/Tests/BoopCoreTests/MesoPlanTests.swift`, `ios/BoopTests/MesoWizardTests.swift`

**Interfaces:**
- Produces: `func generatePlan(days: Int, weeks: Int, emphasis: [String]) async throws -> GeneratedPlan`; `func createAndStart(_ plan: GeneratedPlan, startDate: Date) async throws -> UUID`; `func rerun(_ mesocycleId: UUID, startDate: Date) async throws -> UUID`; `func templates() async throws -> [MesoTemplate]`; `func startCustomWorkout() async throws -> UUID`.

This task also covers the other three entries of the Terv tab's **Újat kezdenék** block, which the approved
screenshot shows: *Ez a blokk újra* (`rerunMesocycle`), *Saját edzés most* (`createCustomWorkout`, which the
once-per-week rule does not apply to) and *Elmentett terveim* (`listMesoTemplates` → `startMesoTemplate`).

- [ ] **Step 1: Write the failing tests:** `emphasisIsCappedAtTwo`; `weeksBelowFourAreRejected`; `generatedPlanIsNotPersistedUntilTheOwnerStartsIt` (the server persists nothing on `generateMesoPlan`; assert no create call is made before the final tap); `wizardIsRefusedOfflineWithAReason` (plan generation needs the server — it must say so, not half-work); `customWorkoutIsNotSubjectToTheOncePerWeekRule`; `rerunStartsAFreshRunOfTheSameTemplate`.
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement the four wizard steps plus the three other entries**, matching `edzes-14-varazslo.png` and the Terv tab's section 5.
- [ ] **Step 4: Run both suites; expect PASS.**
- [ ] **Step 5: Verify in the simulator; commit.**

---

## Stage 6 — Sport, kímélő, and shipping

### Task 11: Sport logging, skip with reason, kímélő — and the `RecoveryClient` lift

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/RecoveryClient.swift`
- Modify: `ios/BoopKit/Sources/BoopCore/Etel/FoodClient.swift` (remove `recovery`, `startKimelo` and its stop), `ios/Boop/Etel/EtelRoom.swift:389,:396,:397,:408` and the stop a few lines below (repoint to the new client, **same commit, no forwarders**)
- Extend: `EdzesSheets.swift` with sport, skip-with-reason and kímélő
- Test: `ios/BoopKit/Tests/BoopCoreTests/RecoveryClientTests.swift`, `ios/BoopTests/EdzesSkipTests.swift`

**Interfaces:**
- Produces: `RecoveryClient` with `func recovery() async throws -> KimeloPeriod?`, `func startKimelo(_ category: SkipReason) async throws`, `func stopKimelo() async throws` — signatures unchanged from `FoodClient`. **The "already running" guard moves into the client** (it throws a typed error); the Hungarian string „A kímélő mód már be van kapcsolva" stays in the room, because copy belongs where it is read. The B4 session drops its store-level check.

- [ ] **Step 1: Write the failing tests:** `startKimeloWhileOneIsRunningThrows` (the guard now lives in the client); `skipKeyIsIdenticalForSkipAndUndo` — build a GYM and a SPORT session key, call skip and undo, assert the two keys are **byte-identical**, and that the key is derived from the stable day+time+date triple, never from an index into a fetched list (saving a schedule re-inserts rows, so any held id is a liability); `skipOnAStaleScheduleIsRejected` (keep `FoodClient`'s `.rejected` behaviour).
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Lift `RecoveryClient`, repoint B4's four call sites in the same commit**, implement the three sheets to match `edzes-12-kihagyas.png`, `edzes-13-kimelo.png`, `edzes-17-sport.png`.
- [ ] **Step 4: Keep every lifted operation answered in `PreviewTransport`** — it asserts on an unanswered food operation and the simulator sees nothing else.
- [ ] **Step 5: Run the kit and app suites, including `EtelStoreTests` and `EtelSettingsTests`** (they cover the kímélő paths including a failed start); expect PASS.
- [ ] **Step 6: Verify in the simulator; commit**, and tell the B4 session the lift has landed.

### Task 12: Docs, gates and ship

**Files:**
- Modify: `docs/features/boop-ios.md` (the Edzés room; **and fix the stale §7**, which still names `LagyTabPage`/`LagyFlowFrame`), `docs/features/README.md` (§2–§3 row), `docs/milestones/roadmap.md` (dated entry + *Epics in flight*), `.claude/skills/boop/SKILL.md` §6 (the slice table), `docs/boop-handbook/` (a page per feature added or changed), `docs/boop-handbook/_jegyek.json`, `_kiadasok.json`, `_dontesek.json`, `docs/superpowers/research/boop-standalone/14-decisions.md` (**start at row 29** — the élet/ikon/Képek sessions and B4 all appended from 8 and collided)
- Modify: `mezo-r36n9.16` (B6's scope shrinks — its training half is built here)

- [ ] **Step 1: Run the full local gates:** kit tests, app tests, `node scripts/gen-codemap.mjs`, `node scripts/lint-docs.mjs` (0 errors / 0 stale).
- [ ] **Step 2: Walk the *Kész, ha…* list below and tick each item with its evidence.**
- [ ] **Step 3: Whole-branch review on the most capable model**; fix Critical/Important with failing tests first, file minors under the epic.
- [ ] **Step 4: Update the docs listed above.**
- [ ] **Step 5: Merge** — `git fetch && git rebase origin/main`, then from the worktree `git checkout --detach origin/main && git merge --no-ff feat/boop-b5-edzes && git push origin HEAD:main`; regenerate the codemap after the merge; fast-forward the primary checkout's `main`.
- [ ] **Step 6: `node scripts/check-beads-backup.mjs --fix`** and commit.
- [ ] **Step 7: Notion** — `node scripts/boop-notion-sync.mjs plan` → apply → `check` exits 0; commit `_notion-state.json`.
- [ ] **Step 8: Install on the phone** (`ios/scripts/install-on-phone.sh`) — say so in the shared notes first, since the install is exclusive — and check the room on the real device, including with the phone in airplane mode.
- [ ] **Step 9: Hungarian report to the owner**, walking the checklist in everyday words.

---

## *Kész, ha…* — the done checklist

**What the owner sees**

- [ ] The Edzés room opens from the Mozgás orb, the `+` sheet and the Mozgás lens menu, with the four tabs `Ma · Terv · Gyakorlatok · Előzmények`, matching the approved screenshots.
- [ ] Ma: today's session with its photo, time and counts; **Az eligazítás** showing what the engine changed and why, in Boop's words; the readiness read; the week's five days; a proposal card with *miért?*; sport logging; kímélő.
- [ ] The player runs briefing → set → rest → debrief → close, with ± steppers for weight, reps and RIR, the engine's rationale, last week's reference and the durable note on the set screen, and a draining orb (no ring) on the rest screen.
- [ ] Mid-workout: swap an exercise (this session **or** the rest of the block) and skip an exercise.
- [ ] **With the network off**: the room opens, the session and its prescription are shown from the cache **with their age stated loudly**, every logged set is kept, the player completes, and the close screen says the sets will go up by themselves. With an empty cache it says it has nothing rather than showing zeroes.
- [ ] Terv: the running block with its eight weeks, per-muscle volume against MEV/MAV/MRV, priorities, the weekly clock, and the four-step block builder that starts a real block.
- [ ] Gyakorlatok: search, the catalog with photos, records, an exercise page with your numbers and your note.
- [ ] Előzmények: sessions and sport newest first, the four-week load with the excused week explained, the block report with Boop's evaluation, comparing two blocks, the muscle map.
- [ ] Empty, loading, offline and error states everywhere; 320 pt width; reduced motion; no emoji; no photo on anything that is not a thing; the voice is Boop's.

**Parity**

- [ ] Every control, state and data field of the web surfaces listed in parent spec §3.1 "keep, native" is present or explicitly listed as not ported.
- [ ] No behaviour change outside this spec: the engine still decides load the same way, and pump / joint pain / workload still do not feed next week's prescription.

**Gates**

- [ ] Kit tests and app tests pass; every new kit component has a render test at accessibility sizes.
- [ ] `node scripts/gen-codemap.mjs` clean; `node scripts/lint-docs.mjs` 0 errors / 0 stale.
- [ ] `ios/scripts/sync-openapi.sh --check` clean; `git grep DEVELOPMENT_TEAM ios/` empty.
- [ ] Every new operation answered in `PreviewTransport`.

**Docs**

- [ ] `docs/features/boop-ios.md` updated **and its stale §7 fixed**; the feature-index row true; a dated milestone entry; the `boop` skill's §6 slice table moved; a handbook page per feature; Notion `check` exits 0.

**Shipped**

- [ ] Merged to main and pushed; the beads backup refreshed; installed on the phone and checked there, including in airplane mode.
