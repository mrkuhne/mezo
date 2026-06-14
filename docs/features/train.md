# Train — Feature Documentation

> The six-tab strength + conditioning area (plan, execute, log, analyze). **Status: ✅ done (FE mock + FE real + Spring Boot backend)** — the only gaps are clearly-flagged Phase-3 AI/analysis features. Lives under the **`Edzés`/Train** tab at route `/train` (sub-nav defined in `frontend/src/features/train/tabs.ts`).

---

## 1. Summary

Train is the largest mezo domain: a six-tab area for planning and executing strength work and conditioning. It covers periodized **mesocycles** (`Mesociklus`), the active week's **gym split**, full-screen **workout execution** with per-set logging, an **exercise catalog + per-exercise records** explorer, **volleyball** (`Röplabda`) scheduling/logging, and structured **interval running** (`Futás`) plans. A `Mai` tab aggregates all three rhythms (gym + volleyball + running) onto one weekly agenda.

**Status per layer — all ✅ done:**

- **FE mock** (Phase 1): synchronous static fixtures, every tab renders without a backend.
- **FE real** (Phase 2): each read/write swapped to `/api/train/*` behind the same hooks; no signature change.
- **Backend** (Phase 2): full `feature/train/**` Spring Boot slice over Postgres — mesocycles, workout execution, sport, exercise catalog/records, running.

**Phase-3-planned (🟣, flagged throughout, do NOT assume live):** AI workout `challenges` + `niggleWarning`, PR detection (the current toast is a scripted demo), the live cross-load → volume recompute engine (both Sport and Running cross-load are static), `volumePerMuscle`/`volumeRecompute` provenance (seed-only), `shoulderLoadTrend`, sport `jumpCount`/`intensity`/`team`/`season` capture, gym-schedule `time`/`duration` (FR-2.1.12), copy-week, and the active-workout 90s timer + Voice chips.

**Driving design docs (read before changing this area):**
- `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` — Phase-2 slice map.
- `docs/superpowers/specs/2026-06-11-train-write-clean-slate-design.md` — the "T0 clean slate" write/ghost rule.
- `docs/superpowers/specs/2026-06-12-exercise-catalog-design.md`, `docs/superpowers/specs/2026-06-12-exercise-records-design.md`.
- `docs/superpowers/specs/2026-06-14-train-running-slice-design.md` — the `Futás` slice.

---

## 2. User-facing behavior

The sub-nav (`TrainSubNav`, `frontend/src/features/train/tabs.ts`) has six tabs: **`Mai`** (`/train`), **`GYM`** (`/train/gym`), **`Sport`** (`/train/sport`), **`Futás`** (`/train/futas`), **`Gyakorlatok`** (`/train/exercises`), **`Mesociklusok`** (`/train/mesocycles`). Three full-screen sibling routes have no sub-nav: active workout (`/train/session`), mesocycle planner/builder (`/train/mesocycles/new`, `/train/mesocycles/:id`), and the running-block builder (`/train/futas/:id`).

### `Mai` — the weekly cross-domain agenda (`views/TrainTodayView.tsx`)
Where gym, volleyball, and running converge. Stacked hero cards for **today** (gym teal → volleyball pink → running blue), then a combined weekly timeline (`WeeklyDayRow`). You can log a volleyball or running session inline via the shared `SportLogSheet`/`RunLogSheet`. Ghosts entirely when there is no active mesocycle ("+ Tervezz mesociklust").

### `Mesociklusok` — plan library (`views/MesocycleLibraryView.tsx`)
`Aktív` hero + `Tervezett` section (with a dashed "+ Új mesociklus tervezése" CTA) + `Archív`. Header chip "+ Új" opens the planner. Cards open the builder.
- **Planner** (`MesocyclePlanner.tsx`, `/train/mesocycles/new`) — a 4-step wizard: `Cél` (goal preset) → `Hossz + fázisok` (name/start/weeks + `MEV/MAV/MRV/Deload` phase-curve editor) → `Split + napok` (split + days/week + weekday picker) → `Áttekintés` (generated program review, per-day exercise add/remove). Save as `planned` or `active`.
- **Builder** (`MesocycleBuilder.tsx`, `/train/mesocycles/:id`) — three sub-views: `Áttekintés`, `Volumen` (provenance), `Gyakorlatok` (weekly exercise editor). Lifecycle buttons: planned → `Aktiválás`, active → `Meso lezárása`. "Heti terv másolása" is inert (deferred).

### `GYM` — the active week (`views/GymView.tsx`)
Week-by-week view of the **active** meso: meta stats (`Fázis`, `Split`, `Szetek`, `Gym napok`), `PhaseDots`, day-by-day `GymDayCard`s. Tapping a day opens `GymDaySheet`; "Indítsuk · most" appears only on today's day and launches the workout. Ghosts when no active meso.

### Active workout (`ActiveWorkoutScreen.tsx`, `/train/session`)
Full-screen takeover, three phases: **`prep`** (niggle pre-flag, AI challenges carousel, warmup, exercise list, "Kezdjük el") → **`active`** (per-set weight/reps/RIR logging, "Múlt hét" comparison, set dots, set history, PR toast, RP feedback debrief) → **`complete`** (`WorkoutComplete` recap). A mid-workout hard reload **resumes** straight back into `active`.

### `Gyakorlatok` — catalog + records (`views/ExercisesView.tsx`)
Default state "Top gyakorlatok · rekordjaid" ranked by `sessionCount`. Searching or muscle-filtering shows the full catalog: record rows first (with `e1RM`/best-set/total-reps), then dashed ghost rows (STIM meter) for catalog items with no history. Tapping a record opens `ExerciseRecordSheet`.

### `Sport` — volleyball (`views/SportView.tsx`)
Hero with week stats (Sessions/Idő/RPE/Váll) and a 3-button switcher: **`Heti terv`** (7-day recurring schedule, editable in real mode via `SportScheduleSheet`), **`Napló`** (logged sessions), **`Cross-load`** (impact rows). Header chip "+ Log" opens `SportLogSheet`.

### `Futás` — running (`views/RunningView.tsx`)
3-segment switcher: **`E heti edzés`** (active block hero with `RunWeekStrip` + prescribed `RunSessionCard`s + `RunCrossLoadCard`), **`Napló`** (logged runs newest-first), **`Tervek`** (Aktív/Tervezett/Archív library; "+ Új terv" → builder). The **builder** (`RunningBlockBuilder.tsx`, `/train/futas/:id`) edits title/goal and a per-week interval editor (`RunWeekEditor`) with `Mentés`/`Duplikál`/`Aktiválás`/`Blokk lezárása`/`Törlés`.

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

**Real-mode mapping notes** (`trainHooks.ts`): `toWorkoutPlan` (`:43-58`) collapses the API response to the Phase-1 `WorkoutPlan` shape and sets `challenges: []` (AI is Phase 3); `deriveGymSchedule` (`:62-74`) builds the gym week from the active meso's template days with `time`/`duration` = `null` (no schedule-template table — FR-2.1.12 out of scope); the active-meso real fallback is `realActiveMeso ?? (mock ? activeMeso : null)` (`:358`).

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
- **Tables** (`202606120900_mezo-tod_t2_workout_execution.sql`): adds `workout_session.template_session_id` (self-FK SET NULL), `exercise_set.workout_session_id` (FK→instance CASCADE), renames `voice_note`→`note`, creates `exercise_feedback` (UNIQUE `(workout_session_id, exercise_id)`; CHECKs pump 1-4 / joint_pain 1-3 / workload 1-3).
- **Entities:** `ExerciseSetEntity` (`weight_kg NUMERIC(6,2)`, `side` CHECK L|B|R, `done_at`), `ExerciseFeedbackEntity`.
- **Endpoints:** `GET /api/train/workouts/today` (template + open instance for resume), `POST /api/train/workouts` (resumes the open instance, never duplicates), `POST .../{id}/sets`, `POST .../{id}/feedback` (upsert per exercise), `POST .../{id}/finish`.
- **DTOs:** `WorkoutTodayResponse`, `TodayExercise`, `LastWeekRef`, `WorkoutStartRequest`, `WorkoutInstanceResponse`, `ExerciseSetResponse`, `SetLogRequest`, `WorkoutFeedbackInput`. `logSet` validation: setIndex 0-49, weightKg 0-999, reps 1-100, rir 0-5, side `^[LBR]$`, note ≤500. `logSet` on a completed instance → **409** (`TRAIN_WORKOUT_NOT_ACTIVE`).
- "Last week" comparison: `WorkoutService.lastWeekRefs` picks the top set of the most-recent completed instance of the same template day, per exercise.

### Exercise catalog + records
- `exercise_catalog` (`202606121400_mezo-7ot_*`) is **master content, not user data** — no `created_by`, no soft delete. Loaded by `ExerciseCatalogLoader` (`@Order(50)`, **every profile incl. prod**) upserting by `slug` from `backend/src/main/resources/content/exercise-catalog.json`; an invalid muscle/type token fails startup fast.
- **Endpoints:** `GET /api/train/exercises` (catalog, `staleTime 1h` on FE), `GET /api/train/exercise-records` (computed on the fly — no materialized table).
- `ExerciseRecordService.list` resolves an exercise identity by `exercise.catalog_id` else name over **ALL rows incl. soft-deleted** (`ExerciseRepository.findIdentityRowsIncludingDeleted` native SQL — day-edits soft-delete template rows but must not erase history), computing `bestSet`, `bestE1rm` (Epley `w×(30+reps)/30`), `bestSessionVolume`, totals, `sessionCount`, `repRecords`, `recentTopSets`.
- **DTOs:** `ExerciseCatalogItem` (adds `slug` vs the FE `ExerciseLibraryItem`), `ExerciseRecordResponse`, `RecordSetRef`, `E1rmRecord`, `SessionVolumeRecord`.

### Sport / volleyball
- **Tables:** `sport_session` (in `202606111400_mezo-n5q_create_train.sql`; intensity/shoulder_strain CHECK 1-10, `jump_count`); `sport_schedule_slot` (added in `202606121000_mezo-0ae_t3_sport_schedule.sql`; `day_of_week` SMALLINT 0=Hét..6=Vas CHECK, `kind` training|match CHECK).
- **Endpoints:** `GET/POST /api/train/sport-sessions`, `GET/PUT /api/train/sport-schedule` (`replaceSchedule` = full soft-delete + re-insert).
- **DTOs:** `SportSessionResponse`, `SportSessionCreateRequest {duration,setsPlayed,rpe,shoulderStrain,notes?}`, schedule slot DTOs. Server defaults session date/time to **now** (the sheet has no date picker); `sport` is always `"volleyball"`.
- 🟣 `jumpCount` exists in the DB/DTO but the log sheet never captures it (only demofixtures set it); `intensity` is never written by the log path; `team`/`season`/`weeklyHours` have no DB home.

### Running (`Futás`)
- **Tables** (`202606141200`/`202606141210_mezo-b4n_*`): `running_block` (status planned|active|archived CHECK, kind interval CHECK, `structure jsonb`), `run_session_log` (FK→block CASCADE, `rpe_actual` CHECK 1-10).
- **The plan is typed jsonb:** `RunningBlockStructure` (`entity/RunningBlockStructure.java`) = `weeks[ {weekNumber, phaseLabel, sessions[ {key, dayOfWeek 0=Hét..6=Vas, label, kind sprint|pyramid|steady, rpeTarget{min,max}, rounds?, segments[ {type warmup|work|rest|cooldown, durationSec, label} ]} ]} ]`, persisted via `@JdbcTypeCode(SqlTypes.JSON)`; `RunningMapper` round-trips it field-for-field to `RunningBlockStructureDto`.
- **Endpoints:** `GET/POST /api/train/running-blocks`, `PUT/DELETE /api/train/running-blocks/{id}`, `POST .../{id}/activate`, `POST .../{id}/close`, `GET/POST /api/train/run-sessions`. `RunningService` enforces single-active on activate; `deleteBlock` is soft delete.
- **DTOs:** `RunningBlockResponse`/`RunningBlockUpsertRequest`, `RunningBlockStructureDto`, `RunWeek`, `RunPrescribedSession`, `RunSegment`, `RpeTarget`, `RunSessionLogResponse`/`RunSessionLogRequest`.
- **Seed:** `RunningSeedData` is `@Profile("demodata")` (not `demofixtures` like Train) — a plain `demodata` app already has the 3 blocks (active/planned/archived).

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

**The canonical internal integration** is `TrainTodayView`: it merges `gymSchedule` (from `useTrain`), `sport.schedule` (volleyball), and `runSessionsForDay(activeRunningBlock, dayIdx)` (from `useRunning`, via `data/runningAgenda.ts`) into one `WeeklyAgendaDay[]`. Logging from here reuses the **shared sheets** `SportLogSheet`/`RunLogSheet`. Note the cross-load seams (Sport→everything, Running→gym volume) are the documented bidirectional contracts but their **live engines are Phase 3** — today they render static rows.

**Inbound seams (one-sided — no live data crosses yet):** Today (`/today`) links here via `WorkoutTeaser` navigation only — it renders its **own** mock `Workout`, not this backend. Fuel keeps a *private copy* of the gym/volleyball schedule (`GymScheduleDay`/`VolleyballSession` in `data/fuelWeek.ts`), **not** sourced from Train — the Fuel (Slice C) backend will later reconcile them. Both are documented from the consuming side in `today.md` §5 / `fuel.md` §5.

---

## 6. How to use it (consume)

Import from the single boundary `@/data/hooks`; never reach into `trainHooks.ts`/`runningHooks.ts` directly.

```tsx
import { useTrain, useRunning } from '@/data/hooks'

function MyWidget() {
  const {
    mesocycles, activeMeso, workout, gymSchedule, sport,
    exerciseLibrary, exerciseRecords, workoutPending, todaySession,
    // imperative writes:
    createMesocycle, activateMesocycle, closeMesocycle, saveDayExercises,
    startWorkout, logSet, saveWorkoutFeedback, finishWorkout,
    logSportSession, saveSportSchedule,
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

- **Frontend (vitest — `VITE_USE_MOCK` both modes must pass):** per-tab view tests (`views/*.test.tsx`), `ActiveWorkoutScreen.test.tsx`, `MesocyclePlanner.test.tsx`, `MesocycleBuilder.test.tsx`, `RunningBlockBuilder.test.tsx`, `planner.test.ts`, sheet tests, `trainHooks.test.tsx`, `trainData.test.tsx`, `train.emptyStates.test.tsx` (the ghost-guards), `train.nav.test.tsx`, `runningDraft.test.ts`, `runningAgenda.test.ts`. Plus Playwright parity (`pnpm parity`).
  ```bash
  cd frontend
  pnpm test                          # REAL mode
  VITE_USE_MOCK=true pnpm test       # MOCK mode — both must be green
  pnpm build
  ```
- **Backend (integration-first, `@SpringBootTest` + Postgres, AssertJ, populators — `docs/references/testing_standards.md`, `integration_test_framework.md`):** service ITs `TrainServiceIT`, `WorkoutServiceIT`, `SportServiceIT`, `ExerciseRecordServiceIT`, `ExerciseCatalogLoaderIT`, `ProvenanceRoundTripIT` (the typed-jsonb risk item), `TrainSeedDataIT`; HTTP contract ITs `TrainContractIT`, `WorkoutContractIT`, `SportContractIT`, `RunningContractIT`, `ExerciseCatalogContractIT`, `ExerciseRecordContractIT`. Populators: `support/populator/TrainPopulator.java`, `RunningPopulator.java`.
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
- **Template vs instance** both live in `workout_session`: template = `template_session_id IS NULL`; instance carries date/status/back-link. `listMesocycles`/`getToday` filter to templates; `logSet`/`finish` operate on instances.
- **Single-active invariant** for both mesocycles and running blocks (enforced server-side on activate AND on meso create-as-active).
- **Records resolve over soft-deleted exercises** via native query — day-edits soft-delete template rows but must not erase history.
- **Ownership errors:** foreign/missing → **404** (indistinguishable); `logSet` on a completed instance → **409**.
- **`phase_curve text[]` is `List<String>`** (not `String[]`) for Hibernate dirty-checking.
- Day-edit save (`MesoExercises.tsx`) fires `saveDayExercises` only when the day carries a real row `id`; mock fixtures have no id → local-only. Drag-reorder is visual only.

**Deferred / Phase 3 (🟣 do NOT assume live):** AI workout `challenges` + `niggleWarning`; PR detection (current toast is a scripted demo, threshold-gated); live cross-load → volume engine (Sport AND Running cross-load are static); `volumePerMuscle`/`volumeRecompute` (seed-only); `shoulderLoadTrend` (constant `'stabil'`); sport `jumpCount`/`intensity`/`team`/`season`/`weeklyHours` capture; gym-schedule `time`/`duration` (FR-2.1.12); copy-week ("Heti terv másolása" inert); active-workout 90s timer + Voice chips.

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
- `frontend/src/features/train/components/` — sheets/cards (`GymDaySheet`, `ExercisePickerSheet`, `ExerciseRecordSheet`, `ChallengesCarousel`, `FeedbackModal`, `WorkoutComplete`, `PRToast`, `SportLogSheet`, `SportScheduleSheet`, `CrossLoadRow`, `RunLogSheet`, `RunWeekEditor`, `RunSessionCard`, `RunCrossLoadCard`, `WeeklyDayRow`, `MesoOverview`, `MesoVolume`, `MesoExercises`, …)

**API contract**
- `api/feature/train/train.yml` — the FE↔BE source of truth for Train

**Backend** (`backend/src/main/java/io/mrkuhne/mezo/feature/train/`)
- `controller/TrainController.java` — implements generated `TrainApi`
- `service/{TrainService,WorkoutService,SportService,ExerciseCatalogService,ExerciseRecordService,RunningService}.java`
- `entity/*` — `MesocycleEntity`, `WorkoutSessionEntity`, `ExerciseEntity`, `ExerciseSetEntity`, `ExerciseFeedbackEntity`, `MuscleGroupVolumeLogEntity`, `ProvenanceEnvelope`, `VolumeRecomputeJson`, `SportSessionEntity`, `SportScheduleSlotEntity`, `ExerciseCatalogEntity`, `RunningBlockEntity`, `RunningBlockStructure`, `RunSessionLogEntity`
- `repository/*` — notably `ExerciseRepository.findIdentityRowsIncludingDeleted`
- `mapper/{TrainMapper,RunningMapper}.java`
- `{TrainSeedData,RunningSeedData,ExerciseCatalogLoader}.java` — seed + master content loader
- `backend/src/main/resources/content/exercise-catalog.json` — catalog master data
- Migrations: `backend/src/main/resources/db/changelog/1.0.0/script/{202606111400_mezo-n5q_create_train, 202606120900_mezo-tod_t2_workout_execution, 202606121000_mezo-0ae_t3_sport_schedule, 202606121400_mezo-7ot_exercise_catalog, 202606141200_mezo-b4n_create_running_block, 202606141210_mezo-b4n_create_run_session_log}.sql`

**Tests**
- FE: `frontend/src/features/train/**/*.test.{ts,tsx}`, `frontend/src/data/trainHooks.test.tsx`, `train.emptyStates.test.tsx`, `train.nav.test.tsx`
- BE: `*IT.java` (service + contract) + `support/populator/{TrainPopulator,RunningPopulator}.java`

**Related docs** — specs/plans in `docs/superpowers/specs|plans/` (dated `2026-06-10`…`2026-06-14`); house standards in `docs/references/*.md`.
