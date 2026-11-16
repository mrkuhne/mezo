# B5 Edzés — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The whole training domain as a native room on the Napkelte spine — four tabs, a set-by-set workout player, and a block builder — that keeps working in a gym with no signal and never hides how stale its numbers are.

**Architecture:** The backend already computes every prescription, the volume ramp, the reports and the skip policy, so the Swift side is a stepper UI, a rest timer, an outbox and a read cache. Writes ride B3's `Outbox` in a new per-workout ordering group; reads go through a new general last-known-good `ServerCache` that is a sibling of `Outbox`/`DayLedger`, never merged into either. The room is built on the **shared area-page kit** delivered by L0 (`NKAreaPage` + `NKAreaTabs`, and the blocks in `AreaBlocks.swift`), which already owns the level bar with landmarks, the stepped week, staleness, the searchable catalog, the two-column comparison and the sub-page frame; the player is a full-screen cover at page level, deliberately outside that system.

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
- **A ring-opened room has no navigation stack.** Everything the room presents — the player cover, every sheet — must work with `closeRoom` and no stack beneath it, and must be verified that way (`-previewHome edzes` opens the room straight from the ring; `-preview shell` goes through Ma).
- **The home's motion budget is the room's too** (kezdőlap spec §3, from a pass the owner rejected as stuttery): **no scaled blurred fog canvas, no stack of live shaders.** The room's moving parts are the head photo under its gradient, the kit's own lights, and the player's one orb — nothing else animates continuously, and every motion has a still branch under Reduce Motion.
- **The ring is the entrance**, and `Terv` in the bottom bar is **his plan**, not an area menu (decision #33). The Edzés room is reached from the ring orb, the `+` sheet and the Mozgás lens — **never** from a Terv grid.
- **The inner tab is called `Blokk`** (owner, 2026-11-16, relayed by the L0 session): the bottom bar's *Terv* is now his own plan, so an inner tab also called *Terv* would put two different Tervs one tap apart, and *Blokk* is what the thing is — the eight-week training block, his own word from the mesocycle work. The label still lives in **exactly one constant**, so a later rename stays a one-line change.
- **The room contributes to Ma, it does not write on it.** What Edzés has to say on the living wall is registered as one `WallSource` (L0/b); if the wall's engine or views have to be edited for it, it is being hard-coded and is wrong.
- Shared hot spots (`openapi-generator-config.yaml`, `api/openapi.yml`, `api/generate/merge.yml`, `1.1.0_master.yml`): one writer at a time; rebase on `origin/main` immediately before touching them.

## Working on top of the L0 kit — read this before Task 1

The shared area-page kit landed in L0 (`mezo-r36n9.37`) **after** this plan was written, and it covers seven things this plan would otherwise have built by hand. Re-read `ios/BoopKit/Sources/BoopDesign/Napkelte/Area.swift` + `AreaBlocks.swift` on `main` before Task 1; these facts are settled and must not be re-litigated or worked around:

- **The kit owns scroll position on tab change.** `NKAreaPage` returns to the tab row when the tab changes, and only when the page is below it. **Add none of your own.**
- **`.nkStale(NKStale(age:loud:))` is safe on any view** — loud sits above the block, not over it. For a single stale number prefer `NKStat(age:)`; for nothing-to-show use `NKStat(value: nil)` or `NKNoFreshData`, **never a 0**.
- **`NKRowState.normal/.done/.skipped/.future`** plus `chips: [String]` renders the week's three states at once (done carries a tick, skipped is drained with its reason in a chip, future is a dashed medallion). The skip reason goes in a chip, not in the sub.
- **`NKCurve` is standalone**, no `NKAreaPage` dependency → it belongs on the exercise sub-page (e1RM over time), not on a tab.
- **`NKAreaSubPage`** is the sanctioned frame for the exercise, the block report and the muscle map. Do not invent an inner page.
- **`NKSearchableRowList`** has two inits; use the block-owns-the-query one over the 166 local catalog rows (`nkRowMatches` folds accents with `hu_HU`). The caller-owns init is for debounced server search — not needed here.
- **The player stays outside the kit**: a page-level `fullScreenCover` with its own chrome. A cover whose binding is already true on first render does not fire — mount the destination first and animate on the next run-loop turn.

**One pre-existing red test:** `BoopTests/MealComposerTests.savingAConfirmationCardRemovesIt()` fails on `origin/main` as well (reported by the L0 session, filed as `mezo-r36n9.52`). **Verify that independently at Task 1** before accepting any red run as pre-existing — and never let it mask a failure of ours.

**The naming question is answered: `Blokk`.** The owner took it on 2026-11-16 (relayed by the L0 session, recorded in the decisions log). The approved spike and the spec said *Terv*; both were corrected in the same change as this plan, so nothing downstream still says *Terv* for the inner tab.

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
| `ios/BoopKit/Sources/BoopDesign/Napkelte/Train.swift` | the only genuinely new kit pieces, both player-only: `NKStepper`, `NKRestOrb`. **The volume bar, the stepped week, staleness, the searchable list, the comparison and the sub-page frame all come from the L0 kit — do not re-create them.** |
| `ios/Boop/Edzes/EdzesRoom.swift` | the room frame: `NKAreaPage` + its four inner tabs |
| `ios/Boop/Edzes/EdzesMa.swift` · `EdzesBlokk.swift` · `EdzesGyakorlatok.swift` · `EdzesElozmenyek.swift` | one file per tab |
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
- Produces: `TrainClient.init(client:)`; `func todayWorkout() async throws -> TodayWorkout`; `func history(from: Date, to: Date) async throws -> [WorkoutHistoryDay]`; `func blockPlan() async throws -> BlockPlan?` (**optional**: no running block is a real state the Blokk tab shows, not an error) and `func volumeArc(blockId:) async throws -> [MuscleVolume]`, which `blockPlan()` merges in for the week bars; `func catalog() async throws -> [CatalogExercise]`; `func records() async throws -> [ExerciseRecord]`; model types as listed in the File Structure.

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

**Decision this task settles:** `/api/train/*` has no `clientRef`. Use the **natural key** `(templateSessionId, the open instance)` for `startWorkout`. No contract change, no Liquibase.

> **Corrected while building (2026-11-16), after reading the contract rather than assuming it.** Two things in the
> paragraph this replaces were wrong, and both would have shipped a bug:
> 1. **A replayed start needs no 409 handling at all.** `POST /api/train/workouts` answers **201 with the open
>    instance** when one exists ("Start (or resume) … an open instance is returned, never duplicated"), so the
>    retry case is already idempotent on the template day.
> 2. **The 409 body carries no workout id** — it is a `SystemMessageList`, i.e. `[SystemMessage]` with a `code`.
>    So "treat the 409 as success and re-learn the id from its body" was not implementable. The two 409s
>    (`TRAIN_WORKOUT_OPEN_ELSEWHERE`, `TRAIN_DAY_DONE_THIS_WEEK`) are **refusals with a meaning**: another
>    session is open, or this day is already done this week. Neither can be fixed by sending again, so the item
>    `.failed`s with the server's own code and the room says what happened in his words.
>
> Consequence for Task 5 and Task 6: those two codes are states the player must be able to show.

**How a queued set finds its workout** (this replaces the payload relink): a queued write never names a server id — the workout may not exist yet when he logs the set in a basement. It names `workoutRef`, the **id of the outbox item that started the workout**, which is also its order group (`OutboxItem.groupRef`). `TrainClient` resolves that into the server's workout id at send time: what this run learned, else today's `openWorkout`, else today's `completedWorkout` (a note or a finish can arrive after the session closed). `nil` means the start has not landed, so the write answers `.retryLater` — it never invents an id and is never dropped. **No queued payload is ever rewritten**, so `RitmusEnvironment`'s `onSent` relink is not needed for training writes.

- [ ] **Step 1: Write the failing tests:**
  - `setsOfOneWorkoutKeepTheirOrder` — enqueue start, three sets and finish; assert `group(of:)` returns the same key for all five and `waits == true`, and that the sender sees them in enqueue order.
  - `twoWorkoutsOnOneDayAreSeparateGroups` — two different workout ids on the same date get different keys (today every group key is date-based; this is the first non-date group).
  - `startRetryDoesNotCreateASecondWorkout` — the stub answers `409 TRAIN_WORKOUT_OPEN_ELSEWHERE` carrying the open workout's id; assert the result is `.sent` and the learned id equals the one in the 409 body. *(Review Focus 4.)*
  - `aSetSurvivesAProcessRestart` — enqueue offline, drop the `Outbox` actor, re-create it over the same directory, assert the item is still pending with the same `id`. *(Review Focus 1.)*
  - `anItemOlderThanSevenDaysFailsVisibly` — with the clock advanced past `maxAgeDays`, assert the item moves to `failed` with a non-nil `failure`, so `RefusedRow` can show it, and is **not** removed. *(Review Focus 2.)*
- [ ] **Step 2: Run the kit tests; expect FAIL.**
- [ ] **Step 3: Add the `OutboxKind` cases** (append only) and extend `group(of:)` with the workout-id key.
- [ ] **Step 4: Implement `TrainPayloads` and the write half of `TrainClient`**, including the 409-means-learn-the-id branch and the `isNoConnection` mapping already used by `RitmusClient.map(_:)`.
- [ ] ~~**Step 5: Wire the relink** in `RitmusEnvironment`'s `onSent`~~ — **dropped**, see the note above: ids are resolved at send time, so nothing has to be rewritten. The branch in `RitmusClient.send` that routes the eight training kinds to `TrainClient` replaces it.
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
- Modify: **`ios/Boop/Nap/NapView.swift:58-66`** — the `drill:` closure is the one seam: it already reads `if hue == .fuel { EtelRoom() } else { MaDrill(…) }`, so Edzés is `hue == .mozgas → EdzesRoom()` beside it. Also `ios/Boop/Capture/CaptureSheet.swift:53` (the `.soon("Edzés indítása")` tile) and `ios/Boop/Nap/LensActionRow.swift:134` (the `.mozgas` lens action). **`MaiView.swift` and `MaDrill.swift` are not touched** — the earlier draft of this plan named them before the shell shipped.
- Add: the Mozgás mood photo to `BoopDesign/Resources/Photos.xcassets` + its row in `CREDITS.md`
- Test: `ios/BoopTests/EdzesMaTests.swift`

**Interfaces:**
- Consumes, from the L0 kit: `NKAreaPage(hue:name:eyebrow:level:display:headline:sentence:photo:tabs:selectedTab:actions:onBack:)` — **`level` is 0…1, not 0…100**, so pass `level: score.map { Double($0) / 100 }, display: score.map(String.init)`, and `level: nil` is the calm half-saturated learning orb; `NKAreaTab(_:badge:dot:)`, `NKHighlight(photo:actions:)` for today's session, `NKBare(label:hue:trailing:state:)` for per-block loading and `.failed(line, retry)`, `NKStatRow`, `NKRowList`, `NKMenuGrid`, `NKAskRow`. Plus `TrainClient`, `ServerCache`.
- Produces: `EdzesRoom(tab:)`; `@Observable final class EdzesStore` with `func load() async`, `var today: Cached<TodayWorkout>?`, `var ageText: String?`.
- **The way out:** copy the Étel room's seam verbatim — `@Environment(\.closeRoom) private var closeRoom` and `onBack: { if let closeRoom { closeRoom() } else { dismiss() } }`, plus `.toolbar(.hidden, for: .navigationBar)` and `RoomSwipeBack()`. A ring-opened room **is the page, with no navigation stack under it**, so a back button that pops a stack slides the room off sideways — the owner saw that and rejected it.

- [ ] **Step 1: Write the failing tests:**
  - `fourTabsInOrder` — `["Ma", "Blokk", "Gyakorlatok", "Előzmények"]`.
  - `emptyCacheOfflineSaysSoRatherThanRenderingZeroes` — with no cache and no network, `EdzesStore.today == nil` and the room's copy is the "nincs friss adat" line, not a session card with zeroes. *(Review Focus 3.)*
  - `staleCacheProducesALoudAgeString` — a two-day-old cached plan yields „2 napos terv".
  - `briefingLinesComeFromTheServerRationale` — not from a local template.
- [ ] **Step 2: Run the app tests; expect FAIL.**
- [ ] **Step 3: Implement `EdzesStore`, `EdzesRoom` and the Ma tab** to match `edzes-1-ma.png` and `edzes-2-ma-offline.png`.
- [ ] **Step 4: Replace the three "hamarosan" entry points** so the `+` sheet tile, the Mozgás lens menu and the Mozgás room's week/days sections open the room for real.
- [ ] **Step 5: Run the kit and app tests; expect PASS.**
- [ ] **Step 6: Verify in the simulator**, both with and without the network, against the two screenshots; check 320 pt width and reduced motion.
- [ ] **Step 7: Commit.**

### Task 6b: The Edzés area's voice on the living wall

The living wall (L0/b, `mezo-r36n9.45`) chooses what Boop says on Ma from what the **areas** register, and an
area joins by handing it one `WallSource` — the engine and the view never learn its name. Edzés is the first
area to join after Étel, and today it is represented only by a thin stand-in derived from the morning brief.

**Files:**
- Modify: `ios/BoopKit/Sources/BoopCore/Morning/WallSources.swift` — add `edzesWallCandidates(...)` and **move
  the `edzes-keszulj` block out of `briefWallCandidates`**. Two sources must not both offer a session card: the
  acted/dismissed set is keyed by candidate id, so a duplicate would reappear after he dismissed it.
- Modify: `ios/Boop/Nap/MaWall.swift:37-47` — one more `r.register(WallSource(id: WallSources.edzes) { … })`
  line, fed from the room's own store. Nothing else in the wall changes.
- Test: `ios/BoopKitTests/EdzesWallSourceTests.swift`

**Interfaces:**
- Consumes: `WallCandidate(id:role:kind:area:expiresAt:rank:text:sub:primary:secondary:settled:why:)`,
  `WallSources.edzes`, `WallRegistry.register(_:)`, `buildWall(_:now:…)`; and `EdzesStore` from Task 6.
- Produces: `edzesWallCandidates(today:now:calendar:)` — a pure function over the room's own session data.

- [ ] **Step 1: Write the failing tests:**
  - `plannedSessionImprovesTheDay` — a session planned for later today is one `.improves` candidate carrying its
    title, its length and the engine's own reason in *miért?* (never a locally written sentence).
  - `aSessionAboutToBeMissedExpires` — within the last hour of its window an unstarted session becomes
    `.expires` with that moment as `expiresAt`, so the wall drops it by itself once it is gone.
  - `aDoneSessionSaysNothingNew` — a finished session produces no `.improves` and no `.expires` candidate.
  - `theBriefNoLongerOffersASessionCard` — `briefWallCandidates` returns no `edzes-keszulj`, so the two sources
    cannot both put a session on the wall.
- [ ] **Step 2: Run the kit tests; expect FAIL.**
- [ ] **Step 3: Implement the source and register it**, with no change to `buildWall`, to `Wall.swift` or to the
      wall's views — if any of those three needs editing, the contribution is being hard-coded and is wrong.
      **Say so to the L0/b session rather than working around it:** that would mean the registry's shape is wrong.

**Two things the wall's own author flagged, both deliberate choices, not defaults to inherit:**
- **`rank` is the only thing that orders the `.improves` slot**, and it is ours to set. The brief's stand-in used
  `0.85` within three hours of the session and `0.4` beyond it. Pick our own numbers against what else competes
  for that slot — the food tip sits at `0.7` — and write the reason into the test, not just the number.
- **A session about to be missed is a real `.expires`, so it may also ring the phone** (`mayRing`, decision #35:
  only the first slot, at most twice a day, cap included in the rule and not a setting). It is the first ringing
  candidate besides the closing meal window, so on a busy day a training reminder and a meal window compete for
  the same two slots. Decide which wins and test that day, rather than discovering it on his phone.
- [ ] **Step 4: Run the kit and app tests; expect PASS.**
- [ ] **Step 5: Verify in the simulator** that Ma shows the session card with its *miért?*, that dismissing it
      keeps it dismissed for the day, and that `-previewWallEmpty YES` still reaches the quiet wall.
- [ ] **Step 6: Commit.**

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

## Stage 5 — Blokk and the block builder

### Task 9: The Blokk tab

**Files:**
- Create: `ios/Boop/Edzes/EdzesBlokk.swift` **only**. The volume bar is the kit's `NKLevelBar(level:hue:ticks:labelTicks:)` with `NKLevelTick(at:label:)` for MEV/MAV, and the eight weeks are `NKSteppedBars([NKStepBar(label:value:dimmed:note:)], current:)` — a deload week is a `dimmed` step carrying its reason as `note`. **No new kit pieces in this task.**
- Test: `ios/BoopTests/EdzesBlokkTests.swift` (the kit's own rendering is the kit's to test; these test **our mapping into it**)

- [ ] **Step 1: Write the failing tests** against the pure mapping functions, not against the kit's views:
  - `ticksSitAtTheirFractionOfMrv` — `volumeTicks(mev:mav:mrv:)` places MEV and MAV at `mev/mrv` and `mav/mrv`.
  - `volumeLevelClampsAboveMrv` — sets above MRV give `level == 1`, never a bar past its end.
  - `weekBarsMarkTheCurrentWeek` — `weekBars(_:)` returns `current` = the running week's index.
  - `deloadWeekIsDimmedWithItsReason` — the deload week is `dimmed` with a non-nil `note`, **present and shorter, never missing**.
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

This task also covers the other three entries of the Blokk tab's **Újat kezdenék** block, which the approved
screenshot shows: *Ez a blokk újra* (`rerunMesocycle`), *Saját edzés most* (`createCustomWorkout`, which the
once-per-week rule does not apply to) and *Elmentett terveim* (`listMesoTemplates` → `startMesoTemplate`).

- [ ] **Step 1: Write the failing tests:** `emphasisIsCappedAtTwo`; `weeksBelowFourAreRejected`; `generatedPlanIsNotPersistedUntilTheOwnerStartsIt` (the server persists nothing on `generateMesoPlan`; assert no create call is made before the final tap); `wizardIsRefusedOfflineWithAReason` (plan generation needs the server — it must say so, not half-work); `customWorkoutIsNotSubjectToTheOncePerWeekRule`; `rerunStartsAFreshRunOfTheSameTemplate`.
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement the four wizard steps plus the three other entries**, matching `edzes-14-varazslo.png` and the Blokk tab's section 5.
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

- [ ] The Edzés room opens from **the home ring's Edzés orb** (`-previewHome edzes`, no navigation stack, back fades the ring in), from the `+` sheet's „Edzés indítása” tile and from the Mozgás lens action, with the four tabs `Ma · Blokk · Gyakorlatok · Előzmények`, matching the approved screenshots.
- [ ] Ma: today's session with its photo, time and counts; **Az eligazítás** showing what the engine changed and why, in Boop's words; the readiness read; the week's five days; a proposal card with *miért?*; sport logging; kímélő.
- [ ] The player runs briefing → set → rest → debrief → close, with ± steppers for weight, reps and RIR, the engine's rationale, last week's reference and the durable note on the set screen, and a draining orb (no ring) on the rest screen.
- [ ] Mid-workout: swap an exercise (this session **or** the rest of the block) and skip an exercise.
- [ ] **With the network off**: the room opens, the session and its prescription are shown from the cache **with their age stated loudly**, every logged set is kept, the player completes, and the close screen says the sets will go up by themselves. With an empty cache it says it has nothing rather than showing zeroes.
- [ ] Ma (the living wall) carries the Edzés session card with its *miért?*, registered as an area source — `buildWall`, `Wall.swift` and the wall's views are untouched, and the brief no longer offers a second session card.
- [ ] Blokk: the running block with its eight weeks, per-muscle volume against MEV/MAV/MRV, priorities, the weekly clock, and the four-step block builder that starts a real block.
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
