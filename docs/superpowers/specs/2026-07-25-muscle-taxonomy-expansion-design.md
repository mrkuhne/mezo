# Muscle taxonomy expansion — 13 → 21 head-specific tokens

- **Date:** 2026-07-25
- **Driving issue:** mezo-wu1s
- **Status:** approved design (point-in-time spec; living doc is `docs/features/train.md`)
- **Input:** `exercise_seed_migration_full.csv` (owner-authored: 50 catalog UPDATEs + 23 INSERTs)

## Problem

The exercise muscle taxonomy is 13 tokens (`chest, shoulder, rear-delt, lats, back-mid, biceps,
triceps, quad, ham, glute, calf, core, traps`). For hypertrophy programming this is too coarse:
chest/shoulder/biceps/triceps are single buckets, so head-specific balance (e.g. side-delt vs
front-delt volume, long-head vs short-head biceps) is invisible in the weekly muscle map, and
lower-back work has no home (back-extension was filed under `glute`).

## Decisions (owner-approved)

1. **21-token taxonomy replaces the 13-token one** as the per-exercise `muscle` value:

   | Region (family/color) | Tokens |
   |---|---|
   | Mell (coral) | `chest-upper`, `chest-mid`, `chest-lower` |
   | Hát (sky) | `back-wide`, `back-mid`, `back-lower`, `traps` |
   | Váll (lav) | `shoulder-front`, `shoulder-side`, `shoulder-rear` |
   | Kar (rose) | `biceps-long`, `biceps-short`, `biceps-brachialis`, `triceps-long`, `triceps-lateral`, `triceps-medial` |
   | Láb (sage) | `quad`, `ham`, `glute`, `calf` |
   | Core (amber) | `core` |

   Renames: `lats` → `back-wide`, `rear-delt` → `shoulder-rear`. New zone: `back-lower`.
   Removed as *live* tokens: `chest`, `shoulder`, `rear-delt`, `lats`, `biceps`, `triceps`.

2. **Existing workout history is migrated in the DB** (not legacy-rendered): a Liquibase data
   migration rewrites `exercise.muscle` via the `catalog_id` join, then case-insensitive name
   match against the catalog, then a generic fallback mapping:
   `chest→chest-mid, shoulder→shoulder-front, rear-delt→shoulder-rear, lats→back-wide,
   biceps→biceps-long, triceps→triceps-medial`.

3. **Volume landmarks stay coarse.** `muscle_group_volume_log` keeps its 8 keys
   (`chest, back, shoulder, biceps, triceps, quad, ham, glute`) — MEV/MAV/MRV are muscle-group
   concepts, not per-head. No join exists between the two key spaces; none is added.
   Consequence: the coarse keys stay first-class for labels/colors on the FE.

4. **Picker filter goes two-level** (region → muscle): 21 flat chips is too many.

5. **The 3 CSV slugs missing from the catalog** (`drag-curl`, `spider-curl`,
   `cross-body-hammer-curl`) are added as new curated entries with sibling-calibrated
   stim/fatigue instead of being skipped.

6. **CSV column mapping:** `complexity` → `stim`, `load_intensity` → `fatigue`. CSV-provided
   UUIDs/timestamps are ignored — `ExerciseCatalogLoader` upserts by slug and owns identity.

## Design

### Backend

- **`content/exercise-catalog.json`** (single source of curated content): apply the 50 slug
  UPDATEs, add 23 CSV INSERTs + 3 extra entries → 139 items.
- **`ExerciseCatalogLoader.MUSCLES`** → the 21 tokens (startup fail-fast validator).
- **Liquibase** (one new changeset, driving id `mezo-wu1s`):
  1. drop `ck_exercise_catalog_muscle`;
  2. UPDATE `exercise_catalog` by slug (CSV mirror, 50 rows), then generic-fallback UPDATE for
     any remaining old-token rows (covers user-created catalog entries);
  3. re-add the CHECK with 21 tokens;
  4. migrate `exercise.muscle`: catalog_id join → name match → generic fallback.
  `muscle_group_volume_log` and `workout_session.muscle` composite summary strings untouched.
- **API contract:** `CatalogExerciseCreateRequest.muscle` enum → 21 values; regenerate merged
  spec + FE types + BE generated sources.
- **`TrainSeedData`** (demofixtures): per-exercise tokens updated to the new taxonomy
  (Bench→chest-mid, Incline DB→chest-upper, OHP→shoulder-front, Lateral Raise→shoulder-side,
  Face Pull→shoulder-rear, Lat Pulldown→back-wide, Hammer Curl→biceps-brachialis,
  Pushdown→triceps-medial, Overhead Ext→triceps-long, …). Coarse volume rows unchanged.

### Frontend

- **`data/train/train.ts` `MUSCLE_LABELS`:** +15 Hungarian labels — Mell (felső/közép/alsó),
  Hát (széles/közép/alsó), Váll (első/oldal/hátsó), Bicepsz (hosszú/rövid), Brachialis,
  Tricepsz (hosszú/oldalsó/mediális). Coarse/legacy keys (`chest`, `back`, `shoulder`, `lats`,
  `rear-delt`, `biceps`, `triceps`) keep their labels for volume-log keys + old summaries.
- **`logic/muscleColors.ts` `MUSCLE_FAMILY`:** new tokens mapped per the region table; old
  tokens stay as legacy aliases (same role `back` has today).
- **`logic/muscleFilters.ts` + `ExercisePickerSheet`:** two-level filter. Row 1:
  `Mind | Plyo | 6 region chips`; picking a region filters to all its tokens and reveals a
  second chip row with that region's muscles to narrow further.
- **`CatalogExerciseSheet`:** the muscle picker becomes region-grouped (6 labeled groups,
  21 options) instead of one flat 13-segment control.
- **`logic/sportMuscleLoad.ts` `LOAD_TABLE`:** minimal remap of old tokens (display is
  region-aggregated anyway): `shoulder→shoulder-front`, `rear-delt→shoulder-rear`,
  `lats→back-wide`, `biceps→biceps-long`, `triceps→triceps-medial`.
- **Mock layer:** `data/train/train.ts` exercise library + meso template exercises,
  `data/today/today.ts` exercises, and `test/msw/handlers.ts` fixtures move to new tokens;
  mock `volumePerMuscle` stays coarse. Aggregation logic (`muscleWeek`, `growthForecast`,
  `groupExercisesByRegion`) is token-agnostic — no changes.

### Tests

- **BE:** `ExerciseCatalogLoaderIT` (21-token allow-list, reject-unknown), catalog contract ITs,
  `TrainSeedDataIT`/`TrainPopulator` token updates, plus a migration-focused assertion that no
  old live tokens remain on `exercise_catalog`/`exercise`.
- **FE:** `muscleColors`, `muscleWeek`, `sportMuscleLoad`, picker + catalog sheet tests, MSW-based
  data tests — updated to new tokens; new tests for the two-level filter interaction.

### Docs

- `docs/features/train.md`: taxonomy (§ data model), picker UX, muscle-week sections.
- New ADR: taxonomy expansion decision + the "volume landmarks stay coarse" boundary.

## Out of scope

- Per-head volume landmarks (MEV/MAV/MRV stay per muscle group).
- `workout_session.muscle` composite strings (informal display summaries).
- Niggle/injury body-part strings (`right-shoulder`) — a different concept.
- Multi-muscle (primary/secondary) exercise attribution.

## Gates

FE: `pnpm build` + `pnpm test` (real) + `VITE_USE_MOCK=true pnpm test`. BE: focused train ITs
locally; full suite in CI via self-PR (authoritative gate). Merge `--no-ff` after green.
