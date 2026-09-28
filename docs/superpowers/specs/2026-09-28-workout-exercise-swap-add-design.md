# Edzés közben gyakorlat csere / hozzáadás — design

- **bd:** `mezo-mobji`
- **Date:** 2026-09-28
- **Domain:** Edzés (active workout, `/train/workout`)
- **Status:** design approved by owner in chat (2026-09-28); prototype + plan pending

## 1. Problem

During an active workout the owner cannot replace a planned exercise with another one (machine
taken, pain, preference) or add an exercise to the running session. For each such change he wants
to choose whether it is **only for today** or **also saved into the mesocycle**.

## 2. Owner decisions (chat, 2026-09-28)

| # | Question | Decision |
|---|---|---|
| D1 | When is scope chosen? | **At the moment of the change** — a "Csak ma" / "Mezociklusra is" choice, default **Csak ma** (same idiom as add-set's "Csak ma / Minden hétre"). |
| D2 | Swap after some sets are logged? | **Split** — logged sets stay on the original exercise (it becomes done, "lecserélve"); the remaining sets move to the new exercise. |
| D3 | Does a "Csak ma" change survive reload? | **Yes** — persisted server-side. |
| D4 | Does "Mezociklusra is" also edit the saved template (`meso_template`)? | **No** — the current run only (remaining weeks). Template editing stays in the template editor. |
| — | Picker / weight (stated as defaults, not objected) | Same-muscle suggestions on top + full searchable library; weight suggestion from the new exercise's own history, none if never done. |

## 3. User-visible behaviour

### 3.1 Entry points
- **Swap:** new row **"Gyakorlat cseréje"** in each exercise card's ⋮ menu (`WorkoutMenuGlass`).
- **Add:** a **"+ Gyakorlat hozzáadása"** button below the last exercise card.
- Both use new Titanium 3D sprite icons (swap arrows, plus-dumbbell) — drawn per üveg bible §4,
  shown on the prototype's "Új ikonok" sheet for OK, then added to the shared sprite.

### 3.2 Flow
1. `ExercisePickerSheet` opens in **single-pick mode** (pick → close). In swap mode a
   **"Hasonló gyakorlatok"** strip on top lists up to 4 library items with the same `muscle`
   (fallback: same region), excluding exercises already in today's session and the one being
   replaced; the full searchable/filterable list follows.
2. Scope sheet (reuse of the add-set "A tervbe is felvegyük?" sheet): **"Csak ma"** (primary,
   preselected) · **"Mezociklusra is"** — subtitle: "a mezociklus hátralévő heteiben is".
   For a closing-block exercise (`ClosingBlockService`: Dead Hang, Back Extension) only "Csak ma" is
   offered (the closing block is re-appended every day, so a plan swap would not stick). The same
   holds when swapping an exercise that was itself added "Csak ma" — it has no plan slot.
3. The session updates in place; no page reload.

### 3.3 Swap semantics
- **No sets logged on the original:** the new exercise takes the original's position and its
  prescription shape (working sets incl. session `extra`, rep range, target RIR, warm-up sets).
  The original disappears from today's list.
- **Some sets logged (D2):** the original stays in place as **done**, showing its logged sets and a
  "Lecserélve → <new name>" tag; its effective set count = logged working sets. The new exercise is
  inserted **directly after it** with `remaining = planned − logged` working sets and the default
  warm-up count of its type (`suggestedWarmupSets`); warm-ups can be skipped as today.
- Swapping the **current** exercise makes the new one current.
- A swapped-in exercise can itself be swapped, skipped, reordered, noted, get extra sets — it is a
  normal card.

### 3.4 Add semantics
- Appended to the end of `session.order`; recipe defaults by type (`libraryToGymExercise`:
  compound 4×8–10 RIR 1 + 2 warm-ups, isolation 3×10–12 + 1, plyo 3×5 weightless).
- A normal card afterwards (reorder, skip, extra set, note).

### 3.5 Weight suggestion
- From the exercise's **own** identity history (catalogId, else exact name), via the existing
  `SetRecommendationService.prescribe` — the server computes it when it returns the new row.
- No history → no target weight (blank, user enters); `anchorWeightKg` is not set.
- The replaced exercise's history is untouched.

### 3.6 Persistence and read-back
- Reload / resume restores swaps and adds exactly (D3).
- The post-workout review (`/train/review/:id`) and history show swapped-out, swapped-in and added
  exercises with their sets.
- **"Mezociklusra is":** every later instance of this weekday in the run shows the new plan; past
  instances are unchanged; `meso_template` is unchanged (D4).

### 3.7 Out of scope
- Removing an exercise from the plan mid-workout (Kihagyás covers today; the meso editor covers the plan).
- Writing to `meso_template`.
- Changing sets/reps of the swapped/added exercise inside the scope sheet (existing extra-set /
  remove-set controls do that afterwards).
- "Don't suggest again" preferences (Fitbod-style).

## 4. Technical design

### 4.1 Data model — instance-scoped exercise rows
`exercise.workout_session_id` already FKs to `workout_session`, and an **instance** is a
`workout_session` row too. So a **"Csak ma" exercise is an `exercise` row whose
`workout_session_id` = the instance id**. No new table.

Liquibase (`db/changelog/1.1.0/script/`): one nullable column
`exercise.replaces_exercise_id UUID` (FK → `exercise(id)` ON DELETE SET NULL) — set on the
swapped-in row, pointing to the row it replaces **for this instance**. Index on it.

Readers that must **not** see instance rows because they read by template day id — volume
distribution (`weekTemplateExercises`), meso detail, day editor, closing block, proactive
challenge evaluator — already filter by template day ids; the plan audits every
`ExerciseRepository` query to confirm (task list item).

### 4.2 API (contract-first, `api/feature/train/train.yml`)
New endpoints on the running workout:

- `POST /api/train/workouts/{workoutId}/exercises` — body
  `{ catalogId?, name, muscle, type, workingSets, repMin, repMax, targetRir, warmupSets,
  scope: TODAY|MESO, replacesExerciseId? }` → returns the created exercise **with its
  prescription** (same shape as a `getToday` exercise) plus the effective set count left on the
  replaced exercise.
- `PATCH /api/train/workouts/{workoutId}/exercises/{exerciseId}/working-sets` — body
  `{ delta, scope: MESO }` — the id-stable replacement for the add-set "Minden hétre" full-list PUT.

Behaviour of `POST`:
- Guard: instance owned + `active`; `replacesExerciseId` (if given) belongs to this instance's
  template day or to this instance.
- **TODAY:** insert row on the instance (`workout_session_id = instance`), `order_index` = after the
  replaced row (swap) or last (add); `replaces_exercise_id` set for a swap.
- **MESO:** insert row on the **template day**. Swap: take the replaced row's `order_index` and
  soft-delete the replaced template row **only** (single-row delete, no full-list replace — every
  other id stays stable). Add: `order_index = max + 1`. `replaces_exercise_id` set for the swap so
  today's instance can still render the replaced row's logged sets.
- Rejected with `TRAIN_EXERCISE_SWAP_NO_PLAN_SLOT` (409) for MESO when the replaced row is a
  closing-block exercise or an instance-scoped row.

### 4.3 Read paths
- `getToday` (open instance present): exercises = live template-day rows ∪ this instance's rows;
  a row that is the target of a `replaces_exercise_id` from this instance is **hidden if it has no
  logged working set in this instance**, else returned with `replacedBy` + `plannedSets = logged`.
  Rows soft-deleted by a MESO swap are re-included only through that link (findById including
  deleted — `findIdentityRowsIncludingDeleted` precedent).
- `getWorkoutDetail` / review: exercises = every row (incl. soft-deleted) referenced by this
  instance's sets ∪ this instance's rows ∪ live template rows — fixes the pre-existing
  "edited-away exercise vanishes from review" trap.
- `logSet`, `skipExercise`, `saveExerciseNote`: guard relaxed to "row belongs to the template day
  **or** to this instance **or** is the replaced row of this instance".
- New `GymExercise` fields: `replacedBy?: {id, name}`, `origin: plan|today` (for the "ma
  hozzáadva" chip).

### 4.4 Frontend
- `logic/workoutState.ts` — new pure transitions, table-tested:
  `swapExercise(session, oldId, newEx, loggedCount)` and `addExercise(session, newEx)`.
  They update `order`, `planned`, `prescribed`; D2 split sets `planned[old] = loggedCount`.
- `ActiveWorkoutPage` — menu row + bottom button, picker (single-pick mode), scope sheet; on
  confirm call the new `useTrain()` mutation, apply the transition optimistically with the
  returned row, then `invalidateToday`; `mergePlan` must treat an id already in `order` as no-op
  (it does) so the refetch does not duplicate.
- `ExercisePickerSheet` — `mode: 'multi' | 'single'`, optional `similarTo: ExerciseLibraryItem`
  for the suggestion strip (`muscle` / `muscleRegion`).
- Add-set "Minden hétre" → the new PATCH (fixes the id-churn bug).
- Mock mode: the mutation emulates via `setQueryData` on `['train','workoutToday']` so cards
  render; same for the PATCH.

### 4.5 Error handling
- Network failure on confirm: no optimistic change is kept; toast "Nem sikerült menteni, próbáld újra".
- 409 no-plan-slot MESO: cannot happen from the UI (option hidden); defensive toast.
- Instance not active (finished in another tab): existing `TRAIN_WORKOUT_NOT_ACTIVE` handling.

### 4.6 Testing
- Backend ITs: TODAY add/swap (0 and N logged) → `getToday`, `logSet` on the new row, resume,
  review; MESO add/swap → next week's instance sees the new plan, other ids unchanged, past
  review intact; PATCH working-sets id stability; closing-block rejection; ownership 404s.
- FE: `workoutState` table tests; `ActiveWorkoutPage` flows in both modes (MSW for real mode,
  `ActiveWorkoutPage.realFinish.test.tsx` pattern); picker single-mode + suggestions.
- Layout spec for the new menu row / button / sheets at 320px.

## 5. Prior art (researcher)
- **Adopted:** scope chosen at swap time with a safe "only today" default — Hevy Trainer
  ("permanent or just for the specific session", https://www.hevyapp.com/features/workout-plan-generator/),
  Boostcamp (https://www.boostcamp.app/blogs/tips-and-tricks-to-using-boostcamp-app), JuggernautAI
  "each day or entire block" (https://www.garagegymreviews.com/juggernautai-review).
- **Adopted:** same-muscle alternatives above full search — Fitbod
  (https://help.fitbod.me/hc/en-us/articles/360006335593-Editing-Workouts-in-Fitbod).
- **Adopted:** weight history belongs to the exercise, never the slot; no history → no suggestion
  (Hevy "if you've logged the exercises at least once"; RP principle, unverified — help centre 403).
- **Rejected:** Strong's end-of-workout "Update Template" (https://help.strongapp.io/article/177-update-template)
  — all-or-nothing, wrong for a mesocycle whose weekly targets differ; Strong itself flags the confusion.
- **Rejected:** Fitbod's preference model (recommend more/less) — our plan is fixed, not generated.

## 6. Codebase terrain (investigator)
- No swap/add exists anywhere (FE, BE, flags, bd). Closest precedent: add-set "Csak ma / Minden
  hétre" sheet, `ActiveWorkoutPage.tsx:1131-1164`, writer `writeExtraSetToTemplate` `:1001-1023`.
- Sets FK to the **template** exercise row; `logSet` guard `WorkoutService.java:645-648`;
  `getToday` `:140-318`; `getWorkoutDetail` `:427-460`.
- Day PUT `TrainService.replaceDayExercises` `:350-367` is a full-list soft-delete + reinsert →
  **every id changes** → a mid-workout "Minden hétre" churns ids under the running session
  (`mergePlan` duplicates / `logSet` 404). Inferred, fixed by §4.2 PATCH; the plan adds a
  regression IT first.
- Day PUT drops per-exercise `note` (pre-existing; our targeted writes avoid it).
- Review loses soft-deleted rows (fixed by §4.3).
- Mesocycles are not instantiated per week: a template-day edit applies to all remaining weeks.
- History/prescription is identity-keyed (`ExerciseHistoryResolver`), incl. soft-deleted rows.
- Picker `ExercisePickerSheet.tsx` is multi-add; muscle data via `logic/muscleColors.ts`.
- Closing block re-appended daily (`ClosingBlockService`).
- Mock `W.exercises` is static; `saveDayExercises` a no-op in mock.
- Gates: contract regen both sides, ArchUnit, `gen-codemap`, `lint-docs`, FE both modes with `CI=true`.

## 7. Delivery
Gate 2: the living prototype `docs/design_2.0/prototypes/elo/edzes.html` gets the menu row, the
add button, single-pick picker with suggestions, the scope sheet, the split "lecserélve" card
state, and an "Új ikonok" sheet — republished to the fixed URL. Gate 3: plan with *Kész, ha…*.
