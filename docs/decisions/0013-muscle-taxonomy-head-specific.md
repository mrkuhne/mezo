# 13. Head/zone-specific muscle taxonomy (13 → 21 tokens)

- **Status:** Accepted
- **Date:** 2026-07-25
- **Driving issue:** mezo-wu1s
- **Context spec:** [`docs/superpowers/specs/2026-07-25-muscle-taxonomy-expansion-design.md`](../superpowers/specs/2026-07-25-muscle-taxonomy-expansion-design.md)

## Context

The exercise `muscle` taxonomy had 13 tokens where chest, shoulder, biceps, and triceps were
each a single bucket, and lower-back work had no home (back-extension sat under `glute`). For
hypertrophy programming this is too coarse: head-level balance (front vs side delt, long vs short
head biceps, upper vs lower chest) — the whole point of the weekly muscle map — was invisible.
The owner supplied `exercise_seed_migration_full.csv` prescribing the finer split per catalog slug.

## Decision

1. **Expand the per-exercise `muscle` taxonomy to 21 head/zone-specific tokens** (chest ×3,
   back ×3 + traps, shoulder ×3, biceps ×3, triceps ×3, quad/ham/glute/calf/core). `lats` becomes
   `back-wide`, `rear-delt` becomes `shoulder-rear`, and `back-lower` is new. This is the value
   space of `exercise_catalog.muscle` (DB CHECK), `exercise.muscle`, the API
   `CatalogExerciseCreateRequest.muscle` enum, and the FE picker/filter.

2. **Volume landmarks stay coarse.** `muscle_group_volume_log` keeps its 8-key space
   (`chest, back, shoulder, biceps, triceps, quad, ham, glute`). MEV/MAV/MRV are muscle-*group*
   concepts, not per-head; splitting the landmark values across heads would be arbitrary. The two
   key spaces already never joined; we keep them independent. Consequence: the legacy coarse keys
   remain first-class on the FE for labels/colors (like `back` already was).

3. **Existing history is migrated in the DB**, not legacy-rendered: a Liquibase data migration
   rewrites `exercise.muscle` (catalog_id join → name match → generic fallback) so past workouts
   show the new breakdown in the muscle-week map.

4. **The picker goes two-level (region → muscle).** 21 flat chips is unusable; the 6-region color
   system already existed, so region chips gate a second row of head sub-chips.

## Consequences

- The muscle-week map and growth forecast now resolve per head (they were already token-agnostic).
- `content/exercise-catalog.json` grew to 139 curated exercises (23 CSV inserts + 3 filled-in
  slugs) — more variants to pick head-specific work from.
- Curated content stays the source of truth via `ExerciseCatalogLoader` (upsert-by-slug); the
  Liquibase step exists only to satisfy the new CHECK at migration time (incl. user-created rows)
  and to migrate history. Editing content = edit the JSON, not SQL.
- Two taxonomies coexist (fine per-exercise, coarse per-group). This is intentional but is the
  main thing a future reader must not "unify" without re-opening decision #2.
