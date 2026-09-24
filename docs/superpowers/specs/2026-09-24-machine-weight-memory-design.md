# Per-machine weight memory — design

**Issue:** `mezo-bk7l2` (created with this spec) · **Date:** 2026-09-24 · **Status:** approved by owner
**Builds on:** `mezo-l95v4` (equivalent reps on a weight swap), `mezo-py1i6` (decimal comma).

## Problem

The engine keeps prescribing weights the machine does not have (98 kg on a stack that goes
95 → 100). Since `mezo-l95v4` the user can swap on the card and get equivalent reps, but has to
do it every time.

## Owner decisions (2026-09-24)

1. **The app learns by itself**, no setup UI, no extra button, no menu row.
2. **One gym.** Memory is per exercise identity (catalog id, else exact name — the
   `ExerciseHistoryResolver` idiom), not per gym.
3. **Learning signal = a near swap.** Logging a working set whose weight differs from the
   engine's ORIGINAL prescription by at most `max(load increment, 10 % of the prescription)`
   marks the prescribed weight as missing on that exercise. A bigger swap is a choice, not
   evidence. Logging (or editing a set to) a weight heals it: it is no longer missing.
4. **Recommendation:** a prescription that lands on a missing weight moves to the nearest
   available weight with equivalent reps; the rationale says so
   (`98 kg nincs a gépen → 95 kg`). The day summary must not claim a weight bump that the snap
   cancelled.

## Behaviour

### Learning (backend, `logSet` / `updateSet`)
- `SetLogRequest` gains optional `prescribedWeightKg`: the engine's original working target for
  the slot (the FE sends `target.targetWeightKg` from the prescription, before any swap
  adjustment — `targetWeightKg` stays the adjusted snapshot per `mezo-l95v4`).
- `logSet`, working set, `prescribedWeightKg != null`, `weightKg != prescribedWeightKg`,
  `|Δ| ≤ max(increment(type), gapNearFraction × prescribed)` → upsert a gap row
  `(user, identityKey, prescribedWeightKg)`.
- `logSet` and `updateSet` with a weight → delete any gap row for `(user, identityKey, weightKg)`.
- Only when the hypertrophy-drive switch is on (no prescription otherwise).

### Snap (backend, `SetRecommendationService.prescribe`, history branch only)
Pure `WeightSnapper.snap(base, reps, rir, repMin, repMax, ref weight, lever direction, gaps,
used weights, plateStep)`:

- `base` not a gap → unchanged.
- Candidates = weights ever logged on the identity (completed working history) ∪
  `base ± k·plateStep` (k = 1..4), minus gaps, minus ≤ 0.
- **Direction is preserved** (the Liftosaur #338 stall): an upward move (WEIGHT +) only
  considers candidates `> ref weight`; a downward move (WEIGHT −, DELOAD) only `< ref weight`.
  Otherwise snapping 65 back to 60 would re-prescribe the same set forever.
- `lower` = nearest candidate below `base`, `higher` = nearest above. Reps for each =
  Epley round-trip incl. RIR (the Java twin of `repEquivalence.ts`, same 20 % guard; a guarded
  candidate is unusable).
- Pick the candidate whose reps fall in `[repMin, repMax]`; if both or neither, the smaller
  distance outside the range; tie → lower.
- No usable candidate → unchanged (the user swaps on the card as today).

After a snap: working sets carry the snapped weight × reps; `progression.targetWeightKg/
targetReps` follow; `deltaKg = snapped − ref`. The rationale gets
` · {from} kg nincs a gépen → {to} kg`. Warmups keep deriving from the (snapped) base.
The day tally counts a zero `deltaKg` as `hold`, not `weightUp`.

### Frontend
Only `handleLogSet` changes: it sends `prescribedWeightKg`. Mock mode unchanged.

## Data

`exercise_weight_gap` (1.1.0 changelog): `id, created_by → app_user cascade, is_deleted,
created_at, identity_key text, weight_kg numeric(6,2)`, partial unique
`(created_by, identity_key, weight_kg) where is_deleted = false`. Added to `ResetDatabase`.
Config: `mezo.hypertrophy.gap-near-fraction: 0.10`.

## Out of scope
Multiple gyms, a settings screen, plate calculators, the anchor (first-session) branch.

## Testing
- `WeightSnapperTest` (pure): no gap, lower in range, lower too many reps → higher, direction
  guard (no snap back to ref), deload direction, no candidate, gap on a plate step.
- `WeightGapRulesTest` (pure): near vs far swap per type.
- `WorkoutWeightGapIT`: log near swap → gap row; log that weight later → healed; getToday snaps
  a WEIGHT+ prescription onto an available weight with equivalent reps + rationale; far swap
  learns nothing; summary tally.
- FE: `handleLogSet` payload carries `prescribedWeightKg` (original, not adjusted).

## Prior art
- **Alpha Progression** — per-gym/equipment/exercise available-weight ranges, manual setup,
  rep-first when the next step is too big (https://alphaprogression.com/en/blog/alpha-progression-guide).
  Adopted: equivalent reps + choose-by-rep-range; rejected: manual setup (owner decision 1).
- **Fitbod** — per-gym ticked weights, free weights only; machines unsupported
  (https://fitbod.zendesk.com/hc/en-us/articles/360006333853-Gym-Profile). Rejected: per-gym.
- **RP Hypertrophy** — nearest weight + recomputed reps, no memory
  (https://hypertrophy.zendesk.com/hc/en-us/community/posts/15878948348823). That is `mezo-l95v4`;
  this adds the memory.
- **Hevy** plate inventory (https://help.hevyapp.com/hc/en-us/articles/34518876511383). Overkill
  for stacks.
- **Liftosaur #338** — progressing from the rounded weight stalls forever
  (https://github.com/astashov/liftosaur/issues/338). Adopted as the direction-preserving rule.
- No app found that learns availability from logs — this is new ground, hence self-healing.

## Codebase terrain
- Engine: `SetRecommendationService.prescribe` (history branch) + `ProgressionDecider` (only
  WEIGHT/DELOAD produce new kg; REP/HOLD reuse the logged weight, which is healed by logging).
- Identity: `ExerciseHistoryResolver.identityKey` (catalog id else name, soft-deleted rows
  included); the template `exercise.id` is not stable across edits.
- `target_weight_kg` stores the adjusted target since `mezo-l95v4`, so the original
  prescription must travel explicitly (`prescribedWeightKg`).
- Day tally: `WorkoutService.getToday` switch on lever; zero delta handled explicitly now.
- Gates: contract regen (api + FE), `ResetDatabase` TRUNCATE list, ArchUnit layer packages,
  CODEMAP, full backend suite with Testcontainers.
