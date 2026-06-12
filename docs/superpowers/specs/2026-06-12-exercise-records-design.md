# Exercise Records / Achievements — Design

**Date:** 2026-06-12
**Status:** approved-pending-review
**Driving need:** historical per-exercise PR tracking — best set, estimated 1RM, volume
records, counters — browsable like achievements, per exercise. Builds directly on the
`exercise_catalog` + `catalog_id` linkage shipped in mezo-7ot and the T2 set-logging data
(`exercise_set`: weight_kg, reps, rir, done_at, workout_session_id).

## Decisions (made with the user, incl. browser mockup round)

1. **New 5th Train tab: "Gyakorlatok"** (`/train/exercises`) — the Gym tab stays
   untouched (it is already full: meso hero + weekly split). Mockup-validated.
2. **Default view: "Top gyakorlatok"** — exercises with records, ranked by session
   count; each row shows best set + e1RM chip.
3. **Search across the full catalog** (110 items) with the picker's muscle chips +
   plyo chip. Matches WITH records render as full record rows (first); matches WITHOUT
   records render as dashed "ghost" rows with a STIM chip — the tab doubles as an
   exercise explorer. User confirmed ghost rows stay.
4. **Detail: record sheet, variant A** (user-picked from two mockup variants):
   hero best set → 2×2 stat grid → rep-PR table → last-5 sparkline.
5. **Compute on-the-fly** (approach A): no materialized table; a single aggregation
   endpoint reads `exercise_set` joined through `exercise`. Single-user data volume
   makes this trivially fast; records never drift from reality (soft deletes included).
6. **Out of scope now:** live "new PR!" detection during an active workout, PR-history
   timeline (when did which record fall), Insights integration. These become attractive
   with a materialized record table later — YAGNI today.

## 1. Record semantics

**Exercise identity:** group key = `exercise.catalog_id` when present, else the exercise
**name** (exact). Display name/muscle/type come from the most recent occurrence; when the
identity is a catalog row, name/muscle/type/stim come from the catalog.

**Set eligibility:** a set counts when `reps IS NOT NULL`. Weight-based metrics (best
set, e1RM, volume) additionally require `weight_kg IS NOT NULL` — so bodyweight/plyo
exercises (Pull-Up, Box Jump) still get counters and rep records but no weight PRs.
Soft-deleted rows are excluded by the existing `@SQLRestriction`.

**Metrics per exercise:**

| metric | rule |
|---|---|
| `bestSet` | max `weight_kg`; tie → more reps; tie → most recent. Carries weightKg, reps, date |
| `bestE1rm` | max Epley `weight × (1 + reps/30)` over all sets; carries the source set + date |
| `bestSessionVolume` | max Σ(weight×reps) grouped by `workout_session_id` (legacy NULL → grouped by exercise row); carries date |
| `totalVolume` | Σ(weight×reps) all-time |
| `totalSets` / `totalReps` | counts over eligible sets |
| `sessionCount` | distinct workout instances the exercise was logged in |
| `repRecords[]` | top 3 distinct weights by magnitude → max reps at each (+ date) |
| `recentTopSets[]` | last 5 sessions' top set (by weight, then reps): date + weightKg + reps |

Dates derive from `done_at` (fallback `created_at`).

## 2. Backend

- New `ExerciseRecordService` (`feature/train/service`): loads the owner's eligible sets
  with their exercises (one repository query each), groups in Java by identity, computes
  the metrics above. No native SQL needed at this scale.
- **`GET /api/train/exercise-records`** → `ExerciseRecordResponse[]` (contract-first,
  tag Train, auth like everything): identity (`catalogId` nullable + `name`, `muscle`,
  `type`), all metrics; list sorted by `sessionCount` desc, then name. Exercises with
  zero eligible sets are absent (the FE merges catalog ghosts client-side from the
  already-fetched catalog query).
- Weight/volume numbers are `number` in the contract (BigDecimal in Java); e1RM rounded
  to 1 decimal, volumes to whole kg.

## 3. Frontend

- **Route + tab:** `/train/exercises`, tab label `GYAKORLATOK` added to the Train tab
  row in BOTH modes (navigation chrome, not data). The 5th tab appears on parity shots —
  acceptable: parity is capture-only (no pixel asserts), documented in the plan.
- **`ExercisesView`:** search input + muscle/plyo chips (same filter logic as
  `ExercisePickerSheet`); default state = "Top gyakorlatok · rekordjaid" ranked list
  (rank number, name, muscle · session count, best set / for weightless exercises the
  total-rep counter, e1RM chip). Active search/filters switch the section to
  "Találatok · teljes katalógus": record rows first, then dashed ghost rows
  (catalog-only matches, STIM chip). Empty records overall → GhostState
  ("Az első logolt edzés után itt nőnek a rekordjaid") with the search still usable
  over the catalog.
- **`ExerciseRecordSheet`** (variant A, house Sheet pattern): eyebrow REKORDOK + name +
  muscle·type·session-count line; hero card (best set, brand-tinted border like the
  sport hero); 2×2 stat grid (Becsült 1RM · Epley, Legjobb session-volumen,
  Össz-volumen, Szett·Rep); "Rep-rekord · top súlyok" 3-row table; "Utolsó 5 alkalom"
  sparkline bars + date labels. Weightless exercises: hero shows total reps, the
  weight-based grid cells render an em-dash.
- **Data:** new query `['train','exerciseRecords']` via `trainApi.exerciseRecords()`;
  `useTrain()` exposes `exerciseRecords` (mock mode: empty list — Phase-1 has no set
  history; the catalog ghost-search still works over the static 21). Mutation-free view.
- The mock-mode Train experience otherwise stays byte-identical; existing tests that
  pin the 4-tab row get updated for the 5th tab deliberately.

## 4. Testing

- `ExerciseRecordServiceIT`: tie-breaks (same weight more reps; same weight+reps more
  recent), Epley winner differs from heaviest set, session-volume grouping by instance,
  bodyweight exercise (reps only) → counters without weight PRs, multi-meso aggregation
  through the same `catalog_id`, name-fallback grouping for unlinked rows, soft-deleted
  sets excluded, rep-record top-3 weights, recent-top-sets ordering and cap at 5.
- `ExerciseRecordContractIT`: 401 without token; 200 with computed payload after
  populator-built history; empty DB → `[]`; cross-user isolation.
- FE: hook test (real mode maps the endpoint; mock mode empty), `ExercisesView` tests
  (top list ranking, search merging records + catalog ghosts, chip filtering, ghost
  state), `ExerciseRecordSheet` tests (full metrics render, weightless variant),
  tab-row tests updated for 5 tabs. Both FE modes + build + parity captures.

## Out of scope (YAGNI)

- Live PR detection / toast during an active workout.
- PR-history timeline (record progression over time) and a materialized
  `exercise_record` table — revisit when PR-feed/notifications are wanted.
- Records for sport (volleyball) sessions — gym/set data only.
- Editing or deleting historical sets from this view.
