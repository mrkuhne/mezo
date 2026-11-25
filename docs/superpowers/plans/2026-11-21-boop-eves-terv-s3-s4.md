# Boop Edzés — éves terv S3 + S4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 52-week year map lives on the server and on the phone (create from a preview, change a block's focus,
move / reorder / skip a block, archive), and the Edzés room offers the next block from it ("Következik") pre-filled
into the S2 intake. Starting that block links it to the map, a late, skipped or early-ended block re-dates the rest,
and a newly started block becomes the season's block.

**Architecture:** Two new owned tables in `train` (`training_year_plan`, `training_year_block`). Pure cores do the
work: `YearGenerator` (rotation + relaxations), `YearSchedule` (re-dating layout), `YearRules` (edit warnings, skip
consequences), `YearReconciler` (year-block status from the linked mesocycle). `YearPlanService` puts them behind
five endpoints. Linking runs inside `TrainService.stampRun` (same feature). The season follows through an
AFTER_COMMIT `MesocycleStarted` listener (season → train is the allowed direction). The consolidation block reuses
candidates/generate with a `consolidation` flag (weeks 1–3, all Tartás, flat curve). The phone gets a hand-decoded
client, `YearPlanModel`, the spike's screens 5/6/6b/7, and a `YearBlockPrefill` for `NewBlockModel`.

**Tech Stack:** Spring Boot 4 / Java 21, Liquibase, OpenAPI contract-first, JUnit 5 + Testcontainers ITs; SwiftUI,
BoopKit (`BoopCore` + `BoopDesign` Napkelte), XCTest with `StubTransport`.

**Spec:** `docs/superpowers/specs/2026-11-20-boop-eves-terv-design.md` (owner OK 2026-11-20) — §2 decisions 3/4/6/7,
§5 S3 + S4, §7a builder-check calls. Look: spike `spike/boop-eves-terv` (`git show spike/boop-eves-terv:ios/Boop/EvesTervDemo/EvesTervYear.swift`,
`…/EvesTervFixtures.swift`; captures `docs/superpowers/specs/assets/eves-terv/{5-letrehozas,5-letrehozas-2,6-terkep,6-terkep-2,6b-blokk,7-kovetkezik}.png`
on that branch). Do not check the spike branch out. Predecessor: `docs/superpowers/plans/2026-11-21-boop-eves-terv-s1-s2.md` (shipped, merge `08d505bf4`).

## Kérdés a tulajdonosnak

Nincs. Az alábbi döntéseket én hoztam meg (controller call), és a spec és a spike keretein belül maradnak.

## Global Constraints

- Contract-first: edit `api/feature/train/train.yml` → `cd api/generate && npm run generate:api` → `ios/scripts/sync-openapi.sh`. Request fields use `pattern`, never `enum`. Every new field on an existing schema is **optional**, and leaving it out keeps today's behaviour.
- Year groups = the 9 landmark groups. **upper** = chest, back, shoulder, biceps, triceps. **lower** = quad, ham, glute, calf. `kind` ∈ `upper|lower|consolidation` (no `full`, §7a).
- A year block has **1–2 focus groups**, so it never has more than 2 Hangsúly (`emphasize-max: 2`). Block from the map: focus → `emphasize`, everything else → `maintain`. The Tartás floor `ceil(mev/3)` is never bypassed (Tartás starts at the band low, S1 decision).
- Year: 52 weeks, block length default 6 (allowed 4–8), consolidation default 2 (allowed 1–2). Full blocks fill `52 − consolidation`, leftover weeks become a **buffer** before the consolidation.
- Re-dating (§7a): **late = more than 3 days** after `planned_start`. A delay eats the buffer first, then shortens the consolidation to 1 week, then moves the end past 52 weeks. The consolidation is always last. Linking window **±14 days**. Ended early → `done`, cancelled → `skipped`, and both re-date the rest.
- Rotation relax order: emphasised-twice → once, then the pair table. Only impossible input is rejected (400). An owner PATCH that breaks a rule is always accepted and comes back with warnings. A PATCH on a `running`/`done` block is refused (409), because it is impossible, not a rule break.
- Consolidation mesocycle: weeks **1–3** only with `consolidation: true` (the user-facing 4–8 stays for everything else), all groups Tartás at the band low, flat curve `["MEV" × weeks]`, no ramp, no deload.
- New config `mezo.year-plan.*` in a `@Validated` `YearPlanProperties` record with a binding IT. No `@Value`.
- ArchUnit: `@Service` in `service/`, entities in `entity/`, config in `config/`, no class-level `@Transactional`. train → season only via `SeasonGatePort`. season → train events allowed. New owned tables go into `ResetDatabase` + a `TrainingYearPlanPopulator` in the same commit. New error keys go into both bundles (`MessageBundleParityTest`).
- Backend tests run as `cd backend && ./mvnw -q test -Dtest='…' -Dmezo.test.use-testcontainers=true`. iOS tests run on simulator `49F8F221-C9B8-4A31-A734-C9121A38D7DA`: `cd ios/BoopKit && xcodebuild test -scheme BoopKit-Package -destination 'platform=iOS Simulator,id=49F8F221-C9B8-4A31-A734-C9121A38D7DA' -skipPackagePluginValidation -derivedDataPath ../build/kit` and `cd ios && xcodebuild test -project Boop.xcodeproj -scheme Boop -destination 'platform=iOS Simulator,id=49F8F221-C9B8-4A31-A734-C9121A38D7DA' -skipPackagePluginValidation -derivedDataPath build/app`.
- Phone: every number and date comes from the server (weeks, dates, current week, buffer, focus counts, consequences). Hand-decoded `PlanClient`, lenient string enums (an unknown note code shows no line). Hungarian copy, no emoji, never "Mezo". Muscle names = `BlockDraft.longName` (not the spike's). Smallest iPhone width, reduced motion.
- Privacy: the owner's real block (prod, started 2026-11-16) is only read. Fixtures and docs use invented values.
- Collisions: `mezo-r36n9.122` (season gym-day editor) touches `SeasonService`. Task 7 adds one method and one listener, both additive. `mezo-r36n9.134` touches `MesocycleDiscardService`, and this plan does not.

**Controller calls (decided here, spec left them open):**
1. **A planned block starts on its day.** No code today promotes a `planned` mesocycle (S2's "Jövő hétfőn" too), so "following the map" would stall. `PlannedBlockStarter` activates a due planned block lazily, on today's workout / mesocycle list / year-plan reads, and only when the season gate allows it (Task 6). Prod currently has no planned blocks.
2. **Year-block status is reconciled on read** from the linked mesocycle (active → `running`, archived with ≥ 1 logged session → `done`, archived with none → `skipped`, discarded → unlinked back to `planned`). A linked but still-planned mesocycle keeps the block `planned` ("indul …"). This replaces hooks on every close/archive/discard path.
3. **Season "re-point" = the new block becomes the goal's newest `goal_plan_link`** (old links stay as history) **and** the season draft's block becomes `adopt <newId>`. Every season read already takes the newest linked mesocycle as the season's block.
4. **The first block kind is upper.** An adopted block 1 sets its kind from its focus (all lower → lower, else upper), and the next block alternates.
5. **Pair table** (config): upper back+biceps, chest+triceps, chest+shoulder, back+shoulder, shoulder+triceps, biceps+triceps; lower quad+glute, ham+glute, quad+calf, ham+calf, glute+calf.
6. **Explicit `yearBlockId` on start never fails a start.** An invalid id falls back to the ±14-day rule.
7. **Consolidation is 1–3 weeks** with the flag (1 when the year shortened it, 2 by default, 3 allowed by the spec's short-block path). `EffortRamp` does not ramp an all-`MEV`, deload-free curve.
8. **Phone additions inside the spike's components** (no new look): the block sheet gets a *Sorrend* pair ("Előrébb a sorban" / "Hátrébb a sorban") under *Időpont*. The map gets a quiet *Éves terv lezárása* (confirm) at the bottom, an *unlinked block* banner ("A futó blokkod nincs az éves tervben" → *Hozzákötöm a következő blokkhoz*), and during the consolidation a *year review* card (blocks done/skipped, focused/unfocused groups) with *Jövő évi terv*. The year view entry is a row in the Edzés room (Ma tab's *AZ EDZÉS TERÜLET* menu and the Blokk tab under the load card). The Következik card sits at the top of Ma, as in the spike.
9. **Creating a plan while one is active** → 409 `TRAIN_YEAR_PLAN_ACTIVE_EXISTS` unless `replaceActive: true` (the phone sends it only from *Jövő évi terv*). A running block is adopted only when it runs into the new plan (`start < meso.endDate`). Then the plan starts on the Monday on/before the meso's start.

## Review Focus

1. **He creates a plan today while his real block runs (started on a Monday, 6 weeks):** block 1 must be that block (adopted, focus = its Hangsúly groups, possibly empty), plan start = that Monday, "itt tartasz" = the right week, the remaining blocks alternate from it. Expected: no 500 and no duplicate block 1. **[RF 1]**
2. **A planned block's day arrives with no season covering it (gate on):** it stays planned and today's workout read still answers. Expected: no 409 bubbling out of a GET. **[RF 2]**
3. **Reorder / PATCH against the consolidation, a done or a running block, or two reorders back to back:** 409 `TRAIN_YEAR_BLOCK_LOCKED` or a clean swap. Expected: never a unique-ordinal 500 or a gap in ordinals. **[RF 3]**
4. **The year runs past 52 weeks (overrun) or is already over:** GET still answers (`overrunWeeks > 0`, `currentWeek` may exceed 52), and the phone strip draws `52 + overrun` columns. Expected: no index crash. **[RF 4]**
5. **Offline or server failure on the year view / Következik:** the card is hidden (never a stale "Következik" with old dates), and the map shows the last plan with its age, or the failure notice with retry. **[RF 5]**

Each line's test sits in the owning task (marked **[RF n]**).

---

### Task 1: Year-plan tables, entities, config

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/202611261000_mezo-r36n9.113_training_year_plan.sql`; list it in `1.1.0/1.1.0_master.yml`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/{TrainingYearPlanEntity,TrainingYearBlockEntity}.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/{TrainingYearPlanRepository,TrainingYearBlockRepository}.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/config/YearPlanProperties.java`; `application.yml` `mezo.year-plan`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`; create `support/populator/TrainingYearPlanPopulator.java` (registered in `DatabasePopulator`)
- Test: `feature/train/TrainingYearPlanRepositoryIT.java`, `feature/train/YearPlanPropertiesBindingIT.java`

**Interfaces:**
- Produces: tables:
  - `training_year_plan` (id, created_by, is_deleted, created_at, updated_at, start_date date, status varchar(10), block_weeks smallint, consolidation_weeks smallint, emphasis text[] not null default '{}', archived_at timestamptz). Constraints: `ck_training_year_plan_status in ('active','archived')`, `ck_…_monday extract(isodow from start_date) = 1`, `ck_…_block_weeks between 4 and 8`, `ck_…_consolidation_weeks between 1 and 2`, `uq_training_year_plan_one_active` on (created_by) where status = 'active' and is_deleted = false.
  - `training_year_block` (id, created_by, is_deleted, created_at, updated_at, plan_id fk cascade, ordinal smallint, kind varchar(14), focus text[] not null default '{}', weeks smallint, gap_weeks smallint not null default 0, planned_start date, mesocycle_id uuid null fk → mesocycle on delete set null, status varchar(10), adopted boolean not null default false). Constraints: `ck_…_kind in ('upper','lower','consolidation')`, `ck_…_status in ('planned','running','done','skipped')`, `ck_…_focus cardinality(focus) <= 2`, `ck_…_weeks between 1 and 8`, `ck_…_gap gap_weeks >= 0`, `uq_training_year_block_plan_ordinal unique (plan_id, ordinal) deferrable initially deferred` (reorder swaps inside one transaction).
- Repositories: `TrainingYearPlanRepository.findByCreatedByAndStatusAndDeletedFalse(UUID, String): Optional<…>`, `findByIdAndCreatedByAndDeletedFalse(UUID, UUID)`. `TrainingYearBlockRepository.findByPlanIdAndDeletedFalseOrderByOrdinalAsc(UUID): List<…>`, `findByIdAndCreatedByAndDeletedFalse(UUID, UUID)`, `findByCreatedByAndMesocycleIdAndDeletedFalse(UUID, UUID): Optional<…>`.
- `YearPlanProperties(int yearWeeks, int defaultBlockWeeks, int defaultConsolidationWeeks, int lateToleranceDays, int linkWindowDays, Map<String, List<String>> kindGroups, List<List<String>> pairs)`. yml values: `year-weeks: 52`, `default-block-weeks: 6`, `default-consolidation-weeks: 2`, `late-tolerance-days: 3`, `link-window-days: 14`, `kind-groups: {upper: [chest, back, shoulder, biceps, triceps], lower: [quad, ham, glute, calf]}`, `pairs:` the controller-call-5 table. Compact constructor: each pair has 2 distinct groups of the same kind.
- `TrainingYearPlanPopulator.plan(UUID owner, LocalDate monday, String... focusPerBlock)` builds a plan with blocks (`"back+biceps"` style tokens; `"consolidation"` for the last).

- [ ] **Step 1: Failing tests.** `TrainingYearPlanRepositoryIT`: `testSave_shouldRoundTripFocusArray_whenTwoGroups()`; `testSave_shouldFail_whenSecondActivePlan()` (unique index); `testSave_shouldFail_whenStartIsNotMonday()`; `testSwapOrdinals_shouldSucceed_inOneTransaction()` (deferrable). `YearPlanPropertiesBindingIT`: kind-groups union equals `VolumeProperties.baselines().keySet()`; `pairs.size() == 11`.
- [ ] **Step 2: Run** `-Dtest='TrainingYearPlanRepositoryIT,YearPlanPropertiesBindingIT'` → FAIL.
- [ ] **Step 3: Implement** the SQL (house conventions: named `pk_/fk_/uq_/ck_/idx_`, `idx_training_year_block_plan_id`), entities (`extends OwnedEntity`, `@SQLDelete` + `@SQLRestriction`, `text[]` like `MesocycleEntity.phaseCurve`), repositories, properties, ResetDatabase entries (`training_year_block, training_year_plan`), populator.
- [ ] **Step 4: Run** the same tests + `ArchitectureTest` → PASS.
- [ ] **Step 5: Commit** `feat(train): year-plan tables, entities, config (mezo-r36n9.113)`.

### Task 2: `YearGenerator` — the rotation (pure)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/YearGenerator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/YearGeneratorTest.java`

**Interfaces:**
- Consumes: Task 1 `YearPlanProperties`.
- Produces:
  - `YearGenerator.generate(Input in, YearPlanProperties p): Result`
  - `Input(LocalDate start, List<String> emphasis, int blockWeeks, int consolidationWeeks, Adopted adopted /*nullable*/)`, `Adopted(UUID mesocycleId, LocalDate mesoStart, int weeks, List<String> focus)`
  - `Result(LocalDate start, List<Block> blocks, List<Note> relaxed)`, `Block(int ordinal, String kind, List<String> focus, int weeks, boolean adopted, UUID mesocycleId)`, `Note(String code, String group, Integer ordinal)`. Codes `emphasis_once`, `no_focus`, `pair_relaxed`.

Rules:
- Start = `in.start()`. With `adopted`, start = the Monday on/before `mesoStart`. Block 1 = adopted (its weeks, its focus ≤ 2, kind per controller call 4).
- Loading-block count = `floor((yearWeeks − consolidationWeeks − adoptedWeeks) / blockWeeks)` (+1 when adopted). Kinds alternate. The last block = `consolidation` (focus empty, weeks = consolidationWeeks).
- Per kind: slots = 2 × blocks of that kind. Demand = 2 for an emphasised group, else 1. Adopted focus counts as supplied.
- Demand > slots: relax emphasised groups to 1, **last emphasis entry first** → `emphasis_once`. Still over: the leftover groups (kind order from config, last first) get `no_focus`.
- Demand < slots: second appearances in mav-descending order (baseline table), max 2 per group. Slots still left: blocks get 1 focus.
- Assignment, by backtracking in block order with candidates in config group order. Hard rule: no group twice in one block, and no group focused in two consecutive blocks (adjacent in the whole sequence). Soft rule 1: each block's pair is in `pairs`. Soft rule 2: a group's two appearances are not in adjacent same-kind blocks. Try hard+1+2, then hard+1, then hard only (each block whose pair is not in the table → `pair_relaxed {ordinal}`).

- [ ] **Step 1: Failing tests.**
  - `defaultYear_eightSixWeekBlocksThenConsolidation()`: start 2027-01-04, no emphasis, 6/2 → 9 blocks, kinds U,L,U,L,U,L,U,L,consolidation; ordinals 1..9; sum of loading weeks 48.
  - `everyGroupFocusedAtLeastOnce_forEveryLength()` over blockWeeks 4..8 → every one of the 9 groups appears in ≥ 1 focus; `relaxed` empty.
  - `emphasisedGroupsTwice()`: emphasis [shoulder, calf] → shoulder and calf appear exactly 2×.
  - `noGroupInConsecutiveBlocks()` and `atMostTwoFocusPerBlock()` across lengths 4..8 with and without emphasis.
  - `pairsFromTable_inDefaultYear()` (no `pair_relaxed`).
  - `allUpperEmphasised_relaxes()`: emphasis = 5 upper groups, blockWeeks 8 (3 upper blocks, 6 slots) → `relaxed` contains `emphasis_once` for triceps, biceps, shoulder, chest in that order until demand ≤ 6, and every upper group still ≥ 1.
  - `deterministic()`: two calls give equal `Result`.
  - **[RF 1]** `adoptedBlockIsBlockOne()`: adopted mesoStart Wed 2026-11-18, 6 weeks, focus [quad] → start 2026-11-16, block 1 adopted kind lower, block 2 upper, quad's demand already met once.
  - **[RF 1]** `adoptedWithoutFocus()`: focus [] → block 1 kind upper, focus [], no exception.
- [ ] **Step 2: Run** `-Dtest=YearGeneratorTest` → FAIL.
- [ ] **Step 3: Implement** (static, no Spring).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(train): deterministic year rotation with relaxations (mezo-r36n9.113)`.

### Task 3: `YearSchedule` re-dating + `YearRules` warnings (pure)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/{YearSchedule,YearRules}.java`
- Test: `…/service/{YearScheduleTest,YearRulesTest}.java`

**Interfaces:**
- Produces:
  - `YearSchedule.layout(LocalDate planStart, List<Slot> loading, Slot consolidation, int plannedConsolidationWeeks, LocalDate today, YearPlanProperties p): Layout`
  - `Slot(UUID id, int ordinal, int weeks, int gapWeeks, String status, MesoFacts meso /*nullable*/)`, `MesoFacts(LocalDate start, int weeks, LocalDate closedOn /*nullable*/)`
  - `Layout(List<Placed> blocks, Placed consolidation, int consolidationWeeks, int bufferWeeks, LocalDate bufferStart, int overrunWeeks, LocalDate end)`, `Placed(UUID id, LocalDate start, int weeks, boolean occupies)`
  - `YearRules.warnings(List<View> blocks, Set<String> groups, YearPlanProperties p): List<YearGenerator.Note>`, `YearRules.skipConsequence(List<View> blocks, UUID blockId): List<String>`, `YearRules.placeFor(String group, List<View> blocks, LocalDate today, YearPlanProperties p): Optional<Suggestion>`
  - `View(UUID id, int ordinal, String kind, List<String> focus, String status, LocalDate start)`, `Suggestion(UUID blockId, int ordinal, String replaces /*nullable = add as second focus*/)`
  - Warning codes: `focus_consecutive {group, ordinal}`, `no_focus_this_year {group}` (+ suggestion fields on the DTO, Task 5), `pair_unusual {ordinal}`, `mixed_focus {ordinal}`.

Layout algorithm (cursor walk in ordinal order; `tol = lateToleranceDays`):
- `due = cursor + gapWeeks`.
- `skipped`: `occupies = false`, start = due, cursor unchanged.
- With `meso`: start = `due` when `|meso.start − due| ≤ tol` days, else `meso.start`. End = start + meso.weeks. When `closedOn` is set and `closedOn < end − tol`, end = Monday on/after `closedOn`. Cursor = Monday on/after end.
- Planned without meso: start = `due`, unless `today > due + tol` days, then start = Monday on/after `today`. Cursor = start + weeks.
- Consolidation: `yearEnd = planStart + yearWeeks`, `room = weeks(cursor → yearEnd)`.
  - `room ≥ planned` → consolidation = planned weeks at `yearEnd − planned`, buffer = `room − planned`.
  - `room ≥ 1` → 1 week at `yearEnd − 1`, buffer = `room − 1`.
  - Else 1 week at cursor, `overrunWeeks = weeks(yearEnd → cursor) + 1`.
  - A consolidation with a meso follows its meso like any block.

`placeFor`: among `planned` blocks of the group's kind starting after `today`, the **latest** one that has a focus group appearing ≥ 2× in the year → replace that group. Else the latest 1-focus block → add. Else empty.

- [ ] **Step 1: Failing tests** (`YearScheduleTest`, plan start 2027-01-04, 8 × 6 + consolidation 2):
  - `onTime_keepsDates()` (block 2 at 2027-02-15, consolidation at 2027-12-20, buffer 2).
  - `twoDaysLate_keepsLaterDates()`.
  - `fiveDaysLate_shiftsLaterBlocks()` (block 1 meso start Sat 2027-01-09 → block 2 at 2027-02-22, buffer 1).
  - `threeWeekDelay_eatsBufferThenShortensConsolidation()` (buffer 0, consolidation 1 week, overrun 0).
  - **[RF 4]** `fourWeekDelay_movesEnd()` (overrun 1, end 2028-01-10).
  - `skippedBlock_freesItsWeeks()` (block 3 skipped → block 4 starts 2027-03-01, buffer 8, consolidation still 2027-12-20).
  - `notStartedPastDue_redatesFromToday()` (today = due + 4 days → start = next Monday).
  - `endedEarly_pullsNextForward()` (closedOn two weeks before end → next at the Monday on/after closedOn).
  - `gapWeek_shiftsFollowing()` (gap 1 on block 4 → blocks 4..8 +1 week, buffer 1).

  `YearRulesTest`:
  - `consecutiveFocusWarned()`.
  - `skipConsequence_listsOnlyFocusGroups()` (calf only in block 6 → skipping 6 lists [calf]).
  - `placeFor_replacesARepeatedGroup()`.
  - `placeFor_addsToSingleFocusBlock()`.
  - `mixedFocusWarned()` (ham + biceps).
  - `unusualPairWarned()`.
- [ ] **Step 2: Run** `-Dtest='YearScheduleTest,YearRulesTest'` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(train): year re-dating layout and edit warnings (mezo-r36n9.113)`.

### Task 4: Consolidation short block (candidates + generate)

**Files:**
- Modify: `api/feature/train/train.yml`. `MesoPlanCandidatesRequest` and `MesoPlanGenerateRequest`: `weeks.minimum` 4 → 1 (description: "4–8; 1–3 only with consolidation"), new `consolidation: boolean, nullable`. Regenerate.
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MesoWeeksGuard.java`
- Modify: `MesoPlanSkeleton.java` (`flatCurve(int weeks)`), `MesoPlanGeneratorService.java`, `MesoPlanCandidatesService.java`, `EffortRamp.java`, both message bundles (`TRAIN_MESO_WEEKS_RANGE`)
- Test: `MesoPlanSkeletonTest`, `EffortRampTest`, `MesoPlanCandidatesContractIT`, `MesoPlanGenerateContractIT`

**Interfaces:**
- Produces:
  - `MesoWeeksGuard.check(int weeks, boolean consolidation)`: 400 `TRAIN_MESO_WEEKS_RANGE` unless `4..8` (no flag) or `1..3` (flag). Called first in `generate` and `candidates`.
  - `MesoPlanSkeleton.flatCurve(int weeks): List<String>` = `"MEV"` × weeks.
  - With the flag: priorities = every baseline group → `maintain` (request priorities ignored), curve = `flatCurve`, template title `"Lezárás"`, style `"Lezárás · N hét"`.
  - `EffortRamp.effectiveReserve`: a curve with no `Deload` whose every phase is `MEV` returns `max(base, floor)` for every week.

- [ ] **Step 1: Failing tests.**
  - `flatCurveForConsolidation()`.
  - `EffortRampTest.allMevCurveDoesNotRamp()` (week 2 of `[MEV, MEV]` = base).
  - `EffortRampTest.normalCurveUnchanged()` (6-week curve, same values as before).
  - Candidates IT `consolidationTwoWeeksAllMaintain()`: 4 days, weeks 2, flag, priorities {chest: emphasize} ignored → 200, every candidate's template `musclePriorities` all maintain, `phaseCurve == [MEV, MEV]`, ≥ 1 offered.
  - `twoWeeksWithoutFlagIs400()` (`TRAIN_MESO_WEEKS_RANGE`), `consolidationFourWeeksIs400()`.
  - Generate IT `generateConsolidationFlat()`.
  - The existing 4–8 ITs stay green unchanged.
- [ ] **Step 2: Run** `-Dtest='MesoPlanSkeletonTest,EffortRampTest,MesoPlanCandidatesContractIT,MesoPlanGenerate*IT'` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same + `MessageBundleParityTest` → PASS.
- [ ] **Step 5: Commit** `feat(train): consolidation short block — 1–3 weeks, all Tartás, flat curve (mezo-r36n9.113)`.

### Task 5: Year-plan API — preview, create, active, patch, archive

**Files:**
- Modify: `api/feature/train/train.yml` (tag `Train`). Operations:
  - `previewYearPlan` POST `/api/train/year-plans/preview`
  - `createYearPlan` POST `/api/train/year-plans` (201)
  - `getActiveYearPlan` GET `/api/train/year-plans/active` (404 `TRAIN_YEAR_PLAN_NONE` = the phone's empty state, as `/api/seasons/active/overview`)
  - `patchYearBlock` PATCH `/api/train/year-plans/blocks/{blockId}`
  - `archiveYearPlan` POST `/api/train/year-plans/{id}/archive`

  Schemas:
  - `YearPlanRequest {startDate (date, required), emphasis? [group pattern, maxItems 9], blockWeeks? 4–8, consolidationWeeks? 1–2, replaceActive? bool}`
  - `YearBlockPatch {focus? [group pattern, 1–2], weeks? 1–8, ordinal? ≥1, shiftWeeks? −1..1, skip? bool, linkRunning? bool}`
  - `YearPlan {id?, status, startDate, endDate, blockWeeks, consolidationWeeks, emphasis[], currentWeek?, loadingBlocks, bufferWeeks, bufferStart?, overrunWeeks, blocks[YearBlock], relaxed[YearNote], warnings[YearNote], focusCount{group:int}, next?: YearNext, unlinkedRunning?: {mesocycleId, title, startDate}, review: YearReview}`
  - `YearBlock {id?, ordinal, kind, focus[], weeks, plannedStart, lastDay, status, mesocycleId?, currentWeek?, adopted, canMoveEarlier, skipConsequence[]}`
  - `YearNote {code, group?, ordinal?, blockId?, replaces?, weeks?}`
  - `YearNext {blockId, startsOn, reason (last_week|no_block)}`
  - `YearReview {blocksDone, blocksSkipped, focused[], unfocused[]}`

  Regenerate.
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/{YearPlanService,YearPlanAssembler}.java`
- Modify: `TrainController.java` (five one-line delegates), bundles (`TRAIN_YEAR_PLAN_NONE`, `TRAIN_YEAR_PLAN_ACTIVE_EXISTS`, `TRAIN_YEAR_START_NOT_MONDAY`, `TRAIN_YEAR_BLOCK_LOCKED`, `TRAIN_YEAR_NOTHING_TO_LINK`)
- Test: `feature/train/YearPlanContractIT.java`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `YearPlanService`: `preview(UUID, YearPlanRequest): YearPlan` (readOnly), `create(UUID, YearPlanRequest): YearPlan`, `active(UUID): YearPlan`, `patchBlock(UUID, UUID blockId, YearBlockPatch): YearPlan`, `archive(UUID, UUID planId): YearPlan` (all writes method-level `@Transactional`).
  - `YearPlanAssembler.toDto(plan, blocks, Layout, notes, LocalDate today): YearPlan` (generated builders, as `MesoPlanCandidatesService`). Also used by Task 6.
- Behaviour:
  - Preview and create run `YearGenerator`, then `YearSchedule`, then `YearRules`. Create persists `planned_start` from the layout.
  - The adopted block (controller call 9) is linked at create with `status = running`.
  - Create with an active plan and without `replaceActive` → 409. With it, the old plan is archived first, then flushed.
  - `startDate` not a Monday → 400.
  - PATCH: `running`/`done` block, or the consolidation for `ordinal`/`shiftWeeks`/`skip` → 409 `TRAIN_YEAR_BLOCK_LOCKED` **[RF 3]**.
  - `focus` re-derives `kind` (all upper → upper, all lower → lower, mixed → keep + `mixed_focus`).
  - `weeks` on the consolidation sets `plan.consolidation_weeks` (1–2, else 400).
  - `ordinal` moves the block among loading blocks, renumbering contiguously.
  - `shiftWeeks −1` only when `gap_weeks > 0` (`canMoveEarlier` mirrors it, else 400). `+1` adds a gap.
  - `skip: true/false` toggles `skipped`/`planned`.
  - After every PATCH: re-layout, rewrite `planned_start` of every block, and return warnings. A `no_focus_this_year` note carries `placeFor`'s `blockId`/`ordinal`/`replaces`.
  - `currentWeek` = week of today since start (null before start). `next`/`unlinkedRunning` stay null in this task (Task 6 fills them).

- [ ] **Step 1: Failing ITs** (`YearPlanContractIT`, `ApiIntegrationTest`):
  - `previewPersistsNothing()`.
  - `createThenActive()` (9 blocks, ordinals 1..9, plannedStart from the layout, consolidation last).
  - `secondCreate409_replaceActiveArchivesOld()`.
  - `notMonday400()`.
  - `noPlan404()`.
  - `patchFocusAcceptedWithWarning()` (give block 3 a focus group of block 2 → 200 + `focus_consecutive`).
  - `patchFocusMoreThanTwo400()` (contract).
  - `skipReturnsConsequenceAndSuggestion()`.
  - `shiftLaterThenEarlier()`.
  - **[RF 3]** `reorderSwapsCleanly()`, `reorderTwiceInARow()`, `patchConsolidationOrdinal409()`, `patchRunningBlock409()`.
  - **[RF 1]** `createWhileBlockRunsAdoptsIt()`: active meso started Monday 2026-11-16, 6 weeks, priorities {quad: emphasize}, request start next Monday → plan start 2026-11-16, block 1 adopted + running + mesocycleId set, focus [quad].
  - `archive()` → status archived, then GET active 404.
- [ ] **Step 2: Run** `-Dtest=YearPlanContractIT` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same + `ArchitectureTest` + `MessageBundleParityTest` → PASS; `node scripts/gen-codemap.mjs`.
- [ ] **Step 5: Commit** `feat(train): year-plan API — preview, create, active, patch, archive (mezo-r36n9.113)`.

### Task 6: Linking, status reconcile, planned block starts on its day, Következik

**Files:**
- Modify: `api/feature/train/train.yml`: `MesoTemplateStartRequest.yearBlockId` (uuid, nullable). Regenerate.
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/{YearPlanLinker,YearReconciler,PlannedBlockStarter}.java`
- Modify: `TrainService.java` (`StampSource.yearBlockId`, the `stampRun` link call), `MesoTemplateService.java` (passes `req.getYearBlockId()`, rerun passes null), `WorkoutService.getToday` (calls `plannedBlockStarter.startDue(user)` before the auto-close), `TrainController.listMesocycles` (calls `startDue` first), `YearPlanService` (`active` reconciles + fills `next`/`unlinkedRunning`; PATCH `linkRunning`)
- Test: `feature/train/YearPlanLinkContractIT.java`, `…/service/YearReconcilerTest.java`, `feature/season/MesocycleGateIT.java` (one test)

**Interfaces:**
- Consumes: Task 5 service/assembler, Task 3 layout, `SeasonGatePort.allowsMesocycleStart`.
- Produces:
  - `YearPlanLinker.linkStarted(UUID owner, MesocycleEntity m, UUID yearBlockId /*nullable*/)`: joins the stamp transaction. The explicit id must be a `planned`, unlinked block of the active plan, else the ±`linkWindowDays` rule (nearest `planned` unlinked block by layout start; tie → lower ordinal; none → no link). Sets `mesocycle_id`, re-layouts.
  - `YearReconciler.reconcile(List<Row> rows, Map<UUID, MesoState> mesos): List<Change>`, where `Row(UUID blockId, String status, UUID mesocycleId)`, `MesoState(String status, boolean hasLogs, boolean deleted)` and `Change(UUID blockId, String status, boolean unlink)`. `hasLogs` = any instance row of the run (as `MesocycleDiscardService`). Rules per controller call 2.
  - `PlannedBlockStarter.startDue(UUID owner)` (`@Transactional`): the latest-start `planned` mesocycle with `startDate ≤ today` → `trainService.activateMesocycle` only when `seasonGate.allowsMesocycleStart` is true, else left planned (no exception path) **[RF 2]**.
  - `next`: (a) an active meso with `today ≥ endDate − 7 days` and the next block in ordinal order is `planned` and unlinked → `{reason: last_week, startsOn: its layout start}`; (b) no active/planned meso and a `planned` block exists → `{reason: no_block, startsOn: max(layout start, Monday on/after today)}`. Else null.
  - `unlinkedRunning`: an active/planned meso started on/after plan start and linked to no block.
  - PATCH `linkRunning: true` links it to that `planned` block (else 409 `TRAIN_YEAR_NOTHING_TO_LINK`).

- [ ] **Step 1: Failing tests.**
  - `YearReconcilerTest`: `activeIsRunning()`, `plannedMesoKeepsPlanned()`, `archivedWithLogsIsDone()`, `archivedWithoutLogsIsSkipped()`, `deletedUnlinksToPlanned()`.

  `YearPlanLinkContractIT`:
  - `startWithYearBlockIdLinks()` (start template today active with block 2's id → GET active: block 2 running, mesocycleId).
  - `invalidYearBlockIdFallsBackToWindow()`.
  - `startWithinFourteenDaysAutoLinks()`.
  - `startOutsideWindowIsUnlinkedRunning()`, then PATCH `linkRunning` links it.
  - `lateStartRedates()` (block 2 started 5 days after its planned start → block 3 `plannedStart` +1 week).
  - `closeWithLogsDone()`, `closeWithoutLogsSkippedAndRedates()`, `discardUnlinksBackToPlanned()`.
  - `plannedBlockActivatesOnItsDay()` (planned meso with startDate today → `GET /api/train/today` → `listMesocycles` shows it active, the old one archived).
  - `nextInLastWeek()`, `nextWhenNoBlock()`, `noNextWhenNextAlreadyLinked()`.

  **[RF 2]** `MesocycleGateIT.plannedBlockWithoutSeasonStaysPlanned()` (gate on, no season → today read 200, block still planned).
- [ ] **Step 2: Run** `-Dtest='YearReconcilerTest,YearPlanLinkContractIT,MesocycleGateIT'` → FAIL.
- [ ] **Step 3: Implement.** No bean cycle: `PlannedBlockStarter → TrainService` only; `TrainService` never calls the starter (hence the controller-level call in `listMesocycles`).
- [ ] **Step 4: Run** same + `MesoTemplate*IT` + `ArchitectureTest` → PASS.
- [ ] **Step 5: Commit** `feat(train): year blocks follow their mesocycle, planned blocks start on their day, Következik (mezo-r36n9.113)`.

### Task 7: The season follows the new block

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/MesocycleStarted.java` (`record MesocycleStarted(UUID userId, UUID mesocycleId, LocalDate startDate)`)
- Modify: `TrainService.stampRun` (publishes it after save, every stamp)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/season/service/SeasonBlockLinkListener.java` (`@Component`, `@TransactionalEventListener(AFTER_COMMIT)`, no `@Async`, catches `RuntimeException` → `log.warn`)
- Modify: `SeasonService.java` (`adoptStartedBlock(UUID owner, UUID mesocycleId, LocalDate start)`, `@Transactional(propagation = REQUIRES_NEW)`), `SeasonApiService.response` (walk the linked list back to the newest existing meso, as `SeasonOverviewService.block`)
- Test: `feature/season/SeasonBlockRelinkIT.java` (`ApiIntegrationTest`)

**Interfaces:**
- Produces: `adoptStartedBlock` picks the active season, else the planned season whose window contains `start`, else no-op. When the meso is already linked → no-op. Else `goalPort.link(owner, goalId, mesoId, start)` and draft block → `new SeasonDraftJson.Block("adopt", mesoId, null)`. Goal fields, slots and sleep are untouched.

- [ ] **Step 1: Failing ITs:**
  - `newBlockBecomesSeasonBlock()` (active season with block A; start template B → `GET /api/seasons/active/overview` `pillars.block.mesocycleId == B`; goal id, title and day-target kcal unchanged; the season draft block = adopt B).
  - `deloadWeeksFollowNewBlock()` (`upcoming` deload week = B's).
  - `noSeasonNoLink()`.
  - `seasonActivationStartDoesNotDoubleLink()` (template start from the season accept → exactly one link for that meso).
  - `discardedNewestFallsBackToPrevious()` (`GET /api/seasons` block = A after B is discarded).
- [ ] **Step 2: Run** `-Dtest='SeasonBlockRelinkIT,SeasonApiIT,SeasonServiceIT'` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same + `MesocycleGateIT` + `ArchitectureTest` → PASS.
- [ ] **Step 5: Commit** `feat(season): a newly started block becomes the season's block (mezo-r36n9.113)`.

### Task 8: Phone client, `YearPlanModel`, intake prefill

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/Train/YearPlanWire.swift` (`WireYearPlan`, `WireYearBlock`, `WireYearNote`, `WireYearNext`, `WireYearReview`, `WireYearUnlinked`, `WireYearPlanRequest`, `WireYearBlockPatch`). String enums, lenient.
- Modify: `PlanClient.swift`:
  - `yearPlanPreview(_:) -> WireYearPlan`, `createYearPlan(_:) -> WireYearPlan`
  - `activeYearPlan() -> WireYearPlan?` (404 → nil)
  - `patchYearBlock(id:_:) -> WireYearPlan`, `archiveYearPlan(id:) -> WireYearPlan`
  - `startTemplate(id:startDate:status:yearBlockId: String? = nil)`
  - `PlanWire.swift`: `WireCandidatesRequest`/`WireGenerateRequest.consolidation: Bool?`
  - `ios/scripts/sync-openapi.sh`; `node scripts/check-ios-contract.mjs` (new raw op ids)
- Create: `ios/BoopKit/Sources/BoopCore/Train/YearPlanModel.swift`
- Modify: `NewBlockModel.swift`
- Test: `ios/BoopKit/Tests/BoopCoreTests/{YearPlanModelTests,NewBlockPrefillTests}.swift`, `PlanClientTests` (year fixture), fixtures in `PlanFixtures.swift`

**Interfaces:**
- Produces:
  - `YearPlanModel` (`@MainActor @Observable`): `init(client: PlanClient, cache: ServerCache?, debounce: Duration = .milliseconds(300), now: () -> Date = Date.init)`.
  - `phase: .loading | .none | .ready(WireYearPlan, age: String?) | .failed(PlanFetchError)`.
  - Draft: `startMonday: String` (default = Monday on/after today), `emphasis: Set<String>`, `blockWeeks: Int` (4…8, default 6), `preview: WireYearPlan?` (debounced on every draft edit), `stepStart(by weeks: Int)`.
  - Actions: `load() async`, `accept(replaceActive: Bool = false) async`, `setFocus(_ blockId: String, _ focus: [String]) async` (≤ 2 enforced), `shift(_ blockId: String, by: Int) async`, `move(_ blockId: String, by: Int) async` (`ordinal ± 1`), `skip(_ blockId: String, _ on: Bool) async`, `linkRunning(_ blockId: String) async`, `archive() async`.
  - `prefill(for block: WireYearBlock, today: Date) -> YearBlockPrefill`.
  - A failed load with a cached plan → `.ready(cached, age:)` **[RF 5]**.
  - `YearBlockPrefill(yearBlockId: String, tiers: [String: String], weeks: Int, consolidation: Bool, startDate: String?)`. Focus → `emphasize`, the other 8 landmark groups → `maintain`; consolidation → all `maintain`; `startDate` = block start when after today, else nil.
  - `NewBlockModel.init(…, prefill: YearBlockPrefill? = nil)`. Tiers and weeks from the prefill (consolidation weeks bypass the 4…8 clamp: range 1…3, no stepper). `tiersLocked: Bool` (consolidation). `StartChoice.planned(String)` = default when `startDate` is set. Candidates/generate carry `consolidation`. Start carries `yearBlockId`.

- [ ] **Step 1: Failing tests.**
  - `YearPlanModelTests`: `noPlanIsNoneNotFailure()`, `previewDebouncedOnEdit()`, `acceptCreatesThenReady()`, `focusCapsAtTwo()`, `skipDecodesSuggestion()`, `unknownNoteCodeDecodes()`, **[RF 5]** `failedLoadKeepsCachedPlanWithAge()`, `failedLoadWithoutCacheIsFailed()`.
  - `NewBlockPrefillTests`: `prefillSetsTiersAndWeeks()`, `consolidationLocksTiersAndSendsFlag()` (stub asserts `consolidation: true`, weeks 2), `startCarriesYearBlockId()`, `plannedStartDateUsed()`, `pastStartFallsBackToNextMonday()`.
- [ ] **Step 2: Run** the BoopKit command (Global Constraints) → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS; `node scripts/check-ios-contract.mjs` → OK.
- [ ] **Step 5: Commit** `feat(boop): year-plan client and model, intake prefill from a year block (mezo-r36n9.113)`.

### Task 9: Year view screens — létrehozás, térkép, blokk sheet

**Files:**
- Create: `ios/Boop/EdzesTerv/EvesTerv/`:
  - `YearStrip.swift` (port of `ETYearStrip`; columns = `52 + overrunWeeks` **[RF 4]**; weeks from server dates, upper above / lower below / light last week hollow / buffer dots / consolidation short marks)
  - `EvesTervLetrehozas.swift` (screen 5)
  - `EvesTervTerkep.swift` (screen 6 + review card + unlinked banner + *Éves terv lezárása*)
  - `EvesTervBlokkSheet.swift` (screen 6b + *Sorrend*)
  - `EvesTervKit.swift` (copy, date formatting `szept. 21.`)
- Modify: `ios/Boop/Edzes/EdzesRoom.swift` (`EdzesPage.yearPlan`; entry rows per controller call 8); `ios/Boop/EdzesTerv/PlanPreview.swift` (`-previewEvesTerv YES`, `-previewEvesTervScreen letrehozas|terkep|blokk|nincs|lezaras|csuszas`, served from fixtures of the server shape)

**Interfaces:**
- Consumes: Task 8 `YearPlanModel`.
- Copy (Hungarian; the spike's sentences where it has one):
  - Notes: `emphasis_once` „{Izom}: csak egyszer tudtam fókuszba tenni.” · `no_focus` „{Izom} idén nem kap fókuszt.” · `pair_relaxed` „A {n}. blokkban szokatlan párt raktam össze, másképp nem jött ki.” · `focus_consecutive` „{Izom} két egymást követő blokkban is fókuszban van.” · `no_focus_this_year` title „{Izom} idén nem kap fókuszt”, button „Áttehetem a {n}. blokkba{ a(z) {X} helyére}” · `mixed_focus` „A {n}. blokk fókusza felsőtest- és lábizmot is vegyít.”
  - Plan lines: overrun „A csúszás miatt az év {w} héttel később ér véget.” · shortened consolidation „A lezárás 1 hétre rövidült.”
  - Map lines from server facts: „Idén minden izom legalább egyszer fókuszba kerül…” (from `focusCount`) · „Egy izom sosem kerül fókuszba két egymást követő blokkban.” (only without a `focus_consecutive` warning) · „A végén {c} hét könnyű szinten tartás, előtte {b} tartalék hét betegségre, nyaralásra.”
  - Sheet: *Fókusz · legfeljebb kettő* (chips of the block's kind only), *Időpont* („Egy héttel előbb” disabled unless `canMoveEarlier`, „Egy héttel később”), *Sorrend* („Előrébb a sorban” / „Hátrébb a sorban”), *Kihagyás* (`skipConsequence` box, *Kihagyom*). A running/done block shows no edit controls.
  - Status pills: „kész” · „fut · {w}. hét” · „következik” · „tervezett” · „kihagyva”.
  - Empty state: „Még nincs éves terved” + *Éves terv készítése*.
  - Review card: „Az év vége” · „{d} blokk kész, {s} kihagyva” · fókuszt kapott / nem kapott izmok · *Jövő évi terv* (create with `replaceActive`, start = the consolidation's end).

- [ ] **Step 1: Build the screens** from the spike against `YearPlanModel` fixtures.
- [ ] **Step 2: Simulator walk** (own device "Boop · mezo-r36n9.113"): every preview screen + loading / empty / failed / offline-with-age, the SE width, reduced motion (strip without animation). Captures to `docs/superpowers/specs/assets/eves-terv/build-{5,6,6b}*.png`, compared with the spike captures.
- [ ] **Step 3: Run** both xcodebuild test commands → PASS.
- [ ] **Step 4: Commit** `feat(boop): éves terv — létrehozás, térkép, blokk lap (mezo-r36n9.113)`.

### Task 10: Következik card and the pre-filled intake

**Files:**
- Create: `ios/Boop/Edzes/KovetkezikCard.swift` (screen 7)
- Modify: `ios/Boop/Edzes/EdzesRoom.swift` (loads `YearPlanModel` in `.task` and after the builder/new-block cover closes; card at the top of Ma when `plan.next != nil`; *Indítás* → `openNewBlock(prefill:)`; *Éves terv* → `.yearPlan`); `ios/Boop/EdzesTerv/UjBlokk/UjBlokkAlapok.swift` (`tiersLocked` → chips disabled + „A lezárásban minden izom Tartáson marad, könnyű szinten.”; consolidation hides the weeks stepper and shows „{w} hét lezárás”; prefilled start shows the date choice „{dátum}-tól” first), `UjBlokkJeloltek.swift` (start choices incl. `.planned`), `PlanPreview.swift` (`-previewKovetkezik YES|lezaras`)

**Interfaces:**
- Consumes: Task 8 `YearPlanModel.prefill`, `NewBlockModel(prefill:)`.
- Card copy:
  - Head: „KÖVETKEZIK · AZ ÉVES TERVBŐL”, the focus muscles as title, „{w} hét · {dátum}-tól · {n}. blokk a {m}-ből”.
  - Sentence: `last_week` „A mostani blokkod {nap} ér véget. Most a(z) {fókusz} kerül fókuszba, minden más Tartáson marad.” · `no_block` „Most nincs futó blokkod. A terv szerint a(z) {fókusz} jön, minden más Tartáson marad.” · consolidation „Az év végi lezárás: minden izom Tartáson, könnyű szinten.”
  - Timeline from weeks (light last week, none for consolidation), tier pills, *Indítás*, *Éves terv*.
  - Card hidden when the year plan is not freshly loaded **[RF 5]**.

- [ ] **Step 1: Build** the card and the wiring.
- [ ] **Step 2: Simulator walk:** card on Ma (last week, no block, consolidation), *Indítás* → Alapok pre-filled → Jelöltek → (DEBUG stub) created → builder; offline → no card. Captures `build-7*.png`.
- [ ] **Step 3: Run** both xcodebuild test commands → PASS.
- [ ] **Step 4: Commit** `feat(boop): Következik kártya, előre kitöltött új blokk (mezo-r36n9.113)`.

### Task 11: Docs, review, ship

**Files:**
- `docs/features/train.md`: §4 year plan (tables, generator, layout, reconcile, starter, consolidation path, endpoints), §9.
- `docs/features/season.md`: §3.3 the new block becomes the season's block, §5.
- `docs/features/boop-ios.md`: year view, Következik, prefill, §4 calls.
- Feature-index row, `docs/milestones/roadmap.md` entry.
- Handbook: new `docs/boop-handbook/07-edzes/19-eves-terv.md`; update `18-uj-blokk-tervjeloltek.md` (prefill, consolidation) and `16-blokk-epito.md` (planned block starts on its day).
- `_jegyek.json` (.113 row), `_dontesek.json` (controller calls 1, 3, 8 as „Boop döntése, a tulajdonos látta”), `_kiadasok.json`, `_funkciok.json` (new row `train-eves-terv`, app „Kész”), `.claude/skills/boop/SKILL.md` §6 row.

- [ ] **Step 1:** Write the docs; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` → 0 errors / 0 stale.
- [ ] **Step 2:** Fresh-context whole-branch review on the most capable model. Fix Critical/Important test-first; minors → bd under `mezo-r36n9`.
- [ ] **Step 3:** Backend focused ITs (Tasks 1–7) + `ArchitectureTest` + `MessageBundleParityTest` (testcontainers); both iOS suites; `git pull --rebase`; detached-HEAD `--no-ff` merge; `git push origin HEAD:main`; regenerate CODEMAP after the merge.
- [ ] **Step 4:** `deploy` green, pod tag = release version. Prod read: `training_year_plan` / `training_year_block` exist (`\d`), no rows until he creates one; his active mesocycle untouched.
- [ ] **Step 5:** Install on the phone (`ios/scripts/install-on-phone.sh`, say so first). Walk: Éves terv → létrehozás preview (his running block as block 1) → Elfogadom only on his yes → térkép → blokk lap.
- [ ] **Step 6:** Notion `plan` → apply → `check` 0; `node scripts/check-beads-backup.mjs --fix`; Hungarian report.

## Kész, ha…

- [ ] Az Edzés szobából elérhető az Éves terv. Terv nélkül a „Még nincs éves terved” állapot, készítés után az 52 hetes sáv a blokkokkal, a könnyítő hetekkel, a tartalékkal, a lezárással és az „itt tartasz” jellel.
- [ ] Létrehozáskor az előnézet mutatja a blokkokat. Minden izom legalább egyszer fókuszba kerül, a kiemeltek kétszer, és ha valami nem fért bele, azt ki is mondja. Egy blokkban legfeljebb 2 fókusz van, és egyik izom sem kap 0 kemény sorozatot (tesztek).
- [ ] Ha most készíti, a futó blokkja lesz az 1. blokk, és jó héten áll az „itt tartasz”.
- [ ] Egy blokk fókusza cserélhető, a blokk mozgatható egy héttel, áthelyezhető a sorban és kihagyható. A szabályszegés figyelmeztetés, nem tiltás. Kihagyáskor látszik, melyik izom marad fókusz nélkül, és jön az áthelyezési ajánlat.
- [ ] A késés (3 napnál több), a kihagyás és a korai befejezés átütemezi a többi blokkot: előbb a tartalék fogy, aztán 1 hétre rövidül a lezárás, végül az év vége kitolódik, és ezt ki is írja.
- [ ] A blokk utolsó hetén, vagy ha nincs futó blokk, az Edzés Ma lapján megjelenik a Következik kártya. Az Indítás előre kitöltött új blokkot nyit (fókusz Hangsúlyon, a többi Tartáson, hetek, kezdés), az elindított blokk az éves tervhez kötődik, és a „Jövő hétfőn” blokk a saját napján tényleg elindul.
- [ ] Az év végi lezárás 2 hetes, minden izom Tartáson van, könnyű szinten, felfutás és külön könnyítő hét nélkül. Közben az év összegzése és a jövő évi terv ajánlata látszik.
- [ ] Az új blokk az évad blokkja lesz: az évad oldalon az új blokk áll, a könnyítő hetei is, a cél és az étkezési célok nem változnak.
- [ ] Hálózat nélkül a térkép az utolsó ismert tervet mutatja a korával, a Következik kártya nem jelenik meg. Kis iPhone-szélesség, csökkentett mozgás, sehol emoji vagy „Mezo”.
- [ ] Kapuk: backend fókuszált IT-k + ArchitectureTest + MessageBundleParityTest; BoopKit + Boop tesztek; codemap; lint-docs 0/0; ios-contract.
- [ ] Dokumentáció, kézikönyv és Notion kész; merge, zöld deploy, a telefonra telepítve és végigjárva.
