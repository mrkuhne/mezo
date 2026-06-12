# Train write + tiszta lap — design (T0–T3)

**Date:** 2026-06-11 · **bd epic:** `mezo-ogv` · **Status:** approved (brainstorm 2026-06-11)

## Goal

Finish the Train domain as a real, usable feature: every write affordance that exists in
the Phase 1 UI persists to the backend, and real mode shows *only* real data — no demo
seed, no static fallbacks masking what is and isn't built. After this program Daniel can:
create a mesocycle in the wizard, activate it, start today's workout, log sets
(weight/reps/RIR/side/note), give RP-style feedback, finish the workout, log sport
sessions, and maintain his weekly sport schedule — all on a clean slate that starts empty.

**Product source of truth:** `~/MrKuhne/mezo_app/_bmad-output/prd/mezo-prd.md` —
journeys 5.2 (workout), 5.9 (mesocycle planning), 5.10 (sport logging); requirements
FR-2.2.11 (planner; the AI-proposal part stays Phase 3+, the local generator suffices now),
FR-2.2.12 (provenance — already shipped in Slice B), FR-2.2.15 (sport logging + recurring
schedule). FR-2.2.13/14 (volume recompute/override) are Phase 4 — **out of scope**.

## Decisions (locked at brainstorm)

1. **Order: clean slate first.** T0 removes the demo-data confusion before any write lands,
   so every new flow is immediately verifiable on an empty app (empty → create → appears).
2. **Demo layers split.** Backend Train seed moves from `demodata` to a new opt-in
   `demofixtures` profile (`demodata` keeps the owner only). FE mock mode
   (`VITE_USE_MOCK=true`) stays for parity + offline dev, but real mode loses every static
   fallback. The frontend `.env` default flips to `VITE_USE_MOCK=false` — reality is the
   default, mock is opt-in.
3. **Write scope:** core flows + meso post-edit (MesoExercises persistence) + set extras
   (L/B/R side, text note) + a real start-date picker in the wizard.
4. **RP feedback is persisted now** (new `exercise_feedback` table) — the data feeds the
   Phase 3 AI volume engine; what isn't collected now is lost forever.
5. **Empty states: ghost style (option C)** — faint skeleton of the future layout + CTA
   ("Itt fog élni a mai edzésed" + „+ Tervezz mesociklust").
6. **Sport weekly schedule becomes real** (`sport_schedule_slot` table + editor) — PRD
   FR-2.2.15 marks it Phase 2–3.
7. **Workout instance model: same table.** Template days stay date-less rows in
   `workout_session`; starting a workout creates a new row (date=today, status=active,
   `template_session_id` → template). The existing `date`/`status` columns serve exactly this.
8. **Single active meso invariant:** activating a meso archives the previously active one
   (explicit, logged action endpoint — not a plain status PATCH).

## Slices

| Slice | Contents | Size |
|---|---|---|
| **T0 · Tiszta lap** | `demofixtures` profile split; real-mode static fallbacks removed (`activeMeso ?? static` deleted); ghost empty states (TrainToday, GymView, sport log, weekly plan); null-guards everywhere; `.env` default → real mode | S |
| **T1 · Meso-írás** | Wizard → real create (planned/active), real date picker, activate/close (Builder buttons), day-exercise post-editing | L |
| **T2 · Edzés-végrehajtás** | `GET /today` (template day + exercises + last-week refs + open instance), start instance, set logging (+L/B/R, note), RP feedback persist, finish | L |
| **T3 · Sport** | SportLogSheet → real save; `sport_schedule_slot` table + weekly-plan editor; weekly view from DB | M |

Each slice: own bd issue, own plan (`writing-plans`), own branch, subagent-driven
implementation with two-stage reviews, gates, `--no-ff` merge — the Slice B working method.

## Data model (one Liquibase changeset per slice, bd-id naming)

**T1/T2 — extend existing tables:**
- `workout_session` **+ `template_session_id uuid`** (nullable, self-FK `ON DELETE SET NULL`).
  Template rows: `date IS NULL`, `template_session_id IS NULL`. Instance rows: `date` set,
  `template_session_id` → template row, day fields copied at start time.
- `exercise_set` **+ `workout_session_id uuid`** (FK → instance row, `ON DELETE CASCADE`):
  a set references the template exercise (`exercise_id`) *and* the concrete occasion.
  "Last week ref" = sets of the previous completed instance of the same template day.
- `exercise_set.voice_note` **renamed to `note`** (new changeset; text note — voice
  recording is Phase 3).
- **New `exercise_feedback`:** `workout_session_id` (instance, FK CASCADE), `exercise_id`
  (FK), **as built (T2):** `pump` smallint 1–4, `joint_pain` smallint 1–3, `workload`
  smallint 1–3 (the shipped FeedbackModal asks pump/joint/„Akarunk még?” — RP workload —
  so the planned `soreness` column became `workload`, and pump carries 4 options),
  house columns, UNIQUE (workout_session_id, exercise_id).

**T3 — new table:**
- `sport_schedule_slot`: `day_of_week` smallint 0–6 CHECK, `time varchar(5)`,
  `duration_min int`, `kind` text CHECK (`training`|`match`), `location` text,
  `intensity_label` text NULL, house columns. `demofixtures` seeds the current BVSC week.

**Seed changes (T0):** `TrainSeedData` moves to `@Profile("demofixtures")`; `demodata`
keeps `OwnerSeedData` only. `TrainSeedDataIT` activates both profiles.

## API contract (contract-first, `api/feature/train/train.yml` grows per slice)

| Endpoint | Slice | Notes |
|---|---|---|
| `POST /api/train/mesocycles` | T1 | Wizard payload: title, goal, startDate, weeks, split, style, phaseCurve, nested days[] + exercises[]; `status` planned\|active → 201 full `MesocycleResponse` |
| `POST /api/train/mesocycles/{id}/activate`, `/close` | T1 | Lifecycle actions; activate archives the previous active meso |
| `PUT /api/train/mesocycles/{id}/days/{dayId}/exercises` | T1 | Full-list replace (matches the local editor UX, idempotent, carries order) |
| `GET /api/train/workouts/today` | T2 | Backend-derived: active meso, today's template day, exercises, last-week set refs, open instance if any. One round trip; joins are cheap server-side |
| `POST /api/train/workouts` | T2 | Start: `{templateSessionId}` → creates instance |
| `POST /api/train/workouts/{id}/sets` | T2 | `{exerciseId, setIndex, weightKg, reps, rir, side?, note?}` |
| `POST /api/train/workouts/{id}/feedback` | T2 | Per-exercise `{exerciseId, soreness, pump, jointPain}` list |
| `POST /api/train/workouts/{id}/finish` | T2 | → completed; response carries the summary for the complete screen |
| `POST /api/train/sport-sessions` | T3 | SportLogSheet fields; date/time default now |
| `GET /api/train/sport-schedule`, `PUT /api/train/sport-schedule` | T3 | Read + full-replace of the weekly slots |

Validation errors follow the house `SystemMessage` contract; ownership is server-side
(`created_by` from the principal) on every new row, including instance/set/feedback chains
(child writes verify the parent belongs to the caller).

## Frontend

- **Hook pattern (Slice A precedent):** `useTrain` grows *additively* with mutations:
  `createMesocycle`, `activateMesocycle`, `closeMesocycle`, `saveDayExercises`,
  `startWorkout`, `logSet`, `saveWorkoutFeedback`, `finishWorkout`, `logSportSession`,
  `saveSportSchedule`. Existing keys unchanged. TanStack `useMutation` + cache
  invalidation; mock mode keeps local no-op behaviour. The Train hook code moves to
  `data/trainHooks.ts`; `hooks.ts` re-exports (import paths unchanged).
- **Component wiring** (the Phase 1 "no component edits" freeze is explicitly lifted by
  this program): wizard terminal buttons → real create; Builder "Aktiválás"/"Meso
  lezárása" → lifecycle actions; ActiveWorkoutScreen reads `/today`, `completeSet` →
  `logSet`, feedback modal → persist, exit/last exercise → `finish`; SportLogSheet
  "Mentés" → `logSportSession`; L/B/R side buttons go live.
- **Static parts in real mode:** `workout` comes from `/today` (ghost until T2);
  the gym weekly row derives from the active meso days; sport weekly plan from the DB
  (ghost until T3). `exerciseLibrary` stays a static **catalog** (content, not user data).
- **Empty states** in the chosen ghost style: TrainToday (no active meso → ghost hero +
  CTA to the wizard), GymView, sport log list, weekly plan.

## Business rules

- One `active` mesocycle at a time; `activate` archives the previous active one.
- Statuses stay within the existing DB CHECKs (`active|planned|archived` for meso;
  `planned|active|completed|skipped` for workout_session).
- An open (status=active) instance is resumed, not duplicated, when "start" fires again.
- Soft delete everywhere (`@SQLDelete`); no physical deletes in normal paths.

## Testing & gates (per slice)

- Backend ITs in the existing framework (populator growth; dedicated ITs for the
  activate-archives rule and the last-week derivation); contract ITs for every endpoint
  (401, happy path, validation `SystemMessage`s).
- FE hook tests with MSW in both modes; **parity 45/45 stays untouched** (mock fixtures
  remain — that's the visual safety net); new mock-mode tests for the T0 empty states.
- Every slice ends with a live browser smoke (post-CORS lesson: empty → create → appears,
  through the real UI).

## Out of scope (explicitly)

- Voice recording / QuickInputSheet AI modality detection (Phase 3; the FAB stays inert).
- Drag-and-drop exercise reordering (visual handle stays; order persists implicitly via
  the full-list replace).
- AI meso proposal, niggle-aware adjustments, volume recompute/override (FR-2.2.13/14,
  Phase 3–4).
- Gym recurring schedule template (FR-2.1.12 `GymSchedule`, Phase 3–4) — the gym weekly
  view keeps deriving from the active meso.
- Multi-user concerns beyond the existing single-owner model.
