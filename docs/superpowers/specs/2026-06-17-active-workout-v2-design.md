# Active-workout v2 — in-session flexibility — Design

> **Date:** 2026-06-17
> **Status:** Approved (brainstorming) → next: writing-plans
> **Driving issue:** `mezo-an1` (cluster) — field-test findings F1–F4 (2026-06-17, real mode, PWA)
> **Scope:** Make the live workout (`ActiveWorkoutScreen`) flexible — reorder exercises, add a set,
> skip an exercise, keep a durable per-exercise note — instead of a rigid linear machine. Plus the
> shared reorder primitive that also fixes the meso planner's currently-fake drag handles.
> AI/analysis (challenges, PR detection, voice) stays Phase-3 out of scope.

## Source of truth

- **Findings:** the 2026-06-17 field-test list (F1 reorder, F2 add-set, F3 skip, F4 note). F5 (manual
  numeric entry, `mezo-4su`) and F6 (done-state, `mezo-7o2`) already shipped.
- **Current code:** `frontend/src/features/train/ActiveWorkoutScreen.tsx` (the linear state machine),
  `frontend/src/data/trainHooks.ts` (the `useTrain` boundary), `api/feature/train/train.yml`,
  `backend/.../feature/train/` (WorkoutService/SportService + entities).
- **House standards (mandatory):** `docs/references/` — `liquibase_conventions.md`, `spring_patterns.md`,
  `api_contract_conventions.md`, `error_handling.md`, `testing_standards.md`, `integration_test_framework.md`,
  `configuration_conventions.md`. The `react19-enterprise` / `tailwind-v4` skills for the FE.
- **Living feature doc to update on completion:** `docs/features/train.md`.

## Decisions (made with the user)

| # | Decision | Choice |
|---|---|---|
| Surfacing model | How the 4 capabilities appear | **A — per-exercise `⋯` action menu** (bottom sheet) hosting ↕ Áthelyezés · ⊘ Kihagyás · ＋ Szett · ✎ Jegyzet, **plus** an always-visible inline **note pill** on the card whenever a note exists (the read-back half from "B") |
| Deviation semantics | Does a live deviation rewrite the PLAN? | **Session-only by default.** The mesocycle is the plan; the instance records what actually happened. **Only ＋ Szett** offers an optional "a tervbe is" (write the new set count to the template → future weeks inherit). Reorder and skip never touch the template. |
| F1 reorder mechanism | DnD vs buttons | **Real drag-and-drop via `dnd-kit`** in a shared `SortableList` primitive (touch + keyboard + screen-reader; long-press activation to avoid scroll conflict), with ▲▼ as the a11y/precision fallback. **The same primitive replaces the planner's fake DnD.** |
| F1 reorder scope | Which exercises | Only the **remaining (not-yet-completed)** exercises; completed ones are fixed. |
| F3 skip granularity | Set vs exercise | **Whole exercise.** Already-logged sets stay; the remainder is marked skipped. **Recorded** as a distinct state (reads tell skipped apart from never-attempted). **No** RP debrief for a skipped exercise. Does not break done-state (`mezo-7o2`: ≥1 logged set anywhere still counts). |
| F4 note scope | Per-set vs durable | **Durable, per-exercise** (machine settings, "remember next time"). Always-visible pill when present; edited via the `⋯` menu; pre-loaded on the next session. |

## 1. Architecture & data flow

Everything lands on `ActiveWorkoutScreen.tsx` plus one new shared primitive and small backend/contract
additions. The current screen is a strictly **linear** machine: a single `exerciseIdx`/`setIdx` cursor over
a fixed `W.exercises` array, with `completedSets` keyed by **array index** (`'ex'+idx`,
`ActiveWorkoutScreen.tsx:30,172-176,92-105`). Reorder/add-set/skip all break that keying — so the cluster
shares one **foundation refactor** that must land first.

```
ActiveWorkoutScreen
├── (foundation) completedSets keyed by exerciseId; cursor = "current exerciseId" not array index;
│                set counts read from an effective per-exercise count; seedFromOpen rebuilt by exerciseId
├── ExerciseActionSheet  (⋯ menu hub) ── ↕ reorder · ⊘ skip · ＋ add-set · ✎ note
├── <NotePill>           (inline, shown when the exercise has a durable note)
├── <SortableList>       (NEW shared primitive, dnd-kit) ── reused by the meso planner
└── useTrain()           (data boundary) ── new: skipExercise, addSet(+optional template write),
                                            saveExerciseNote; reorder is client-only (ephemeral v1)
```

**Mock vs real (the house asymmetry):** in mock mode all `useTrain` writes no-op and the screen runs on
local React state — reorder/add-set/skip/note all work locally with **no persistence** (consistent with
every other mock write). In real mode the new writes persist (skip → backend state, add-set → `exercise_set`
row + optional template write, note → exercise template column) and a mid-workout reload resumes from the
persisted instance. Reorder is **ephemeral in both modes** for v1 (see Out of scope).

## 2. Foundation refactor (must land first)

The enabling change, with no user-visible feature on its own:

- **`completedSets` keyed by `exerciseId`** (not `'ex'+index`). All readers/writers updated
  (`completeSet` :171-202, `seedFromOpen` :92-105, history rendering, the advance logic).
- **Cursor by exerciseId, non-linear.** `exerciseIdx`/advance (`:211-225`) reworked so "current exercise"
  and "next exercise" come from a mutable **session order** of exercises (the reordered/skip-aware list),
  not `array[idx+1]`. "Last exercise" = no remaining non-skipped exercise.
- **Effective set count per exercise** (not the fixed `ex.sets`): `setIdx`, the set-dots
  (`:521-534`), the `x/N` header (`:473`) and the progress denominator read an **effective** count that
  add-set can grow. `seedFromOpen` rebuilds the cursor from the **persisted** set rows, not `ex.sets`.

Behavior must be byte-identical for the existing happy path (no reorder/skip/extra set) — the existing
`ActiveWorkoutScreen.test.tsx` real+mock suites stay green; new behavior is additive.

## 3. Per-feature design

### F1 — Reorder (↕ Áthelyezés)
- `⋯` → "Áthelyezés" opens a `SortableList` of the **remaining** exercises (`dnd-kit` SortableContext;
  drag handle = the existing grip; ▲▼ fallback for a11y). Reordering sets the session order; the current
  in-progress exercise stays current.
- **Client-only / ephemeral (v1).** No contract/backend; the order lives in React state and resets to
  template order on a hard reload (logged sets are preserved by exerciseId regardless). Per-instance order
  persistence is a documented follow-up.
- **Shared primitive:** `frontend/src/components/ui/SortableList.tsx` (or `features/train/components/`),
  generic over items + `onReorder`. **Replaces the fake DnD** in `MesoExercises.tsx`,
  `ExerciseEditRow.tsx`, `PlannerExerciseRow.tsx` (the "VISUAL ONLY — Phase 1 ships no real DnD" stubs) so
  planner reorder finally works and writes via the existing `replaceDayExercises` PUT.

### F2 — Add a set (＋ Szett)
- `⋯` → "＋ Szett" appends one set to the current exercise: the effective count grows, a **dashed "extra"
  set-dot** appears, logging continues with the next `setIndex`.
- **Persistence (real):** the extra set posts to the existing `POST /api/train/workouts/{id}/sets` — the
  backend already accepts any `setIndex` (0-49) with no check against planned `sets` (`WorkoutService.logSet`),
  so the log-extra-set half needs **no backend change**.
- **Optional template write:** immediately after adding, a prompt — **Csak ma** (default; instance-only) /
  **Minden hétre** (writes the bumped `sets` to the `exercise` template row so future weeks inherit). The
  "Minden hétre" path reuses the day-exercise write (`replaceDayExercises` / a narrow patch — see Contract).
- Remove/undo of an extra set is **out of scope v1** (skip covers "do fewer"); revisit if needed.

### F3 — Skip (⊘ Kihagyás)
- `⋯` → "Kihagyás" marks the **whole current exercise** skipped and advances. Already-logged sets stay;
  the exercise gets a **skipped marker**. No FeedbackModal (RP debrief) for a skipped exercise.
- **Persistence (real):** a `POST /api/train/workouts/{id}/skip` records the skip (see Contract + Backend).
- **Reads:** a skipped exercise is visually marked in the recap/summary (struck + "kihagyva"), distinct
  from never-attempted. Skipped exercises contribute no sets → no `lastWeek`/records impact, and do **not**
  satisfy done-state on their own.

### F4 — Note (✎ Jegyzet)
- **Durable, per-exercise.** Stored on the **exercise template** (survives across instances). Shown as an
  always-visible **note pill** under the exercise name on the active card whenever present; edited via
  `⋯` → "Jegyzet" (a small text sheet). Pre-loaded on the next session ("remember next time").
- The existing per-set `note` field (`exercise_set.note`, the "Note" chip) stays for in-the-moment per-set
  annotations; F4 is the separate durable layer.

## 4. API contract (contract-first — edit `api/feature/train/train.yml` first)

- **Skip:** `POST /api/train/workouts/{id}/skip` body `{ exerciseId }` → records a skip for that exercise in
  the instance. (Idempotent; owner-scoped.)
- **Note (read):** add `note?: string` to `TodayExercise` (and the gym/exercise read DTOs as needed) so the
  pill pre-loads. **Note (write):** `PUT /api/train/exercises/{exerciseId}/note` body `{ note }` (≤500), or
  fold into the existing day-exercise write — decide in the plan; prefer a narrow endpoint.
- **Add-set template write (optional path):** reuse `replaceDayExercises` (full day list with the bumped
  `sets`) — no new endpoint required; the FE sends the day's exercises with the new count when "Minden hétre".
- **Reorder:** no contract change (ephemeral v1).
- Regenerate: `api/generate` → `frontend pnpm generate:api`; backend types regenerate on `mvnw`.

## 5. Backend (house standards: liquibase / spring / contract-first / integration-test refs)

- **Skip state — Liquibase migration** (`{YYYYMMDDHHMM}_mezo-an1_*`): add `skipped boolean not null default false`
  to `exercise_set` (a skip writes a marker row: `exerciseId`, next `setIndex`, `skipped=true`, perf fields
  null), **or** a dedicated `exercise_skip(instance_id, exercise_id)` table — pick the cleaner option in the
  plan (leaning `skipped` column to reuse the instance↔exercise FK chain). Update `ResetDatabase` TRUNCATE
  list + the relevant `*Populator` if a table is added.
- **Note — Liquibase migration:** add `note text` to the `exercise` template table; map on `ExerciseEntity`;
  expose on the `TodayExercise` read mapping (`WorkoutService.getToday` / `TrainMapper`); write via the new
  endpoint (owner-scoped, ownership verified server-side).
- **Skip service:** `WorkoutService.skipExercise(user, instanceId, exerciseId)` — verify the exercise hangs
  off the instance's template day (same check as `logSet` :159-162); persist the marker. Errors via
  `SystemRuntimeErrorException` + `SystemMessage` (no hardcoded text).
- **No change** needed for the add-set log path (`logSet` already accepts arbitrary `setIndex`).
- **Tests:** `@SpringBootTest` ITs (Testcontainers/compose Postgres, AssertJ, `*Populator` data) — skip
  persists + reads back as skipped; note round-trips on the template + surfaces on `getToday`; add-set extra
  row persists and `getToday`/resume rebuild from it; template write bumps `sets`.

## 6. Frontend (react19 patterns; tests in both modes)

- **New:** `SortableList` (dnd-kit) shared primitive; `ExerciseActionSheet` (the `⋯` sheet); `NotePill`;
  the add-set "Csak ma / Minden hétre" prompt; the skip flow + recap marking.
- **Refactor:** `ActiveWorkoutScreen.tsx` per §2 (exerciseId-keyed state, non-linear cursor, effective set
  counts, `seedFromOpen`).
- **Data boundary:** `useTrain` gains `skipExercise`, `addSet` (with optional template write), `saveExerciseNote`;
  mock arms no-op (local-state behavior preserved); real arms persist + invalidate `['train','workoutToday']`.
- **Planner integration:** swap the three fake-DnD stubs to `SortableList`, wiring `onReorder` →
  `saveDayExercises` (existing PUT). Removes the misleading non-working grip.
- **Add dependency:** `@dnd-kit/core` + `@dnd-kit/sortable` (+ `@dnd-kit/modifiers` if needed).
- **Tests:** both modes — reorder changes order (and the planner reorder now persists); add-set grows the
  count + the "Minden hétre" prompt; skip marks + advances without RP debrief; note pill shows when present
  and pre-loads next session. Existing happy-path suites stay green.

## 7. Build sequence (vertical slices under `mezo-an1`)

Large cluster → decompose into ordered children, each shippable + tested:
1. **Foundation refactor** (§2) — exerciseId-keyed state, non-linear cursor, effective counts, resume. No new feature; suites stay green.
2. **`SortableList` primitive + planner DnD fix** — the shared real-DnD primitive; replace the 3 fake stubs.
3. **F1 reorder in the active workout** (uses #1 + #2).
4. **F2 add-set** + optional template write.
5. **F3 skip** + migration + skip recap marking.
6. **F4 durable note** + migration + pill + read-back.

(Order: the foundation + primitive first; features 3-6 are then largely independent and parallelizable.)

## 8. Out of scope / known limitations (YAGNI)

- **Per-instance reorder persistence across reload** — reorder is ephemeral (client-only) in v1; a hard
  reload resets to template order (logged sets preserved). Persisting per-instance order is a follow-up.
- **Set-level skip** — whole-exercise only.
- **Remove/undo an added set** — not in v1 (skip covers "do fewer").
- **AI/Phase-3** — challenges, real PR detection, voice, crossLoad stay inert/deferred.

## 9. Docs to update on completion

- `docs/features/train.md` — Active workout section (the `⋯` menu, note pill, reorder/add-set/skip flows),
  §4 data model/API (skip + note + add-set), §9 gotchas (ephemeral reorder, skip semantics); run
  `node scripts/lint-docs.mjs`.
- `bd` — decompose `mezo-an1` into the §7 children; close each as shipped.
