# Exercise Catalog — Design

**Date:** 2026-06-12
**Status:** approved-pending-review
**Driving need:** the meso wizard's exercise picker offers only the 21-item Phase-1 demo
list (`frontend/src/data/train.ts` `exerciseLibrary`). There is no backend catalog: the
backend `ExerciseEntity` is a per-template-day row (copy of name/muscle/type), not master
data. We want a real, curated catalog served by the backend, including plyometric
exercises for vertical-jump development (volleyball).

## Decisions (made with the user)

1. **Catalog lives in the backend** — new `exercise_catalog` table + `GET /api/train/exercises`.
   Rationale: Phase 3 (AI brain, pgvector, recommendations) needs it as master data;
   a static FE list would have to migrate anyway.
2. **Curated ~120 items, English names** — hand-curated, muscle-balanced, RP-style
   `stim`/`fatigue` values. No bulk import from public datasets (noise, foreign taxonomy,
   and stim/fatigue would be manual work regardless).
3. **Nullable `catalog_id` on the existing `exercise` table** — copy semantics stay
   (name/muscle/type still copied into the day row; existing screens unchanged), but new
   picks carry a reference back to master data. Existing rows stay NULL.
4. **Plyometric exercises included** — new exercise `type` value `plyo` for the
   vertical-jump block (user request).

## 1. Data model (backend)

New table `exercise_catalog` — master/content data: **no `created_by`, no soft delete**
(it is not user-owned data; ownership filtering and `@SQLRestriction` do not apply).

| column    | type          | constraints |
|-----------|---------------|-------------|
| `id`      | uuid PK       | `gen_random_uuid()` |
| `slug`    | text          | `uq_exercise_catalog_slug` — stable key for content upserts (e.g. `barbell-bench-press`) |
| `name`    | text NOT NULL | English display name |
| `muscle`  | text NOT NULL | `ck_exercise_catalog_muscle` — token list below |
| `type`    | text NOT NULL | `ck_exercise_catalog_type` — `compound` / `isolation` / `plyo` |
| `stim`    | numeric(3,2) NOT NULL | 0–1 |
| `fatigue` | numeric(3,2) NOT NULL | 0–1 |

Changes to the existing `exercise` table (new changeset; released changesets are immutable):

- add `catalog_id uuid NULL` + `fk_exercise_catalog` → `exercise_catalog(id)`
  (`ON DELETE SET NULL` — catalog rows are never deleted in practice, but a content
  removal must not break historical template days).
- extend `ck_exercise_type` to `('compound','isolation','plyo')` — drop + re-add under a
  new changeset, keeping the same constraint name.

**Muscle taxonomy** (existing 10 + 3 new):
`back-mid, lats, chest, shoulder, rear-delt, biceps, triceps, quad, ham, glute`
\+ **`calf`, `core`, `traps`**.

Plyo items use their real primary muscle (mostly `quad`, `glute`, `calf`); "plyo" is a
*type*, not a muscle. The picker gets a dedicated Plyo filter chip (see §4).

## 2. Content loading — bundled JSON + idempotent loader

The seed-data house rule (`liquibase_conventions.md`: demo data in Java
`@Profile("demodata")`, never SQL) covers *demo* data. The catalog is *content* needed in
every environment including prod, so neither mechanism fits as-is. Chosen mechanism:

- Catalog content lives in `backend/src/main/resources/content/exercise-catalog.json`
  (array of `{slug, name, muscle, type, stim, fatigue}`).
- A startup component `ExerciseCatalogLoader` (`feature/train`, **all profiles**, ordered
  before `TrainSeedData`) **upserts by `slug`**: insert missing rows, update changed
  fields, never delete. Content tuning (e.g. stim adjustments) = edit the JSON; Liquibase
  owns schema only.
- Loader parses the JSON with the SB4 Jackson 3 `ObjectMapper` (`tools.jackson.databind`),
  validates tokens against the same allowed sets the DB CHECKs enforce, and fails fast on
  violation (a typo in content must break startup, not produce a 500 later).

## 3. API (contract-first)

`api/feature/train/train.yml` additions:

- **`GET /api/train/exercises`** → `200: ExerciseCatalogItem[]`, tag `Train`,
  `operationId: getExerciseCatalog`, behind auth like every endpoint (401 without token).
  Sorted by `muscle, name` server-side.
- New schema **`ExerciseCatalogItem`**: required `id (uuid), slug, name, muscle, type, stim, fatigue`;
  `type` enum `[compound, isolation, plyo]`; `stim`/`fatigue` number 0–1.
- **`GymExerciseInput`** gains optional `catalogId` (uuid, nullable) — the
  PUT `/mesocycles/{id}/days/{dayId}/exercises` path persists it to `exercise.catalog_id`.
- **`Exercise` response schema** gains optional `catalogId` (uuid, nullable).
- All three existing `type` enums (`Exercise`, `GymExerciseInput`, workout-today exercise)
  extend to `[compound, isolation, plyo]`.

Regeneration as usual: `api/generate npm run generate:api` → backend codegen in Maven,
`pnpm generate:api` for FE types.

## 4. Frontend

- `trainApi.exercises()` → new query `['train','exerciseCatalog']` with a long
  `staleTime` (content data; refetch on app reload is enough).
- `useTrain().exerciseLibrary` **keeps its shape** (`ExerciseLibraryItem`): in real mode
  it is mapped from the API response (`id` = catalog uuid); in mock mode the static
  21-item list stays untouched (mock branch does not fetch).
- `ExerciseKind` union extends to `'compound' | 'isolation' | 'plyo'`.
- `ExercisePickerSheet`: filter chips stay muscle-based, extended with the 3 new muscle
  tokens **plus a special `plyo` chip** that filters `type === 'plyo'` instead of muscle
  (one explicit special case in the filter predicate). `MUSCLE_LABELS` gains entries for
  `calf`, `core`, `traps` (and a label for the plyo chip).
- `onPick` flows the picked item's id into the built `GymExerciseInput.catalogId`
  (MesoExercises / day-editor builder).
- MSW: new `GET /api/train/exercises` handler with a small fixture (a few items across
  muscles incl. one plyo) so real-mode FE tests are deterministic.

## 5. Content curation (~120 items)

- Muscle-balanced: 8–14 per muscle group; the current 21 items keep their exact names
  (slugs derived from them) so existing demo fixtures remain consistent.
- Fills known gaps: deadlift variants, pull-up/chin-up, dips, rows, calf raises, core
  work, unilateral leg work (split squat, lunge, step-up), traps.
- **Plyo block (~12 items)** for vertical-jump development, e.g.: Box Jump, Depth Jump,
  Depth Drop, Broad Jump, Seated Box Jump, Tuck Jump, Pogo Hops, Single-Leg Bound,
  Lateral Bound, Jump Squat, Trap-Bar Jump, Approach Jump (volleyball-specific).
- stim/fatigue RP-consistent: compounds high stim / higher fatigue; isolations low
  fatigue; spinal loaders (deadlift, squat) top of the fatigue scale; plyo = moderate
  stim, fatigue reflecting CNS cost (depth jump high, pogo hops low).
- Exact list is produced at implementation time in `exercise-catalog.json`; the plan
  contains the full JSON (no placeholder content in the plan).

## 6. Testing

Backend (house framework, both DB modes):

- `ExerciseCatalogLoaderIT`: load populates ~120 rows; running twice is idempotent
  (no duplicates); changing a value in a row then re-running upserts it; invalid token
  in content fails fast.
- `ExerciseCatalogContractIT` (`ApiIntegrationTest`): 401 without token; 200 list sorted
  by muscle+name; item field round-trip incl. a plyo item.
- Day-exercises PUT round-trip with `catalogId` set and with it absent (NULL persisted);
  unknown `catalogId` (random uuid) → the service validates existence and throws
  `SystemRuntimeErrorException` → 400 `VALIDATION_INVALID_VALUE` (never a raw FK 500).
- `ResetDatabase`: `exercise_catalog` is **content, not user data** — it must NOT be
  truncated between tests (loader runs once per context); only `exercise.catalog_id`
  rows vanish with their owning tables as today.

Frontend (both modes):

- hook test: real mode maps the API catalog into `exerciseLibrary`; mock mode keeps the
  static list.
- picker test: plyo chip filters type; new muscle chips render; payload spy asserts
  `catalogId` in the PUT body after picking.
- Gates: BE both DB modes, FE both modes, build, parity 45/45 (picker layout unchanged
  apart from extra chips — parity screens must stay green; mock mode visuals untouched).

## Out of scope (YAGNI)

- User-created custom exercises (POST/PUT on the catalog).
- Equipment field / equipment filtering (names already encode Barbell/DB/Cable/Machine).
- Strict-FK refactor (exercise rows referencing catalog without copied fields).
- Hungarian localization of exercise names.
- Catalog admin UI.
