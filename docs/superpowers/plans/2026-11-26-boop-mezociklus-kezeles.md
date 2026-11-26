# Boop Mezociklus fül + kezelés — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, the munkamenet default) to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every mesocycle the owner made lives on the iPhone: the Mezociklus tab (current card + two tiles), the
Mezociklusaim page, a look-first detail page, restart / close / start / rerun / save-to-template, a graphic
zárójelentés, the builder's template mode, and „blokk” → „mezociklus” in every visible string.

**Architecture:** Two new atomic server endpoints in `MesoTemplateService` (restart, save-to-template) composed from
the existing `TrainService.closeMesocycle` + `stampRun` inside one transaction. On the phone, `PlanClient` gains the
lifecycle calls, a new `MezociklusokModel` (BoopCore, pure + testable) owns the list / actions / report, and new
SwiftUI files under `ios/Boop/Edzes/Mezociklus/` render it in the Napkelte kit, taking the accepted spike
(`spike/boop-mezociklus`, round 2) as the look. `BlockBuilderModel` gets a `Source` (`.running` / `.template(id)`).

**Tech Stack:** Spring Boot 4 / Java 25, OpenAPI-first contract (`api/feature/train/train.yml` → `api/openapi.yml`),
Liquibase untouched; SwiftUI iOS 26, Swift Testing, `RawJSONClient` lenient wire types.

**Spec:** `docs/superpowers/specs/2026-11-26-boop-mezociklus-kezeles-design.md` · bd `mezo-r36n9.177` (acceptance =
the *Kész, ha…* list there).

## Global Constraints

- Napkelte canon: dark glass, colour only in sky and orbs, shared kit (`NKBare`, `NKBlockTimeline`, `NKBodyMap`/
  `NKBodyHeat`, `NKLevelBar`, `NKStatRow`, `NKSheetFrame`); no emoji; never „Mezo” alone as a visible word.
- No page is a plain text-and-list page: each section leads with a graphic. Tapping anything startable opens its
  detail page; only the detail page's bottom bar starts it.
- Destructive / irreversible confirmations are attached to the screen (`confirmationDialog` / sheet), never to a list
  row or swipe.
- Restart is one server transaction: everything or nothing. The new run starts **today**, week 1, from the old run's
  **current** state (every phone edit), keeps the old run's `templateId` (a legacy run gets one materialized).
- Copy fixed by the spec: restart „Újrakezded ma az 1. héttől?”; template toggle „A sablont is frissítem”; save confirm
  „A „X” sablon a mostani állapottal íródik felül.”; close „Hogy sikerült? (nem kötelező)”; start-while-running
  „A most futó „X” lezárul.”; empty list „Még nincs mezociklusod — indíts egyet”.
- Missed-workout count is shown only when computed from logged data (client side); otherwise omitted.
- §9 bar: cached first, fresh behind; offline shows the last list with its age; Dynamic Type XXXL; VoiceOver labels on
  every new control; iPhone SE width; reduced motion (no carousel auto-scroll, no ring animation).
- Internal identifiers may keep `block`; only visible strings are renamed. Server-emitted texts are out of scope.

## Review Focus

1. **Restart failing mid-way** (season gate 409, or any later error) — the old run must still be active, not closed,
   no orphan new run. → Task 2 `MesocycleRestartGateIT`.
2. **Restart of a run that is not active** (archived, planned, foreign) — 409 / 404, nothing changes. → Task 2.
3. **Template edit of a template that a running run came from** — the running run must not change. → Task 2
   `saveToTemplate`/`update` IT + Task 6 test that template mode never calls a mesocycle write.
4. **Double tap on Újraindítás / Indítás** — one request in flight; the second tap is ignored. → Task 5 model test.
5. **Offline on the Mezociklusaim page** — the cached list with its age, actions disabled with a reason, no spinner
   forever. → Task 5 model test + Task 8 preview state `-previewMezo offline`.

---

### Task 1: Contract — restart and save-to-template

**Files:**
- Modify: `api/feature/train/train.yml` (paths after `/api/train/mesocycles/{id}/rerun`, schemas after
  `MesoRerunResponse`)
- Regenerate: `api/openapi.yml` (`cd api/generate && npm run generate:api`)
- Modify: `backend/.../feature/train/controller/TrainController.java` (two overrides next to `rerunMesocycle`)

**Interfaces — Produces:**
- `POST /api/train/mesocycles/{id}/restart`, operationId `restartMesocycle`, body `MesocycleRestartRequest`
  (optional; `updateTemplate: boolean`, default false) → 200 `MesocycleResponse` (the new run); 404 not found / not
  owned; 409 `TRAIN_MESO_NOT_ACTIVE` (not the active run) or `SEASON_REQUIRED`.
- `POST /api/train/mesocycles/{id}/save-to-template`, operationId `saveMesocycleToTemplate`, no body → 200
  `MesoRerunResponse` (`{templateId}`); 404; 409 `TRAIN_MESO_NOT_ACTIVE` when archived.
- Controller: `restartMesocycle(UUID id, MesocycleRestartRequest req)` →
  `mesoTemplateService.restart(currentUserId.get(), id, req != null && Boolean.TRUE.equals(req.getUpdateTemplate()))`;
  `saveMesocycleToTemplate(UUID id)` → `mesoTemplateService.saveToTemplate(currentUserId.get(), id)`.

- [ ] Add both paths (401/404/409 responses with `SystemMessageList`, same style as `rerun`) and
      `MesocycleRestartRequest`; reuse `MesoRerunResponse` for save-to-template.
- [ ] `cd api/generate && npm run generate:api`; `./mvnw -q -pl backend compile` (from repo root per `ios/README`/
      AGENTS build section) — Expected: compiles once Task 2's service methods exist (do Task 1+2 in one commit).

### Task 2: Server — `MesoTemplateService.restart` + `saveToTemplate`

**Files:**
- Modify: `backend/.../feature/train/service/MesoTemplateService.java`
- Modify: `backend/.../feature/train/service/TrainService.java` (`StampSource` gains `String weeklyReviewMode` as
  last component; `stampRun` sets it when non-null; `MesoTemplateService.start` passes null)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/MesoRestartIT.java` (HTTP, extends
  `ApiIntegrationTest`, gate off by the test profile)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/season/MesocycleRestartGateIT.java` (HTTP, extends
  `ApiIntegrationTest`, `@TestPropertySource(properties = "mezo.season.mesocycle-gate.enabled=true")`, NOT
  `@Transactional` — the rollback must be observable)

**Interfaces — Produces:**
- `@Transactional public MesocycleResponse restart(UUID createdBy, UUID mesocycleId, boolean updateTemplate)`
- `@Transactional public MesoRerunResponse saveToTemplate(UUID createdBy, UUID mesocycleId)`
- private `MesoTemplateEntity snapshotInto(MesoTemplateEntity target, MesocycleEntity run, UUID createdBy)` — copies
  title, shortTitle, goal, goalPreset, priorities, sportGroups, weeks, split, style, trainingStyle, techniquesEnabled,
  phaseCurve, notes, `days = daysOf(createdBy, run.getId())`; `rerun`'s legacy branch is refactored onto it.
- New error code constant `TRAIN_MESO_NOT_ACTIVE` (409).

Restart algorithm (order matters):
1. `mesocycleRepository.findLockedByIdAndCreatedByAndDeletedFalse(id, createdBy)` else 404; status ≠ `active` → 409.
2. `days = daysOf(...)` **before** closing (the run's current state).
3. Template: `run.templateId` → owned template (soft-deleted → treat as legacy); none → new template via
   `snapshotInto`, linked onto the run. `updateTemplate` → `snapshotInto(existing, run)` + save.
4. `trainService.closeMesocycle(createdBy, id, null)` (closedAt, frozen report, `MesocycleClosed` AFTER_COMMIT).
5. Year block: the block linked to the old run (`yearBlockRepository.findByCreatedByAndMesocycleIdAndDeletedFalse`,
   first) is passed as `yearBlockId`, else null.
6. `trainService.stampRun(createdBy, new StampSource(templateId, run fields…, startDate = today in TrainService.ZONE,
   status "active", mapper.toDayInputs(days), null, …, run.getWeeklyReviewMode()))`.
   Any exception → the whole transaction rolls back (step 4 included).

`saveToTemplate`: owned run (404), archived → 409; existing template → `snapshotInto` + save; none → create + link.
Idempotent (a second call overwrites with the same state).

- [ ] **Write failing ITs** in `MesoRestartIT`:
  - `testRestart_shouldCloseOldAndStartNewFromCurrentState_whenActive` — start a template run; `PUT` a day's exercises
    to a different list (via `/api/train/mesocycles/{id}/days/{dayId}/exercises`); restart → new run: `status ACTIVE`,
    `startDate == today`, `currentWeek == 1`, `templateId == old templateId`, day exercises == the edited list; old
    run: `ARCHIVED`, `closedAt != null`, `hasReport == true`; template days unchanged (still the original names).
  - `testRestart_shouldOverwriteTemplate_whenUpdateTemplateTrue` — same edit, `{updateTemplate:true}` → the template's
    days carry the edited names; `runCount == 2`.
  - `testRestart_shouldMaterializeTemplate_whenLegacyRun` — `trainPopulator.createMesocycle(owner, "Legacy", "active")`
    + a day + exercise → new run has non-null `templateId`, old run linked to the same id.
  - `testRestart_shouldReturn409_whenRunArchived` and `..._whenRunPlanned` — body code `TRAIN_MESO_NOT_ACTIVE`; list
    unchanged.
  - `testRestart_shouldReturn404_whenForeignOwner`.
  - `testRestart_shouldKeepWeeklyReviewMode` — set `weeklyReviewMode` via settings PUT, restart, new run carries it.
  - `testSaveToTemplate_shouldOverwriteTemplateWithRunState_andLeaveRunUntouched` — edit day → save → template days
    edited; run's `templateId` unchanged; a second call returns the same `templateId`.
  - `testSaveToTemplate_shouldCreateAndLink_whenLegacyRun`; `testSaveToTemplate_shouldReturn409_whenArchived`.
- [ ] **Write failing** `MesocycleRestartGateIT.restartWithoutSeasonRollsBackEverything` — owner with an active run
      (populator, no season) → restart 409 `SEASON_REQUIRED`; then via HTTP list: exactly one run, still `ACTIVE`,
      `closedAt == null`, `hasReport == false`; `select count(*) from meso_template where created_by = ?` unchanged.
- [ ] Run: `./mvnw -q -pl backend test -Dtest='MesoRestartIT,MesocycleRestartGateIT' -Dmezo.test.use-testcontainers=true`
      — Expected: FAIL (404 route / missing method).
- [ ] Implement per the algorithm above.
- [ ] Re-run the two ITs + `MesoTemplateIT,MesocycleGateIT,ArchitectureTest` — Expected: all green.
- [ ] `node scripts/gen-codemap.mjs`; commit `feat(api): mesocycle restart + save-to-template (mezo-r36n9.177)`.

### Task 3: Backend docs

**Files:** the train feature doc under `docs/features/` (find via `docs/features/README.md` index; the one covering
`train-sablonok-futamok`), its §API / §flows: the two endpoints, atomicity, legacy materialization.

- [ ] Update the doc; `node scripts/lint-docs.mjs` → 0 errors / 0 stale; commit with Task 2 or right after.

### Task 4: BoopCore — wire types + `PlanClient` lifecycle calls

**Files:**
- Modify: `ios/BoopKit/Sources/BoopCore/Train/PlanWire.swift` (`WireBlock` + new `WireReport`)
- Modify: `ios/BoopKit/Sources/BoopCore/Train/PlanClient.swift`
- Modify: `ios/BoopKit/Tests/BoopCoreTests/PlanFixtures.swift` (`reportJSON(aiStatus:)`, `templatesJSON()`,
  `blocksJSON` gains closed / planned variants with `closedAt`, `templateId`, `hasReport`, `endDate`, `split`)
- Test: `ios/BoopKit/Tests/BoopCoreTests/MezociklusClientTests.swift`

**Interfaces — Produces:**
- `WireBlock` optional: `endDate: String?`, `closedAt: String?`, `templateId: String?`, `hasReport: Bool?`,
  `split: String?`, `goal: String?`.
- `WireReport` (Decodable, lenient, all optional except `mesocycleId`): `title`, `startDate`, `endDate`, `weeks`,
  `selfEval`, `aiEval`, `aiEvalStatus` (`pending|ready|failed|…`), `aiEvalEnabled: Bool?`,
  `adherence: {plannedSessions, completedSessions, plannedWeeks, completedWeeks, completionPct}`,
  `volume.muscles[].weeks[]: {week, planned, actual}`, `strength[]: {exerciseName, firstTopKg, lastTopKg,
  firstTopReps, lastTopReps}`, `records.highlights[]: {exerciseName, kind}` (match the contract names).
- `PlanClient`:
  - `allBlocks() -> [WireBlock]` (`listMesocycles`)
  - `templates() -> [WireTemplate]` (`listMesoTemplates`) — `WireTemplate` gains `id`, `runCount`, `weeks`,
    `phaseCurve`, `split` accessors over its json.
  - `activate(id:) -> WireBlock` (`activateMesocycle`)
  - `closeBlock(id:selfEval:) -> WireBlock` (replaces the caller-less `closeBlock(id:)`; body omitted when nil)
  - `rerun(id:) -> String` (`rerunMesocycle`, returns templateId)
  - `restart(id:updateTemplate:) -> WireBlock` (`restartMesocycle`)
  - `saveToTemplate(id:) -> String` (`saveMesocycleToTemplate`)
  - `report(id:) -> WireReport` (`getMesocycleReport`)
  - `updateTemplate(id:_ template: WireTemplate) -> WireTemplate` (`updateMesoTemplate`, PUT)

- [ ] Tests (StubTransport, as in `PlanClientTests`): each call hits the right path/method/operationId;
      `closeBlock(id:selfEval:"jó volt")` sends `{"selfEval":"jó volt"}`; `restart(updateTemplate:true)` sends
      `{"updateTemplate":true}`; a 409 `SEASON_REQUIRED` maps to `.conflict("SEASON_REQUIRED")`; `WireReport` decodes
      the fixture with `aiEvalStatus == "pending"` and a missing `volume`.
- [ ] Run `cd ios/BoopKit && swift test --filter MezociklusClientTests` — FAIL, implement, PASS. Commit.

### Task 5: BoopCore — `MezociklusokModel` (list, actions, card data, report)

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/Train/Mezociklusok.swift`
- Test: `ios/BoopKit/Tests/BoopCoreTests/MezociklusokModelTests.swift`

**Interfaces — Produces:**
- `public struct MezoCard: Identifiable, Equatable` — `id`, `kind: Kind (.running, .planned, .closed, .template)`,
  `title`, `dateText` (Hungarian: „okt. 13-tól”, „júl. 7. – aug. 17.”, planned „jan. 5-től”), `split`, `weeks`,
  `currentWeek`, `loads: [Double]` (phaseCurve MEV 0.45 · MAV 0.72 · MRV 1.0 · Deload 0.3), `phases: [String]`
  (Alap/Építés/Csúcs/Pihenőhét), `heat: [String: Double]` (Σ working sets per muscle over all days, ÷ max),
  `runCount`, `hasReport`, `adherence: Double?` (from the loaded report), `templateId`, `blockId`, `days:
  [MezoDayPeek]` (`name`, `focus`, `exerciseCount`).
- `public func mezoCards(blocks: [WireBlock], templates: [WireTemplate], today: Date) -> MezoGroups` (pure) —
  `running: MezoCard?`, `upcoming` (planned, start asc), `closed` (archived, closedAt ?? endDate desc), `templates`
  (as listed).
- `@Observable @MainActor public final class MezociklusokModel`:
  - `init(client: PlanClient, cache: ServerCache?, clock: @escaping () -> Date = Date.init)`
  - `phase: .loading | .ready | .failed(PlanFetchError)`, `groups: MezoGroups`, `ageText: String?` (cached answer's
    age), `busy: Bool`, `lastError: String?` (Hungarian, from `PlanKit`'s message map incl. `SEASON_REQUIRED`)
  - `load(force:)` — cache (`ServerCache` key `train/mezociklusok`) shown first, then server; offline keeps cache.
    After the list, loads reports for the newest ≤ 8 closed cards with `hasReport` concurrently, fills `adherence`.
  - `start(template:) async -> WireBlock?` → `startTemplate(id, today, "active")`
  - `activate(planned:) async -> WireBlock?`
  - `rerun(closed:) async -> WireBlock?` → `rerun` then `startTemplate(templateId, today, "active")`
  - `restart(running:updateTemplate:) async -> WireBlock?`
  - `saveToTemplate(running:) async -> Bool`
  - `close(running:selfEval:) async -> WireBlock?`
  - every action: no-op returning nil/false while `busy`; on success `load(force: true)`.
  - `restartStats(running:) -> (week: Int, of: Int, done: Int?)` — `done` only when the block's days carry logged
    instances the client can count; else nil (spec: omit rather than guess).
- `@Observable @MainActor public final class MezoReportModel` — `load(blockId:)`, `report: WireReport?`, polls every
  10 s while `aiEvalStatus == "pending"`, `stop()` cancels; `aiState: .pending | .ready(String) | .off | .failed`.

- [ ] Tests: `groupsRunningPlannedClosedTemplates` (fixture with 1 active, 1 planned, 2 archived out of order, 2
      templates → order and kinds); `heatNormalizesToMax`; `curveMapsPhases`; `dateTextHungarian`
      (`2026-07-07…2026-08-17` → „júl. 7. – aug. 17.”); `restartIgnoresSecondTapWhileBusy` (stub delays, two calls →
      one `restartMesocycle` sent); `rerunStartsTodayAsActive` (body `startDate` = clock's day, `status` `active`);
      `offlineShowsCacheWithAge` (cache put 2 days ago, transport offline → `phase .ready`, `ageText` non-nil);
      `seasonRequiredSaysItInWords` (`lastError` contains „évad”); `reportPollsUntilReady` (pending → ready in two
      reads, debounce shortened via an injected interval).
- [ ] `swift test --filter MezociklusokModelTests` FAIL → implement → PASS. Commit.

### Task 6: BoopCore — builder template mode

**Files:**
- Modify: `ios/BoopKit/Sources/BoopCore/Train/BlockBuilderModel.swift`
- Modify: `ios/BoopKit/Sources/BoopCore/Train/BlockDraft.swift` (only if needed: `init(template:catalog:)`)
- Test: `ios/BoopKit/Tests/BoopCoreTests/BlockBuilderTemplateTests.swift`

**Interfaces — Produces:**
- `public enum Source: Equatable { case running, run(id: String), template(id: String) }` — `.run(id)` loads that
  block from `allBlocks()` instead of `runningBlock()` (a planned run) and saves through the existing run calls; `init(client:source: = .running, …)`;
  `public var source: Source { get }`; `public var isTemplate: Bool`.
- Template load: `client.templates()` → the one with `id` (`.failed(.notFound)` when gone) → a `WireBlock` built from
  it (status `"template"`, `currentWeek` 0, day ids `"t\(index)"`) → `BlockDraft(block:catalog:)`. No week proposals,
  no locked day, `coverageHints` forced off. The template's raw `WireJSON` is kept as the save base.
- Template save: one `updateTemplate(id:)` with the base json where `days` (all days via `dayInput(_:forSave:)`),
  `musclePriorities`, `sportGroups`, `trainingStyle`, `techniquesEnabled` are replaced and `id`, `runCount`,
  `createdAt`, `updatedAt` are dropped; then re-read. Never calls a `/mesocycles/` write.
- `suggest(…)` in template mode uses the running block's id when one exists (fetched once at load), else returns an
  empty `WireSuggestions` (the sheets fall back to the catalogue list).

- [ ] Tests: `runSourceLoadsThatBlock` (two blocks, `.run(id)` of the planned one → its days); `templateLoadBuildsDraftFromTemplate` (days/exercise names match fixture); `templateSaveSendsOnePutWithEditedDays`
      (rename an exercise → exactly one `updateMesoTemplate`, body `days[0].exercises[0].name` edited, no `id`/`runCount`
      key, zero requests whose path contains `/mesocycles/` and method ≠ GET); `templateGoneIsNotFound`;
      existing `PlanClientTests` builder tests still green (running mode unchanged).
- [ ] `swift test --filter 'BlockBuilderTemplateTests|PlanClientTests|BlockBuilderEditorTests'` FAIL → implement → PASS.
      Commit.

### Task 7: Boop app — the Mezociklus tab

**Files:**
- Modify: `ios/Boop/Edzes/EdzesRoom.swift` (`EdzesTab.blokk` raw value „Mezociklus”; `blokk` content order per spec
  §5.1; remove `yearPlanRow` use; covers for the new pages)
- Create: `ios/Boop/Edzes/Mezociklus/MezoCurrentCard.swift` (the spike's `MezoCurrentCardSpike`, production: actions
  wired, `NKAction`-sized 44 pt pills, VoiceOver labels, `…` menu „Mentés a sablonba”), `MezoTiles.swift` (spike
  `MezoTilesSpike` + `SpikeRing` → `MezoRing`)
- Modify: `ios/Boop/EdzesTerv/WeekReviewDeck.swift:579` — drop the „Blokk szerkesztése” action from
  `WeekReviewEntrance` (and its `openBuilder` parameter if it becomes unused)
- Modify: `ios/BoopKit/Sources/BoopDesign/Napkelte/Glass.swift` (`cycle-ink` glyph, spike geometry, in `outlined`)
  and `Area.swift` (`case "Mezociklus": "cycle-ink"`; drop `"Blokk"` from the clock case)
- Test: `ios/BoopTests/` — existing tab/label tests updated to „Mezociklus”; add `MezoTabLayoutTests` only if the
  repo's BoopTests already snapshot tab content order (check first; otherwise covered by the preview walk-through)

- [ ] No running block: empty state keeps *Új mezociklus*; a planned run shows on the card with **Megnézem** (opens
      its detail). Tiles always present. Unreachable + no cache: existing no-data card, tiles still open.
- [ ] `xcodebuild test` (Boop scheme, session-owned simulator per memory `boop-tests-own-simulator`) green. Commit.

### Task 8: Boop app — Mezociklusaim, detail, sheets, zárójelentés

**Files (create under `ios/Boop/Edzes/Mezociklus/`):**
- `MezociklusokPage.swift` — hero („MOST FUT”: `NKBlockTimeline`, `MezoRing`, `NKBodyMap`), KÖVETKEZIK date cards,
  SABLONJAIM horizontal `ScrollView` of cards (body map, mini curve, „N×” badge; `.scrollTargetBehavior(.viewAligned)`,
  no auto-scroll), LEZÁRTAK ring cards with tags; states loading / empty / error / offline (`ageText`).
- `MezoDetailPage.swift` — header, A HETEK ÍVE, HOGY SIKERÜLT teaser (closed + `hasReport`, opens report), A HÉT NAPJAI
  carousel, MIT KAPNAK AZ IZMOK; bottom bar **Indítás** (template/planned) | **Újrafuttatás** (closed) + **Szerkesztés**
  (template → builder `.template(id)`; planned → builder `.run(id)`; closed → builder `.template(rerun id)`).
  Start confirm: when a run is active, `confirmationDialog` „A most futó „X” lezárul.” with „Indítás ma”.
- `MezoRestartSheet.swift`, `MezoCloseSheet.swift` — spike sheets, wired to the model; restart shows
  `restartStats` (the „maradt ki” stat only when `done` is non-nil); close → `MezoReportPage` pending.
- `MezoReportPage.swift` — A HETEK: TERV ÉS VALÓSÁG (bars per week Σ planned vs Σ actual from `volume`; hidden when
  `volume` is nil), adherence ring, ERŐ (up/down rows, records marked), saját értékelés, BOOP ÉRTÉKELÉSE
  pending / ready / off.
- Modify: `ios/Boop/EdzesTerv/PlanPreview.swift` — preview server answers `listMesoTemplates`, `activateMesocycle`,
  `rerunMesocycle`, `restartMesocycle`, `saveMesocycleToTemplate`, `getMesocycleReport` (pending first, ready on the
  2nd read), `updateMesoTemplate`; `listMesocycles` returns running + planned + 3 closed; preview launch arg
  `-previewMezo list|detail|detailClosed|restart|close|report|pending|save|offline|empty`.
- Modify: `ios/Boop/EdzesTerv/BlockBuilderPage.swift` — title „Sablon szerkesztése” in template mode; hide the review
  mode row and „Mégsem, eldobom” in template mode.

- [ ] Walk every `-previewMezo` state in the session's own simulator, screenshot each to `ios/build/mezo-*.png`;
      check XXXL Dynamic Type, iPhone SE (3rd gen) width, VoiceOver labels (Accessibility Inspector or
      `accessibilityLabel` grep), reduced motion.
- [ ] `xcodebuild test` green. Commit.

### Task 9: Rename „blokk” → „mezociklus” in every visible string

**Files:** every `ios/Boop/**` + `ios/BoopKit/Sources/**` literal from
`grep -rIn '"[^"]*[Bb]lokk[^"]*"' ios/Boop ios/BoopKit/Sources` (~130 literals, ~42 files), plus the tests asserting
them (`ios/BoopKit/Tests`, `ios/BoopTests`). `PlanKit.swift:219` season text → „Mezociklust csak futó évadban
indíthatsz…” (keep meaning). `BlockBuilderPage.Mode.blokk` raw value „Blokk” → „Mezociklus” (check the preview default
parser that reads it).

Suffix table (apply by hand, never a blind replace): blokk → mezociklus · blokkod → mezociklusod · blokkot →
mezociklust · blokkban → mezociklusban · blokkból → mezociklusból · blokkhoz → mezociklushoz · blokknak →
mezociklusnak · blokkra → mezociklusra · blokkon → mezocikluson · blokkok → mezociklusok · anything else: rewrite the
sentence so it reads naturally · „Új blokk” → „Új mezociklus” · „Edzésblokk” → „Mezociklus”.

- [ ] After the edit: `grep -rIn '"[^"]*[Bb]lokk' ios/Boop ios/BoopKit/Sources` → only non-visible keys
      (UserDefaults keys, identifiers, comments); list any left with a reason in the commit body.
- [ ] `grep -rInE '"[^"]*\bMezo\b[^c]' ios/Boop ios/BoopKit/Sources` → none.
- [ ] BoopKit `swift test` + Boop `xcodebuild test` green. Commit `feat(ios): blokk → mezociklus (mezo-r36n9.177)`.

### Task 10: Ship (munkamenet lezárás)

- [ ] Docs: `docs/features/boop-ios.md` (Mezociklus tab, pages, template mode), feature-index row, dated milestone;
      handbook page under `docs/boop-handbook/NN-edzes/`; `_kiadasok.json` row (merge sha); `_funkciok.json`:
      `train-sablonok-futamok`, `train-blokk-lezaras-jelentes` → app; `node scripts/lint-docs.mjs` 0/0;
      `node scripts/gen-codemap.mjs`.
- [ ] Final review: one fresh most-capable-model review of the whole branch diff; fix real findings.
- [ ] Gates: backend focused ITs + `ArchitectureTest` (`-Dmezo.test.use-testcontainers=true`); BoopKit `swift test`;
      Boop `xcodebuild test`.
- [ ] Merge per CLAUDE.md (detached `origin/main`, `--no-ff`, push); wait for `deploy` green and the pod tag = release;
      phone install `ios/scripts/install-on-phone.sh`; live walk-through (list, detail, a template edit save; restart
      only with the owner's OK — it closes his real running mezociklus).
- [ ] Notion sync through a sonnet worker (`check` exits 0), beads backup, `bd close`, delete simulator
      „Boop · mezo-r36n9.177”, Hungarian report.
