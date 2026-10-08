# Kihagyás S3 · Kaja — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-tap skipping of an unlogged meal slot (stored, neutral, no redistribution) and a per-category kímélő-mód Fuel (guidance instead of a kcal target for illness / stomach bug, maintenance + protein for injury, a muted reference target for travel), with every backend judge of "ate too little" made aware of both.

**Architecture:** `planned_skip` gains kind `MEAL` and flows through the one central read (`PlannedSkipService.verdictsBetween`); the recovery period answers a pure `RecoveryFuelMode` per date. `FuelDayService` is the single place that turns both into served fields (`fuelMode`, `skippedKcal`, maintenance targets), and every consumer reads them from the Fuel day/week it already fetches. The FE marks the skipped window **after** the budget split, so nothing is ever renormalised.

**Tech Stack:** Spring Boot 3 / Java 21 / Liquibase / PostgreSQL · OpenAPI fragments → generated `api.gen.ts` · React 18 + TanStack Query + Vitest · Playwright layout specs.

**Spec:** `docs/superpowers/specs/2026-09-28-kihagyas-kimelo-mod-design.md` §10 (+ Slice lessons S1/S2).
**Prototype (build target, owner-approved 2026-10-07):** `docs/design_2.0/prototypes/elo/fuel.html` — routes `#mai`, `#mai?d=2026-09-27`, `#mai?km=ILLNESS|STOMACH|INJURY|TRAVEL`, `#trendek`, `#ikonok-s3`; sheets `mealwhy`, `orvos`. Serve it with `python3 -m http.server 8817 --bind 127.0.0.1` from `docs/design_2.0/prototypes` (check `lsof -i :8817` first).

## Global Constraints

- **One central read.** MEAL skips are read only through `PlannedSkipService.verdictsBetween` / helpers built on it; recovery days only through `RecoveryPeriodService`. No new "is it skipped / protected?" query anywhere else.
- **No redistribution.** A skipped slot keeps its budget share; no other slot's budget, and no "fér még bele" figure, may grow because of a skip.
- **A meal skip is never missed:** always `excused`, never `freePass`, never in the weekly pass race, never bridges the training streak.
- **Fuel mode follows the period's days** (`startDate … endedOn−1`, open-ended while open), **ignoring** `recovery_day_release`.
- Mode map: `ILLNESS, STOMACH → GUIDANCE` · `INJURY → MAINTENANCE` · `TRAVEL → ESTIMATE`.
- **Copy:** Hungarian; Fuel shame-vocabulary guard applies to every new string (`elrontott|túlléptél|hiba|rossz|bukta|kudarc` must not appear); nothing turns red or amber because of a skip or a period day. Use the prototype's strings verbatim.
- **Icons:** Titanium sprite only, never emoji. New: `t-tea`, `t-nohunger` (from the prototype) via `docs/design_2.0/assets/titanium-custom.svg` + `node scripts/gen-titanium-sprite.mjs` — never paste into generated sprite outputs.
- **Boundaries:** train never imports meal/fuel/companion; `RecoveryPeriodService` stays repository-only; layer subpackages enforced (ArchUnit — run `./mvnw test -Dtest=ArchitectureTest` after every backend task; focused ITs do not run it).
- **Backend ITs:** always `-Dmezo.test.use-testcontainers=true`. **FE tests:** `CI=true pnpm test` twice — `VITE_USE_MOCK` unset and `VITE_USE_MOCK=false` (file filters after `--` do not scope; the whole suite runs).
- Released Liquibase changesets are immutable → new changeset file under `backend/src/main/resources/db/changelog/1.1.0/script/`, registered like its neighbours. jsonb `?` → `jsonb_exists()`.
- Not switch-gated, no LLM. Commit subjects carry `(mezo-q4xt2.3)`; end messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Absolute paths in every shell command (the session cwd may drift); never `cd` to the primary repo.

## File map

| Area | Files |
|---|---|
| DB | create `…/1.1.0/script/202610071000_mezo-q4xt2.3_planned_skip_meal.sql` (+ its changelog include) |
| Contract | `api/feature/train/train-skip.yml`, `api/feature/meal/meal.yml` → regenerated `frontend/src/data/api.gen.ts` + backend DTOs |
| train | `entity/PlannedSkipEntity.java`, `service/PlannedSkipService.java`, `service/PlannedSkipPolicy.java`, `service/RecoveryPeriodService.java`, create `service/RecoveryFuelMode.java` |
| nutrition / meal | `nutrition/service/DayTargetProjector.java`, `meal/service/FuelDayService.java`, `meal/service/MealCoachPrompt.java`, `meal/service/GoalIntakeAdherenceAdapter.java` |
| companion & co. | `companion/service/ContextSnapshotAssembler.java`, `DayScoreService.java`, `companion/tools/FuelTools.java`, `companion/flags/service/FlagEvaluator.java` + rules `LoadFuelMismatchRule`, `LoggingGapRule`, `MealRhythmDriftRule`, `character/service/CharacterSignalReads.java`, `quest/service/QuestSelector.java`, `habit/service/HabitEvaluator.java` |
| FE data | `features/train/logic/plannedSkips.ts`, `data/train/skipHooks.ts`, `data/types.ts`, `data/fuel/fuel.ts` (+ mock), create `features/fuel/logic/mealSkips.ts`, create `features/fuel/logic/fuelMode.ts` |
| FE logic | `features/fuel/logic/buildDayPlan.ts`, `fuelSwimlane.ts`, `heroWindow.ts`, `keretHero.ts`, `fuelWeekView.ts`, `data/fuel/timelineHooks.ts`, `data/today/todayHooks.ts` |
| FE UI | `features/fuel/components/FuelMealBlocks.tsx`, `FuelEnergyHero.tsx`, `FuelWeekDayGlass.tsx`, `features/fuel/pages/FuelMaiPage.tsx`, create `features/fuel/sheets/MealSkipSheet.tsx`, create `features/fuel/components/FuelGuidanceCard.tsx`, create `features/fuel/sheets/DoctorSheet.tsx`, create `features/fuel/components/FuelRecoveryNote.tsx`, Fuel CSS next to the existing `fmx-*` rules |
| Icons | `docs/design_2.0/assets/titanium-custom.svg` → generator outputs |
| Docs | `docs/features/fuel.md`, `train.md`, `companion.md`, `docs/features/README.md`, `docs/milestones/roadmap.md`, `docs/CODEMAP.md`, `docs/design_2.0/prototypes/elo/README.md`, spec "Slice lessons S3" |

---

### Task 1: `planned_skip` learns MEAL (DB, contract, service, policy)

**Files:** the DB script (create) · `api/feature/train/train-skip.yml` · `PlannedSkipEntity.java` · `PlannedSkipService.java` · `PlannedSkipPolicy.java` · tests `PlannedSkipPolicyTest`, `PlannedSkipApiIT` (extend the existing ones; find them with `grep -rl "PlannedSkipPolicy" backend/src/test`).

**Interfaces — Produces:**
- `PlannedSkipEntity.Kind.MEAL`, `PlannedSkipEntity.Reason.NOT_HUNGRY`, `Integer plannedKcal` (column `planned_kcal`).
- Contract: `PlannedSkipKind += MEAL`; `PlannedSkipReason += NOT_HUNGRY`; `plannedKcal: integer, min 0, max 5000, nullable` on request and response.
- `PlannedSkipPolicy.Row` gains `Integer plannedKcal` (last component; keep the shorter constructors delegating with `null`).
- `PlannedSkipService.mealSkipsOn(UUID user, LocalDate date) : List<PlannedSkipPolicy.Row>` and `mealSkipsBetween(UUID user, LocalDate from, LocalDate to) : Map<LocalDate, List<Row>>` — both built on `verdictsBetween`, filtered to `Kind.MEAL`.
- Error codes: `TRAIN_SKIP_REASON_INVALID` (new), existing `TRAIN_SKIP_TARGET_INVALID`, `TRAIN_SKIP_DATE_OUT_OF_WINDOW`.

- [ ] **Step 1: Failing policy tests.** Add to `PlannedSkipPolicyTest`:

```java
@Test
void mealSkipIsAlwaysExcusedAndNeverTakesTheWeeklyPass() {
    Instant t0 = Instant.parse("2026-09-28T08:00:00Z");
    Row meal = new Row(UUID.randomUUID(), LocalDate.of(2026, 9, 28), Kind.MEAL, null, null, "lunch#1",
        Reason.NOT_HUNGRY, null, Source.USER, t0);
    Row gym = new Row(UUID.randomUUID(), LocalDate.of(2026, 9, 29), Kind.GYM, null, null, null,
        Reason.NO_TIME, null, Source.USER, t0.plusSeconds(3600));
    List<Verdict> v = PlannedSkipPolicy.judge(List.of(meal, gym));
    assertThat(v.get(0).excused()).isTrue();
    assertThat(v.get(0).freePass()).isFalse();
    assertThat(v.get(1).freePass()).as("the later GYM skip still gets the week's pass").isTrue();
}

@Test
void seriousMealSkipIsExcusedWithoutPass() {
    Row meal = new Row(UUID.randomUUID(), LocalDate.of(2026, 9, 28), Kind.MEAL, null, null, "dinner#1",
        Reason.STOMACH, null, Source.USER, Instant.parse("2026-09-28T18:00:00Z"));
    Verdict v = PlannedSkipPolicy.judge(List.of(meal)).get(0);
    assertThat(v.serious()).isTrue();
    assertThat(v.excused()).isTrue();
    assertThat(v.freePass()).isFalse();
}
```

- [ ] **Step 2:** Run `./mvnw -f <repo>/backend/pom.xml test -Dtest=PlannedSkipPolicyTest` → FAIL (no `Kind.MEAL`).
- [ ] **Step 3: Liquibase.** Create the script (copy the header comment style of `202609281500_mezo-q4xt2.1_planned_skip.sql`; register it where that file is registered):

```sql
-- Kihagyás S3 (mezo-q4xt2.3, spec §10): a skipped MEAL slot. session_key = '<slotKind>#<n>'
-- (n = 1-based index among the day's planned windows of that kind); planned_kcal = the slot's
-- budget at skip time, a snapshot (windows exist only in the FE). New reason NOT_HUNGRY (MEAL only).
alter table planned_skip add column planned_kcal integer;
alter table planned_skip drop constraint ck_planned_skip_kind;
alter table planned_skip add constraint ck_planned_skip_kind check (kind in ('GYM', 'SPORT', 'RUN', 'MEAL'));
alter table planned_skip drop constraint ck_planned_skip_reason;
alter table planned_skip add constraint ck_planned_skip_reason check (reason_category in
    ('ILLNESS', 'STOMACH', 'INJURY', 'TRAVEL', 'TIRED', 'NO_TIME', 'NO_MOOD', 'NOT_HUNGRY', 'OTHER', 'NONE'));
alter table planned_skip drop constraint ck_planned_skip_target;
alter table planned_skip add constraint ck_planned_skip_target check (
    (kind = 'GYM'   and day_of_week is null and time is null and session_key is null) or
    (kind = 'SPORT' and day_of_week is not null and time is not null and session_key is null) or
    (kind = 'RUN'   and day_of_week is null and time is null and session_key is not null) or
    (kind = 'MEAL'  and day_of_week is null and time is null and session_key is not null));
alter table planned_skip add constraint ck_planned_skip_planned_kcal check (
    planned_kcal is null or (kind = 'MEAL' and planned_kcal between 0 and 5000));
```

- [ ] **Step 4: Entity + policy.** Add the enum values and `plannedKcal`. In `PlannedSkipPolicy.judge`: exclude `Kind.MEAL` from the `passByWeek` stream filter, and compute

```java
boolean meal = r.kind() == PlannedSkipEntity.Kind.MEAL;
boolean pass = !meal && r.source() == Source.USER && !r.backed() && !serious
    && r.id().equals(passByWeek.get(isoWeekKey(r.date())));
return new Verdict(r, serious, pass, meal || serious || pass
    || r.source() == Source.ADVICE || r.source() == Source.RECOVERY || r.backed());
```

Update the class Javadoc rule list with the MEAL line.
- [ ] **Step 5: Service.**
  - `upsert`: for `Kind.MEAL` the window is `today−7 ≤ date ≤ today` (future → `TRAIN_SKIP_DATE_OUT_OF_WINDOW`); store `plannedKcal` (null for other kinds).
  - `validateTarget`: `case MEAL -> req.getSessionKey() != null && req.getSessionKey().matches("(breakfast|lunch|dinner|snack)#[1-9]") && req.getDayOfWeek() == null && req.getTime() == null;`
  - New reason check → `TRAIN_SKIP_REASON_INVALID`: `NOT_HUNGRY` only with MEAL; MEAL only with `NOT_HUNGRY, NO_TIME, STOMACH, ILLNESS, TRAVEL, OTHER, NONE`.
  - `verdictsBetween`: pass `e.getPlannedKcal()` into the `Row`; a MEAL row is never `recoveryBacked`/`adviceBacked` (set both false for MEAL).
  - `bridgedWeeks`: skip `Kind.MEAL` verdicts. Audit every caller of `verdictsBetween` in `backend/src/main` (`grep -rn "verdictsBetween" backend/src/main`) — each must filter by kind or be kind-safe; list the dispositions in the commit body.
  - `toResponse`: map `plannedKcal`. Add `mealSkipsOn` / `mealSkipsBetween`.
- [ ] **Step 6: Contract + regen.** Edit `train-skip.yml` (enum values, `plannedKcal`, PUT description: "MEAL: sessionKey = `<slotKind>#<n>`, date in [today−7, today]"). Regenerate with the repo's contract commands (see `AGENTS.md` §Build & Test → API contract; the drift gate must pass).
- [ ] **Step 7: IT cases** in `PlannedSkipApiIT` (each a separate `@Test`):
  1. PUT `{date: today, kind: MEAL, sessionKey: "lunch#1", reasonCategory: NONE, plannedKcal: 900}` → 200, `excused=true`, `freePass=false`, `plannedKcal=900`.
  2. Same PUT again with `reasonCategory: NOT_HUNGRY` → same `id`, reason updated (idempotent).
  3. MEAL + `sessionKey: "brunch#1"` → 400 `TRAIN_SKIP_TARGET_INVALID`.
  4. MEAL + `date: today+1` → 400 `TRAIN_SKIP_DATE_OUT_OF_WINDOW`.
  5. MEAL + `reasonCategory: TIRED` → 400 `TRAIN_SKIP_REASON_INVALID`; GYM + `NOT_HUNGRY` → 400 same code.
  6. A MEAL skip (NONE) then a GYM skip (NO_TIME) in the same ISO week → GET `/skips`: the GYM row has `freePass=true`.
  7. DELETE the MEAL skip → 204; GET no longer lists it.
  8. Streak guard: a week whose only skip is a MEAL skip is **not** in `bridgedWeeks` (assert through the service bean).
- [ ] **Step 8:** Run `./mvnw … test -Dtest='PlannedSkipPolicyTest,PlannedSkipApiIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true` → PASS.
- [ ] **Step 9:** Commit `feat(train): planned skip learns MEAL — neutral, pass-free, kcal snapshot (mezo-q4xt2.3)`.

---

### Task 2: Fuel mode + served Fuel day/week fields

**Files:** create `train/service/RecoveryFuelMode.java` · `RecoveryPeriodService.java` (+ its repository if a finder is missing) · `DayTargetProjector.java` · `FuelDayService.java` · `api/feature/meal/meal.yml` · tests `RecoveryFuelModeTest` (new), `DayTargetProjectorTest`, `RecoveryPeriodServiceIT` (or the existing recovery IT), `FuelDayApiIT` (find with `grep -rl "FuelDayService\|/api/fuel/day\|getFuelDay" backend/src/test`).

**Interfaces — Consumes:** Task 1's `mealSkipsOn` / `mealSkipsBetween`.
**Produces:**

```java
package io.mrkuhne.mezo.feature.train.service;
/** How Fuel behaves on a kímélő-mód day (Kihagyás S3, spec §10.1.2). Pure. */
public enum RecoveryFuelMode {
    GUIDANCE, MAINTENANCE, ESTIMATE;
    public static RecoveryFuelMode of(PlannedSkipEntity.Reason category) {
        return switch (category) {
            case ILLNESS, STOMACH -> GUIDANCE;
            case INJURY -> MAINTENANCE;
            case TRAVEL -> ESTIMATE;
            default -> throw new IllegalArgumentException("not a recovery category: " + category);
        };
    }
    /** True when a kcal target must not be judged on this day. */
    public boolean unjudged() { return this == GUIDANCE || this == ESTIMATE; }
}
```

- `RecoveryPeriodService.fuelDays(UUID user, LocalDate from, LocalDate to) : Map<LocalDate, RecoveryPeriodEntity>` — every date in `[from,to]` inside a non-deleted period's `startDate … (endedOn−1 | open-ended)`, **releases ignored**; if two periods touch a date the later-started wins.
- `DayTargetProjector.project(seg, base, movement, fallback, boolean dropDeficit)` — when `dropDeficit`, `segBalance = Math.max(segBalance, 0)`; the existing 4-arg overload delegates with `false`.
- Contract (`meal.yml`): on `FuelDayResponse` **and** `FuelDayRollup`: `fuelMode: {type: string, enum: [GUIDANCE, MAINTENANCE, ESTIMATE], nullable: true}`, `recoveryCategory: {type: string, enum: [ILLNESS, STOMACH, INJURY, TRAVEL], nullable: true}`, `recoveryDay: {type: integer, nullable: true}` (1-based day of the period), `skippedKcal: {type: integer}` (0 when none; **0 in GUIDANCE**).

- [ ] **Step 1: Failing unit tests.**

```java
class RecoveryFuelModeTest {
    @Test void mapsCategories() {
        assertThat(RecoveryFuelMode.of(Reason.ILLNESS)).isEqualTo(RecoveryFuelMode.GUIDANCE);
        assertThat(RecoveryFuelMode.of(Reason.STOMACH)).isEqualTo(RecoveryFuelMode.GUIDANCE);
        assertThat(RecoveryFuelMode.of(Reason.INJURY)).isEqualTo(RecoveryFuelMode.MAINTENANCE);
        assertThat(RecoveryFuelMode.of(Reason.TRAVEL)).isEqualTo(RecoveryFuelMode.ESTIMATE);
        assertThatThrownBy(() -> RecoveryFuelMode.of(Reason.TIRED)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void onlyGuidanceAndEstimateAreUnjudged() {
        assertThat(RecoveryFuelMode.GUIDANCE.unjudged()).isTrue();
        assertThat(RecoveryFuelMode.ESTIMATE.unjudged()).isTrue();
        assertThat(RecoveryFuelMode.MAINTENANCE.unjudged()).isFalse();
    }
}
```

In `DayTargetProjectorTest` (reuse its existing segment/base fixtures): with base 2480, movement 190, balance −400 → `project(…, true).kcal() == 2670` and `energy.balance() == 0`; with balance +250 (bulk) → `project(…, true).kcal()` equals `project(…, false).kcal()`.
- [ ] **Step 2:** Run both → FAIL. **Step 3:** implement enum + overload → PASS.
- [ ] **Step 4: `fuelDays`.** Read `protectedDays` in `RecoveryPeriodService` and mirror its period lookup without the release subtraction (add a repository finder only if none returns ended + open periods overlapping a range). IT cases: open period started 3 days ago → 4 dates incl. today; a released date is **still** present; an ended period (`endedOn = today`) → today absent, yesterday present; a soft-deleted period → nothing.
- [ ] **Step 5: `FuelDayService`.** Inject `RecoveryPeriodService` and `PlannedSkipService`.
  - `getDay`: `period = fuelDays(user, date, date).get(date)`; `mode = period == null ? null : RecoveryFuelMode.of(period.getCategory())`; project with `dropDeficit = (mode == MAINTENANCE)`; `skippedKcal = mode == GUIDANCE ? 0 : min(Σ plannedKcal of mealSkipsOn(user, date), targets.kcal)` (null `plannedKcal` counts 0); set the four new fields (`recoveryDay = DAYS.between(start, date) + 1`).
  - `getWeek`: **one** `fuelDays(user, start, end)` and **one** `mealSkipsBetween(user, start, end)` for the week (no per-day query), same rules per rollup.
- [ ] **Step 6: IT cases** (`FuelDayApiIT`): no period/no skip → `fuelMode` null, `skippedKcal` 0; INJURY period + deficit goal → `fuelMode=MAINTENANCE`, `energy.balance == 0`, `targets.kcal` higher by the deficit than the same day without the period; ILLNESS → `GUIDANCE`, `recoveryDay` correct, `skippedKcal` 0 even with a MEAL skip row; TRAVEL → `ESTIMATE`, targets unchanged; MEAL skip 900 on a normal day → `skippedKcal=900`, targets unchanged; two skips summing above the target → clamped to `targets.kcal`; week rollup carries `fuelMode` on period days only.
- [ ] **Step 7:** contract regen; run `-Dtest='RecoveryFuelModeTest,DayTargetProjectorTest,*Recovery*IT,FuelDayApiIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true` → PASS.
- [ ] **Step 8:** Commit `feat(fuel): served fuel mode + skipped kcal on the Fuel day and week (mezo-q4xt2.3)`.

---

### Task 3: The coach, the meal coach and the day score go quiet

**Files:** `ContextSnapshotAssembler.java` (`fuelBlock` ~l.635) · `MealCoachPrompt.java` (~l.63, 216) · `DayScoreService.java` (~l.235, where `DayInputs` gets its targets) · `FuelTools.java` (~l.128, 162) · their existing tests.

**Interfaces — Consumes:** `FuelDayResponse.getFuelMode()/getRecoveryCategory()/getSkippedKcal()`, `PlannedSkipService.mealSkipsOn`.

Rules (exact):
- **`fuelBlock`**
  - `GUIDANCE`: `"[Mai üzemanyag] Kímélő mód (<betegség|gyomorrontás>): ma nincs kalóriacél. Eddig <kcal> kcal, fehérje <p> g, víz <w>/<wt> ml. Ne mérd semmihez az evést, ne említs hiányt; folyadék és könnyű étel."` — no `/target` for kcal or macros.
  - `ESTIMATE`: the normal line + `" (úton van: a keret csak tájékoztató, becsült nap — ne kérd számon)"`.
  - `MAINTENANCE`: the normal line + `" (sérülés: szinten tartó keret, a fogyási hiány szünetel; a fehérje a fő cél)"`.
  - Any mode-less day with meal skips: append `"; kihagyott étkezés: <Reggeli|Ebéd|Vacsora|Snack> (<ok>)"` per skip, joined by `, `; reason labels: `NOT_HUNGRY nem éhes · NO_TIME nincs ideje · STOMACH gyomorrontás · ILLNESS beteg · TRAVEL úton · OTHER <reasonText or "egyéb"> · NONE ok nélkül`; then `" — tudatos kihagyás, nem mulasztás."`. Slot label from the `sessionKey` prefix.
- **`MealCoachPrompt`**: in `GUIDANCE` replace the "NAPI CÉLOK" block and the remaining-kcal line with `"KÍMÉLŐ MÓD: ma nincs kalóriacél. Ne számolj hátralévő keretet; könnyű, jól tolerálható ételt javasolj, folyadékkal."`; in `ESTIMATE` keep targets, add `"A keret ma csak tájékoztató (utazás)."`; otherwise remaining kcal = `target − eaten − skippedKcal`.
- **`DayScoreService`** (inputs only; `DayEvaluationEngine` stays untouched): `fuelMode.unjudged()` → pass `null` for `kcalTarget`, `proteinTargetG`, `carbsTargetG`, `fatTargetG` (the nutrition dimension becomes `NO_DATA` and the others renormalise); otherwise with `skippedKcal > 0` scale all four targets by `(targetKcal − skippedKcal) / targetKcal` (if the factor is ≤ 0 → nulls).
- **`FuelTools`**: day text — the same mode sentence as `fuelBlock`; week text — a period day prints `"kímélő nap (nincs értékelve)"` instead of its "vs cél" comparison.

- [ ] **Step 1: Failing tests** (extend each class's existing test; build the Fuel day via the existing fixtures/mocks):
  - `ContextSnapshotAssembler`: GUIDANCE output contains `"ma nincs kalóriacél"` and does **not** match `\d+/\d+ kcal`; a normal day with a `lunch#1`/`NOT_HUNGRY` skip contains `"kihagyott étkezés: Ebéd (nem éhes)"`.
  - `MealCoachPrompt`: GUIDANCE prompt contains `"KÍMÉLŐ MÓD"` and not `"NAPI CÉLOK"`; a 900-kcal skip lowers the printed remaining kcal by 900.
  - `DayScoreService`: GUIDANCE closed day → nutrition dimension status `NO_DATA`; target 2400, eaten 1500, `skippedKcal` 900 → nutrition score equals the score of eaten 1500 vs target 1500 with proportionally scaled macros (assert `>= 90`), and is strictly higher than without the skip.
  - `FuelTools`: week text for a period day contains `"kímélő nap"`.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** run the four test classes + `ArchitectureTest` → PASS.
- [ ] **Step 5:** Commit `feat(companion): coach, meal coach and day score honour meal skips and the fuel mode (mezo-q4xt2.3)`.

---

### Task 4: Flags, character, quests, habits and the adaptive review ignore kímélő days

**Files:** `FlagEvaluator.java` · `rule/LoadFuelMismatchRule.java` · `rule/LoggingGapRule.java` · `rule/MealRhythmDriftRule.java` · `CharacterSignalReads.java` (~l.826-851) · `QuestSelector.java` · `HabitEvaluator.java` (~l.100-112) · `GoalIntakeAdherenceAdapter.java` · tests of each.

**Interfaces — Consumes:** `RecoveryPeriodService.open`, `fuelDays`; `FuelDayResponse/FuelDayRollup.getFuelMode()`; `RecoveryFuelMode.unjudged()`.

Rules (exact):
1. `FlagEvaluator`: while `openRecovery.isPresent()`, `LOAD_FUEL_MISMATCH`, `LOGGING_GAP`, `MEAL_RHYTHM_DRIFT` return `FlagVerdict.unavailable(key, UnavailableReason.RECOVERY_MODE)` (same pattern as the four S2 keys; update the comment to "seven rules").
2. After the period ends the windows still contain its days:
   - `LoadFuelMismatchRule`: days whose `getDay(...).getFuelMode()` is non-null and `unjudged()` are left out of the kcal average and the target average (fewer than the rule's own minimum days left → its existing "not enough data" outcome).
   - `LoggingGapRule` and `MealRhythmDriftRule`: load `recoveryPeriodService.fuelDays(user, windowStart, today)` once and drop those dates from the observation window before counting gaps / dead slots.
3. `CharacterSignalReads` (macro-adherence day rows): a `fuelDays` date with an `unjudged()` mode is omitted from the detector input; a `MAINTENANCE` date uses `DayTargetProjector.project(…, true)` for its kcal target.
4. `QuestSelector`: on a date whose fuel mode is `GUIDANCE`, the `protein_target` quest is not eligible (the next catalog candidate takes the slot); `water_target` stays eligible.
5. `HabitEvaluator`: on a `GUIDANCE` date `breakfast_protein` and `last_meal_before` yield `true` (vacuously kept — a sick day must not break the chain).
6. `GoalIntakeAdherenceAdapter.weekAdherence`: rollups with a non-null `fuelMode` are excluded from the adherence figures (logged-day count and averages); if none remain return what the adapter returns today for a week without logged days.
7. **Audit and report** (no behaviour change unless a judgment is found): `GoalDailyIntakeAdapter`, `TeamEditionReads`, `DailySummaryService`, `MeWeekService`, `MetricSeriesService`, `MesoContextAssembler`, `proactive/service/WeeklyReviewGenerator`, `proactive/…/RetroLoggingProbe`. For each, state in the commit body: "display only — untouched" or the fix. Rule: wherever eaten-vs-target becomes a score, an adherence %, an "under target" sentence or a nudge, skip `unjudged()` days.

- [ ] **Step 1: Failing tests** — one per rule above, in the class's existing test: (1) open ILLNESS period → the three keys come back `UNAVAILABLE / RECOVERY_MODE`; (2) a 7-day window with 4 sick low-kcal days and 3 normal days at target → `LOAD_FUEL_MISMATCH` not raised (without the period it is raised — assert both); (3) logging gap entirely inside an ended period → not raised; (4) selector on a GUIDANCE day never returns `protein_target`; (5) both habits `true` on a GUIDANCE day with no meals; (6) a week of 3 GUIDANCE rollups at 900 kcal + 4 on-target days → adherence equals that of the 4 days alone.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement (inject `RecoveryPeriodService` where missing — check for constructor cycles; companion/quest/habit/character/meal → train is an allowed direction). **Step 4:** run the touched test classes + `ArchitectureTest` with Testcontainers → PASS.
- [ ] **Step 5:** `node scripts/gen-codemap.mjs`; commit `feat(companion): kímélő days are not judged — flags, character, quests, habits, adaptive review (mezo-q4xt2.3)`.

---

### Task 5: FE data layer — MEAL skips and the fuel mode

**Files:** `features/train/logic/plannedSkips.ts` (+ test) · `data/train/skipHooks.ts` (+ mock store) · `data/types.ts` · `data/fuel/fuel.ts` and its mock/real mappers · create `features/fuel/logic/mealSkips.ts` (+ test) · create `features/fuel/logic/fuelMode.ts` (+ test).

**Produces:**

```ts
// plannedSkips.ts
export type SkipKind = 'GYM' | 'SPORT' | 'RUN' | 'MEAL' | 'DAY'
export type SkipReason = 'ILLNESS' | 'STOMACH' | 'INJURY' | 'TRAVEL' | 'TIRED' | 'NO_TIME' | 'NO_MOOD' | 'NOT_HUNGRY' | 'OTHER' | 'NONE'
export interface PlannedSkip { /* … existing … */ plannedKcal?: number | null }

// features/fuel/logic/mealSkips.ts
export const MEAL_REASONS: readonly { value: SkipReason; label: string; icon: string; serious: boolean }[] = [
  { value: 'NOT_HUNGRY', label: 'Nem vagyok éhes', icon: 't-nohunger', serious: false },
  { value: 'NO_TIME', label: 'Nincs időm', icon: 't-clock', serious: false },
  { value: 'STOMACH', label: 'Gyomorrontás', icon: 't-digestion', serious: true },
  { value: 'ILLNESS', label: 'Beteg vagyok', icon: 't-ill', serious: true },
  { value: 'TRAVEL', label: 'Úton vagyok', icon: 't-travel', serious: true },
  { value: 'OTHER', label: 'Egyéb', icon: 't-other', serious: false },
]
/** `<slotKind>#<n>` for every planned meal window, n = 1-based index among same-kind windows in time order. */
export function mealSkipKeys(windows: readonly { slotKey: SlotKey }[]): string[]
export function mealSkipLabel(skip: Pick<PlannedSkip, 'reasonCategory' | 'reasonText'>): string // 'ok nélkül' | '„text”' | chip label
/** Meal skips may target today and the last 7 days — never the future. */
export function canSkipMealOn(dateIso: string, todayIso: string): boolean

// features/fuel/logic/fuelMode.ts
export type FuelMode = 'GUIDANCE' | 'MAINTENANCE' | 'ESTIMATE'
export const fuelModeOf = (category: SkipReason): FuelMode | null  // ILLNESS/STOMACH→GUIDANCE, INJURY→MAINTENANCE, TRAVEL→ESTIMATE, else null
```

- `matches()` in `plannedSkips.ts`: a `DAY` row must **not** match a `MEAL` target (`if (s.kind === 'DAY' && s.date === t.date) return t.kind !== 'MEAL'`); `MEAL` matches on `sessionKey` like `RUN`.
- Mock `judge`: MEAL rows are excluded from the pass race, `freePass=false`, `excused=true`.
- `usePlannedSkips().upsert` accepts `plannedKcal`; the mock store keeps it. Real-mode request body sends it only for MEAL.
- Fuel day type (the FE `fuel` object from `useFuelDay`): add `fuelMode: FuelMode | null`, `recoveryCategory`, `recoveryDay: number | null`, `skippedKcal: number`. Real mode maps the served fields. **Mock mode derives them** from the mock recovery state (`useRecovery` mock cache: period covering the date, releases ignored → `fuelModeOf(category)`) and from the mock planned skips of that date (`Σ plannedKcal`, 0 in GUIDANCE), so both modes behave alike. Week rollups get `fuelMode` the same way.

- [ ] **Step 1: Failing tests** (`plannedSkips.test.ts`, `mealSkips.test.ts`, `fuelMode.test.ts`):

```ts
it('a recovery DAY row never hides a meal', () => {
  const day = { kind: 'DAY', date: '2026-09-28' } as const
  expect(isSkipped([day], { kind: 'MEAL', date: '2026-09-28', sessionKey: 'lunch#1' })).toBe(false)
  expect(isSkipped([day], { kind: 'GYM', date: '2026-09-28' })).toBe(true)
})
it('a meal skip neither takes nor needs the weekly pass', () => {
  const meal = skip({ id: 'a', kind: 'MEAL', sessionKey: 'lunch#1', reasonCategory: 'NONE', createdAt: '2026-09-28T08:00:00Z' })
  const gym = skip({ id: 'b', kind: 'GYM', reasonCategory: 'NO_TIME', createdAt: '2026-09-29T08:00:00Z' })
  const [m, g] = judge([meal, gym])
  expect(m).toMatchObject({ excused: true, freePass: false })
  expect(g.freePass).toBe(true)
})
it('numbers same-kind windows in time order', () => {
  expect(mealSkipKeys([{ slotKey: 'breakfast' }, { slotKey: 'snack' }, { slotKey: 'lunch' }, { slotKey: 'snack' }, { slotKey: 'dinner' }]))
    .toEqual(['breakfast#1', 'snack#1', 'lunch#1', 'snack#2', 'dinner#1'])
})
it('allows today and 7 days back, never the future', () => {
  expect(canSkipMealOn('2026-09-28', '2026-09-28')).toBe(true)
  expect(canSkipMealOn('2026-09-21', '2026-09-28')).toBe(true)
  expect(canSkipMealOn('2026-09-20', '2026-09-28')).toBe(false)
  expect(canSkipMealOn('2026-09-29', '2026-09-28')).toBe(false)
})
```

(`skip(...)` = the test file's existing row factory; add one if absent.)
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** `pnpm exec tsc --noEmit` + both test modes → PASS.
- [ ] **Step 5:** Commit `feat(fuel): FE data for meal skips and the fuel mode (mezo-q4xt2.3)`.

---

### Task 6: FE plan logic — the skipped window (no redistribution)

**Files:** `data/types.ts` (`FuelSlot`) · `features/fuel/logic/buildDayPlan.ts` · `fuelSwimlane.ts` · `heroWindow.ts` · `keretHero.ts` · `data/fuel/timelineHooks.ts` · `data/today/todayHooks.ts` (`useFuelPreview`) · tests next to each.

**Produces:**
- `FuelSlot.state: 'done' | 'now' | 'pending' | 'missed' | 'skipped'`; `FuelSlot.skipKey?: string` (set on every planned meal/snack slot); `FuelSlot.skip?: { id: string; reasonCategory: SkipReason; reasonText?: string | null }`.
- `buildDayPlan` input: `mealSkips?: readonly PlannedSkip[]` (the date's `kind: 'MEAL'` rows; `useFuelTimeline` passes `plannedSkips.filter(s => s.kind === 'MEAL' && s.date === date)`).
- Lane tile VM (`WindowTileVM`): `state` gains `'skipped'`, plus `skipKey`, `skip`.
- Keret-hero VM: `skippedKcal: number`, `skippedLabels: string[]`; `remainingKcal = target − eaten − skippedKcal`.

Order inside `buildDayPlan` (this is the whole point — keep it in a comment):
1. windows + `splitBudget`/`splitBudgetPct` over **all** windows (unchanged);
2. assign `skipKey` from `mealSkipKeys(windows)`;
3. fill logged meals (unchanged) — **a logged meal beats a skip**;
4. for each still-unlogged meal slot whose `skipKey` matches a skip → `state = 'skipped'`, attach `skip`; such a slot is excluded from the late-log reflow chain (it is neither a "previous meal" nor shifted), from the `nowWin` candidates, and from the missed/pending classification.

- [ ] **Step 1: Failing tests** in `buildDayPlan.test.ts` (use the file's existing input factory; 4 meals, budget 2800):

```ts
it('a skipped slot keeps its share and nobody else grows', () => {
  const base = buildDayPlan(input())
  const skipped = buildDayPlan(input({ mealSkips: [mealSkip('lunch#1')] }))
  const kcal = (p: typeof base) => p.slots.filter(s => s.kind === 'meal' || s.kind === 'snack').map(s => s.budgetKcal)
  expect(kcal(skipped)).toEqual(kcal(base))
  expect(skipped.slots.find(s => s.skipKey === 'lunch#1')!.state).toBe('skipped')
})
it('the skipped slot is never "now" and never "missed"', () => {
  const p = buildDayPlan(input({ nowHHmm: '13:00', mealSkips: [mealSkip('lunch#1')] }))
  expect(p.slots.find(s => s.skipKey === 'lunch#1')!.state).toBe('skipped')
  expect(p.slots.filter(s => s.state === 'now')).toHaveLength(1)
  expect(p.slots.find(s => s.state === 'now')!.skipKey).not.toBe('lunch#1')
})
it('a logged meal beats a skip on the same slot', () => {
  const p = buildDayPlan(input({ meals: [loggedLunch()], mealSkips: [mealSkip('lunch#1')] }))
  expect(p.slots.find(s => s.skipKey === 'lunch#1')!.state).toBe('done')
})
it('a skip whose key matches no window is ignored', () => {
  expect(() => buildDayPlan(input({ mealSkips: [mealSkip('snack#4')] }))).not.toThrow()
})
```

`keretHero.test.ts`: target 2270, eaten 1180, skipped slots with budgets 420 → `remainingKcal === 670`, `skippedKcal === 420`, `skippedLabels` = `['Uzsonna']`; a past-normalised lane (`asPastDayLane`) keeps `'skipped'` (not turned into `'missed'`); `heroWindow` never picks a skipped tile; `useFuelPreview` skips skipped slots when choosing its three upcoming slots.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement (fix every exhaustive `switch`/ternary on `state` the compiler reports — `grep -rn "'missed'" frontend/src --include='*.ts*'` lists the readers). **Step 4:** `tsc --noEmit` + both test modes → PASS.
- [ ] **Step 5:** Commit `feat(fuel): skipped meal window — split first, mark after (mezo-q4xt2.3)`.

---

### Task 7: FE UI — Kihagyom, the reason sheet, the skipped card, the hero

**Files:** `docs/design_2.0/assets/titanium-custom.svg` (+ generator run) · `FuelMealBlocks.tsx` (+ test) · create `features/fuel/sheets/MealSkipSheet.tsx` (+ test) · `FuelEnergyHero.tsx` (+ test) · `FuelMaiPage.tsx` (+ test) · Fuel CSS.

Build to the prototype (`#mai`, `#mai?d=2026-09-27`, sheet `mealwhy`, `#ikonok-s3`); class names and strings there are the reference. Reuse, do not re-invent: `SkipReasonSheet.tsx` for the sheet anatomy (header, chip grid, Egyéb voice field, the "MEDDIG TARTHAT?" duration row and its `useOpenRecovery` wiring, note line, two buttons) and `SkippedBlock.tsx` for the muted card. If the duration row is inline in `SkipReasonSheet`, extract it into `features/train/components/RecoveryDurationRow.tsx` and use it from both sheets (no behaviour change in the training sheet; its tests must stay green).

Behaviour:
- **Icons:** copy the two `<symbol>`s (`t-tea`, `t-nohunger`) from the prototype into `titanium-custom.svg`, run `node scripts/gen-titanium-sprite.mjs`, commit generated outputs.
- **Block card** (unlogged, not skipped, `canSkipMealOn(date, today)`, fuel mode ≠ `GUIDANCE`): next to "Logolás ide" a secondary button `t-skip` + **"Kihagyom"**; **"Kihagytam"** when the window is closed (past day or `now` after `windowTo`). `aria-label="<slot> kihagyása"`. Tap → `upsert({ date, kind: 'MEAL', sessionKey: tile.skipKey, reasonCategory: 'NONE', plannedKcal: tile.budgetKcal })` then open `MealSkipSheet` for that skip.
- **Skipped card:** block gets `is-skipped` (muted head, tag "kihagyva" instead of the budget ring); inner row: reason icon (`t-skip` when none), **"Kihagyva · <mealSkipLabel>"**, sub-line **"<kcal> kcal kiesett a napból. A többi étkezésed nem lett nagyobb."**; three ghost pills: **"Másik ok"** / **"Okot adok"** (no reason yet) → sheet; **"Visszavonom"** → `undo(id)` + toast "Visszavonva · az étkezés visszakerült a napba"; **"Mégis ettem"** → `undo(id)` then the existing `onLogInto(tile)`.
- **`MealSkipSheet`:** eyebrow `KIHAGYVA · <SLOT>`, title "Miért marad ki?", sub "Nem kötelező. Segít, hogy a coach értse a mintát."; six chips from `MEAL_REASONS`; OTHER → the shared voice text field (`reasonText`); a serious chip reveals the duration row — picking a duration opens/updates the period (`useOpenRecovery`, `startDate` = the skip's date) and shows "Kímélő mód bekapcsolva · amíg tart, a Fuel nem kér számon semmit, az edzés és a sport pedig magától kimarad."; note lines per the prototype; buttons "Most nem mondom" / "Kész" (disabled until a chip is chosen). Each chip tap upserts the same skip with the new reason.
- **Hero:** when `vm.skippedKcal > 0` draw the muted segment after the eaten arc (`.ring-skip`, lavender 42% alpha, butt cap, 1.5-unit gap; `stroke-dasharray: <pct−1.5> 100; stroke-dashoffset: −(<eatenPct>+1.5)`; skip it when the segment is ≤ 1.5%); gauge `aria-label` adds ", ebből N kcal kihagyva"; below the hero a chip **"<Címkék> kihagyva · N kcal kiesett a napból"** opening the equation box; the equation box gets a **"Kihagyva"** row (`t-skip`, "kihagyott étkezés · nem kerül át máshová", `− N`) before "Marad" and a hatched segment on its bar. The block header shows "N ÉTKEZÉS · K KIHAGYVA".
- **Yesterday chip:** `yMissed` counts only `state === 'missed'` (skipped excluded — already true after Task 6; assert it).

- [ ] **Step 1: Failing component tests:**
  - `FuelMealBlocks.test.tsx`: an unlogged pending tile renders a button named `/Uzsonna kihagyása/` with text "Kihagyom"; on a past day the text is "Kihagytam"; a skipped tile renders "Kihagyva · Nem vagyok éhes", "420 kcal kiesett a napból", and buttons "Másik ok", "Visszavonom", "Mégis ettem"; no "Kihagyom" when `fuelMode === 'GUIDANCE'`; shame-vocabulary guard over the rendered text of all new states.
  - `MealSkipSheet.test.tsx`: six chips in order; "Kész" disabled until a chip; choosing "Gyomorrontás" shows "MEDDIG TARTHAT?"; choosing "Nem vagyok éhes" does not; choosing a duration calls the open-recovery mutation with `{ category: 'STOMACH', estimate: 'FEW_DAYS', startDate: <skip date> }`; "Egyéb" shows the text field and saves `reasonText`.
  - `FuelEnergyHero.test.tsx`: with `skippedKcal: 420` the `.ring-skip` circle exists, the remaining numeral reads 670, the label stays "MÉG BELEFÉR", and no element has an over/warn class; with `skippedKcal: 0` no `.ring-skip`.
  - `FuelMaiPage.test.tsx` (mock mode): tap "Kihagyom" on Uzsonna → the sheet opens → "Nem vagyok éhes" → "Kész" → the block shows the skipped card and the header reads "· 1 KIHAGYVA"; "Visszavonom" restores "Logolás ide".
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** both test modes + `pnpm build` → PASS.
- [ ] **Step 5:** Commit `feat(fuel): skip a meal — Kihagyom, reason sheet, neutral hero segment (mezo-q4xt2.3)`.

---

### Task 8: FE UI — the four kímélő Fuel faces

**Files:** create `FuelGuidanceCard.tsx` (+ test) · create `features/fuel/sheets/DoctorSheet.tsx` (+ test) · create `FuelRecoveryNote.tsx` (+ test) · `FuelMaiPage.tsx` · `FuelEnergyHero.tsx` · `FuelMealBlocks.tsx` · `fuelWeekView.ts` + `FuelWeekDayGlass.tsx` (+ tests) · `data/today/todayHooks.ts` / the Nap fuel preview component · Fuel CSS.

Build to the prototype (`#mai?km=…`, sheet `orvos`, `#trendek` with a period day). All copy verbatim from it. One glass per card (`FuelGuidanceCard` is the glass; its inner rows are flat).

- `fuel.fuelMode === 'GUIDANCE'` (page level, replaces hero + "Miből jön össze?" + macro rings): `FuelGuidanceCard` — category icon, eyebrow `KÍMÉLŐ MÓD · <BETEG VAGY|GYOMORRONTÁS> · N. NAP`, title "Ma nincs kalóriacél", lead "Pihenj, igyál, és egyél, amikor megy. A számokat most elengedjük."; water row (ring `consumed.water / targets.water`, "＋ Víz" → the existing water sheet); three tips (ILLNESS and STOMACH sets as in the prototype; icons `t-water`, `t-tea`, `t-meat` / `t-skip`); STOMACH only: "EZEK KÖNNYEBBEN MENNEK LE" chips *Banán · Főtt rizs · Pirítós · Főtt krumpli · Sós keksz · Húsleves · Almapüré* + "Nem előírás, csak ötlet. Amint jobban vagy, ehetsz rendesen."; row "Mikor fordulj orvoshoz?" → `DoctorSheet` (two lists as in the prototype + "Ez nem orvosi tanács. Ha bizonytalan vagy, hívd a háziorvosodat vagy az ügyeletet."); total line "Ma eddig **N kcal** · nem mérjük semmihez" (or "Amit megeszel, beírhatod. Nem mérjük semmihez." at 0); fine print "Ez nem orvosi tanács.".
  Blocks in GUIDANCE: no budget ring (a logged block shows "N kcal" plain), unlogged shows "Ha megy, egyél. Nincs mihez mérni.", log sub-label "ha ettél, beírhatod", no "még pótolható", no Kihagyom; an already skipped slot's sub-line is "Nem számít mulasztásnak. Jobbulást!".
- `MAINTENANCE`: slim strip "Kímélő mód · Sérülés · N. nap" (`t-kimelo`; tap → toast "A kímélő módot a Nap oldalon zárod le: Hogy vagy? → Jobban"); normal hero on the served (maintenance) targets; `FuelRecoveryNote` "Sérülés alatt nem fogyókúrázunk — A hiányt kikapcsoltam: szinten tartó keretet látsz. A fehérje most a legfontosabb, abból épül vissza a szövet. · Ez nem orvosi tanács."; the protein ring gets `is-lead` (glow + "FŐ CÉL" caption); the equation box's "Célod" row reads "szünetel, amíg a sérülés tart · 0".
- `ESTIMATE`: the same strip ("Úton vagy"); hero with `is-estimate` (muted numerals, gauge 55% opacity); right label "KB. ENNYI FÉR MÉG", and when over: "A KERET KÖRÜL" (never "A KERET FELETT"); note "Úton vagy, becsülj nyugodtan — Elég nagyjából beírni, a keret most csak tájékoztat. Ha egy dologra figyelsz, a fehérje legyen.".
- All three: unlogged closed windows show no "még pótolható" chip; the yesterday "pótolható" chip is hidden when **yesterday** has a fuel mode.
- **Week:** `fuelWeekView` day VM gets `recovery: boolean` (from the rollup's `fuelMode`, any mode); such a day has no `over`, no pct; `FuelWeekDayGlass` shows the `t-kimelo` mark in place of the score/percentage and a hatched lavender bar; its detail reads "Kímélő nap — Amit ezen a napon ettél (N kcal), nem mérem a kerethez, és a heti értékelésbe sem számít bele. A beírt étkezéseid megmaradnak.".
- **Nap fuel preview:** on a GUIDANCE day show one line "Kímélő mód · ma nincs kalóriacél — folyadék, könnyű étel" instead of slot budgets.

- [ ] **Step 1: Failing tests:** `FuelGuidanceCard` (ILLNESS: title, three tips, no "EZEK KÖNNYEBBEN"; STOMACH: the seven chips + doctor row; both end with "Ez nem orvosi tanács."; no `\d+\s*/\s*\d+\s*kcal` in the text); `DoctorSheet` (5 rows for STOMACH, 4 for ILLNESS); `FuelMaiPage` per mode in mock mode (seed the mock recovery cache): GUIDANCE → no element with the hero's test id / "MÉG BELEFÉR", guidance title present, no "Kihagyom"; MAINTENANCE → strip + note + protein `is-lead`; ESTIMATE → "KB. ENNYI FÉR MÉG" and never "A KERET FELETT" even when eaten > target; `fuelWeekView` → a rollup with `fuelMode` yields `recovery: true`, `over: false`, `pct: null`; shame-vocabulary guard over every new component.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** both test modes + `pnpm build` → PASS.
- [ ] **Step 5:** Commit `feat(fuel): kímélő-mód Fuel — guidance, maintenance, estimate (mezo-q4xt2.3)`.

---

### Task 9: Layout, runtime verification, docs, ship

- [ ] **Step 1: Layout specs.** In `frontend/tests/layout` extend the Fuel Mai spec (or add `fuel-meal-skip.spec.ts` following its neighbours): at **320 px** — (a) a skipped block: its three pills stay inside the card and none overlaps the FAB; (b) the "Logolás ide" + "Kihagyom" row: both fully inside the card, "Kihagyom" not truncated; (c) GUIDANCE card: eyebrow, water row and the seven chips inside the card, no horizontal scroll; (d) `MealSkipSheet`: six chips in two columns, the duration row wraps inside the sheet. Keep CI-font headroom (S2 lesson: chips that fit locally overflowed on CI fonts — leave ≥ 8 px slack). Run the layout suite.
- [ ] **Step 2: Runtime pass** with the `verify` skill (mock-mode PWA): walk every *Kész, ha…* screen item, console clean, reduced motion on.
- [ ] **Step 3: Docs.** `docs/features/fuel.md` (meal skip, fuel modes, served fields, consumers table, the "split first, mark after" rule, known limitation: past days rebuild windows from today's plan, a template edit can orphan a skip), `train.md` (kind MEAL, `NOT_HUNGRY`, `planned_kcal`, `fuelDays`, `RecoveryFuelMode`), `companion.md` (three more silenced flags, coach lines), feature index rows (`docs/features/README.md` §2–§3), milestone log entry dated with the ship day + *Epics in flight* (S3 done, S4 next) in `docs/milestones/roadmap.md`. `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` → 0 errors / 0 stale.
- [ ] **Step 4: Full gates.** Backend: the focused classes of Tasks 1–4 + `ArchitectureTest`, then (migration + cross-cutting) the full suite `./mvnw clean test -Dmezo.test.use-testcontainers=true`. FE: `CI=true pnpm test` in both modes, `pnpm build`, layout suite, contract drift gate.
- [ ] **Step 5: Living prototype.** If the build deviated anywhere, update `elo/fuel.html` to match; update the Fuel row in `elo/README.md` ("Last synced" → S3 shipped); republish to the fixed URL (`read` first; the gate requires reading the live copy in full).
- [ ] **Step 6: Merge + deploy** per AGENTS.md "no-wait, net stays": `git fetch && git rebase origin/main` (or merge) → re-run quick gates if anything came in → `git checkout --detach origin/main && git merge --no-ff feat/kihagyas-s3` → `node scripts/gen-codemap.mjs` (commit if changed) → `git push origin HEAD:main`. Watch `deploy` for that commit; a red `ci` outranks everything.
- [ ] **Step 7: Verify live** on `https://46.225.112.172.sslip.io/`: skip a meal and undo it on the owner's account only if the owner agreed — otherwise verify read-only: the new version is served, `/fuel` renders, and

```bash
export KUBECONFIG=~/.kube/mezo-k3s.yaml
kubectl exec -n mezo postgres-0 -- psql -U mezo -d mezo -c "select conname from pg_constraint where conrelid='planned_skip'::regclass order by 1"
kubectl exec -n mezo postgres-0 -- psql -U mezo -d mezo -c "select column_name from information_schema.columns where table_name='planned_skip' and column_name='planned_kcal'"
```

show the new constraint set and column.
- [ ] **Step 8: Close.** Append "Slice lessons S3" to the spec; `bd close mezo-q4xt2.3` with a result summary; `node scripts/check-beads-backup.mjs --fix` + commit; `bd dolt push`; `git push`; delete the branch; Hungarian report walking the checklist.

---

## Kész, ha… (acceptance — also on the bead)

**Amit a tulajdonos lát (mind a prototípussal egyezik):**
1. Mai: be nem írt étkezésen **Kihagyom** (lezárt ablakon / múlt napon **Kihagytam**); jövő napra nincs.
2. Koppintásra azonnal kihagyva + „Miért marad ki?" lap: 6 ok, Egyéb szöveg/diktálás, „Most nem mondom".
3. Gyomorrontás / Beteg vagyok / Úton vagyok → „Meddig tarthat?" → kímélő mód bekapcsol.
4. Kihagyott kártya: halvány, „Kihagyva · ok", Másik ok · Visszavonom · Mégis ettem — mind működik.
5. Gyűrű: halvány kihagyott szelet; „még belefér" nem nő; „Miből jön össze?" Kihagyva sor; fejléc „· K KIHAGYVA".
6. Betegség / gyomorrontás: tanácskártya cél és gyűrűk helyett; gyomorrontásnál lista + „Mikor fordulj orvoshoz?" lap; nincs Kihagyom.
7. Sérülés: szinten tartó keret, FŐ CÉL fehérje, magyarázó kártya; Célod sor szünetel.
8. Utazás: halvány cél, „KB. ENNYI FÉR MÉG", soha „A KERET FELETT".
9. Heti nézet: kímélő nap jelöléssel, százalék és sárga jelzés nélkül.
10. Új ikonok (`t-tea`, `t-nohunger`) a közös készletből; emoji sehol.
11. 320 px-en semmi nem lóg ki / nem takar; csökkentett mozgásnál is ép; üres / betöltés / hiba állapot rendben.

**Paritás:** a Fuel Mai, a logolás, a víz, a heti nézet és a Nap előnézet minden eddigi vezérlője és adata megvan; az edzés „Miért?" lapja változatlanul működik.

**Szabályok (teszttel igazolva):** nincs szétosztás; étkezés-kihagyás sosem mulasztás, nem viszi a szabadjegyet, nem hidalja a sorozatot; a kímélő nap ételét a coach, a napzárás, a 3 jelzés, a karakter, a küldetés, a szokás és a heti felülvizsgálat nem ítéli meg.

**Kapuk:** backend fókuszált + teljes csomag (Testcontainers) zöld; ArchUnit zöld; FE tesztek mindkét módban; layout specek; `pnpm build`; szerződés-drift; `gen-codemap`; `lint-docs` 0/0.

**Dokumentáció:** `fuel.md`, `train.md`, `companion.md`, funkcióindex, mérföldkő-napló, spec „Slice lessons S3".

**Élesben:** main-re olvasztva, `deploy` zöld, az új verzió él a production URL-en, az éles adatbázisban az új oszlop és megkötések megvannak.

**Élő prototípus:** egyezik az élessel, újra közzétéve a fix linken, README frissítve.
