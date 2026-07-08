# Writable Exercise Catalog + Demo Videos + Plyo Split (design spec)

- **Date:** 2026-07-08 · **bd:** `mezo-52zg` · **Domain:** Train (exercise catalog + planner)
- **Depends on:** `mezo-dhdr` (recipe types — the planner already emits recipe-shaped `GymExercise`; the plyo lead reuses the P3 weightless branch). Branch `feat/catalog-authoring` is stacked on `feat/hypertrophy-drive`.
- **Living docs to update on ship:** [`docs/features/train.md`](../../features/train.md) §2/§4/§10
- **Design references (mandatory):** `spring_patterns.md` · `liquibase_conventions.md` · `api_contract_conventions.md` · `testing_standards.md` · `integration_test_framework.md` · `frontend_conventions.md`

## 1. Goal

Three cohesive Train additions, one spec:
- **P1' — Writable catalog:** the exercise catalog is currently master content (`exercise-catalog.json`, no `created_by`, read-only). Let the user **create/edit/delete their own exercises** in-app with every parameter (name, muscle, type, stim/fatigue, video).
- **P2 — Demo videos:** attach a YouTube demo to **any** exercise (user-created *or* standard) and watch it **inline** without leaving the app — in the active workout (mid-set), the exercise browser, and the mesocycle builder.
- **P5 — Plyo split:** a new 4-day **`Láb+Plyo / Felső`** split (2 lower+plyo, 2 upper, ~6 exercises/day) whose lower days **lead with a plyometric**, on a **6-8 rep / RIR 0 / 2 warmup + 2-3 working** scheme.

**Current model (what changes).** `ExerciseCatalogEntity` = `slug`(unique)/`name`/`muscle`/`type`/`stim`/`fatigue` — master data, no ownership/soft-delete/media. `ExerciseCatalogLoader` (`@Order(50)`, every profile) upserts by `slug` from JSON. `GET /api/train/exercises` → `ExerciseCatalogItem`. The planner (`features/train/logic/planner.ts`) generates recipe-shaped exercises from `SPLIT_TEMPLATES` + `SCHEMES`, and **explicitly excludes plyo** from `generateProgram` (`ExerciseSeed.type = Exclude<ExerciseKind,'plyo'>`; plyo only enters via the picker). The catalog already carries **14 plyo** entries incl. `box-jump`/`depth-jump`.

## 2. Decisions

| # | Decision | Choice + rationale |
|---|---|---|
| D1 | Scope / branch | **One combined spec**, cohesive (all Train catalog/plan). Stacked on `mezo-dhdr` because P5's planner code uses the recipe types (unmerged on `main`). Natural incremental cut if ever needed: P1'+P2 (catalog+video) ↔ P5 (split). |
| D2 | Writable catalog shape | **One table, provenance column.** `exercise_catalog` gains `created_by uuid NULL` (**null = master/JSON**, set = user-created) + `is_deleted` (user rows only). User and master exercises coexist; no separate `user_exercise` table (it would duplicate the shape). |
| D3 | Video model | **One `video_url` column on `exercise_catalog`**, settable on **any** row (master or user). Single-user app → no per-user override table needed. The loader **never clobbers** a non-null `video_url` (see D6). Video = a YouTube URL; the FE derives the `youtube-nocookie.com/embed/{id}` inline player. |
| D4 | Edit authority | **Full CRUD (`POST/PUT/DELETE /exercises`) only on user rows** (`created_by = currentUser`); a full edit/delete of a master row → **409 `CATALOG_MASTER_READONLY`**. **Video is the one field editable on any row** — `PUT /exercises/{id}/video` accepts master + user rows (so the user can add a demo to Box Jump without "owning" it). |
| D5 | Slug | Generated from `name` (slugify: lowercase, non-alnum→`-`, collapse); on collision append `-2`,`-3`… `slug` stays globally unique (`uq_exercise_catalog_slug`). |
| D6 | Loader interaction | `ExerciseCatalogLoader` upserts **only content fields** (`name/muscle/type/stim/fatigue`) by slug from JSON; it (a) never touches rows whose slug isn't in the JSON (user rows), (b) sets `video_url` from JSON **only when the JSON provides one AND the row's `video_url` is null** (seeds standard videos, never overwrites a user-set one), (c) leaves `created_by` null on master rows. |
| D7 | Video surfaces | Inline **YouTube-nocookie iframe** in **3 places**: active workout (a `▶ Demo` control on the current-exercise card → in-place player, no navigation), the **Gyakorlatok** browser (`ExerciseRecordSheet`), and the meso builder (`ExercisePickerSheet` + `ExerciseEditRow`). No autoplay; lazy-mounted on tap. |
| D8 | Plyo split | New `SPLIT_TEMPLATE` `Láb+Plyo / Felső` (4 training + 3 rest) + new day-types with ~6 exercises. The **lower days lead with a plyo** exercise; `generateProgram` is relaxed to allow a single plyo lead seed, emitted as a **weightless reps-only recipe** (reuses the P3 `targetWeightKg=null` branch — `warmupSets:0`, `workingSets:3`, reps from the plyo scheme). Register the split in `SPLITS` (`@/data/train`). |
| D9 | Scheme | New goal preset **`erohipertrofia` ("Erő-Hipertrófia")** with `SCHEMES` entry `compound {reps '6-8', rir 0, sets 3}` / `isolation {reps '8-10', rir 0, sets 2}` (the P3 to-failure philosophy) + a plyo scheme `{reps '5', sets 3}`. The existing goals/schemes are untouched. |
| D10 | New plyo content | 2 new JSON entries: `db-jump-squat` (muscle `quad`, type `plyo`) and `single-leg-plate-hop` (muscle `calf`, type `plyo`), sensible stim/fatigue. |
| D11 | Out of scope | Sharing user exercises across users; video **upload** (URL only); non-YouTube providers; editing master **content** fields (name/muscle/…) in-app; per-user catalog visibility (single-user). |

## 3. Writable catalog (P1')

**Data model** (migration `{ts}_mezo-52zg_catalog_write.sql`):
- `exercise_catalog`: add `created_by uuid NULL` (FK→`app_user` `ON DELETE CASCADE`, nullable — master rows keep null), `is_deleted boolean NOT NULL DEFAULT false`, `video_url text NULL`. Add `idx_exercise_catalog_created_by`. **Existing 110 rows** get `created_by=null`, `is_deleted=false`.
- `ExerciseCatalogEntity`: add `createdBy` (UUID, nullable), `isDeleted`, `videoUrl`. Add `@SQLRestriction("is_deleted = false")` + `@SQLDelete("update exercise_catalog set is_deleted = true where id = ?")` (master rows have `is_deleted=false`, so the restriction is transparent for them). **Note:** the entity is no longer pure master data — but the loader still owns master rows.

**Loader** (`ExerciseCatalogLoader`, D6): change the per-slug upsert to set content fields always, `video_url` only-if-json-and-row-null, `created_by` left null. User rows (slug not in JSON) are never visited.

**API** (`api/feature/train/train.yml`, contract-first):
- `POST /api/train/exercises` — `CatalogExerciseCreateRequest {name (minLength 1), muscle (pattern = the 13 tokens), type (pattern compound|isolation|plyo), stim (0-1), fatigue (0-1), videoUrl?}` → 201 `ExerciseCatalogItem`. Server stamps `createdBy`, generates `slug` (D5).
- `PUT /api/train/exercises/{id}` — same body; **owner-only** (foreign/master → 409 `CATALOG_MASTER_READONLY` / 404). 
- `DELETE /api/train/exercises/{id}` — soft delete, owner-only (master → 409).
- `PUT /api/train/exercises/{id}/video` — `CatalogVideoRequest {videoUrl (nullable, YouTube pattern)}` → 200; allowed on **any** row.
- `ExerciseCatalogItem` gains `videoUrl?` + `editable` (bool: `created_by == currentUser`) so the FE shows edit/delete only on owned rows.
- `GET /api/train/exercises` returns all non-deleted rows (master + user) with the effective `videoUrl`.

**Service:** extend `ExerciseCatalogService` (create/update/delete/setVideo, owner checks, slug-gen). Errors via `SystemMessage` (`CATALOG_MASTER_READONLY`, `VALIDATION_*`).

**UI** (`features/train`): the **Gyakorlatok** page (`ExercisesPage`) gets a header `+ Új gyakorlat` opening a `CatalogExerciseSheet` (name, muscle picker over the 13 HU-labelled tokens, type segmented, stim/fatigue steppers, video URL input). User rows show a pencil (edit) + trash (delete). New hook methods on `useTrain` (`createCatalogExercise`, `updateCatalogExercise`, `deleteCatalogExercise`, `setExerciseVideo`) — dual-mode (mock: `setQueryData`; real: API).

## 4. Demo videos (P2)

**Store:** `video_url` (D3). Read returns the effective `videoUrl`. `PUT /exercises/{id}/video` sets/clears it on any row.
**Player:** a shared `VideoDemo` component (`shared/ui/` or `features/train/components/`) — takes a YouTube URL, extracts the id (`youtu.be/{id}` | `watch?v={id}`), renders `<iframe src="https://www.youtube-nocookie.com/embed/{id}" allowfullscreen loading="lazy">` inside a 16:9 `notch`-clipped frame; **mounts only after tap** (no eager iframe). Ghosts when no video.
**Surfaces (D7):**
- **Active workout** (`ActiveWorkoutPage`): the current-exercise card header gains a `▶ Demo` chip (visible when the exercise resolves a `videoUrl`) that expands the `VideoDemo` in place (collapses on re-tap) — no route change, the set logger stays mounted.
- **Browser** (`ExerciseRecordSheet` via `ExercisesPage`): a `Demo` section with the player.
- **Builder** (`ExercisePickerSheet` row + `ExerciseEditRow` expanded): a small `▶` that opens the player so you see "which is which" while composing.
**Video resolution is server-side, no FE join:** `GymExercise` and `TodayExercise` gain a nullable `videoUrl`, populated by the backend from the exercise's linked catalog row (`catalog_id` → effective `video_url`). Every surface reads `videoUrl` directly. The catalog-browser surface reads the catalog item's own `videoUrl`. **Seed** `box-jump`/`depth-jump` (and the 2 new plyo) videos in `exercise-catalog.json` so demos work out-of-box.

## 5. Plyo split (P5)

**Content (D10):** append to `exercise-catalog.json`:
`{ "slug":"db-jump-squat", "name":"DB Jump Squat", "muscle":"quad", "type":"plyo", "stim":0.62, "fatigue":0.45 }`,
`{ "slug":"single-leg-plate-hop", "name":"Single-Leg Plate Hop", "muscle":"calf", "type":"plyo", "stim":0.52, "fatigue":0.30 }`.

**Split + generator** (`features/train/logic/planner.ts` + `@/data/train`):
- Add `SPLIT_TEMPLATES['Láb+Plyo / Felső']` — `Hét:Láb+Plyo A · Kedd:Felső A · Sze:Rest · Csü:Láb+Plyo B · Pén:Felső B · Szo:Rest · Vas:Rest` (default weekdays; user re-picks in step 3).
- Add day-type seed builders in `exercisesForDay` for `Láb+Plyo A/B` and `Felső A/B` (~6 each), the lower days leading with a plyo seed:
  - **Láb+Plyo A:** Box Jump *(plyo)* · Barbell Squat · Romanian Deadlift · Leg Press · Leg Curl · Standing Calf Raise
  - **Felső A:** Barbell Bench Press · Chest Supported Row · Overhead Press · Lat Pulldown · Pronated · Hammer Curl · Tricep Pushdown
  - **Láb+Plyo B:** Depth Jump *(plyo)* · Hip Thrust · Romanian Deadlift · Leg Press · Seated Leg Curl · Standing Calf Raise
  - **Felső B:** Weighted Pull-Up · Incline DB Press · Lateral Raise · Seal Row · Incline Curl · Overhead Tricep Ext
- Relax `ExerciseSeed.type` to allow `plyo` **for a lead seed only**; in `generateProgram`, a plyo seed emits a **weightless recipe** (`warmupSets:0`, `workingSets: plyoScheme.sets`, `repMin=repMax=plyoReps`, `targetRIR:0`, no weight) — the P3 engine then prescribes reps-only for it.
- Register `Láb+Plyo / Felső` in `SPLITS` and add the `erohipertrofia` goal to `GOAL_PRESETS` + `SCHEMES` (D9). The 2 upper days together cover **hát** (row+pull-up) · **mell** (bench+incline) · **váll** (OHP+lateral) · **kar** (bicep+tricep).

## 6. Migration & seed

Changeset `{YYYYMMDDHHMM}_mezo-52zg_catalog_write.sql`: the `exercise_catalog` column adds (D2/D3) with explicit `fk_/idx_` names. **No new tables.** Add `exercise_catalog` is **already** in scope for reset/ownership — confirm it's TRUNCATE-safe: it holds master content re-seeded by the loader, so `ResetDatabase` must still let the loader repopulate (master rows are content, user rows are test-created). Extend `TrainPopulator` with a `createUserCatalogExercise` factory; seed data stays JSON (master) + Java where owned.

## 7. Testing

**Backend (integration-first, Testcontainers `-Xmx3g`, AssertJ, populators):**
- `CatalogWriteServiceIT` / `CatalogWriteContractIT` — create (slug-gen + collision), update/delete owner-only (master → 409 `CATALOG_MASTER_READONLY`), `setVideo` on master + user, `editable` flag, list returns master+user with effective video.
- `ExerciseCatalogLoaderIT` — loader preserves a user-set `video_url` on a master row across a re-run; never deletes user rows; seeds JSON video only when row video null.
- `plannerProgram` (FE) — the `Láb+Plyo / Felső` split generates the 4 days, plyo lead is weightless (targetWeightKg null / warmupSets 0), upper days cover the 4 muscle groups.

**Frontend (vitest both modes + build):** `CatalogExerciseSheet` (create/edit/delete + validation), `VideoDemo` (id extraction from `youtu.be`/`watch?v=`, lazy mount, ghost), the `▶ Demo` in `ActiveWorkoutPage` (opens inline, no route change), the split in `MesocyclePlannerPage`, both mock+real.

## 8. Out of scope / follow-ups

D11 items; plus: analytics on demo views, a "duplicate this master exercise to edit it" convenience, and drag-reordering user exercises in the browser — file as bd follow-ups if wanted.
