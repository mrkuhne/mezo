# Workout exercise swap / add — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** During an active workout the user can swap an exercise (also after partial sets) or add one, choosing "Csak ma" or "Mezociklusra is"; both persist server-side.

**Architecture:** Every change creates an **instance-scoped `exercise` row** (`workout_session_id` = the running instance) — that is today's reality. "Mezociklusra is" additionally makes an **id-stable targeted write** on the template day (insert one row, soft-delete only the replaced row) tagged `added_in_workout_id` = the instance, so it stays hidden in that instance and takes effect from the next session. One pure backend assembler builds the instance's exercise list for `getToday` and `getWorkoutDetail`. The frontend applies a pure `Session` transition with the server's refreshed today payload.

**Tech Stack:** Spring Boot 3 / JPA / Liquibase (backend), contract-first OpenAPI (`api/feature/train/train.yml`), React + TanStack Query (frontend), Vitest + MSW, Testcontainers ITs.

**Spec:** `docs/superpowers/specs/2026-09-28-workout-exercise-swap-add-design.md` · **Prototype:** `docs/design_2.0/prototypes/elo/edzes.html` (artifact `DdTK5jJ6XTBuqnPSC3fpcC`, v13) · **bd:** `mezo-mobji`

## Global Constraints

- Scope sheet copy (verbatim from the approved prototype): options **„Csak ma”** — „A mai edzésre. Jövő héten a régi terv jön.” and **„Mezociklusra is”** — „A {meso name} hátralévő {N} hetében is. A mentett sablonod nem változik.”; no-plan-slot note: „Ez a gyakorlat ma került be, nincs a mezociklus tervében, ezért csak mára cserélhető.”
- Menu row: **„Gyakorlat cseréje”**, hint „Hasonlóra vagy bármi másra” / „A {d} kész szett itt marad, a többi az újé”. Bottom button: **„Gyakorlat hozzáadása”**.
- Card pills: „Csak ma · a {old} helyett”, „Mezociklusban · a {old} helyett”, „Ma hozzáadva”, „Mezociklusba felvéve”, „Lecserélve → {new} · {d} szett kész”, „Első alkalom — a súlyt te adod meg, innentől jön a javaslat”.
- New sprite icons `swap`, `addex` (Titanium recipe) — never emoji.
- "Mezociklusra is" never writes `meso_template`; never rewrites past instances.
- Closing-block exercises and instance rows have **no plan slot**: MESO → 409 `TRAIN_EXERCISE_NO_PLAN_SLOT`.
- Tests: FE `CI=true` in mock AND `VITE_USE_MOCK=false`; backend focused ITs; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs`.

## Data model decision (refines spec §4.1)

Two columns on `exercise` plus one flag:

| column | set on | meaning |
|---|---|---|
| `replaces_exercise_id uuid null` | instance row | the row it replaces in this instance |
| `added_in_workout_id uuid null` | template row created by a MESO change | hidden in that instance (the instance row stands in for it) |
| `saved_to_plan boolean not null default false` | instance row | pill: „Mezociklusban” vs „Csak ma” |

## Assembly rule (one pure function, backend)

`SessionExerciseAssembler.assemble(template, instanceRows, deletedWithSets, instanceId, loggedWorking, closingIds)`:
1. base = live template rows (orderIndex) **minus** rows with `added_in_workout_id == instanceId`, plus soft-deleted rows that carry sets in this instance, placed at their stored orderIndex (tie → before).
2. each instance row with `replaces_exercise_id` → inserted right after the replaced row; the replaced row is **dropped when it has 0 logged working sets in this instance**, else kept with `replacedByName` and `workingSets = logged`.
3. each instance row without replacement → before the first closing row of base, else at the end, creation order.
4. per row: `changeScope` = instance row ? (savedToPlan ? MESO : TODAY) : null; `replacesName`; `planSlot` = template row && not closing.

---

### Task 1: Schema + entity

**Files:** Create `backend/src/main/resources/db/changelog/1.1.0/script/202609282100_mezo-mobji_exercise_session_change.sql`; register in the 1.1.0 changelog master; modify `entity/ExerciseEntity.java`.

- [ ] SQL: `ALTER TABLE exercise ADD COLUMN replaces_exercise_id UUID; ADD CONSTRAINT fk_exercise_replaces_exercise_id_exercise_id FOREIGN KEY (replaces_exercise_id) REFERENCES exercise(id) ON DELETE SET NULL; ADD COLUMN added_in_workout_id UUID; ADD CONSTRAINT fk_exercise_added_in_workout_id_workout_session_id FOREIGN KEY (added_in_workout_id) REFERENCES workout_session(id) ON DELETE SET NULL; ADD COLUMN saved_to_plan BOOLEAN NOT NULL DEFAULT false;` + indexes on both FKs. No bare `?`.
- [ ] Entity fields `replacesExerciseId`, `addedInWorkoutId`, `savedToPlan` (default false).
- [ ] Repository: `@Query(native) findAllByIdIncludingDeleted(Collection<UUID>)` returning `ExerciseEntity` via native select on `exercise` (bypasses `@SQLRestriction`).
- [ ] Commit.

### Task 2: Contract

**Files:** `api/feature/train/train.yml`; regenerate backend (`./mvnw -q generate-sources`) and frontend (`pnpm generate:api`).

- [ ] `POST /api/train/workouts/{id}/exercises` (`changeWorkoutExercise`) body `WorkoutExerciseChangeRequest {catalogId?, name, muscle, type(compound|isolation|plyo), warmupSets, workingSets, repMin, repMax, targetRIR, scope(TODAY|MESO), replacesExerciseId?}` → 200 `WorkoutExerciseChangeResponse {exerciseId, today: WorkoutTodayResponse}`; 404, 409.
- [ ] `POST /api/train/workouts/{id}/exercises/{exerciseId}/plan-sets` (`addPlanWorkingSet`) body `{delta: integer 1..3}` → 204; 404, 409.
- [ ] `TodayExercise` gains optional `changeScope (TODAY|MESO, nullable)`, `replacesName`, `replacedByName`, `planSlot (boolean)`.
- [ ] Commit.

### Task 3: Assembler (pure) + unit test

**Files:** Create `service/SessionExerciseAssembler.java`, `test/.../SessionExerciseAssemblerTest.java`.

- [ ] Table tests: plain template passthrough; TODAY swap 0 logged (old dropped, new in place); TODAY swap 2 logged (old kept, workingSets=2, replacedByName, new right after); MESO swap (template new row hidden, deleted old with sets kept); add before closing; add with no closing → end; chained swap A→B→C.
- [ ] Implement `record Assembled(ExerciseEntity row, Integer workingSetsOverride, String replacesName, String replacedByName, String changeScope, boolean planSlot)`.
- [ ] Commit.

### Task 4: Read paths + guards

**Files:** `service/WorkoutService.java`, `service/ClosingBlockService.java` (+ `closingCatalogIds()`).

- [ ] `getToday`: when `open != null`, exercises = assembler output for `open`; instance rows skip `effectiveSets`/`dayDelta`; overrides applied; new TodayExercise fields set. `open == null` path unchanged except rows with `added_in_workout_id` are **shown** (they are the plan now).
- [ ] `getWorkoutDetail`: same assembler for the instance.
- [ ] `logSet` / `skipExercise` guard: row's `workoutSessionId ∈ {templateId, instanceId}`; `saveFeedback`: allowed ids = assembled ids ∪ ids with sets.
- [ ] Commit.

### Task 5: Change service + controller + ITs

**Files:** Create `service/WorkoutExerciseChangeService.java`; modify `controller/TrainController.java`; create `test/.../WorkoutExerciseChangeIT.java`, regression in `.../ExtraSetPlanIT` (inside the same IT class).

- [ ] IT first: TODAY add → `getToday` has it with `changeScope=TODAY`, logSet works, resume (second getToday) identical, review lists it; TODAY swap with 0 / 2 logged; MESO swap → next week's instance sees new plan, other template ids unchanged, past review intact, today shows instance row once; MESO add before closing; MESO on closing / instance row → 409; foreign instance → 404; PATCH plan-sets keeps every id and bumps workingSets.
- [ ] Implement; `@Transactional`; ownership via `ownedInstanceOrThrow`-equivalent; returns `getToday(createdBy, instance.getTemplateSessionId())`.
- [ ] Run focused ITs with Testcontainers; commit.

### Task 6: FE data layer

**Files:** `data/types.ts`, `data/train/trainHooks.ts`, `data/train/trainHooks.test.tsx`, `test/msw/handlers.ts` (no import of `data/train/train.ts`).

- [ ] `LoggedWorkoutExercise` + `changeScope`, `replacesName`, `replacedByName`, `planSlot`, `catalogId?`; `toWorkoutPlan` maps them.
- [ ] `changeExercise(workoutId, req, {onSuccess(exerciseId)})`: real → POST, `setQueriesData(WORKOUT_TODAY_QUERY_KEY, today)` then invalidate; mock → append edit to a `['train','mockWorkoutEdits']` cache and `workout = applyMockEdits(trainWorkout, edits)`.
- [ ] `addPlanWorkingSet(workoutId, exerciseId)`: real PATCH-style POST; mock no-op.
- [ ] Commit.

### Task 7: Session transitions

**Files:** `features/train/logic/workoutState.ts` + test.

- [ ] `swapExercise(s, oldId, input: SessionExerciseInput)`: logged(old)=0 → replace id in `order`, drop old; else insert after old, `planned[old] = warmupSlots + logged`, clear extra/removed of old. New id gets planned/prescribed.
- [ ] `addExercise(s, input, beforeId?: string)`.
- [ ] Commit.

### Task 8: UI

**Files:** `sheets/ExercisePickerSheet.tsx` (`mode`, `similarTo`), create `sheets/ExerciseScopeSheet.tsx`, `components/WorkoutMenuGlass.tsx` (swap row), `pages/ActiveWorkoutPage.tsx` (button, wiring, pills, kept-old card, extra-sheet PATCH + hidden „Minden hétre” when `!planSlot`), sprite (`swap`, `addex`) in the shared Titanium sprite.

- [ ] Tests first (mock): menu row opens picker; similar strip lists same-muscle items; pick → scope sheet copy; Csak ma → card with pill; 3-logged swap → old card „Lecserélve”, new card 1 set; add button → appended; today-row swap shows only Csak ma.
- [ ] Real-mode MSW test: POST body + card from returned `today`.
- [ ] Commit.

### Task 9: Gates, docs, ship

- [ ] FE: `CI=true pnpm test` (mock) and `CI=true VITE_USE_MOCK=false pnpm test`; affected `tests/layout` spec; `pnpm build`.
- [ ] Backend focused ITs + ArchUnit test; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs`.
- [ ] Docs: `docs/features/train.md` (active workout §2, workout execution §4, traps), feature index row, roadmap milestone entry.
- [ ] Living prototype README row; merge `--no-ff` to main, push, deploy green, live check, prod DB column check.

## Kész, ha…

- [ ] ⋮ menü → „Gyakorlat cseréje” opens the picker with „Hasonló gyakorlatok” (same muscle) + full searchable list, as in the prototype.
- [ ] Choosing an exercise opens the scope sheet with the two option rows (Csak ma highlighted) — or only „Csak ma” + note for no-plan-slot rows.
- [ ] Swap with 0 logged → new card in place; with N logged → old card faded „Lecserélve → X · N szett kész”, new card after it with the remaining sets.
- [ ] „Gyakorlat hozzáadása” at the list bottom adds a card before the closing exercises with type defaults.
- [ ] Pills per the Global Constraints; first-time exercise shows the „Első alkalom” pill and a blank weight.
- [ ] Reload mid-workout restores every swap/add exactly (real mode).
- [ ] „Mezociklusra is” → next week's same day shows the new plan; this week's past reviews unchanged; template ids of untouched exercises unchanged.
- [ ] Add-set „Minden hétre” no longer churns ids (IT), hidden for today-only rows.
- [ ] Review of today's workout lists swapped-out (with its sets), swapped-in and added exercises.
- [ ] New icons in the shared sprite; 320px; reduced motion unaffected.
- [ ] Parity: every existing menu row, sheet, counter, finish gate still works (existing ActiveWorkoutPage tests green).
- [ ] Gates green (both FE modes, build, focused ITs, ArchUnit, codemap, lint-docs 0/0).
- [ ] Docs updated (train.md, feature index, roadmap).
- [ ] Merged to main, deploy green, live URL shows the feature, prod DB has the three new columns.
- [ ] Living prototype matches and is published.
