# Boop B3 Napi ritmus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Boop's daily loop on the iPhone — an offline-first check-in with a frozen watch snapshot landing as a dot on the
energy-of-the-day curve, the goal of the day, a one-minute evening close producing one `day_close` record (voice journal
included), local check-in/close reminders, a Boop chat tab that already knows today, and a minimal Napló "Napok" list.

**Architecture:** Backend: extend `biometrics/checkin` (capturedAt, snapshot table, evening merge-write, biomarker port),
a new leaf feature `dayclose` (record + dual-write into intention / ritual / 20:00 check-in + journal link), idempotent
`clientRef` on intention focus and journal entries, `BoopDayContext` + two tools + a day-context endpoint in companion,
`session.done` in the boop brief. iOS: a persisted `Outbox` + per-date `DayLedger` in BoopCore that every capture writes
to first; screens in `ios/Boop/Ritmus/` built from the approved spike on B2's spine.

**Tech Stack:** Spring Boot / JPA / Liquibase / contract-first OpenAPI (`api/feature/*`), JUnit ITs with Testcontainers,
ArchUnit; SwiftUI (iOS 26 SDK), swift-openapi-generator client in BoopAPI, BoopCore with `StubTransport` tests,
HealthKit, EventKit (read-only), `UNUserNotificationCenter`, `SFSpeechRecognizer`, `NWPathMonitor`.

**Spec:** [`docs/superpowers/specs/2026-11-11-boop-b3-napi-ritmus-design.md`](../specs/2026-11-11-boop-b3-napi-ritmus-design.md)
(read it with this plan; § references below are to it). Approved look: `docs/design_2.0/prototypes/boop-ios-spike/BoopSpike/Ritmus*.swift`
+ `ritmus-*.png` — screens are built to match them.

**State at plan time (2026-11-12):** B1 (`mezo-r36n9.11`) and B2 (`mezo-r36n9.12`) are **on main** — `health_sample`,
`BoopAppDelegate`, `DayPhase`, `DayPlan.goals`, `MaPhases`, `CaptureSheet`, `BoopTabView`, `NaploView`, `SpineBar` exist.
The **paid Apple team is not active** (~2026-11-25, `mezo-r36n9.19`) → Task 16 (widget / answer-from-notification) is
behind the cut line and is filed, not built, unless the paid team is active when B3 reaches it.

## Global Constraints

- Napkelte look: painted sky per page, white type, serif questions/headlines, Outfit numbers, mono labels, glass cards, the orb as the answer. **No emoji; no SF Symbols except chevrons/arrows.** New glyphs (microphone, offline cloud) go into the Napkelte glyph set.
- One voice: **Boop**; never "Mezo" in any user-visible string. Copy is Hungarian; no streaks, no "missed" marks, no guilt copy.
- **Nothing changes without the owner's tap** — B3 adds no automatic change to plans.
- Server "today" = owner zone `mezo.wearable.zone` (`WearableProperties.zone()`); **never `LocalDate.now()`** in new code. Dates accepted: today … today − 7 in the owner zone; future → 400.
- Every B3 write is idempotent (natural key or `clientRef`); a retried request never duplicates.
- Captured-at, not received-at: `capturedAt` from the phone is the record's moment.
- Check-in slots: reggel → `06:30` (capture before 10:00), délben → `10:00` (10:00–14:30), délután → `14:00` (after 14:30). A Boop check-in never moves slot and never writes `20:00`; only the evening close merge-writes `20:00`.
- Free team: no APNs, no App Group, no new App ID/target; **no `Boop.xcodeproj` edit** (file-system synchronized groups). Never commit the team id.
- ArchUnit `feature_slices_are_cycle_free`: biometrics ↛ wearable, companion ↛ boop, `dayclose` reads others through their services and nothing in biometrics/intention/ritual/journal imports `dayclose`. Layer subpackages (`controller/service/repository/entity/mapper/config`); no class-level `@Transactional`/`@Value`.
- Liquibase: `backend/src/main/resources/db/changelog/1.1.0/script/{yyyyMMddHHmm}_mezo-r36n9.13_*.sql`, timestamps after B1's last changeset, named constraints, registered in `1.1.0_master.yml`; no bare `?` in jsonb SQL (use `jsonb_exists()`). New tables into `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`.
- Contract change ⇒ regenerate `frontend/src/api.gen.ts`, run `ios/scripts/sync-openapi.sh`, add the new operations to `ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml`, and run FE tests in both modes.
- Production DB: reads free; any write needs the owner's per-change OK. No real personal data in fixtures, docs, screenshots.
- Commits: `feat(boop|api|ios): … (mezo-r36n9.13)`, ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Commands used below**
- Backend focused: `cd backend && ./mvnw -q test -Dmezo.test.use-testcontainers=true -Dtest='<Classes>,ArchitectureTest'`
- BoopKit: `cd ios/BoopKit && xcodebuild test -scheme BoopKit-Package -destination 'id=<own simulator udid>' -skipPackagePluginValidation -derivedDataPath ../build/kit -only-testing:BoopCoreTests/<Class>`
- App: `cd ios && xcodebuild test -project Boop.xcodeproj -scheme Boop -destination 'id=<udid>' -skipPackagePluginValidation -derivedDataPath build/app`
- Always `export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`. Use this session's own simulator (`Boop · mezo-r36n9.13`).

## Review Focus

1. **An offline capture synced after midnight / days later** — a close or check-in for yesterday must be accepted for its own date and sit at its captured time (not 409, not "today"). Pinned in Task 2 (`savesYesterdayWithCapturedAt`) and Task 4 (`acceptsCloseForYesterdayAfterMidnight`).
2. **The same request sent twice (lost response, app killed mid-flush)** — no duplicate check-in, close, focus or journal entry; the concurrent unique-violation race returns the stored row. Pinned in Task 2, 3, 4 and the Outbox test in Task 6 (`retryAfterLostResponseSendsSameClientRef`).
3. **A day the owner already closed in the web app** — Boop shows it closed and re-closing never wipes the web's reflection text. Pinned in Task 4 (`webClosedDayFallsBackToLegacy`, `recloseKeepsWebReflectionText`).
4. **The question of the day is `pain` or `craving`, or no cached plan offline** — never crash, never silently drop answered items. Pinned in Task 6 (`questionOfDayKinds`) and Task 8 UI test.
5. **No watch data (watch off, HealthKit denied, Huawei rows without HR)** — the snapshot saves with nulls, the detail shows "—", the server fallback never throws. Pinned in Task 2 (`fallbackWithNoSamplesStoresNulls`) and Task 7 (`emptyHealthGivesNullSnapshot`).

---

### Task 1: Contract — all B3 API changes in one pass

**Files:**
- Modify: `api/feature/checkin/checkin.yml` (save request: optional `capturedAt` date-time, optional `snapshot` `CheckInSnapshot{hrBpm,hrAt,hrvMs,hrvAt,hrvUsualMs,steps,stepsIsDayTotal,sleepMinutes,source,computedBy}`; response: `snapshot` nullable)
- Modify: `api/feature/intention/intention.yml` (addFocus body: optional `clientRef` uuid)
- Modify: `api/feature/journal/journal.yml` (create body: optional `clientRef` uuid; `source` enum + `boop`)
- Create: `api/feature/dayclose/dayclose.yml` — `putDayClose` `PUT /api/day-close/{date}`, `getDayClose` `GET /api/day-close/{date}`, `listDayCloses` `GET /api/day-close?from&to`, `generateDayCloseLine` `POST /api/day-close/{date}/line`; schemas `DayCloseRequest{capturedAt,clientRef,eveningEnergy?,dayRating(1–5),goalText?,goalOutcome?(done|partial|no),planGoals[{id,title,result,met?}],journalClientRef?}`, `DayCloseResponse{date,closedAt,eveningEnergy,dayRating,goalText,goalOutcome,planGoals,journalText?,boopLine?,source(boop|web)}`, `DayCloseLineResponse{line}`
- Modify: `api/feature/companion/companion.yml` — createConversation body optional `channel` (`web|boop`); new `getDayContext` `GET /api/companion/day-context` → `DayContextResponse{chips[{key,label,value,sub?}],questions[string],generatedAt}`
- Modify: `api/feature/boop/boop.yml` — `BriefSession` + `done` boolean, `doneMinutes?`, `avgHr?`
- Modify: `api/openapi.yml`, `api/generate/merge.yml` (register dayclose)
- Regenerate: `frontend/src/api.gen.ts`; `ios/scripts/sync-openapi.sh`; add to `ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml`: `listCheckInsForDay, saveCheckIn, getCheckInPlan, getIntentionDay, addFocus, removeFocus, createJournalEntry, transcribeVoiceNote, putDayClose, getDayClose, listDayCloses, generateDayCloseLine, listConversations, createConversation, listMessages, sendMessage, getDayContext`

- [ ] **Step 1:** Write the contract changes above; every new field optional so the web client is unaffected.
- [ ] **Step 2:** Run the repo's contract merge/generation (see `docs/features/_platform-api-backend.md` §7) and `ios/scripts/sync-openapi.sh`. Expected: generated files change, no errors.
- [ ] **Step 3:** `cd frontend && CI=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build` — PASS (no FE source change).
- [ ] **Step 4:** Build BoopKit (Commands) — compiles with the new generated client.
- [ ] **Step 5:** Commit `feat(api): B3 contract — check-in capturedAt + snapshot, day-close, clientRef, day-context (mezo-r36n9.13)`.

### Task 2: Check-in — capturedAt, date window, snapshot table, evening merge, server fallback

**Files:**
- Create: `…/db/changelog/1.1.0/script/202611121000_mezo-r36n9.13_check_in_snapshot.sql` (table `check_in_snapshot`: `id`, `check_in_id` FK unique where live, `created_by`, `hr_bpm`, `hr_at`, `hrv_ms`, `hrv_at`, `hrv_usual_ms`, `steps`, `steps_is_day_total`, `sleep_minutes`, `source`, `computed_by` CHECK `phone|server`, timestamps, `is_deleted`)
- Create: `feature/biometrics/checkin/entity/CheckInSnapshotEntity.java`, `…/repository/CheckInSnapshotRepository.java`
- Create: `feature/biometrics/checkin/service/CheckInBiomarkerSource.java` (port) — `Optional<CheckInSnapshotValues> snapshotAt(UUID owner, Instant at)`
- Create: `feature/wearable/service/WearableCheckInBiomarkerSource.java` (implements the port: HR 5-min buckets ±15 min of `at`, latest `hrv_sdnn` ≤ 8 h, 14-day HRV median, `daily_metric` steps flagged day total, `sleep_log` minutes)
- Modify: `feature/wearable/repository/HealthSampleRepository.java` — `List<HealthSampleEntity> findWindow(UUID createdBy, String metric, Instant from, Instant to)` (live rows, ordered by `start_at`)
- Modify: `feature/biometrics/checkin/service/CheckInService.java` — `save` uses `capturedAt` (default now) for `saved_at`, validates date window in owner zone, writes snapshot (phone's, else port's with `computed_by=server`) in the same transaction, catches the unique-violation race and re-reads; new `CheckInResponse mergeEvening(UUID owner, LocalDate date, Integer energy, Integer dayRating10, Instant capturedAt)`
- Modify: `…/mapper/CheckInMapper.java`, `…/service/CheckInText.java` (one snapshot line: `pulzus 78, HRV 38 (szokott 50), 7 420 lépés`)
- Modify: `ResetDatabase.java`, `1.1.0_master.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/checkin/CheckInBoopIT.java`, `…/feature/wearable/WearableCheckInBiomarkerSourceIT.java`

**Interfaces:**
- Produces: `CheckInService.mergeEvening(...)` (Task 4); `CheckInSnapshotRepository.findByCheckInIdIn(Collection<UUID>)` (Task 11 day context); response `snapshot`.

- [ ] **Step 1: Failing tests** in `CheckInBoopIT`:
  - `savesYesterdayWithCapturedAt` — date = owner-today − 1, `capturedAt` 16:02 → 200, `saved_at` = 16:02 that day.
  - `rejectsFutureAndOlderThanSevenDays` — today + 1 → 400; today − 8 → 400.
  - `storesPhoneSnapshot` — request with snapshot → response `snapshot.computedBy = phone`, values round-trip.
  - `retryIsIdempotent` — same slot twice → one row, one live snapshot.
  - `mergeEveningKeepsOtherFields` — web 20:00 row with mood 6 → `mergeEvening(energy 7, rating 8)` → mood still 6, energy 7, day_rating 8; no row → minimal row created.
  - `checkInTextAddsSnapshotLine` — text contains `pulzus 78, HRV 38 (szokott 50)`.
  In `WearableCheckInBiomarkerSourceIT`: `averagesHrBucketsWithinFifteenMinutes`, `latestHrvWithinEightHours`, `fallbackWithNoSamplesStoresNulls` (empty → snapshot row with all nulls, `computed_by=server`, no exception).
- [ ] **Step 2:** Run (Commands, `-Dtest='CheckInBoopIT,WearableCheckInBiomarkerSourceIT,ArchitectureTest'`) — FAIL.
- [ ] **Step 3:** Implement the files above. Port lives in biometrics, implementation in wearable (wearable → biometrics is the existing direction).
- [ ] **Step 4:** Run again plus the existing `CheckInServiceIT,CheckInPlanApiIT,CheckInPlanServiceIT` — PASS.
- [ ] **Step 5:** Commit `feat(biometrics): check-in capturedAt, snapshot, evening merge (mezo-r36n9.13)`.

### Task 3: Idempotent clientRef on intention focus and journal entry; journal source `boop`

**Files:**
- Create: `…/script/202611121010_mezo-r36n9.13_client_refs.sql` (`intention_focus.client_ref uuid`, `journal_entry.client_ref uuid`, unique partial indexes `(created_by, client_ref) where client_ref is not null and is_deleted = false`; journal `source` CHECK + `boop`)
- Modify: `feature/intention/entity/IntentionFocusEntity.java`, `…/service/IntentionService.java` — `addFocus(UUID, LocalDate, String, UUID clientRef)`: existing live row with that ref → return it (no cap check)
- Modify: `feature/journal/entity/JournalEntryEntity.java`, `…/service/JournalService.java` — `create` returns the existing entry for a repeated `clientRef`; new `Optional<JournalEntryEntity> findByClientRef(UUID owner, UUID ref)`
- Test: `…/feature/intention/IntentionFocusClientRefIT.java`, `…/feature/journal/JournalClientRefIT.java`

- [ ] **Step 1: Failing tests** — `repeatedClientRefReturnsSameFocus` (two POSTs → one row, same id), `clientRefBypassesNothingElse` (a 4th focus without ref still 409 `INTENTION_FOCUS_CAP`), `repeatedJournalClientRefReturnsSameEntry`, `acceptsBoopSource`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run with existing intention/journal ITs + ArchitectureTest — PASS.
- [ ] **Step 5:** Commit `feat(intention,journal): idempotent clientRef, journal source boop (mezo-r36n9.13)`.

### Task 4: `dayclose` feature — record, dual-write, web fallback, Boop's line

**Files:**
- Create: `…/script/202611121020_mezo-r36n9.13_day_close.sql` (table per spec §7.4; unique `(created_by, close_date) where is_deleted = false`; `goal_outcome` CHECK `done|partial|no`; `day_rating` CHECK 1–5; `evening_energy` CHECK 1–10)
- Create: `feature/dayclose/{entity/DayCloseEntity, repository/DayCloseRepository, mapper/DayCloseMapper, controller/DayCloseController, config/DayCloseProperties, service/DayCloseService, service/DayCloseLineWriter, service/DayClosedEvent}.java`
- Modify: `feature/ritual/service/RitualService.java` — `RitualDayResponse closeOn(UUID userId, LocalDate date, Instant closedAt)` (no `LocalDate.now()`, no 409; does not touch `reflection_text`; fires `RitualClosedEvent`)
- Modify: `ResetDatabase.java`, `1.1.0_master.yml`
- Test: `…/feature/dayclose/DayCloseServiceIT.java`, `…/feature/dayclose/DayCloseApiIT.java`

**Interfaces:**
- Consumes: `CheckInService.mergeEvening` (Task 2), `IntentionService.reflect` + `getDay`, `RitualService.closeOn`, `JournalService.findByClientRef` (Task 3).
- Produces: `DayCloseService.put(UUID, LocalDate, DayCloseRequest)`, `get(UUID, LocalDate) → Optional<DayCloseResponse>`, `list(UUID, LocalDate from, LocalDate to)`; `DayClosedEvent(UUID owner, LocalDate date)`.

- [ ] **Step 1: Failing tests** (`DayCloseServiceIT`):
  - `closeWritesRecordAndLegacyStores` — rating 4, energy 7, outcome partial → `day_close` row; `daily_intention.reflection = partial`; `ritual_day.closed_at` set; 20:00 check-in energy 7, day_rating 8.
  - `acceptsCloseForYesterdayAfterMidnight` — owner clock 00:20, date = yesterday → 200 for yesterday.
  - `putIsIdempotent` — same body twice → one row; second PUT with `journalClientRef` links `journal_entry_id`.
  - `unknownJournalClientRefIsIgnoredUntilItArrives` — ref not yet posted → close saved, link null; later PUT links it.
  - `webClosedDayFallsBackToLegacy` — only `ritual_day.closed_at` + reflection text + 20:00 day_rating 8 → GET returns `source=web`, rating 4, journalText = reflection.
  - `recloseKeepsWebReflectionText` — then PUT from Boop → `ritual_day.reflection_text` unchanged.
  - `ritualReflectionTextNotWritten` — Boop close with a journal → `reflection_text` stays null.
  - `listReturnsRangeIncludingWebDays`.
  In `DayCloseApiIT`: `futureDateIs400`, `olderThanSevenDaysIs400`, `lineEndpointReturns503SafeWhenLlmDown` (`companion-fake` profile; line cached by input hash).
- [ ] **Step 2:** Run (`-Dtest='DayCloseServiceIT,DayCloseApiIT,ArchitectureTest'`) — FAIL.
- [ ] **Step 3:** Implement. The line writer uses the cheap tier, one Hungarian sentence citing the day (rating, goal, evening energy); prompt in `DayCloseLineWriter`.
- [ ] **Step 4:** Run plus existing ritual/intention ITs — PASS.
- [ ] **Step 5:** File the later cleanup issue (`bd create "Migrate evening readers to day_close, retire legacy writes" --parent mezo-r36n9`). Commit `feat(dayclose): one day-close record with legacy dual-write (mezo-r36n9.13)`.

### Task 5: Brief — `session.done`, today's foci in the prompt

**Files:**
- Modify: `feature/boop/service/BoopDayAssembler.java`, `BoopDay.java` — session `done/doneMinutes/avgHr` (done = train session finished today or sport logged, else a `wearable_workout` today overlapping planned window ±2 h with ≥ 20 min; minutes/avg HR from the matched wearable workout, HR null for rows without HR); input hash includes `done`
- Modify: `feature/boop/service/BoopPrompts.java` — today's foci next to the creed
- Modify: `ios/BoopKit/Sources/BoopCore/Morning/Brief.swift` (decode the three fields), `DayPlan.swift` — `goals` sets `met` for the session from `done`, result `"90 perc · pulzus átl. 128"` / `"90 perc"`; bedtime stays `nil`
- Test: `…/feature/boop/BoopSessionDoneIT.java`; `ios/BoopKit/Tests/BoopCoreTests/DayPlanGoalsTests.swift`

- [ ] **Step 1: Failing tests** — `finishedTrainSessionIsDone`, `overlappingWearableWorkoutIsDone`, `shortWorkoutIsNotDone` (19 min), `huaweiWorkoutWithoutHrGivesMinutesOnly`, `promptContainsTodaysFoci`; Swift `sessionMetFromDone`, `sessionResultWithoutHr`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run with existing boop ITs (`companion-fake`) + `MorningClientTests` — PASS.
- [ ] **Step 5:** Commit `feat(boop): brief session done signal, foci in prompt (mezo-r36n9.13)`.

### Task 6: BoopCore — Outbox, DayLedger, slot logic

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/Ritmus/Outbox.swift` — `public actor Outbox { init(directory: URL, sender: OutboxSender, clock: @Sendable () -> Date); func enqueue(_ item: OutboxItem) async; func flush() async; var pending: [OutboxItem] { get }; var failed: [OutboxItem] { get }; func retry(_ id: UUID) async }`; `OutboxItem { id: UUID (clientRef), kind: OutboxKind, date: String, capturedAt: Date, payload: Data, attempts: Int, nextAttempt: Date?, failure: String? }`; `OutboxKind = checkIn | checkInNote | goal | goalRemove | journal | voice | dayClose | chatQuestion`; `protocol OutboxSender: Sendable { func send(_ item: OutboxItem) async -> OutboxSendResult }`, `OutboxSendResult = sent(Data?) | retryLater | failed(String)`
- Create: `…/Ritmus/DayLedger.swift` — `public struct DayLedger: Codable, Equatable { date, checkIns: [LedgerCheckIn], goal: LedgerGoal?, close: LedgerClose?, journal: [LedgerJournal] }` with pending flags; `public final class LedgerStore` (`@Observable`, persisted per date, merges server rows by slot / clientRef — local pending wins until sent)
- Create: `…/Ritmus/CheckInSlot.swift` — `public enum CheckInMoment { reggel, delben, delutan }`, `static func moment(at: Date, calendar: Calendar) -> CheckInMoment` (< 10:00, 10:00–14:30, > 14:30), `var slotId: String` (`06:30`/`10:00`/`14:00`)
- Create: `…/Ritmus/CheckInQuestions.swift` — the five core + question of the day from a cached plan; `QuestionKind = scale | pain | craving`
- Test: `ios/BoopKit/Tests/BoopCoreTests/OutboxTests.swift`, `DayLedgerTests.swift`, `CheckInSlotTests.swift`, `CheckInQuestionsTests.swift`

- [ ] **Step 1: Failing tests:**
  - `OutboxTests`: `survivesRelaunch` (enqueue, new actor on same dir → pending 1), `flushSendsInOrder`, `retryAfterLostResponseSendsSameClientRef`, `fourHundredMarksFailedNotDropped`, `conflictAndRateLimitRetryWithBackoff` (409/429 → retryLater), `olderThanSevenDaysMarkedFailed`.
  - `DayLedgerTests`: `pendingLocalCheckInWinsOverServer`, `serverRowReplacesSentLocal`, `curvePointsSortedByCapturedAt`.
  - `CheckInSlotTests`: 09:59 → reggel/`06:30`, 10:00 → délben, 14:30 → délben, 14:31 → délután/`14:00`; no input yields `20:00`.
  - `CheckInQuestionsTests`: `coreFiveAlwaysFirst`, `noCachedPlanSkipsQuestionOfDay`, `questionOfDayKinds` (`pain` → pain kind, `craving` → craving kind, unknown key → skipped, never crash), `startsFromLastAnswerOfDayElseFive`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement (JSON files under Application Support/`boop-outbox/`; backoff 30 s × 2ⁿ capped at 30 min — builder's numbers). **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat(ios): outbox, day ledger, check-in slots (mezo-r36n9.13)`.

### Task 7: BoopCore — RitmusClient (sender), plan cache, snapshot builder

**Files:**
- Create: `…/Ritmus/RitmusClient.swift` — `public struct RitmusClient: OutboxSender` (maps each `OutboxKind` to its operation: saveCheckIn with `capturedAt`+`snapshot`, addFocus/removeFocus with `clientRef`, createJournalEntry `source=boop`, transcribeVoiceNote then createJournalEntry, putDayClose, sendMessage); `func fetchDay(_ date: String) async throws -> ServerDay` (check-ins, intention day, day close); `func fetchPlans(_ date: String) async throws -> [String: CheckInPlan]` (all three slots, cached by the ledger store); `func line(_ date: String) async throws -> String`
- Create: `…/Ritmus/SnapshotBuilder.swift` — `public struct SnapshotBuilder { init(reader: HealthReader); func snapshot(at: Date, calendar: Calendar) async -> CheckInSnapshotValue }` (HR mean last 15 min else latest within 60 min; HRV latest ≤ 8 h + 14-day median; steps today to now; sleep last night) — add any missing read to `HealthReader` (e.g. `func latestSample(_ metric: HealthMetric, since: Date) async throws -> HealthSampleValue?`, `func samples(_ metric:, from:, to:)`) with the `HealthKitReader` implementation
- Test: `RitmusClientTests.swift` (StubTransport), `SnapshotBuilderTests.swift` (fake `HealthReader`)

- [ ] **Step 1: Failing tests** — `checkInRequestCarriesCapturedAtSlotAndSnapshot`, `evening20NeverSentByCheckIn`, `focusCarriesClientRef`, `dayCloseThenJournalThenRelink` (sync order §7.4), `serverErrorMapsToRetryOrFailed`; `hrMeanOfLastFifteenMinutes`, `hrFallsBackToLatestWithinHour`, `hrvUsualIsFourteenDayMedian`, `emptyHealthGivesNullSnapshot`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat(ios): ritmus client, plan cache, watch snapshot (mezo-r36n9.13)`.

### Task 8: Check-in screen (full screen) + after-save payoff

**Files:**
- Create: `ios/Boop/Ritmus/CheckinView.swift` (from spike `RitmusCheckin.swift`: painted sky per hue, swipe on the orb 26 pt/step, soft haptic, *Kihagyom* / *Tovább*·*Kész*, progress dots, "Most csak ennyi" from item 2 → `quick_exit`, overwrite line "A délit már kitöltötted 12:40-kor — felülírod?", pain/craving variants)
- Create: `ios/Boop/Ritmus/CheckinDone.swift` ("MENTVE · HH:mm" / "Ráesett a görbére", curve card, detail, optional voice line → check-in `note`, Boop's line online / calm offline line, offline chip)
- Create: `ios/BoopKit/Sources/BoopDesign/Napkelte/Ritmus.swift` — `EnergyCurveCard` (dashed prediction + soft fill, solid owner line, numbered white dots, "most" line, dashed ring on pending dots, tap to select), `CheckInDetail` (3-column answers + "AZ ÓRÁD EKKOR", "—" for nulls, "lejjebb" when HRV < usual), `LevelRow`, `OfflineChip`, `VoiceRecorderRow`; glyphs `mic` + `offline` into the Napkelte glyph set (spike `RMicGlyph`/`ROfflineGlyph`)
- Test: `ios/BoopTests/CheckinFlowTests.swift` (view-model level), BoopDesign snapshot-free unit tests for the curve geometry (`EnergyCurveGeometryTests`)

- [ ] **Step 1: Failing tests** — `rushedCheckInSavesEnergyOnlyWithQuickExit` (energy, Tovább, Most csak ennyi → asked_items = shown, quick_exit), `unchangedItemNeedsNoSwipe`, `skippedItemNotSent`, `secondCheckInSameMomentAsksBeforeOverwrite`, `painQuestionShowsGateThenRegions`; geometry `dotsMapHoursSixToTwentyFour`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement to match the spike screenshots `ritmus-2*`, `ritmus-3*`. **Step 4:** Run — PASS; screenshot on own simulator vs `ritmus-2-kitoltes.png`, `ritmus-3-kitoltes-gorbe.png`.
- [ ] **Step 5:** Commit `feat(ios): check-in by swiping the orb, energy curve payoff (mezo-r36n9.13)`.

### Task 9: Ma — goal of the day (Reggel) + curve on Napközben + entry points

**Files:**
- Modify: `ios/Boop/Nap/MaPhases.swift` (Reggel plan card: "MI MA A LEGFONTOSABB?" block — field + mic + ≤ 3 chips with why, set goal row with star + "csere", collapsed "A nap terve elfogadva · HH:mm · a nap célja: …"; Napközben: `EnergyCurveCard` "AZ ENERGIÁD MA · n / 3 kitöltés" on top, past check-in rows select their dot, next one shows *Kitöltöm*; Este: closed card → summary)
- Create: `ios/BoopKit/Sources/BoopCore/Ritmus/GoalSuggestions.swift` — `static func suggest(brief: Brief, calendar: [CalendarEventLite], pastGoals: [(date: String, text: String)], today: String) -> [GoalSuggestion]` (longest/most-attended event today "a naptárból"; today's session; text seen on ≥ 2 past days and not in last 7 "N napja nem volt"; max 3; calendar titles stay on the phone)
- Modify: `ios/Boop/Capture/CaptureSheet.swift` (Check-in → CheckinView; Napló tile → evening voice / journal line), `ios/Boop/Shell/ShellView.swift` (full-screen covers for check-in and close at page level — `boop-ios.md` §9)
- Test: `GoalSuggestionsTests.swift`

- [ ] **Step 1: Failing tests** — `calendarEventSuggestedWithWhy`, `sessionSuggested`, `overdueRepeatedGoalSuggested`, `atMostThree`, `noSuggestionsWhenNothingKnown`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement; goal saves through the outbox (`goal` / `goalRemove`). **Step 4:** Run + app tests — PASS; screenshots vs `ritmus-1-reggel-cel.png`, `ritmus-4-napkozben-gorbe.png`. Count taps: chip + accept = 2.
- [ ] **Step 5:** Commit `feat(ios): goal of the day and energy curve on Ma (mezo-r36n9.13)`.

### Task 10: Este — the one-minute close + voice journal

**Files:**
- Create: `ios/Boop/Ritmus/EsteView.swift` (from spike `RitmusEste.swift`: four numbered steps, *Lezárom a napot* enabled after the rating, closed view with Boop's sentence, "A MAI NAPOD", bedtime line, offline variants)
- Create: `ios/BoopKit/Sources/BoopCore/Ritmus/VoiceJournal.swift` — `public final class VoiceJournal` (record m4a to the outbox dir; on-device `SFSpeechRecognizer(locale: hu-HU)` when `supportsOnDeviceRecognition`, else `voice` outbox item → transcribe online; deletes audio after a transcript)
- Test: `EsteFlowTests.swift`, `VoiceJournalTests.swift` (fake recognizer)

- [ ] **Step 1: Failing tests** — `closeDisabledUntilRating`, `closeSendsDayCloseThenJournalRelink`, `closeOfflineShowsSavedAndLaterLine`, `planGoalsCopiedWithMet`, `audioDeletedAfterTranscript`, `noOnDeviceFallsBackToUpload`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement to match `ritmus-5-este.png`, `ritmus-6-este-lezarva.png`. **Step 4:** Run — PASS; taps open + 3 + close = 5.
- [ ] **Step 5:** Commit `feat(ios): one-minute evening close with voice (mezo-r36n9.13)`.

### Task 11: Backend chat — BoopDayContext, tools, day-context endpoint, boop channel

**Files:**
- Create: `…/script/202611121030_mezo-r36n9.13_conversation_channel.sql` (`ai_conversation.channel varchar(8) default 'web'` CHECK `web|boop`)
- Create: `feature/companion/service/BoopDayContext.java` — `DayBlock assemble(UUID owner, LocalDate date)` from leaf services (sleep_log, wearable daily metrics + HRV, check-ins + snapshots, intention foci, train/sport session today+tomorrow, meals vs targets, calendar blocks times/durations only, bedtime target, weight goal); `String render(DayBlock)` < 1 200 tokens; `List<DayChip> chips(DayBlock)`; `List<String> questions(DayBlock)` (templates §7.6, max 3)
- Create: `feature/companion/tools/DayTools.java` — `get_wearable(scope=today|week)`, `get_calendar(scope=today)`
- Modify: `AiConversationEntity.java`, `ConversationService.java` (channel), `ChatService.java` / planner context — for `channel=boop` push the day block every turn and limit history to today's turns; `scope=today` uses the owner zone
- Modify: companion controller — `GET /api/companion/day-context`
- Test: `…/feature/companion/BoopDayContextIT.java`, `…/feature/companion/BoopChannelChatIT.java` (`companion-fake`)

- [ ] **Step 1: Failing tests** — `blockUnderTokenBudget`, `calendarTitlesNeverInBlock`, `chipsMatchBlock`, `lowHrvAsksWhyTired`, `sessionTodayAsksFoodAndFocus`, `maxThreeQuestions`; `boopChannelPushesDayBlockEveryTurn`, `boopChannelHistoryOnlyToday`, `webChannelUnchanged`, `ownerZoneDecidesToday`.
- [ ] **Step 2:** Run (`-Dtest='BoopDayContextIT,BoopChannelChatIT,ArchitectureTest'`) — FAIL (and ArchUnit: no boop import).
- [ ] **Step 3:** Implement; answer prompt rule: name the number and its source in one clause, Hungarian, Boop's voice.
- [ ] **Step 4:** Run + existing companion chat ITs — PASS.
- [ ] **Step 5:** Commit `feat(companion): chat that knows today for Boop (mezo-r36n9.13)`.

### Task 12: Boop tab — the chat screen

**Files:**
- Modify: `ios/Boop/BoopChat/BoopTabView.swift` (from spike `RitmusChat.swift`: painted head, "BOOP LÁTJA · MOST" chips from `getDayContext`, "MA KÉRDEZHETED", bubbles, composer with mic, offline queued line)
- Create: `ios/BoopKit/Sources/BoopCore/Ritmus/ChatStore.swift` — today's conversation (created lazily, `channel=boop`, title = date), non-stream `sendMessage`, offline question → `chatQuestion` outbox item, conversation created on flush
- Test: `ChatStoreTests.swift`

- [ ] **Step 1: Failing tests** — `firstQuestionCreatesTodaysBoopConversation`, `newDayStartsNewConversation`, `offlineQuestionQueuedThenSent`, `readyQuestionSendsItsText`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement to match `ritmus-7-boop.png`, `ritmus-8-boop-valasz.png`. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat(ios): Boop chat tab that knows today (mezo-r36n9.13)`.

### Task 13: Napló — minimal "Napok" (last 14 days)

**Files:**
- Modify: `ios/Boop/Naplo/NaploView.swift` — "Napok": 14 glass rows (date, rating word, goal + outcome, mini energy line with dots, first journal line; web-closed days shown the same); tap → the "A MAI NAPOD" summary + `EnergyCurveCard` for that day; "Minták" stays a placeholder
- Create: `ios/BoopKit/Sources/BoopCore/Ritmus/NaploDays.swift` — `static func rows(closes: [DayCloseLite], checkIns: [String: [LedgerCheckIn]], from: String, to: String) -> [NaploDayRow]` (days without anything are absent, no "missed" mark)
- Test: `NaploDaysTests.swift`

- [ ] **Step 1: Failing tests** — `fourteenDaysNewestFirst`, `emptyDayAbsentNotMissed`, `ratingWords` (1 Nehéz … 3 Rendben … 5 Remek), `webDayShown`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(ios): Napló days list (mezo-r36n9.13)`.

### Task 14: Reminders + notification deep links + flush triggers

**Files:**
- Create: `ios/Boop/Ritmus/RitmusReminders.swift` — reuses `ReminderCenter` from `BedtimeReminder.swift`: check-in reminders 07:30 / 12:30 / 16:00 only for undone moments, close at bedtime target − 75 min (fallback 21:30); rescheduled on every save and foreground; copy per spec §5.6; no badges
- Modify: `ios/Boop/App/BoopAppDelegate.swift` — set `UNUserNotificationCenter.current().delegate`; tap on a ritmus notification → `boop://checkin` / `boop://este`; `ios/Boop/BoopApp.swift` `.onOpenURL` opens the covers; outbox flush on foreground, `NWPathMonitor` satisfied, after each capture, and in `BackgroundSyncHost.syncIncremental()`
- Test: `RitmusRemindersTests.swift` (fake `ReminderCenter`)

- [ ] **Step 1: Failing tests** — `schedulesOnlyUndoneMoments`, `closeAtBedtimeMinus75`, `closeFallback2130WithoutBedtime`, `savingCancelsThatMomentsReminder`.
- [ ] **Step 2–4:** FAIL → implement → PASS; on the simulator, a test notification tap opens item 1.
- [ ] **Step 5:** Commit `feat(ios): check-in and close reminders with deep links (mezo-r36n9.13)`.

### Task 15: Ship — review, docs, merge, deploy, phone, live check

- [ ] **Step 1:** Final fresh-context review (most capable model) of the whole branch against the spec; fix Critical/Important with a failing test first; file minors under `mezo-r36n9`.
- [ ] **Step 2:** Docs: `docs/features/boop-ios.md` (B3 section, files, tests, known limits), `docs/features/README.md` row, new `docs/features/dayclose.md` (or the checkin/intention docs' B3 notes), `docs/milestones/roadmap.md` entry, boop skill §6 (B3 shipped). `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` → 0 errors / 0 stale.
- [ ] **Step 3:** Gates: backend focused ITs of Tasks 2–5, 11 + ArchitectureTest (or the full suite with Testcontainers); FE both modes + `pnpm build`; BoopKit + app tests.
- [ ] **Step 4:** `git fetch && git rebase origin/main` → detached `--no-ff` merge → `git push origin HEAD:main` → regenerate CODEMAP if needed → fast-forward primary `main` (skill §3). Watch `deploy` for that commit; pod tag = release version.
- [ ] **Step 5:** Prod check (reads only): the new tables exist (`day_close`, `check_in_snapshot`), after the owner's first real use the rows appear.
- [ ] **Step 6:** `bd list --parent mezo-r36n9 --status in_progress` → no other session installing → say so → `ios/scripts/install-on-phone.sh`; owner opens the app; verify check-in offline (airplane mode) → sync, close, chat.
- [ ] **Step 7:** Delete own simulator; `node scripts/check-beads-backup.mjs --fix`, commit, push; Hungarian report walking the *Kész, ha…* list.

---

## Cut line — B1 paid team dependent

### Task 16: Widget + answer-from-notification (only if `mezo-r36n9.19` paid team is active)

Medium/Smart Stack widget with App Intent buttons (2×5 grid, "Ennyi"), App Group + shared Keychain token, notification
extension with answer buttons (spike `RitmusLock.swift`). Needs a widget target and a notification-extension target →
`Boop.xcodeproj` edit (hot spot: announce, one writer). **If the paid team is not active when Task 15 starts:** file
`mezo-r36n9.13.1` "Boop B3 widget + answer from notification (paid team)" with this paragraph and the spike reference,
ship without it, and tell the owner.

---

## Kész, ha…

**Amit a tulaj lát (the owner sees)**
- [ ] Reggel: "Mi ma a legfontosabb?" with ≤ 3 suggestions, voice or typing; chip + *Elfogadom a napot* = 2 taps; matches `ritmus-1`.
- [ ] Check-in: five core items + question of the day, answered by swiping the orb, *Tovább*, "Most csak ennyi" from item 2; starts from the last answer; matches `ritmus-2`, `ritmus-2b`.
- [ ] After saving: the dot on the energy curve with "AZ ÓRÁD EKKOR" (pulse, HRV, steps, sleep; "—" when missing), optional sentence, Boop's line; matches `ritmus-3`.
- [ ] Ma · Napközben shows the energy curve with today's dots; matches `ritmus-4`.
- [ ] Este: four steps, *Lezárom* after the rating, voice "Mesélj", closed summary + bedtime line; 5 taps; matches `ritmus-5`, `ritmus-6`.
- [ ] Boop tab: "Boop látja" chips, 3 ready questions, answers that name today's data; matches `ritmus-7`, `ritmus-8`.
- [ ] Napló: the last 14 days list, tap opens the day.
- [ ] Reminders at 07:30 / 12:30 / 16:00 (only if not done) and the close at bedtime − 75 min; tapping opens the flow directly.
- [ ] **Airplane mode:** check-in, goal, close and voice save with the "Nincs net" chip and send themselves when the network returns; nothing lost.
- [ ] No emoji, no new SF Symbols, mic and offline glyphs from the Napkelte set; "Boop" everywhere, never "Mezo".
- [ ] Widget / answer-from-notification: built (paid team active) **or** filed as `mezo-r36n9.13.1` and the owner told.

**Parity**
- [ ] B2's Ma (hero, lens, proposals, Boop mondja, drill-downs), the S3 brief sheets, the bedtime reminder unchanged.
- [ ] Web app check-in, intention, journal, Napzárás work as before; a Boop-closed day shows closed on the web; web-closed days show closed in Boop.

**Gates**
- [ ] Backend focused ITs (Tasks 2, 3, 4, 5, 11) + `ArchitectureTest` green with Testcontainers.
- [ ] FE `CI=true` tests in both modes + `pnpm build` green (contract changed).
- [ ] BoopKit tests + app tests green on the own simulator.
- [ ] `node scripts/gen-codemap.mjs` committed; `node scripts/lint-docs.mjs` 0 errors / 0 stale.

**Docs**
- [ ] `docs/features/boop-ios.md`, feature index row, roadmap milestone, boop skill §6 updated; dayclose documented.

**Shipped**
- [ ] Merged to main, `deploy` green for that commit, pod tag = release version, `GET /api/day-close/{today}` answers on prod.
- [ ] Installed on the phone (no other session installing), check-in + close done once live; prod rows visible (read-only check).
- [ ] Cleanup issue for migrating evening readers filed; own simulator deleted; tracker backup refreshed and pushed.
