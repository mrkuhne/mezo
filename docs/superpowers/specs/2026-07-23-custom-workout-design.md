# Saját edzés (custom workout) — design (mezo-ws2x)

**Date:** 2026-07-23 · **Driving issue:** `mezo-ws2x` · **Companion issue:** `mezo-j3x0` (Mai
cross-day entry, a p7rp D3 follow-up — part A below) · **Status:** approved

## Problem

Every gym workout instance hangs off a mesocycle template day. On a rest day (or between
mesocycles) there is no way to train and have it count: the user cannot assemble an ad-hoc
strength session, log it through the normal flow, and see it land in exercise history, records,
the weekly picture, Insights, companion context and XP. Additionally (part A, `mezo-j3x0`), the
Mai tab's weekly gym rows are inert for non-today, non-done days, so the cross-day start shipped
in `mezo-p7rp` is only reachable from the Gym tab.

## Approved UX

UI name: **„Saját edzés”** (code name `custom`). Three entry points, all opening the same sheet:

1. **Mai — rest-day card**: a `+ Saját edzés` CTA on the „Ma pihenőnap” card (primary use case).
2. **Mai — always available**: a discreet `+ Saját edzés` row under the `Heti terv` section, so
   an extra session is startable even on a planned gym day.
3. **Gym tab**: a header chip next to the existing „Időpontok”.

**Entry sheet (`CustomWorkoutSheet`)**: saved custom templates on top (name + exercise count;
tap → start, ✎ → edit), `+ Új összeállítása` below → composer.

**Composer (`CustomWorkoutBuilderPage`, `/train/custom/new` and `/train/custom/:id`)**: a
full-screen sibling route (no sub-nav, like the meso builder). Name field + exercise list;
add via the existing multi-add `ExercisePickerSheet`; per exercise the same recipe stepper grid
as the meso builder (warmup/working sets, rep range, RIR, anchor kg). Save CTA + **`Indítás
ma →`** (saves, then navigates to `/train/session?day={templateId}`).

**Execution**: the started custom workout runs the unchanged ActiveWorkout flow — set logging,
skip, note, add-set, RP debrief, summary, explicit finish, level-up overlay. Zero new execution
UI. The done-day review (`WorkoutReviewPage`) works unchanged.

**Weekly visibility**: completed custom instances of the current week render as extra rows in
the Mai weekly agenda on their own date (name + ✓ kész, tap → review). An open custom instance
today drives the gym hero's „Folytassuk →” state for free (open-instance-wins day resolution).
The `LoadTiles` Gym tile counts completed custom sessions.

**Repeatability**: a custom template is startable any time, any number of times per week — the
once-per-week rule (p7rp D5) does not apply; one-open-workout-at-a-time (p7rp D6) does.

**Part A (`mezo-j3x0`) — Mai → GymDaySheet**: the currently-inert weekly gym rows (non-today,
not done) become tappable → open the same `GymDaySheet` as the Gym tab, with its existing
four-state footer. Today's row (direct start) and done rows (direct review) keep their current
behavior — only the dead rows gain life.

## Decisions

- **D1 — Modeling: meso-less template day.** A custom template is an ordinary `workout_session`
  TEMPLATE row (`template_session_id NULL`) with `mesocycle_id NULL` and a new discriminator
  column **`origin TEXT NOT NULL DEFAULT 'meso'` CHECK (`meso|custom`)**. Its name lives in
  `type` (where meso day titles already live), `day_label = ''` (not weekday-bound). Exercises
  are ordinary `exercise` recipe rows FK'd to it. The instance machinery (start, log, skip,
  feedback, finish, auto-close, review) is reused untouched.
- **D2 — Instances inherit `origin`.** `startWorkout` copies the template's `origin` onto the
  instance row, so queries filter without joins.
- **D3 — Guards.** The D5 „once per template day per Mon–Sun week” guard is **skipped** when
  the template is `origin='custom'` (repeatable); the D6 „one open workout at a time” guard
  stays (409 `TRAIN_WORKOUT_OPEN_ELSEWHERE`).
- **D4 — `getToday` becomes partially meso-independent.** Today the no-active-meso early return
  precedes everything. New order: the open-instance branch and the `?day=`/`templateSessionId`
  param branch resolve **without** an active meso (a custom workout must work between
  mesocycles too); only the weekday-label fallback and the closing-block ensure stay
  meso-gated. `completedWorkout` is populated **only for meso-origin** resolved days — a custom
  day is repeatable, so it must never trigger the FE review-redirect.
- **D5 — Counting semantics.**
  - ✅ automatic (no change): exercise history + records + e1RM (`exercise_set` rows, catalog
    identity); „múlt hét” refs + the prescription engine (per template day → double progression
    across repeats of the same custom template); Insights weekly counts + companion
    `get_recent_workouts` (`findDoneInstancesBetween` stays origin-agnostic); XP / level-up on
    finish; the progression robustness streak (`findInstanceDates`).
  - ❌ deliberately excluded: the planned-day ✓ marks (`weekDoneDates`), QuestEvaluator day
    completion and the discipline trait (`TrainingCommitmentCalculator`) are plan-adherence
    semantics — a rest-day extra session must not tick the planned Wednesday row nor inflate
    discipline. **`findDoneInstanceDates` gains `AND s.origin = 'meso'`.**
- **D6 — `WorkoutSummaryResponse` gains `origin` + `title`** so the FE weekly agenda can render
  custom rows by name from the existing `GET /workouts?from&to` fetch (`useWeekWorkouts`).
- **D7 — Template CRUD.** New endpoints (contract-first, `api/feature/train/train.yml`):
  `GET/POST /api/train/custom-workouts`, `PUT/DELETE /api/train/custom-workouts/{id}`.
  Response `{id, name, exercises: GymExercise[]}` reuses the existing `GymExercise` /
  `GymExerciseInput` schemas; PUT is rename + full exercise replace (the same
  soft-delete-and-reinsert pattern as meso day exercises); DELETE is soft — history survives
  (record identity already reads soft-deleted rows). Start needs **no new endpoint**: the
  existing `POST /api/train/workouts {templateSessionId}` accepts a custom template id.
- **D8 — Mai entry (part A).** Inert weekly gym rows open `GymDaySheet`; `TrainTodayPage`
  resolves the tapped weekday's `MesoDay` from the active meso and passes the same props as
  `GymPage` (completed map from `useWeekWorkouts`, open instance from `todaySession`).
- **D9 — LoadTiles.** Completed custom sessions add to the Gym tile count (they are real load);
  the tile still shows planned days too — count = planned gym days + completed custom sessions
  of the week.
- **D10 — Composer reuse.** The per-exercise recipe stepper grid is extracted from
  `MesoDayTabsEditor` into a shared `ExerciseRecipeRow` component used by both the meso builder
  and the custom composer — no duplication.
- **D11 — Out of scope / untouched.** The closing block (`ClosingBlockService`) never touches
  custom templates (it iterates active-meso days only — unchanged). Challenges are keyed on
  `templateSessionId` and left as-is. Mock mode: fixtures + no-op writes, full visual parity;
  mock start navigates to `/train/session` plain (mock days carry no id — the existing
  `GymDaySheet` mock behavior).

## Data model & API

**Migration** (Liquibase, `1.0.0/script/`): `{ts}_mezo-ws2x_workout_session_origin.sql` —
`ALTER TABLE workout_session ADD COLUMN origin TEXT NOT NULL DEFAULT 'meso'` +
`ck_workout_session_origin CHECK (origin IN ('meso','custom'))`. Backfill via the default.
Entity: `WorkoutSessionEntity.origin`.

| Endpoint | Behavior |
|---|---|
| `GET /api/train/custom-workouts` | owner's custom templates, `CustomWorkoutResponse {id, name, exercises: GymExercise[]}` |
| `POST /api/train/custom-workouts` | `CustomWorkoutCreateRequest {name, exercises: GymExerciseInput[]}` → 201 |
| `PUT /api/train/custom-workouts/{id}` | rename + full exercise replace; foreign/missing → 404 |
| `DELETE /api/train/custom-workouts/{id}` | soft delete; foreign/missing → 404 |
| `POST /api/train/workouts` | unchanged shape; D5 guard skipped for custom templates |
| `GET /api/train/workouts/today?templateSessionId=` | resolves custom templates; works without an active meso (D4) |
| `GET /api/train/workouts?from&to` | summaries now carry `origin` + `title` (D6) |

Service: `CustomWorkoutService` (feature/train/service) — CRUD, owner-scoped
(`created_by`, foreign → 404), method-level `@Transactional` on writes. `WorkoutService`
changes: D2 origin copy, D3 guard skip, D4 resolution reorder, D5 query filter.

## Frontend structure

| Layer | File | What |
|---|---|---|
| data | `data/train/customWorkoutHooks.ts` (+ `data/hooks.ts` barrel re-export) | `useCustomWorkouts()` list + `useCustomWorkoutActions()` create/update/delete; dual-mode |
| data | `data/train/train.ts` | 1–2 mock custom-template fixtures |
| sheets | `features/train/sheets/CustomWorkoutSheet.tsx` | entry sheet (list + start/edit + new) |
| pages | `features/train/pages/CustomWorkoutBuilderPage.tsx` | composer; routes `/train/custom/new`, `/train/custom/:id` in `app/router.tsx` |
| components | shared `ExerciseRecipeRow` extracted from `MesoDayTabsEditor` | recipe stepper grid reuse (D10) |
| entries | `TrainTodayPage` (rest-day card + under `Heti terv`), `GymPage` (header chip) | all open `CustomWorkoutSheet` |
| agenda | `logic/agenda.ts`, `components/WeeklyDayRow.tsx`, `logic/weeklyLoad.ts` | custom summary rows on their date + Gym tile count (D9) |
| part A | `WeeklyDayRow.tsx` + `TrainTodayPage.tsx` | inert gym rows → `GymDaySheet` (D8) |

`ActiveWorkoutPage` and `WorkoutReviewPage`: **zero changes**.

## Testing

- **BE ITs** (`ApiIntegrationTest` + populators): `CustomWorkoutIT` — CRUD + ownership (foreign
  → 404); start-custom: D5 skipped (same template twice in a week succeeds), D6 enforced (409);
  `getToday` with `?day={customId}` **without an active meso**; open custom instance wins day
  resolution; summaries carry `origin`/`title`; `findDoneInstanceDates` excludes custom dates;
  auto-close settles a stale custom instance.
- **FE**: hooks in both modes; `CustomWorkoutSheet` / composer / agenda-row component tests;
  `weeklyLoad` custom counting; part-A row-tap test. Gate: `pnpm build && pnpm test &&
  VITE_USE_MOCK=true pnpm test`.

## Delivery order

1. **`mezo-j3x0`** — Mai → GymDaySheet entry (small, FE-only, ships first on its own branch).
2. **`mezo-ws2x`** — Saját edzés (full-stack: migration + BE + contract + FE, one branch).

Each: own `feat/<topic>` branch → self-PR → CI green → `--no-ff` merge. `docs/features/train.md`
(§2 Mai/Gym/entry points, §4 data model/API, §5 integrations) updated in the same change.
