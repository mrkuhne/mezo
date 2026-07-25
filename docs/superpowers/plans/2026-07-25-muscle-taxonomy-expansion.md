# Muscle taxonomy expansion (13 → 21) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the 13-token exercise muscle taxonomy with 21 head/zone-specific tokens across catalog content, DB, API contract, and the frontend, migrating existing history.

**Architecture:** `content/exercise-catalog.json` is the single source of curated content (loaded/validated at startup by `ExerciseCatalogLoader`); a Liquibase changeset carries the DB CHECK swap + history migration; the API enum + FE constants (labels, colors, region→muscle map, two-level filter) follow.

**Tech Stack:** Spring Boot 4 / Liquibase / PostgreSQL · OpenAPI contract-first · React 19 + Vite + Vitest.

## Global Constraints

- Taxonomy (21): `chest-upper, chest-mid, chest-lower, back-wide, back-mid, back-lower, traps, shoulder-front, shoulder-side, shoulder-rear, biceps-long, biceps-short, biceps-brachialis, triceps-long, triceps-lateral, triceps-medial, quad, ham, glute, calf, core`.
- Volume log (`muscle_group_volume_log`) stays coarse (8 keys incl. `back`); legacy coarse keys keep FE labels/colors.
- Generic fallback map: `chest→chest-mid, shoulder→shoulder-front, rear-delt→shoulder-rear, lats→back-wide, biceps→biceps-long, triceps→triceps-medial`.
- Gate: FE `pnpm build` + `pnpm test` + `VITE_USE_MOCK=true pnpm test`; BE focused train ITs local, full suite in CI.

---

### Task 1: Catalog content + DB migration + loader + API enum

**Files:**
- Modify: `backend/src/main/resources/content/exercise-catalog.json` (113 → 139 items, new tokens)
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607251400_mezo-wu1s_muscle_taxonomy_expansion.sql`
- Modify: `backend/.../db/changelog/1.0.0/1.0.0_master.yml` (register changeset)
- Modify: `backend/.../feature/train/ExerciseCatalogLoader.java` (`MUSCLES` → 21)
- Modify: `api/feature/train/train.yml` (`CatalogExerciseCreateRequest.muscle` enum → 21) → regen `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Test: `backend/.../feature/train/ExerciseCatalogLoaderIT.java`, `ExerciseCatalogContractIT.java` (count 113 → 139)

- [x] Apply `exercise_seed_migration_full.csv` to the catalog JSON (50 UPDATEs by slug, 23 INSERTs, 3 missing-slug UPDATEs → new sibling-calibrated entries). `complexity→stim`, `load_intensity→fatigue`.
- [x] Write the Liquibase migration: drop CHECK → slug UPDATE (CSV mirror) → generic fallback → re-add 21-token CHECK → migrate `exercise.muscle` (catalog_id join → name match → generic fallback). Register in master.
- [x] `ExerciseCatalogLoader.MUSCLES` → 21 tokens. API enum → 21; regenerate contract + FE + BE sources.
- [x] Update `ExerciseCatalogLoaderIT` + `ExerciseCatalogContractIT` counts to 139.
- [ ] Run: `cd backend && ./mvnw clean test -Dtest=ExerciseCatalogLoaderIT,ExerciseCatalogContractIT,CatalogWriteContractIT` — expect PASS.

### Task 2: Backend demo fixtures

**Files:** Modify `backend/.../feature/train/TrainSeedData.java` (per-exercise tokens; volume rows + session composites stay coarse)

- [x] Remap `exercise(...)` tokens by name to new taxonomy; leave `volume(...)` and `session(...)` coarse.
- [ ] Run: `./mvnw clean test -Dtest=TrainSeedDataIT` — expect PASS (counts unchanged).

### Task 3: Frontend constants (labels, colors, region map)

**Files:** `frontend/src/data/train/train.ts` (`MUSCLE_LABELS`), `frontend/src/features/train/logic/muscleColors.ts` (`MUSCLE_FAMILY` + new `REGION_MUSCLES`/`LIVE_MUSCLES`)
**Test:** `muscleColors.test.ts`

- [x] `MUSCLE_LABELS`: +15 HU labels, keep legacy coarse keys.
- [x] `MUSCLE_FAMILY`: map 21 tokens to families, keep legacy aliases. Add `REGION_MUSCLES` + `LIVE_MUSCLES`.
- [x] Extend `muscleColors.test.ts` for the 21 tokens + region grouping.

### Task 4: Two-level filter + pickers + sport load

**Files:** `frontend/src/features/train/logic/muscleFilters.ts` (rewrite), `sheets/ExercisePickerSheet.tsx`, `pages/ExercisesPage.tsx`, `sheets/CatalogExerciseSheet.tsx`, `logic/sportMuscleLoad.ts`
**Test:** `muscleFilters.test.ts` (new), `ExercisePickerSheet.test.tsx`, `CatalogExerciseSheet.test.tsx`, `sportMuscleLoad.test.ts`, `GymPage.test.tsx`

- [x] `muscleFilters.ts`: `TOP_FILTERS`/`TOP_FILTER_LABELS`/`subMuscles`/`matchesMuscleFilter(muscle,type,top,sub)`/`isRegionFilter`.
- [x] Picker + ExercisesPage: `[top, sub]` state, level-1 region row + level-2 sub-row.
- [x] CatalogExerciseSheet: region-grouped 21-token picker (`MuscleKey = CatalogExerciseCreateRequest['muscle']`).
- [x] `sportMuscleLoad.ts` LOAD_TABLE remap. New `muscleFilters.test.ts`; update picker/catalog/sport/gym tests.

### Task 5: Mock seeds + MSW

**Files:** `frontend/src/data/train/train.ts`, `frontend/src/data/today/today.ts`, `frontend/src/test/msw/handlers.ts`

- [x] Remap per-exercise tokens by name; keep `volumePerMuscle` coarse, niggle `right-shoulder` untouched.

### Task 6: Docs

**Files:** `docs/features/train.md`, new `docs/decisions/0009-muscle-taxonomy-expansion.md`

- [x] Update train.md muscle-color + picker + DTO sections.
- [ ] Write ADR. Run `node scripts/lint-docs.mjs`.

### Task 7: Gates + merge

- [ ] FE: `pnpm build`, `pnpm test`, `VITE_USE_MOCK=true pnpm test` — all green.
- [ ] Push branch → self-PR → CI green → merge `--no-ff` → push main.
