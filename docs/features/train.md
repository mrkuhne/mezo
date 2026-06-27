---
title: Train
type: feature-domain
status: done
updated: 2026-06-27
tags: [train, running, sport, frontend, backend, data-layer]
key_files:
  - frontend/src/features/train
  - frontend/src/data/trainHooks.ts
  - frontend/src/data/runningHooks.ts
  - frontend/src/data/runningDraft.ts
  - frontend/src/lib/runningApi.ts
  - api/feature/train/train.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/train
related: [_platform-data-layer, _platform-design-system, today, fuel]
---

# Train — Feature Documentation

> The six-tab strength + conditioning area (plan, execute, log, analyze). **Status: ✅ done (FE mock + FE real + Spring Boot backend)** — the only gaps are clearly-flagged Phase-3 AI/analysis features. Lives under the **`Edzés`/Train** tab at route `/train` (sub-nav defined in `frontend/src/features/train/tabs.ts`).

---

## 1. Summary

Train is the largest mezo domain: a six-tab area for planning and executing strength work and conditioning. It covers periodized **mesocycles** (`Mesociklus`), the active week's **gym split**, full-screen **workout execution** with per-set logging, an **exercise catalog + per-exercise records** explorer, **volleyball** (`Röplabda`) scheduling/logging, and structured **interval running** (`Futás`) plans. A `Mai` tab aggregates all three rhythms (gym + volleyball + running) onto one weekly agenda.

**Status per layer — all ✅ done:**

- **FE mock** (Phase 1): synchronous static fixtures, every tab renders without a backend.
- **FE real** (Phase 2): each read/write swapped to `/api/train/*` behind the same hooks; no signature change.
- **Backend** (Phase 2): full `feature/train/**` Spring Boot slice over Postgres — mesocycles, workout execution, sport, exercise catalog/records, running.

**Phase-3-planned (🟣, flagged throughout, do NOT assume live):** AI workout `challenges` + `niggleWarning`, PR detection (the current toast is a scripted demo), the live cross-load → volume recompute engine (both Sport and Running cross-load are static), `volumePerMuscle`/`volumeRecompute` provenance (seed-only), `shoulderLoadTrend`, sport `jumpCount`/`intensity`/`team`/`season` capture, gym-schedule **`duration`** (the gym-time **schedule is now live** — see §4 `GymScheduleSlot`; only per-day duration stays out of scope), copy-week, and the active-workout 90s timer + Voice chips.

**Driving design docs (read before changing this area):**
- `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` — Phase-2 slice map.
- `docs/superpowers/specs/2026-06-11-train-write-clean-slate-design.md` — the "T0 clean slate" write/ghost rule.
- `docs/superpowers/specs/2026-06-12-exercise-catalog-design.md`, `docs/superpowers/specs/2026-06-12-exercise-records-design.md`.
- `docs/superpowers/specs/2026-06-14-train-running-slice-design.md` — the `Futás` slice.

---

## 2. User-facing behavior

The sub-nav (`TrainSubNav`, `frontend/src/features/train/tabs.ts`) has six tabs: **`Mai`** (`/train`), **`GYM`** (`/train/gym`), **`Sport`** (`/train/sport`), **`Futás`** (`/train/futas`), **`Gyakorlatok`** (`/train/exercises`), **`Mesociklusok`** (`/train/mesocycles`). Three full-screen sibling routes have no sub-nav: active workout (`/train/session`), mesocycle planner/builder (`/train/mesocycles/new`, `/train/mesocycles/:id`), and the running-block builder (`/train/futas/:id`).

### `Mai` — the weekly cross-domain agenda (`views/TrainTodayView.tsx`)
Where gym, volleyball, and running converge. Both **today's hero cards** and the **weekly timeline rows** (`WeeklyDayRow`) are now ordered **by time-of-day** rather than by a fixed gym→volleyball→running modality order — a morning run renders above an evening gym; untimed sessions sort last. Both surfaces order through the same pure helper `daySessions(day)` (`features/train/agenda.ts`), which flattens a day's `{gym, volleyball, running[]}` into typed `AgendaItem`s carrying `timeOfDay` and sorts ascending (null/`''` → `'99:99'` last, then stable by modality). Gym time comes from the standalone gym schedule (§4 `GymScheduleSlot`); running time from each session's `timeOfDay` (now shown next to the weekday in the weekly rows). You can log a volleyball or running session inline via the shared `SportLogSheet`/`RunLogSheet`. **Once a session is logged, its hero and weekly row flip to a `done` state** — the `MA` chip becomes a `✓ Kész` (success-coloured) chip and the log CTA is replaced by a muted summary of the logged effort (volleyball: `Logolva · RPE · perc · váll`; running: `Logolva · RPE · kör`; **gym**: a `✓ Kész` chip + a muted `Mai edzés logolva` pill, no start CTA). **All three modalities now flip — including gym** — and **past days this week are marked too**, not only today: in the weekly rows a gym day shows `kész` when its ISO date is in `weekDoneDates` (server-computed, §4), a volleyball day when a session is logged on that date, a running day when its prescribed session is logged. Tapping a volleyball/run *today* summary re-opens the sheet (an in-place edit needs a backend `PUT` — `mezo-0p3` follow-up); the gym done-state is non-interactive (no in-place edit sheet yet). Ghosts entirely when there is no active mesocycle ("+ Tervezz mesociklust"). Run-only-today (a running session today with no gym/volleyball) renders its hero via a synthetic agenda day; a true rest day shows the "Ma pihenőnap" card.

### `Mesociklusok` — plan library (`views/MesocycleLibraryView.tsx`)
`Aktív` hero + `Tervezett` section (with a dashed "+ Új mesociklus tervezése" CTA) + `Archív`. Header chip "+ Új" opens the planner. Cards open the builder.
- **Planner** (`MesocyclePlanner.tsx`, `/train/mesocycles/new`) — a 4-step wizard: `Cél` (goal preset) → `Hossz + fázisok` (name/start/weeks + `MEV/MAV/MRV/Deload` phase-curve editor) → `Split + napok` (split + days/week + weekday picker) → `Áttekintés` (generated program review, per-day exercise add/remove). Save as `planned` or `active`.
- **Builder** (`MesocycleBuilder.tsx`, `/train/mesocycles/:id`) — three sub-views: `Áttekintés`, `Volumen` (provenance), `Gyakorlatok` (weekly exercise editor). Lifecycle buttons: planned → `Aktiválás`, active → `Meso lezárása`. "Heti terv másolása" is inert (deferred).

### `GYM` — the active week (`views/GymView.tsx`)
Week-by-week view of the **active** meso: meta stats (`Fázis`, `Split`, `Szetek`, `Gym napok`), `PhaseDots`, day-by-day `GymDayCard`s. Tapping a day opens `GymDaySheet`; "Indítsuk · most" appears only on today's day and launches the workout. A header **"Időpontok"** chip opens `GymScheduleSheet` (the weekly gym-time editor, §4 `GymScheduleSlot`); it is **mock-gated** — hidden in mock mode where `saveGymSchedule` no-ops, mirroring `SportView`'s schedule-edit gating (`GymView.tsx:70-79`). Ghosts when no active meso.

### Active workout (`ActiveWorkoutScreen.tsx`, `/train/session`)
Full-screen takeover, three phases: **`prep`** (niggle pre-flag, AI challenges carousel, warmup, exercise list, "Kezdjük el") → **`active`** (per-set weight/reps/RIR logging, "Múlt hét" comparison, set dots, set history, PR toast, RP feedback debrief) → **`complete`** (`WorkoutComplete` recap). A mid-workout hard reload **resumes** straight back into `active`. Weight/reps use `CompactStepper`: 44px ± buttons **and** a tap-to-edit center value — typing the number straight in (HU decimal comma accepted) commits + clamps to the contract bounds (weight 0–999, reps 1–100) on blur, so reaching e.g. 100 kg needs no tap-spam; exact non-2.5 values are honored (`weightKg` has no `multipleOf`). The same `useEditableNumber` hook backs `NumberStep` in the sport/run log sheets. The active-phase session state — logged sets, the cursor, and per-exercise set counts — lives in a pure, **exerciseId-keyed** model (`workoutState.ts`: `Session{order,setIdx,logged,extra,skipped,planned}` + `makeSession`/`currentExerciseId`/`effectiveSetCount`/`completeSet`/`advance`/`addExtraSet`/`skipExercise`/`seedFromOpen`), so the screen is a thin view over it (resume rebuilds the model from the open instance via `seedFromOpen`). This non-linear, id-keyed cursor is the foundation for the in-session reorder / add-set / skip / note features. The active-phase header carries a **`⋯` "Gyakorlat műveletek"** button that opens `ExerciseActionSheet` (`components/ExerciseActionSheet.tsx`) — a four-row menu (↕ Áthelyezés · ⊘ Kihagyás · ＋ Szett · ✎ Jegyzet) built on the shared `Sheet`. **Áthelyezés (reorder)** switches to a sub-view hosting the shared `SortableList` over the **remaining (future) exercises only** — the done + current exercises (`session.order.slice(0, ci+1)`) stay fixed, and the reorder is **client-only / ephemeral** (it just replaces `session.order` via a functional `setSession` updater, no persistence). Because `currentExerciseId` derives "next" from `order` rather than an array index, reordering the tail directly changes which exercise comes up after the current one. **＋ Szett (add-set, F2)** is wired via `onAddSet`: it bumps `session.extra[id]` (`addExtraSet`), growing `effectiveSetCount` (planned + extra) so the header set count and the set dots gain one more — the extra dots (index `≥ session.planned[id]`) render via the `.set-dot.extra` class (a dashed `var(--brand-glow)` border). The added set logs through the **existing `logSet` path** like any planned set (the persisted `setIndex` is just the next index — **no new data hook**). After the add, a small **`sheet-nested` prompt** offers **"Csak ma"** (session-only, the default) vs **"Minden hétre"**: the latter calls `writeExtraSetToTemplate`, which finds the meso day whose exercise list contains the current exercise (by id — the `/today` exercise id IS the template-day exercise row id), bumps that exercise's `sets` by 1, and persists the full day list via the existing **`saveDayExercises` PUT** so future weeks inherit the higher count. **Only add-set offers a template write — reorder and skip never touch the plan.** (Mock mode shows the prompt but the write no-ops, like every other mock write; if no meso day contains the exercise, the write is a safe no-op.) **⊘ Kihagyás (skip, F3)** is wired via `onSkip` → `handleSkip`: it marks the current exercise skipped in the model (`skipExercise` → `session.skipped`) and advances to the next non-skipped exercise **without an RP debrief** (or finishes the workout when nothing remains — mirroring `advanceAfterFeedback`'s all-done branch); real mode persists via `useTrain.skipExercise` (`POST .../{id}/skip`, idempotent), mock no-ops. Per spec, **already-logged sets on a skipped exercise stay** (skip only abandons the remainder): the recap (`WorkoutComplete`, `skippedExerciseIds` prop) marks a skipped exercise **"kihagyva"** — struck when nothing was logged, or the real `n/m szet` count + a muted `· kihagyva` tag when some sets were done — and a mid-workout reload restores skipped state because `seedFromOpen` routes `skipped` markers to `session.skipped` (not `logged`). **✎ Jegyzet (note, F4)** is wired via `onEditNote`: each exercise carries a durable per-exercise **note** (`TodayExercise.note`, surfaced through `toWorkoutPlan` onto `LoggedWorkoutExercise.note`). An always-visible **note pill** (`aria-label="Gyakorlat-jegyzet"`) renders under the exercise name whenever the effective note is non-empty (`effectiveNote = localNotes[current.id] ?? current.note ?? ''`); `⋯` → "Jegyzet" opens a `sheet-nested` editor (a 500-char `<textarea>` prefilled with the current note) whose "Mentés" calls `useTrain.saveExerciseNote` (`PUT /api/train/exercises/{exerciseId}/note`, real persists + invalidates `workoutToday`; mock no-ops) and writes a **local override** (`localNotes`, keyed by exercise id) so the pill updates instantly in both modes. Saving an **empty** note clears it (the pill hides and `hasNote` flips the row label back to "Jegyzet"). The note is **durable on the exercise template** (not the instance), so it pre-loads on the next session. The `⋯` button is itself **disabled while a debrief (`FeedbackModal`) is open**, so the sheet always operates on the unambiguous current exercise (during a debrief the on-screen exercise is the just-finished one, while `currentExerciseId` has already advanced).

### `Gyakorlatok` — catalog + records (`views/ExercisesView.tsx`)
Default state "Top gyakorlatok · rekordjaid" ranked by `sessionCount`. Searching or muscle-filtering shows the full catalog: record rows first (with `e1RM`/best-set/total-reps), then dashed ghost rows (STIM meter) for catalog items with no history. Tapping a record opens `ExerciseRecordSheet`.

### `Sport` — volleyball (`views/SportView.tsx`)
Hero with week stats (Sessions/Idő/RPE/Váll) and a 3-button switcher: **`Heti terv`** (7-day recurring schedule, editable in real mode via `SportScheduleSheet`), **`Napló`** (logged sessions), **`Cross-load`** (impact rows). Header chip "+ Log" opens `SportLogSheet`. The switcher's selected segment is **sticky** (`useStickyTab('train.sport.view')`), so leaving and returning restores it rather than snapping to `Heti terv`.

### `Futás` — running (`views/RunningView.tsx`)
3-segment switcher: **`E heti edzés`** (active block hero with `RunWeekStrip` + prescribed `RunSessionCard`s — each now shows its `timeOfDay` next to the weekday — + `RunCrossLoadCard`), **`Napló`** (logged runs newest-first), **`Tervek`** (Aktív/Tervezett/Archív library; "+ Új terv" → builder). The switcher's selected segment is **sticky** (`useStickyTab('train.futas.view')`), so creating a plan from `Tervek` and pressing the builder's breadcrumb `← Futás` returns to `Tervek`, not the default `E heti edzés` (mezo-0h9). The **builder** (`RunningBlockBuilder.tsx`, `/train/futas/:id`) edits title/goal, a **1–8 week** add/remove row (`RunningBlockBuilder.tsx:153-177`), and the selected week via `RunWeekEditor`. Editing is **auto-saved** — no Save button; a debounced write (`:65-69`) persists ~600 ms after the last keystroke and flushes on back, with a `Mentés…`/`✓ Mentve`/`Nem mentve` status pill (`:126-128`). Lifecycle collapses to a **single status-dependent CTA** (planned→`Aktiválás`, active→`Lezárás`) plus a `⋯` **overflow menu** (`OverflowMenu`, `:206`) carrying `Duplikálás`/`Törlés`. Each `RunWeekEditor` session is a **two-zone card** (`RunWeekEditor.tsx:59-92`): **Menetrend** (`WeekdayGrid` single-select weekday + a `type="time"` time-of-day input — both plan-level) over **Terhelés** (week-level load: sprint rounds+rest steppers / pyramid work-second pills). The old hardcoded "Kedd · Sprint" / "Péntek · Piramis" labels are gone — weekday + time are user-editable.

---

## 3. Architecture & data flow

The whole area flows through **two hooks**, both re-exported from the single data boundary `frontend/src/data/hooks.ts:202-203`:

```
View (features/train/**)
  → useTrain()      (data/trainHooks.ts)   |   useRunning()  (data/runningHooks.ts)
    → isMockMode()  (@/lib/mode → VITE_USE_MOCK !== 'false')
       ├─ MOCK: TanStack Query initialData = static fixtures (data/train.ts, data/running.ts)
       │        writes no-op (useTrain) OR emulate the server via queryClient.setQueryData (useRunning)
       └─ REAL: api client (lib/trainApi.ts, lib/runningApi.ts) over apiFetch → /api/train/*
            → TrainController.java (implements generated TrainApi)
              → {Train,Workout,Sport,ExerciseCatalog,ExerciseRecord,Running}Service
                → repositories → Postgres
```

**Invariants of the seam:**
- **Mock mode is synchronous** (`initialData` set) so the first render equals the Phase-1 static return — preserved for parity and component tests. **Real mode has NO static fallback**: an empty backend surfaces as `null`/`[]` and every view ghost-guards (the "T0 clean slate" rule, `2026-06-11-train-write-clean-slate-design.md`). The full rationale is in the comment block at `frontend/src/data/trainHooks.ts:166-173`.
- **Mode is read inside hook bodies, never at module scope** (`frontend/src/lib/mode.ts`), so tests stub per-case with `vi.stubEnv`.
- Default mode is **mock** (`VITE_USE_MOCK !== 'false'`), but per `CLAUDE.md` the project runs FE in REAL mode by default in dev/test.
- Contract types are generated: `api/feature/train/train.yml` → merged `api/openapi.yml` → FE `frontend/src/lib/api.gen.ts` (re-exported as named types in `trainApi.ts`/`runningApi.ts`) and BE `io.mrkuhne.mezo.api.dto.*` + the `TrainApi` interface that `TrainController` implements.

**Real-mode mapping notes** (`trainHooks.ts`): `toWorkoutPlan` (`:47-62`) collapses the API response to the Phase-1 `WorkoutPlan` shape and sets `challenges: []` (AI is Phase 3); `deriveGymSchedule(meso, slots)` (`:67-83`) builds the gym week by joining the active meso's template days (WHAT) with the standalone weekly gym slots (WHEN) — `DAY_ORDER` index `==` `slot.dayOfWeek`, a gym day with no matching slot keeps `time: null`; `duration` stays `null` (no DB home, out of scope). The active-meso real fallback is `realActiveMeso ?? (mock ? activeMeso : null)` (`:393`).

---

## 4. Data model & API

All tables: UUID PKs (`gen_random_uuid()`), `created_by` ownership via `OwnedEntity`, soft delete via `@SQLDelete`/`@SQLRestriction`. Migrations live under `backend/src/main/resources/db/changelog/1.0.0/script/`. Generated DTOs live in `io.mrkuhne.mezo.api.dto.*`; never hand-write boundary DTOs. The API fragment is `api/feature/train/train.yml`.

### Mesocycles (planning)
- **Tables** (`202606111400_mezo-n5q_create_train.sql`; `mezo-7ot` adds `exercise.catalog_id` + plyo): `mesocycle`, `muscle_group_volume_log` (UNIQUE `(mesocycle_id, muscle)`, jsonb `source` = `ProvenanceEnvelope`), `workout_session` (template rows = `template_session_id IS NULL`), `exercise` (FK→session CASCADE, `catalog_id` FK→`exercise_catalog` SET NULL).
- **Entities:** `MesocycleEntity` (`phase_curve text[]` mapped as `List<String>` for Hibernate dirty-checking; `volume_recompute` jsonb = `VolumeRecomputeJson`), `MuscleGroupVolumeLogEntity` (first typed-jsonb persistence, `ProvenanceEnvelope`), `WorkoutSessionEntity`, `ExerciseEntity`.
- **Endpoints:** `GET /api/train/mesocycles` (batch-loads volume + days, stitches), `POST /api/train/mesocycles` (wizard create; server computes `endDate`, `currentWeek`, `orderIndex`; create-as-active archives others), `POST .../{id}/activate`, `POST .../{id}/close`, `PUT .../{id}/days/{dayId}/exercises` (soft-delete + re-insert; unknown `catalogId` → 400, not FK 500).
- **DTOs:** `MesocycleResponse`, `MesocycleCreateRequest`, `MesoDay`/`MesoDayInput`, `GymExercise`/`GymExerciseInput`, `VolumeProfile`/`VolumeSource`/`VolumeBaseline`/`VolumeAdjustment`/`VolumeRecompute`/`VolumeChange`/`VolumeUserOverride`.
- 🟣 `volumePerMuscle` + `volumeRecompute` are **only in mock fixtures** (`data/train.ts`) and the `demofixtures` seed (`TrainSeedData`). No real write path produces them — `MesoVolume` ghost-guards. The provenance envelope round-trips through the DB (proven by `ProvenanceRoundTripIT`) but is seed-only.

### Workout execution
- **Tables** (`202606120900_mezo-tod_t2_workout_execution.sql`): adds `workout_session.template_session_id` (self-FK SET NULL), `exercise_set.workout_session_id` (FK→instance CASCADE), renames `voice_note`→`note`, creates `exercise_feedback` (UNIQUE `(workout_session_id, exercise_id)`; CHECKs pump 1-4 / joint_pain 1-3 / workload 1-3). `202606171200_mezo-an1_exercise_set_skipped.sql` adds `exercise_set.skipped` (F3 whole-exercise skip marker). `202606171210_mezo-an1_exercise_note.sql` adds `exercise.note` (F4 durable per-exercise note).
- **Entities:** `ExerciseSetEntity` (`weight_kg NUMERIC(6,2)`, `side` CHECK L|B|R, `done_at`, `skipped`), `ExerciseEntity` (the template exercise — carries the durable `note`), `ExerciseFeedbackEntity`.
- **Endpoints:** `GET /api/train/workouts/today` (template + open instance for resume), `POST /api/train/workouts` (resumes the open instance, never duplicates), `POST .../{id}/sets`, `POST .../{id}/skip` (F3 — records a skip-marker set for a whole exercise), `POST .../{id}/feedback` (upsert per exercise), `POST .../{id}/finish`, `PUT /api/train/exercises/{exerciseId}/note` (F4 — owner-scoped durable note write, ≤500 chars). **`.../{id}/finish` now returns an optional `levelUp`** (the gamified-progression payload): `WorkoutService.finishWorkout` computes + attaches it inside its `@Transactional`, but **only when the `mezo.feature.progression.enabled` switch is on** (gated by the `ProgressionGate` `@ConditionalOnProperty` bean, injected via `ObjectProvider`). Start/resume responses never carry it — the shared `toInstanceResponse` is untouched. See the progression backend doc (`_platform-api-backend.md` §4e); the FE LevelUpScreen is P5.
- **DTOs:** `WorkoutTodayResponse`, `TodayExercise`, `LastWeekRef`, `WorkoutStartRequest`, `WorkoutInstanceResponse`, `ExerciseSetResponse`, `SetLogRequest`, `WorkoutSkipRequest`, `WorkoutFeedbackInput`, `ExerciseNoteRequest` (`note` ≤500, nullable to clear). `TodayExercise.note` surfaces the durable note on read; `saveExerciseNote` is owner-scoped (foreign/missing exercise → **404**, over-length note → **400**). `logSet` validation: setIndex 0-49, weightKg 0-999, reps 1-100, rir 0-5, side `^[LBR]$`, note ≤500. `logSet`/`skipExercise` on a completed instance → **409** (`TRAIN_WORKOUT_NOT_ACTIVE`); a foreign exercise → **404**. `skipExercise` persists an `ExerciseSetEntity` with `skipped=true`, the next free `setIndex` for that exercise, and null performance fields — a skip marker is **not** a logged set, so it never flips the gym done-state (`findDoneInstanceDates` requires `skipped = false`).
- "Last week" comparison: `WorkoutService.lastWeekRefs` picks the top set of the most-recent completed instance of the same template day, per exercise.

### Exercise catalog + records
- `exercise_catalog` (`202606121400_mezo-7ot_*`) is **master content, not user data** — no `created_by`, no soft delete. Loaded by `ExerciseCatalogLoader` (`@Order(50)`, **every profile incl. prod**) upserting by `slug` from `backend/src/main/resources/content/exercise-catalog.json`; an invalid muscle/type token fails startup fast.
- **Endpoints:** `GET /api/train/exercises` (catalog, `staleTime 1h` on FE), `GET /api/train/exercise-records` (computed on the fly — no materialized table).
- `ExerciseRecordService.list` resolves an exercise identity by `exercise.catalog_id` else name over **ALL rows incl. soft-deleted** (`ExerciseRepository.findIdentityRowsIncludingDeleted` native SQL — day-edits soft-delete template rows but must not erase history), computing `bestSet`, `bestE1rm` (Epley `w×(30+reps)/30`), `bestSessionVolume`, totals, `sessionCount`, `repRecords`, `recentTopSets`.
- **DTOs:** `ExerciseCatalogItem` (adds `slug` vs the FE `ExerciseLibraryItem`), `ExerciseRecordResponse`, `RecordSetRef`, `E1rmRecord`, `SessionVolumeRecord`.

### Sport / volleyball · cross · TRX
- **Tables:** `sport_session` — a **3-kind modality** since `mezo-lmox` (`202606271000_mezo-lmox_generalize_sport_session.sql`): the existing `sport` column is the typed discriminator (`ck_sport_session_sport` CHECK `volleyball|cross|trx`) and a `rounds` INT effort column was added for cross/TRX; the original table (`202606111400_mezo-n5q_create_train.sql`) carries intensity/shoulder_strain CHECK 1-10 + `jump_count`. `sport_schedule_slot` (added in `202606121000_mezo-0ae_t3_sport_schedule.sql`; `day_of_week` SMALLINT 0=Hét..6=Vas CHECK, `kind` training|match CHECK).
- **Endpoints:** `GET/POST /api/train/sport-sessions`, `GET/PUT /api/train/sport-schedule` (`replaceSchedule` = full soft-delete + re-insert).
- **DTOs:** `SportSessionResponse` (now `+ rounds?`, `+ levelUp?`; `setsPlayed`/`shoulderStrain` are volleyball-only → optional), `SportSessionCreateRequest {sport? (pattern volleyball|cross|trx), duration, rpe, setsPlayed?, shoulderStrain?, rounds?, notes?}` — only `duration`+`rpe` are required; `sport` defaults to `"volleyball"` server-side. Schedule slot DTOs unchanged. Server defaults session date/time to **now** (the sheet has no date picker).
- **Progression (`mezo-lmox`):** **`POST /api/train/sport-sessions` now returns an optional `levelUp`** (mirrors the gym finish + run log): `SportService.logSportSession` runs `SportSignalCalculator.compute` → `ProgressionService.applySport` → `LevelUpResultMapper.toDto` inside its `@Transactional`, **only when `mezo.feature.progression.enabled` is on** (the shared `ProgressionGate` bean, injected via `ObjectProvider`); idempotent on the saved session id; the GET list never carries it. Per-kind athletic XP (volleyball→vertical_jump/agility/coordination/explosiveness/aerobic_capacity from `setsPlayed`+rpe+min; cross→anaerobic_capacity/strength_endurance/explosiveness/core_stability from `rounds`+rpe; trx→core_stability/strength_endurance/anaerobic_capacity/mobility from `rounds`+rpe+min) is config-driven (`mezo.progression.sport`). See the progression backend doc (`_platform-api-backend.md` §4e); the FE LevelUpScreen is P5.
- 🟣 `jumpCount` exists in the DB/DTO but the log sheet never captures it (volleyball scores off `setsPlayed`, not jumpCount); `intensity` is never written by the log path; `team`/`season`/`weeklyHours` have no DB home. **The cross/TRX log-sheet UI is deferred to P5** — P3b generalized the backend/contract, but `SportLogSheet` still captures the volleyball shape, so cross/TRX rows arrive only via the API / demofixtures.

### Gym schedule (`GymScheduleSlot` — weekday → time)
A **standalone** owner-scoped weekly schedule answering only *when* the user trains on each weekday; it **persists across mesocycles** (the active meso supplies *what*, this supplies *when*). Mirrors `sport_schedule_slot`, minus the volleyball-specific columns. This is the Option-Y choice (standalone schedule, not time-on-the-meso-day) — see the X-vs-Y decision in `docs/superpowers/specs/2026-06-15-gym-schedule-times-design.md`.
- **Table:** `gym_schedule_slot` (`202606151500_mezo-auk_create_gym_schedule_slot.sql`) — `day_of_week` SMALLINT (0=Hét..6=Vas, `ck_gym_schedule_slot_day_of_week` CHECK 0–6), `time` VARCHAR(5), plus the `OwnedEntity` columns; `idx_gym_schedule_slot_created_by_day_of_week`. Lean by design: **no** duration/kind/location.
- **Entity / repository:** `GymScheduleSlotEntity extends OwnedEntity` (`dayOfWeek`, `time`); `GymScheduleSlotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc`.
- **Service:** `GymScheduleService` — `getSchedule` + a **replace-all** `replaceSchedule` (soft-delete the owner's current week via `@SQLDelete`, then re-insert; method-level `@Transactional` on the write only), exactly mirroring `SportService`'s schedule methods. Ownership stamped server-side, never from the client.
- **Endpoints:** `GET/PUT /api/train/gym-schedule` (`TrainController.getGymSchedule`/`putGymSchedule` delegate to `GymScheduleService`); PUT body is the full slot list and returns the new list.
- **DTOs / mapper:** `GymScheduleSlotResponse {id, dayOfWeek 0–6, time '^\d{2}:\d{2}$'}`, `GymScheduleSlotInput {dayOfWeek, time}` (`api/feature/train/train.yml`); `TrainMapper.toGymSlotResponse` (entity→DTO). The FE joins these onto the active meso's gym days via `deriveGymSchedule` (§3).

### Running (`Futás`)
- **Tables** (`202606141200`/`202606141210_mezo-b4n_*`): `running_block` (status planned|active|archived CHECK, kind interval CHECK, `structure jsonb`), `run_session_log` (FK→block CASCADE, `rpe_actual` CHECK 1-10).
- **The plan is typed jsonb:** `RunningBlockStructure` (`entity/RunningBlockStructure.java`) = `weeks[ {weekNumber, phaseLabel, sessions[ {key, dayOfWeek 0=Hét..6=Vas, timeOfDay "HH:mm" (nullable), label, kind sprint|pyramid|steady, rpeTarget{min,max}, rounds?, segments[ {type warmup|work|rest|cooldown, durationSec, label} ]} ]} ]`, persisted via `@JdbcTypeCode(SqlTypes.JSON)`; `RunningMapper` round-trips it field-for-field to `RunningBlockStructureDto`.
- **`timeOfDay` rides the `structure` jsonb — NO Liquibase migration.** It's a nullable `HH:mm` field added to `RunPrescribedSession` (`RunningBlockStructure.java:17`, OpenAPI `train.yml` `RunPrescribedSession.timeOfDay` `pattern ^\d{2}:\d{2}$`); MapStruct + Hibernate `@JdbcTypeCode(JSON)` round-trip it with no DDL change. The pre-existing `dayOfWeek` is now **user-editable** in the builder (`WeekdayGrid`). Both are **plan-level**: the FE `setSessionDay`/`setSessionTime` editors (`runningDraft.ts:59-64`) apply one edit to the same-`key` session in **every** week, since weekday/time are constant across weeks.
- **Endpoints:** `GET/POST /api/train/running-blocks`, `PUT/DELETE /api/train/running-blocks/{id}`, `POST .../{id}/activate`, `POST .../{id}/close`, `GET/POST /api/train/run-sessions`. `RunningService` enforces single-active on activate; `deleteBlock` is soft delete. **`POST /api/train/run-sessions` now returns an optional `levelUp`** (the gamified-progression payload, just like the gym `.../{id}/finish`): `RunningService.logSession` computes + attaches it inside its `@Transactional`, but **only when the `mezo.feature.progression.enabled` switch is on** (the same `ProgressionGate` `@ConditionalOnProperty` bean, injected via `ObjectProvider`). When on, it runs `RunSignalCalculator.compute` → `ProgressionService.applyRun` → `LevelUpResultMapper.toDto`, idempotent on the saved log id; the GET list path never carries it. See the progression backend doc (`_platform-api-backend.md` §4e); the FE LevelUpScreen is P5.
- **`currentWeek` is server-derived, not client-owned (mezo-478).** `applyUpsert` sets it to `clampWeek(startDate, weeks)` — the 1-based week containing today, clamped to `[1, weeks]` (week 1 before the start) — ignoring the request's `currentWeek` (mirrors `TrainService` for mesocycles). Reads additionally **heal** a stale/invalid stored value (null, `<1`, or `>weeks`) via `RunningService.toResponse`, so a block written before this (e.g. the legacy `currentWeek 0` that rendered "az aktuális hét (0) nincs a tervben" for a plan starting today) self-corrects on the next fetch. Weeks are 1-indexed; the `RunWeekView` `weeks.find(w => w.weekNumber === currentWeek)` therefore always resolves for an in-range plan. Mock mode mirrors the derivation via `currentWeekOf` (`lib/dates.ts`). _Known limitation:_ like mesocycles, the stored value only re-derives on write/activate; the read-time heal only fires for out-of-range values, so a valid block does not auto-advance week-to-week without a write.
- **DTOs:** `RunningBlockResponse`/`RunningBlockUpsertRequest`, `RunningBlockStructureDto`, `RunWeek`, `RunPrescribedSession`, `RunSegment`, `RpeTarget`, `RunSessionLogResponse` (now also carries an optional `levelUp` → `LevelUpResult`, the same schema as the gym finish)/`RunSessionLogRequest`.
- **Seed:** `RunningSeedData` is `@Profile("demofixtures")` (same as `TrainSeedData`, since `mezo-uuv`) — a plain `demodata` (prod) app starts **clean** with no running blocks; the 3 demo blocks (active/planned/archived) require the opt-in `demodata,demofixtures` profile combo.

---

## 5. Integrations

This is the highest-value section: Train both consumes and exposes a number of seams. The contract (the type/shape that crosses) is named at each.

| Seam | Direction | Where | Type crossing |
|---|---|---|---|
| **Single data boundary** | Train ↔ app | `frontend/src/data/hooks.ts:202-203` re-exports `useTrain`, `useRunning` | hook return types `TrainData`, `RunningData` |
| **`Mai` aggregation** | GYM/Sport ↔ Running | `views/TrainTodayView.tsx` composes BOTH hooks | `WeeklyAgendaDay`, `RunPrescribedSession`, `WorkoutPlan`, `SportSchedule` |
| **Sport → all systems (cross-load)** | Sport → Train/Fuel/Sleep/Weight/Insights | `data/train.ts` `sport.crossLoad` + `SYSTEM_LABELS`; rendered by `CrossLoadRow` | `CrossLoadRow {target,impact,why,system,warning}` — 🟣 **mock-only; engine Phase 3** (real mode = `crossLoad: null` → view ghosts) |
| **Running → GYM (cross-load)** | Running → Train leg volume | `components/RunCrossLoadCard.tsx` | static presentational text — 🟣 **Phase-3 engine** |
| **Volume recompute provenance** | Pattern engine → meso volume | `MesoVolume`, `MuscleGroupVolumeLogEntity.source` (`ProvenanceEnvelope`), `VolumeRecomputeJson` | `VolumeSource`/`VolumeAdjustment` — 🟣 **seed-only, Phase-3 engine** |
| **Catalog ↔ planner/editor** | Exercises → meso days | `ExercisePickerSheet` writes `GymExerciseInput.catalogId` | `ExerciseLibraryItem.catalogId` → `exercise.catalog_id` FK |
| **Records ← sets** | Workout execution → Exercises | `ExerciseRecordService` aggregates `exercise_set` (incl. soft-deleted) | `ExerciseSetEntity` → `ExerciseRecordResponse` |
| **Auth / ownership** | Train ↔ techcore | every service takes `UUID createdBy` first; entities extend `OwnedEntity` | `CurrentUserId`, `created_by` |
| **Date formatting** | Train ↔ lib | `huMonthDay`/`huMonthDayDow` (`@/lib/dates`) | ISO date strings → HU display |
| **Error contract** | Train ↔ techcore | `SystemRuntimeErrorException` + `SystemMessage` | `SystemMessageList` (401/404/409 etc.) |
| **Design system** | Train ↔ shared UI | `Sheet`, `GhostState`, ui primitives; tokens in `frontend/src/styles/prototype.css` | category palette `--cat-*`, run accent `--run` (blue), volleyball pink `--cat-tendency` |

**The canonical internal integration** is `TrainTodayView`: it merges `gymSchedule` (from `useTrain`, itself the meso-days × gym-slots join of `deriveGymSchedule`), `sport.schedule` (volleyball), and `runSessionsForDay(activeRunningBlock, dayIdx)` (from `useRunning`, via `data/runningAgenda.ts`) into one `WeeklyAgendaDay[]`, then orders each day by time-of-day through the shared `daySessions` helper (`features/train/agenda.ts`). Logging from here reuses the **shared sheets** `SportLogSheet`/`RunLogSheet`. Note the cross-load seams (Sport→everything, Running→gym volume) are the documented bidirectional contracts but their **live engines are Phase 3** — today they render static rows.

**Inbound seams (one-sided — no live data crosses yet):** Today (`/today`) links here via `WorkoutTeaser` navigation only — it renders its **own** mock `Workout`, not this backend. Fuel keeps a *private copy* of the gym/volleyball schedule (`GymScheduleDay`/`VolleyballSession` in `data/fuelWeek.ts`), **not** sourced from Train — the Fuel (Slice C) backend will later reconcile them. Both are documented from the consuming side in `today.md` §5 / `fuel.md` §5.

---

## 6. How to use it (consume)

Import from the single boundary `@/data/hooks`; never reach into `trainHooks.ts`/`runningHooks.ts` directly.

```tsx
import { useTrain, useRunning } from '@/data/hooks'

function MyWidget() {
  const {
    mesocycles, activeMeso, workout, gymSchedule, gymSlots, sport,
    exerciseLibrary, exerciseRecords, workoutPending, todaySession,
    // imperative writes:
    createMesocycle, activateMesocycle, closeMesocycle, saveDayExercises,
    startWorkout, logSet, saveWorkoutFeedback, finishWorkout,
    logSportSession, saveSportSchedule, saveGymSchedule,
  } = useTrain()

  const {
    runningBlocks, activeRunningBlock, runSessions, runningPending,
    saveRunningBlock, activateRunningBlock, closeRunningBlock,
    deleteRunningBlock, logRunSession,
  } = useRunning()

  // ALWAYS ghost-guard real mode (no static fallback) and check *Pending before redirecting:
  if (workoutPending) return null
  if (!activeMeso) return <GhostState />
  // ...
}
```

- Reads return `null`/`[]` in real mode when the backend is empty — render a ghost, never assume data.
- Writes are imperative callbacks that `mutate` + invalidate the relevant query key; most accept an optional `{ onSuccess }`. In mock mode `useTrain` writes **no-op** while `useRunning` writes **emulate the server** via `queryClient.setQueryData` (so the `Futás` flows are interactive without a backend).
- **Backend consumer:** inject the relevant `*Service`; all methods take `UUID createdBy` first (from `CurrentUserId`). Use generated `api.dto` types only.

---

## 7. How to extend it

Adding a Train endpoint/field/sub-tab is **contract-first + dual-mode + both-test-modes**. The obligations are non-negotiable.

**Add or change an endpoint/field:**
1. Edit `api/feature/train/train.yml` (path + schema) FIRST. Follow `docs/references/api_contract_conventions.md`.
2. Merge + regenerate: `cd api/generate && npm run generate:api`; then `cd frontend && pnpm generate:api`. Backend types regenerate during `./mvnw generate-sources`.
3. Backend: implement the method on `TrainController` (delegate to a `*Service`). Follow `docs/references/java_package_structure.md` (`feature/train/{controller,service,repository,entity,dto,mapper}`) and `spring_patterns.md` (constructor DI via `@RequiredArgsConstructor`, method-level `@Transactional` on writes only, derived→JPQL→native repositories, MapStruct).
4. New table → Liquibase changeset `{YYYYMMDDHHMM}_{bd-id}_{desc}.sql` per `docs/references/liquibase_conventions.md` (UUID PK `gen_random_uuid()`, explicit `pk_/fk_/uq_/ck_/idx_` names, soft-delete columns). Seed data in Java `@Profile("demodata"|"demofixtures")` — never SQL. Add the table to `ResetDatabase`'s TRUNCATE list and add/extend a `*Populator` (`docs/references/integration_test_framework.md`).
5. New configurable value → `application.yml` under the `mezo:` root (`docs/references/configuration_conventions.md`), never `@Value`.
6. Errors → `SystemRuntimeErrorException` + a `SystemMessage` code (`docs/references/error_handling.md`).
7. Frontend: add the client method to `lib/trainApi.ts`/`lib/runningApi.ts`, wire a query/mutation in `trainHooks.ts`/`runningHooks.ts` **with both branches** — mock (no-op for `useTrain`, or `setQueryData` for `useRunning`) and real. Keep the boundary cast idiom (`as Mesocycle` style) consistent and use `satisfies` on request bodies. Ghost-guard the new read in every view.

**Add a Train sub-tab:** add an entry to `TRAIN_TABS` (`frontend/src/features/train/tabs.ts`), add the route + a `views/<X>View.tsx`, and surface its data through `useTrain`/`useRunning` (or a new hook re-exported from `data/hooks.ts`).

**Swap a mock-only feature to real** (e.g. a future cross-load engine): produce the data server-side, replace the static fixture branch in the hook with the API client call, and drop the `crossLoad: null` ghost — keeping the mock branch byte-identical to Phase 1.

---

## 8. Testing

Both modes and both layers must stay green.

- **Frontend (vitest — `VITE_USE_MOCK` both modes must pass):** per-tab view tests (`views/*.test.tsx`), `ActiveWorkoutScreen.test.tsx`, `MesocyclePlanner.test.tsx`, `MesocycleBuilder.test.tsx`, `RunningBlockBuilder.test.tsx`, `WeekdayGrid.test.tsx`, `planner.test.ts`, sheet tests (incl. `GymScheduleSheet.test.tsx`), `agenda.test.ts` (the `daySessions` time-ordering), `WeeklyDayRow.test.tsx` (time-ordered rows), `trainHooks.test.tsx`, `trainHooks.deriveGym.test.ts` (the gym-slot join), `trainData.test.tsx`, `train.emptyStates.test.tsx` (the ghost-guards), `train.nav.test.tsx`, `runningDraft.test.ts`, `runningHooks.test.ts`, `runningAgenda.test.ts`. Plus Playwright parity (`pnpm parity`).
  ```bash
  cd frontend
  pnpm test                          # REAL mode
  VITE_USE_MOCK=true pnpm test       # MOCK mode — both must be green
  pnpm build
  ```
- **Backend (integration-first, `@SpringBootTest` + Postgres, AssertJ, populators — `docs/references/testing_standards.md`, `integration_test_framework.md`):** service ITs `TrainServiceIT`, `WorkoutServiceIT`, `SportServiceIT`, `ExerciseRecordServiceIT`, `ExerciseCatalogLoaderIT`, `ProvenanceRoundTripIT` (the typed-jsonb risk item), `TrainSeedDataIT`; HTTP contract ITs `TrainContractIT`, `WorkoutContractIT`, `SportContractIT`, `GymScheduleContractIT` (gym-schedule GET/PUT round-trip, replace-all, ownership isolation, 401), `RunningContractIT`, `ExerciseCatalogContractIT`, `ExerciseRecordContractIT`. Populators: `support/populator/TrainPopulator.java`, `RunningPopulator.java`.
  ```bash
  cd backend
  docker compose up -d
  ./mvnw clean test                  # ITs against fixed mezo_test DB (always use clean)
  ```

---

## 9. Decisions, gotchas & deferred

**Key decisions** (see linked specs): mock parity vs clean-slate real mode (`2026-06-11-train-write-clean-slate-design.md`); running as a mesocycle-mirroring slice with typed-jsonb plan structure (`2026-06-14-train-running-slice-design.md`); on-the-fly records aggregation (no materialized table) over soft-deleted rows (`2026-06-12-exercise-records-design.md`); catalog as master content loaded in every profile (`2026-06-12-exercise-catalog-design.md`).

**Gotchas:**
- **Mock parity contract is the single most important rule:** mock returns byte-identical Phase-1 statics (synchronous `initialData`); real has no fallback → views MUST ghost-guard.
- **`useTrain` mocks no-op; `useRunning` mocks emulate** (`setQueryData`). Asymmetric on purpose.
- **Real-mode run-block create inserts synchronously into the cache** (`runningHooks.ts:52-63`, **mezo-11m**): on a `create` success the new block is written into `['running','blocks']` directly (no async invalidate that would race the read-after-write), so navigating straight to the builder no longer crashes on an `undefined` structure. Updates + mock mode still invalidate. The builder also guards `!draft.structure` with a `Betöltés…` placeholder (`RunningBlockBuilder.tsx:97-99`).
- **Run-builder edits auto-save (no Save button):** a 600 ms debounce (`RunningBlockBuilder.tsx:65-69`) plus a flush-on-back (`backToList`, `:71-74`); `dirty` is a `JSON.stringify` diff of the draft vs the loaded block (`:57-60`). The re-seed effect keys on `block?.id` only so a refetch never clobbers in-progress edits.
- **Template vs instance** both live in `workout_session`: template = `template_session_id IS NULL`; instance carries date/status/back-link. `listMesocycles`/`getToday` filter to templates; `logSet`/`finish` operate on instances.
- **Single-active invariant** for both mesocycles and running blocks (enforced server-side on activate AND on meso create-as-active).
- **Records resolve over soft-deleted exercises** via native query — day-edits soft-delete template rows but must not erase history.
- **Ownership errors:** foreign/missing → **404** (indistinguishable); `logSet` on a completed instance → **409**.
- **`phase_curve text[]` is `List<String>`** (not `String[]`) for Hibernate dirty-checking.
- Day-edit save (`MesoExercises.tsx`) fires `saveDayExercises` only when the day carries a real row `id`; mock fixtures have no id → local-only. **Exercise reorder is real** (the `SortableList` primitive, drag + ▲▼): the builder remaps the day's exercises and persists via the same `saveDayExercises` full-list PUT (array order = the contract); the planner (`MesocyclePlanner` step 3) reorders its local draft `program` only (saved wholesale at the end).
- **Gym time is a *standalone* schedule, not a meso-day field** (Option Y, `2026-06-15-gym-schedule-times-design.md`): `GymScheduleSlot` persists across mesocycles; the meso decides *whether* you train that weekday, the slot decides *when*. `deriveGymSchedule` joins them by weekday — a slot with no meso gym day shows nothing; a meso gym day with no slot renders with `time: null` (graceful). PUT is **replace-all** (delete-then-insert the whole week).
- **`Mai` orders by time-of-day, not modality** — `daySessions` (`features/train/agenda.ts`) is the single ordering helper shared by `WeeklyDayRow` and `TrainTodayView` heroes; untimed (null/`''`) sort last (`'99:99'` sentinel), ties stable by modality. `TrainTodayView` builds today's hero from a `daySessions` pass, with run-only-today handled via a **synthetic** agenda day (no gym/volleyball but a running session) so the run still gets a hero; a fully empty today shows "Ma pihenőnap".
- **`GymView`'s "Időpontok" entry is mock-gated** (`GymView.tsx:70`): hidden in mock mode because `saveGymSchedule` no-ops there, mirroring `SportView`. Mock mode still *renders* gym times from the static `gymScheduleMock` slots (`data/train.ts`), it just can't edit them.
- **`Mai` done-state matching is asymmetric** (`TrainTodayView.tsx`) — there is **no schedule↔log link** for volleyball, so "logged today" is matched by **today's date**: `sport.sessions.find(s => s.sport === 'volleyball' && s.date === huMonthDayDow(localDateString()))` (the mapped `SportSession.date` is the HU display string, so we compare against today formatted the same way). Running **does** carry the prescribed tuple back, so it matches on `blockId + weekNumber + sessionKey` (`runLoggedFor(key)`), ignoring date. **Gym** has no client-readable per-day completion, so the backend computes it: `GET /api/train/workouts/today` returns `weekDoneDates` — the ISO dates this Mon–Sun week whose gym instance carries **≥1 logged set** (`WorkoutService.doneDatesThisWeek` → `WorkoutSessionRepository.findDoneInstanceDates`, status-agnostic so an unfinished-but-logged session still counts). `TrainTodayView` derives `loggedGym = weekDoneDates.includes(today)` for the hero, and per-row `gymLogged`/`vbLogged` (matched against each weekly row's computed calendar `date`) so **past** completed days are marked, not just today. **The done-state stores nothing new — it is a pure read-derivation over already-persisted sessions/sets.** In real mode the log itself is persisted to Postgres (`POST /api/train/sport-sessions` → `SportService.create` → `sport_session` table, §4); the flip then happens after `logSportMutation`/`logRunSession` **invalidate→refetch** the session query from the backend (the DB is the source of truth — the same data the Sport `Napló` reads). The `setQueryData` cache-append is **mock-only** (the `mock ? … : …` arm in `trainHooks.ts`): it exists so the UI flips without a backend in tests/prototype, was a silent no-op before, and **never** substitutes for the DB in real mode — mock `sport.week` stats are also not recomputed on append (real mode re-derives them). A timezone edge exists: the backend stamps the log date server-side, so the flip relies on the server "today" matching the browser's local date.

**Deferred / Phase 3 (🟣 do NOT assume live):** AI workout `challenges` + `niggleWarning`; PR detection (current toast is a scripted demo, threshold-gated); live cross-load → volume engine (Sport AND Running cross-load are static); `volumePerMuscle`/`volumeRecompute` (seed-only); `shoulderLoadTrend` (constant `'stabil'`); sport `jumpCount`/`intensity`/`team`/`season`/`weeklyHours` capture; gym-schedule **`duration`** only (gym **time** is now live via `GymScheduleSlot` — §4); copy-week ("Heti terv másolása" inert); active-workout 90s timer + Voice chips.

---

## 10. Key files

**FE — data / hooks / api**
- `frontend/src/data/hooks.ts` — single boundary, re-exports `useTrain`/`useRunning` (`:202-203`)
- `frontend/src/data/trainHooks.ts` — Train queries + mutations, mode branching
- `frontend/src/data/runningHooks.ts` — Running queries + server-emulating mock mutations
- `frontend/src/data/train.ts` — Train mock fixtures, label maps, presets
- `frontend/src/data/running.ts`, `frontend/src/data/runningDraft.ts`, `frontend/src/data/runningAgenda.ts` — running fixtures + pure structure editors + agenda helpers
- `frontend/src/lib/trainApi.ts`, `frontend/src/lib/runningApi.ts` — REST clients + re-exported gen types
- `frontend/src/data/types.ts` — Train domain types

**FE — screens / views**
- `frontend/src/features/train/{TrainScreen,TrainSubNav,tabs}.{tsx,ts}` — shell + sub-nav
- `frontend/src/features/train/views/{TrainTodayView,GymView,SportView,RunningView,ExercisesView,MesocycleLibraryView}.tsx`
- `frontend/src/features/train/{ActiveWorkoutScreen,MesocyclePlanner,MesocycleBuilder,RunningBlockBuilder}.tsx` — full-screen routes
- `frontend/src/features/train/{planner,muscleFilters}.ts` — planner program-gen + exercise filters
- `frontend/src/features/train/agenda.ts` — pure `daySessions(day)` time-ordering helper (shared by `WeeklyDayRow` + `TrainTodayView`)
- `frontend/src/features/train/components/` — sheets/cards (`GymDaySheet`, `GymScheduleSheet` (standalone weekly gym-time editor → PUT `/gym-schedule`), `ExercisePickerSheet`, `ExerciseRecordSheet`, `ChallengesCarousel`, `FeedbackModal`, `WorkoutComplete`, `PRToast`, `SportLogSheet`, `SportScheduleSheet`, `CrossLoadRow`, `RunLogSheet`, `RunWeekEditor` (two-zone session cards: Menetrend = `WeekdayGrid` + time, Terhelés = load), `WeekdayGrid` (single-select 7-day picker), `RunSessionCard`, `RunCrossLoadCard`, `WeeklyDayRow` (renders `daySessions` time-ordered items, running time shown), `MesoOverview`, `MesoVolume`, `MesoExercises`, …)

**API contract**
- `api/feature/train/train.yml` — the FE↔BE source of truth for Train

**Backend** (`backend/src/main/java/io/mrkuhne/mezo/feature/train/`)
- `controller/TrainController.java` — implements generated `TrainApi`
- `service/{TrainService,WorkoutService,SportService,GymScheduleService,ExerciseCatalogService,ExerciseRecordService,RunningService}.java`
- `entity/*` — `MesocycleEntity`, `WorkoutSessionEntity`, `ExerciseEntity`, `ExerciseSetEntity`, `ExerciseFeedbackEntity`, `MuscleGroupVolumeLogEntity`, `ProvenanceEnvelope`, `VolumeRecomputeJson`, `SportSessionEntity`, `SportScheduleSlotEntity`, `GymScheduleSlotEntity`, `ExerciseCatalogEntity`, `RunningBlockEntity`, `RunningBlockStructure`, `RunSessionLogEntity`
- `repository/*` — notably `ExerciseRepository.findIdentityRowsIncludingDeleted`
- `mapper/{TrainMapper,RunningMapper}.java`
- `{TrainSeedData,RunningSeedData,ExerciseCatalogLoader}.java` — seed + master content loader
- `backend/src/main/resources/content/exercise-catalog.json` — catalog master data
- Migrations: `backend/src/main/resources/db/changelog/1.0.0/script/{202606111400_mezo-n5q_create_train, 202606120900_mezo-tod_t2_workout_execution, 202606121000_mezo-0ae_t3_sport_schedule, 202606121400_mezo-7ot_exercise_catalog, 202606141200_mezo-b4n_create_running_block, 202606141210_mezo-b4n_create_run_session_log, 202606151500_mezo-auk_create_gym_schedule_slot}.sql`

**Tests**
- FE: `frontend/src/features/train/**/*.test.{ts,tsx}`, `frontend/src/data/trainHooks.test.tsx`, `train.emptyStates.test.tsx`, `train.nav.test.tsx`
- BE: `*IT.java` (service + contract) + `support/populator/{TrainPopulator,RunningPopulator}.java`

**Related docs** — specs/plans in `docs/superpowers/specs|plans/` (dated `2026-06-10`…`2026-06-14`); house standards in `docs/references/*.md`.
