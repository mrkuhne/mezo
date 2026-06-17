# Active-workout v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan may also be driven by the Workflow tool, one slice per phase.

**Goal:** Turn the live workout (`ActiveWorkoutScreen`) into a flexible session — reorder exercises (real drag-and-drop), add a set (optionally writing the plan), skip an exercise (recorded), and keep a durable per-exercise note — and fix the meso planner's fake drag handles with the same reorder primitive.

**Architecture:** A foundation refactor re-keys the active-workout state by `exerciseId` (today it is array-index keyed) and makes the cursor non-linear with variable per-exercise set counts. Four features then surface behind a per-exercise `⋯` action sheet (plus an always-visible note pill). A new `dnd-kit` `SortableList` primitive serves both the active reorder and the planner. Backend adds a skip endpoint + two small Liquibase migrations (skip flag, durable note); add-set's optional template write reuses the existing day-exercise PUT.

**Tech Stack:** React 19 + Vite + Tailwind v4 + TanStack Query (frontend), `@dnd-kit/*` (new), Vitest (FE tests both mock + real modes), Java 21 + Spring Boot 4 + Liquibase + JPA (backend), `@SpringBootTest` + Testcontainers/compose Postgres ITs, OpenAPI contract-first (`api/feature/train/train.yml`).

**Spec:** `docs/superpowers/specs/2026-06-17-active-workout-v2-design.md`. **Driving issue:** `mezo-an1`.

**House standards (read before each backend/contract task):** `docs/references/liquibase_conventions.md`, `spring_patterns.md`, `api_contract_conventions.md`, `error_handling.md`, `integration_test_framework.md`, `testing_standards.md`.

**Global conventions for every task:**
- One `feat/<topic>` branch per slice; conventional commit subject carries the bd id, e.g. `feat(train): … (mezo-an1)`.
- FE quality gate (run from repo root): `pnpm -C frontend test <path>` (REAL mode) **and** `VITE_USE_MOCK=true pnpm -C frontend test <path>` (MOCK) must both pass; `pnpm -C frontend build` for TS.
- BE quality gate: `docker compose up -d` once, then `backend/mvnw -f backend/pom.xml clean test -Dtest=<IT>` (always `clean` — Lombok/MapStruct incremental compile is flaky).
- Contract change → `npm --prefix api/generate run generate:api` then `pnpm -C frontend generate:api` (backend regenerates on `mvnw`).
- Touch a feature's behavior → update `docs/features/train.md` in the same slice, then `node scripts/lint-docs.mjs`.

---

## File Structure

**Created:**
- `frontend/src/components/ui/SortableList.tsx` — generic dnd-kit sortable list (drag + ▲▼ a11y fallback), one responsibility: ordered list with `onReorder`.
- `frontend/src/components/ui/SortableList.test.tsx` — primitive unit tests.
- `frontend/src/features/train/components/ExerciseActionSheet.tsx` — the `⋯` bottom sheet (reorder / skip / add-set / note entry points).
- `frontend/src/features/train/components/ExerciseActionSheet.test.tsx`
- `frontend/src/features/train/workoutState.ts` — pure helpers for the exerciseId-keyed session state (order, effective set count, advance, seed-from-open). Extracted so the state logic is unit-testable without the full screen.
- `frontend/src/features/train/workoutState.test.ts`
- `backend/.../db/changelog/1.0.0/script/202606171200_mezo-an1_exercise_set_skipped.sql`
- `backend/.../db/changelog/1.0.0/script/202606171210_mezo-an1_exercise_note.sql`

**Modified:**
- `frontend/src/features/train/ActiveWorkoutScreen.tsx` — adopt `workoutState` helpers; render `ExerciseActionSheet` + note pill + dashed extra set-dot; wire skip/add-set/note.
- `frontend/src/data/trainHooks.ts` — add `skipExercise`, `addSet`, `saveExerciseNote` to `useTrain` (+ the `TrainData` type); mock no-op, real persist + invalidate `['train','workoutToday']`.
- `frontend/src/features/train/components/{MesoExercises,ExerciseEditRow,PlannerExerciseRow}.tsx` — replace fake DnD with `SortableList`, wire `onReorder` → existing `saveDayExercises`.
- `api/feature/train/train.yml` — `TodayExercise.note`, skip endpoint, note write endpoint.
- `backend/.../feature/train/service/WorkoutService.java` — `skipExercise(...)`; surface exercise `note` in `getToday`.
- `backend/.../feature/train/controller/TrainController.java` — implement the new generated operations.
- `backend/.../feature/train/entity/{ExerciseSetEntity,ExerciseEntity}.java` — `skipped` / `note` fields.
- `backend/.../feature/train/mapper/TrainMapper.java` — map `note` onto `TodayExercise`.
- `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` — register the two new changesets.
- `backend/src/test/java/.../train/WorkoutServiceIT.java` (+ `WorkoutContractIT.java`) — skip/note/add-set ITs.
- `frontend/package.json` — add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
- `docs/features/train.md` — active-workout section + §4/§9.

---

## Slice 1 — Foundation refactor (exerciseId-keyed, non-linear cursor, variable counts)

**No user-visible feature.** Extract the session-state logic into pure, tested helpers and switch the screen onto them. The existing `ActiveWorkoutScreen.test.tsx` (real + mock) MUST stay green — behavior is identical for the no-reorder/no-skip/no-extra-set path.

### Task 1.1: Pure session-state model with tests

**Files:**
- Create: `frontend/src/features/train/workoutState.ts`
- Test: `frontend/src/features/train/workoutState.test.ts`

- [ ] **Step 1: Write failing tests** for the pure model.

```ts
// workoutState.test.ts
import { describe, expect, test } from 'vitest'
import { makeSession, completeSet, effectiveSetCount, currentExerciseId, advance, addExtraSet, skipExercise, seedFromOpen } from './workoutState'

const EX = [
  { id: 'a', sets: 2 }, { id: 'b', sets: 3 }, { id: 'c', sets: 2 },
] as { id: string; sets: number }[]

test('makeSession starts at the first exercise, no logged sets', () => {
  const s = makeSession(EX)
  expect(currentExerciseId(s)).toBe('a')
  expect(s.setIdx).toBe(0)
  expect(effectiveSetCount(s, 'a')).toBe(2)
})

test('completeSet appends to the exercise keyed by id and advances setIdx', () => {
  let s = makeSession(EX)
  s = completeSet(s, { weight: 100, reps: 8, rir: 2 })
  expect(s.logged['a']).toHaveLength(1)
  expect(s.setIdx).toBe(1)
})

test('advance moves to the next exercise in session order, skipping completed', () => {
  let s = makeSession(EX)
  s = completeSet(s, { weight: 1, reps: 1, rir: 1 })
  s = completeSet(s, { weight: 1, reps: 1, rir: 1 }) // a done (2/2)
  s = advance(s)
  expect(currentExerciseId(s)).toBe('b')
  expect(s.setIdx).toBe(0)
})

test('addExtraSet grows the effective count for that exercise only', () => {
  let s = makeSession(EX)
  s = addExtraSet(s, 'a')
  expect(effectiveSetCount(s, 'a')).toBe(3)
  expect(effectiveSetCount(s, 'b')).toBe(3) // unchanged (planned)
})

test('skipExercise marks it skipped and advance lands on the next non-skipped', () => {
  let s = makeSession(EX)
  s = skipExercise(s, 'a')
  expect(s.skipped).toContain('a')
  s = advance(s)
  expect(currentExerciseId(s)).toBe('b')
})

test('reorder changes the session order of remaining exercises only', () => {
  let s = makeSession(EX) // current = a
  s = { ...s, order: ['a', 'c', 'b'] } // reorder b/c (both remaining)
  s = completeSet(s, { weight: 1, reps: 1, rir: 1 })
  s = completeSet(s, { weight: 1, reps: 1, rir: 1 })
  s = advance(s)
  expect(currentExerciseId(s)).toBe('c') // c now before b
})

test('seedFromOpen rebuilds logged sets + cursor by exerciseId from persisted sets', () => {
  const open = { sets: [
    { exerciseId: 'a', setIndex: 0, weightKg: 100, reps: 8, rir: 2 },
    { exerciseId: 'a', setIndex: 1, weightKg: 100, reps: 8, rir: 2 },
    { exerciseId: 'b', setIndex: 0, weightKg: 50, reps: 10, rir: 1 },
  ] }
  const s = seedFromOpen(EX, open)
  expect(s.logged['a']).toHaveLength(2)
  expect(currentExerciseId(s)).toBe('b') // a full (2/2) -> resume on b
  expect(s.setIdx).toBe(1) // b has 1 logged -> next is index 1
})
```

- [ ] **Step 2: Run, verify FAIL.** Run: `pnpm -C frontend test src/features/train/workoutState.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `workoutState.ts`.** A `Session` = `{ order: string[]; setIdx: number; logged: Record<string, {weight;reps;rir}[]>; extra: Record<string, number>; skipped: string[]; planned: Record<string, number> }`. Implement: `makeSession(exercises)`, `currentExerciseId` (first id in `order` not fully done and not skipped), `effectiveSetCount(s, id) = planned[id] + (extra[id]??0)`, `completeSet`, `advance` (next id in `order` after current that is not skipped and not full), `addExtraSet(s,id) = extra[id]+1`, `skipExercise(s,id)`, `seedFromOpen(exercises, open)` (group `open.sets` by `exerciseId`, rebuild `logged`, set cursor to first not-full id, `setIdx = logged[currentId]?.length ?? 0`). Pure functions only — no React.

- [ ] **Step 4: Run, verify PASS.** Same command → PASS.

- [ ] **Step 5: Commit.** `git add frontend/src/features/train/workoutState.ts frontend/src/features/train/workoutState.test.ts && git commit -m "feat(train): exerciseId-keyed workout session state model (mezo-an1)"`

### Task 1.2: Adopt the model in `ActiveWorkoutScreen` (no behavior change)

**Files:** Modify `frontend/src/features/train/ActiveWorkoutScreen.tsx` (state at :30, :126; `completeSet` :171-202; `seedFromOpen` :92-105; `advanceAfterFeedback` :211-225; set-dots :521-534; header :473).

- [ ] **Step 1:** Run the existing suites to capture green baseline: `pnpm -C frontend test src/features/train/ActiveWorkoutScreen.test.tsx` and `VITE_USE_MOCK=true …` → both PASS.
- [ ] **Step 2:** Replace the `completedSets` `'ex'+idx` map and `exerciseIdx`/`setIdx` with a single `session` state from `workoutState` (keep `weight/reps/rir/note` local input state). `current = W.exercises.find(e => e.id === currentExerciseId(session))`. Set-dots iterate `effectiveSetCount(session, current.id)`; header reads it; `completeSet` calls the model + (real mode) `logSet`; advance uses `advance(session)`; resume uses `seedFromOpen(W.exercises, openWorkout)`.
- [ ] **Step 3:** Run both suites again → both still PASS (identical happy path). Fix until green.
- [ ] **Step 4:** `pnpm -C frontend build` → PASS.
- [ ] **Step 5: Commit.** `git commit -am "refactor(train): drive ActiveWorkoutScreen from exerciseId-keyed session state (mezo-an1)"`

---

## Slice 2 — `SortableList` primitive (dnd-kit) + planner DnD fix

### Task 2.1: Add dnd-kit + the primitive with tests

**Files:** `frontend/package.json`; Create `frontend/src/components/ui/SortableList.tsx` + `.test.tsx`.

- [ ] **Step 1:** Add deps: `pnpm -C frontend add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`.
- [ ] **Step 2: Write failing test.**

```tsx
// SortableList.test.tsx — verify the a11y fallback path (▲▼) deterministically; DnD pointer
// dragging is covered by the dnd-kit lib itself, we test the reorder contract + buttons.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SortableList } from './SortableList'

test('▲▼ buttons reorder items and call onReorder with the new id order', async () => {
  const onReorder = vi.fn()
  render(<SortableList items={[{id:'a',label:'A'},{id:'b',label:'B'},{id:'c',label:'C'}]}
    onReorder={onReorder} renderItem={(it)=> <span>{it.label}</span>} />)
  await userEvent.click(screen.getByRole('button', { name: 'B feljebb' }))
  expect(onReorder).toHaveBeenLastCalledWith(['b','a','c'])
})
```

- [ ] **Step 3: Run, verify FAIL.** `pnpm -C frontend test src/components/ui/SortableList.test.tsx`.
- [ ] **Step 4: Implement `SortableList`.** Props: `{ items: {id:string}[]; onReorder:(ids:string[])=>void; renderItem:(item,i)=>ReactNode; disabled?:boolean }`. Use `DndContext` + `SortableContext` (verticalListSortingStrategy) with a `PointerSensor` (activationConstraint `{ delay: 180, tolerance: 6 }` to avoid scroll conflict) and `KeyboardSensor`. Each row: a `useSortable` handle (grip) + visible ▲▼ buttons with aria-labels `` `${label} feljebb` `` / `` `${label} lejjebb` `` that call `onReorder` with `arrayMove`. On drag end, compute the new id order and call `onReorder`.
- [ ] **Step 5: Run, verify PASS.** Same command → PASS. `pnpm -C frontend build` → PASS.
- [ ] **Step 6: Commit.** `git commit -am "feat(ui): SortableList primitive (dnd-kit, touch + ▲▼ a11y) (mezo-an1)"`

### Task 2.2: Replace the planner's fake DnD with `SortableList`

**Files:** Modify `frontend/src/features/train/components/MesoExercises.tsx`, `ExerciseEditRow.tsx`, `PlannerExerciseRow.tsx` (remove the "VISUAL ONLY — Phase 1 ships no real DnD" stubs).

- [ ] **Step 1: Write/extend test** in `MesoExercises.test.tsx`: reordering via the ▲▼ control produces the new exercise order and calls `saveDayExercises` (mock: assert the local order changed; the existing test setup shows how it renders). Assertion: after clicking "{name} feljebb", the rows render in the new order.
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3:** Wrap the exercise rows in `SortableList`; `onReorder(ids)` reorders the day's exercises and calls `saveDayExercises(mesoId, dayId, reorderedExercises)` (existing `replaceDayExercises` PUT, order = array order per `train.yml`). Delete the dead drag markup.
- [ ] **Step 4: Run, verify PASS** (both modes). `pnpm -C frontend build` → PASS.
- [ ] **Step 5: Commit.** `git commit -am "fix(train): real reorder in the meso planner via SortableList (was fake DnD) (mezo-an1)"`

---

## Slice 3 — F1 reorder in the active workout

**Files:** Modify `ActiveWorkoutScreen.tsx`; Create `ExerciseActionSheet.tsx` (+ test). Reorder is **client-only/ephemeral** (no contract/backend).

- [ ] **Step 1: Write failing test** (`ActiveWorkoutScreen.test.tsx`, mock mode): open the `⋯` menu → "Áthelyezés", move a remaining exercise up via ▲, close; assert the active exercise list/next-up reflects the new order. (Use the mock workout fixture; assert by the next exercise name after completing the current one, or by the reorder sheet's row order.)
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3:** Build `ExerciseActionSheet` (a `Sheet` with the four action rows; props `{ onReorder, onSkip, onAddSet, onEditNote, hasNote }`). Wire the header `⋯` button to open it. "Áthelyezés" opens a `SortableList` of the **remaining** exercises (filter out fully-done + the current); `onReorder(ids)` updates `session.order` (remaining segment only; completed prefix stays fixed).
- [ ] **Step 4: Run, verify PASS** (both modes). `pnpm -C frontend build`.
- [ ] **Step 5: Commit.** `git commit -am "feat(train): reorder remaining exercises in the active workout (F1, mezo-an1)"`

---

## Slice 4 — F2 add-set (+ optional template write)

### Task 4.1: Add a set this session (FE-only persistence path)

**Files:** Modify `ActiveWorkoutScreen.tsx`, `trainHooks.ts` (add `addSet` to `useTrain`).

- [ ] **Step 1: Write failing tests.** (a) `workoutState.test.ts` already covers `addExtraSet` (Slice 1). (b) `ActiveWorkoutScreen.test.tsx` mock: `⋯` → "＋ Szett" grows the set-dots from 4 → 5 and the header reads `Set x/5`; a dashed "extra" dot is present (`data-extra` attribute on the 5th dot). (c) real mode (MSW, mirror the existing `set:` capture): after add-set, completing the extra set POSTs `setIndex: 4`.
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3:** Wire "＋ Szett" → `addExtraSet(session, current.id)`; render the extra dot with `border-style:dashed` + `data-extra`. In real mode the extra set logs through the existing `logSet` path (no new hook needed for the log itself); add a thin `useTrain.addSet` only if a distinct call is wanted — otherwise the model change + existing `logSet` suffices. (Decide: prefer reusing `logSet`; `addSet` in `useTrain` is the optional-template-write trigger in Task 4.2.)
- [ ] **Step 4: Run, verify PASS** (both modes). `build`.
- [ ] **Step 5: Commit.** `git commit -am "feat(train): add an extra set mid-workout (F2 session-only, mezo-an1)"`

### Task 4.2: Optional "Minden hétre" → write the template set count

**Files:** Modify `ActiveWorkoutScreen.tsx` (the post-add prompt), `trainHooks.ts` (reuse `saveDayExercises`).

- [ ] **Step 1: Write failing test** (real mode): after "＋ Szett" the prompt renders "Csak ma / Minden hétre"; clicking "Minden hétre" calls the day-exercise PUT (`replaceDayExercises`) with the current exercise's `sets` bumped by 1 (assert via an MSW capture of `PUT /api/train/mesocycles/:id/days/:dayId/exercises` body). "Csak ma" fires no PUT.
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3:** After `addExtraSet`, show the prompt. "Minden hétre" → `saveDayExercises(mesoId, dayId, days-exercises-with-bumped-sets)`; "Csak ma" → dismiss. Needs `mesoId`/`dayId`/the day's exercise list available on the screen (from `useTrain`/`todaySession`); thread them in.
- [ ] **Step 4: Run, verify PASS** (both modes). `build`.
- [ ] **Step 5: Commit.** `git commit -am "feat(train): optional 'minden hetre' template write on add-set (F2, mezo-an1)"`

---

## Slice 5 — F3 skip (contract + migration + UI)

### Task 5.1: Migration — `skipped` flag on `exercise_set`

**Files:** Create `backend/.../db/changelog/1.0.0/script/202606171200_mezo-an1_exercise_set_skipped.sql`; modify `1.0.0_master.yml`, `ExerciseSetEntity.java`. Read `liquibase_conventions.md` first.

- [ ] **Step 1:** Write the SQL: `ALTER TABLE exercise_set ADD COLUMN skipped boolean NOT NULL DEFAULT false;` (explicit, immutable changeset — never edit a released one).
- [ ] **Step 2:** Register it in `1.0.0_master.yml` (new `changeSet` id `"1.0.0:202606171200_mezo-an1_exercise_set_skipped"`, `sqlFile` path `script/202606171200_mezo-an1_exercise_set_skipped.sql`).
- [ ] **Step 3:** Add `private boolean skipped = false;` (`@Column`) to `ExerciseSetEntity` (+ Lombok @Getter/@Setter already on class).
- [ ] **Step 4: Run IT** to apply + verify: `backend/mvnw -f backend/pom.xml clean test -Dtest=WorkoutServiceIT` (compose up) → PASS (existing tests; migration applies clean).
- [ ] **Step 5: Commit.** `git commit -am "feat(train-db): exercise_set.skipped flag (F3 migration, mezo-an1)"`

### Task 5.2: Contract + service — skip endpoint

**Files:** `api/feature/train/train.yml` (new `POST /api/train/workouts/{id}/skip`, body `WorkoutSkipRequest { exerciseId: uuid }`); `WorkoutService.skipExercise`; `TrainController`; `WorkoutServiceIT`.

- [ ] **Step 1:** Edit `train.yml`: add the path + `WorkoutSkipRequest` schema. Regenerate: `npm --prefix api/generate run generate:api && pnpm -C frontend generate:api`.
- [ ] **Step 2: Write failing IT** in `WorkoutServiceIT.java`:

```java
@Test
void testSkipExercise_shouldRecordSkip_whenExerciseInActiveInstance() {
  UUID user = databasePopulator.populateUser("workout@test.local");
  MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
  WorkoutSessionEntity template = trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
  ExerciseEntity exercise = trainPopulator.createExercise(user, template.getId(), "Face Pull", 0);
  WorkoutInstanceResponse started = workoutService.startWorkout(user, startRequest(template));
  workoutService.skipExercise(user, started.getId(), exercise.getId());
  // a skipped marker row exists for that exercise+instance
  assertThat(exerciseSetRepository.findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(user, started.getId())
      .stream().anyMatch(s -> s.getExerciseId().equals(exercise.getId()) && s.isSkipped())).isTrue();
}

@Test
void testSkipExercise_shouldThrowNotFound_whenExerciseNotInTemplateDay() { /* mirror logSet's foreign-exercise IT */ }
```

- [ ] **Step 3: Run, verify FAIL.** `backend/mvnw … -Dtest=WorkoutServiceIT`.
- [ ] **Step 4: Implement** `WorkoutService.skipExercise(UUID user, UUID instanceId, UUID exerciseId)`: verify instance owned + active + exercise hangs off the instance's template day (same guard as `logSet`, `WorkoutService.java:159-162`); persist a skip marker `ExerciseSetEntity` (`workoutSessionId=instance`, `exerciseId`, `setIndex`=next, `skipped=true`, perf fields null, `createdBy=user`). Errors via `SystemRuntimeErrorException` + `SystemMessage`. Implement the generated `TrainApi` skip method in `TrainController` delegating to the service.
- [ ] **Step 5: Run, verify PASS.** Add `WorkoutContractIT` HTTP-level test (`ownerAuthHeaders()`, 204/200). Run `-Dtest=WorkoutServiceIT,WorkoutContractIT` → PASS.
- [ ] **Step 6: Commit.** `git commit -am "feat(train): skip-exercise endpoint + service (F3, mezo-an1)"`

### Task 5.3: FE skip + recap marking

**Files:** `trainHooks.ts` (`skipExercise` mutation: mock no-op, real `trainApi.skip` + invalidate today); `ActiveWorkoutScreen.tsx` (`⋯` → "Kihagyás" → model `skipExercise` + advance, no FeedbackModal); recap/summary marks skipped exercises ("kihagyva", struck).

- [ ] **Step 1: Write failing tests** (both modes): `⋯` → "Kihagyás" advances to the next exercise WITHOUT opening the FeedbackModal; the skipped exercise shows "kihagyva" in the recap. Real mode: a skip POST fires.
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement** the mutation + wiring + recap marking.
- [ ] **Step 4: Run, verify PASS** (both modes). `build`.
- [ ] **Step 5: Commit.** `git commit -am "feat(train): skip an exercise in the active workout (F3 UI, mezo-an1)"`

---

## Slice 6 — F4 durable per-exercise note

### Task 6.1: Migration + entity — `note` on the exercise template

**Files:** Create `…/script/202606171210_mezo-an1_exercise_note.sql` (`ALTER TABLE exercise ADD COLUMN note text;`); register in `1.0.0_master.yml`; add `private String note;` to `ExerciseEntity`.

- [ ] **Steps:** mirror Task 5.1 (SQL → master include → entity field → `mvnw clean test -Dtest=WorkoutServiceIT` PASS → commit `feat(train-db): exercise.note column (F4 migration, mezo-an1)`).

### Task 6.2: Contract + read/write — note round-trip

**Files:** `train.yml` (`TodayExercise.note`; `PUT /api/train/exercises/{exerciseId}/note` body `{ note }` maxLength 500); `WorkoutService`/`TrainMapper` (surface note on `getToday`); `ExerciseService` or `WorkoutService.saveExerciseNote`; `TrainController`; `WorkoutServiceIT`.

- [ ] **Step 1:** Edit `train.yml`; regenerate FE + (mvnw) BE types.
- [ ] **Step 2: Write failing IT:** `saveExerciseNote(user, exerciseId, "4-es ülés")` then `getToday(user)` returns that exercise's `note == "4-es ülés"`; foreign exercise → SystemRuntimeErrorException.
- [ ] **Step 3: Run, verify FAIL.**
- [ ] **Step 4: Implement** the write (owner-scoped, ownership verified) + map `note` onto `TodayExercise` in `getToday`/`TrainMapper`.
- [ ] **Step 5: Run, verify PASS** (`-Dtest=WorkoutServiceIT,WorkoutContractIT`).
- [ ] **Step 6: Commit.** `git commit -am "feat(train): durable per-exercise note round-trip (F4 backend, mezo-an1)"`

### Task 6.3: FE note pill + edit sheet

**Files:** `trainHooks.ts` (`saveExerciseNote` mutation + `toWorkoutPlan` carries `note` onto the exercise); `ActiveWorkoutScreen.tsx` (always-visible `NotePill` when `current.note`; `⋯` → "Jegyzet" opens a text sheet → `saveExerciseNote`).

- [ ] **Step 1: Write failing tests** (both modes): when an exercise has a note, the pill renders under the name; `⋯` → "Jegyzet" → type → save calls `saveExerciseNote` (real: POST) and the pill updates. No pill when note absent.
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement** the pill, the edit sheet, the mutation; thread `note` through `toWorkoutPlan` (`trainHooks.ts:47-62`) and the `LoggedWorkoutExercise`/`TodayExercise` FE types.
- [ ] **Step 4: Run, verify PASS** (both modes). `build`.
- [ ] **Step 5: Commit.** `git commit -am "feat(train): durable per-exercise note pill + editor (F4 UI, mezo-an1)"`

---

## Finalization

- [ ] **Docs:** Update `docs/features/train.md` — active-workout section (the `⋯` menu, note pill, reorder/add-set/skip), §4 (skip flag, exercise note, add-set template write), §9 (ephemeral reorder, skip semantics). Run `node scripts/lint-docs.mjs` → PASS. Commit `docs(train): active-workout v2 (mezo-an1)`.
- [ ] **Full gates:** `pnpm -C frontend test` + `VITE_USE_MOCK=true pnpm -C frontend test` (both green), `pnpm -C frontend build`, `backend/mvnw -f backend/pom.xml clean test` (full suite green).
- [ ] **bd:** close the per-slice children / `mezo-an1`; `git pull --rebase && bd dolt push && git push`; confirm `git status` clean + up to date.

---

## Self-Review

**Spec coverage:** ⋯ menu + note pill → Slices 3/6 + ExerciseActionSheet; deviation-session-only → Slice 1 model (template untouched) + Slice 4.2 the only template write; reorder real DnD shared primitive + planner fix → Slices 2/3; skip whole-exercise recorded, no RP debrief → Slice 5; durable note → Slice 6; foundation exerciseId refactor → Slice 1; backend skip + note migrations → 5.1/6.1; ephemeral reorder + no set-level skip + no undo → honored (Slice 3 client-only; Slice 5 whole-exercise; add-set has no remove). All spec sections map to a task.

**Placeholder scan:** Task 4.1 Step 3 and 5.3/6.3 describe sheet/recap markup by structure rather than full JSX — these are routine Sheet compositions following the existing `SportLogSheet`/`Sheet` pattern; the test specs + props pin the contract. Migration SQL, contract deltas, the state model, and the skip service are given concretely. No TBD/"handle edge cases".

**Type consistency:** `Session` shape (Slice 1) is the single source for `order`/`logged`/`extra`/`skipped`/`planned`; `effectiveSetCount`/`currentExerciseId`/`advance`/`addExtraSet`/`skipExercise`/`seedFromOpen` names are reused verbatim in Slices 2-6. `skipExercise` exists at two layers intentionally: the pure model fn (Slice 1) and the `useTrain`/service method (Slice 5) — same name, different layer, not a mismatch. Backend `isSkipped()` matches the `skipped` boolean field (Lombok boolean getter).
