# Equivalent reps when the prescribed weight isn't available — design

**Issue:** `mezo-l95v4` · **Date:** 2026-09-24 · **Status:** approved by owner

## Problem

The live workout card shows the progression engine's target per working set (e.g. 98 kg × 10,
RIR 2). When the machine has no 98 (only 95), the user types 95 — and the rep field stays at 10.
95 × 10 is an easier set than prescribed, the set is then logged against the 98 × 10 snapshot, so
it never earns TARGET_HIT and counts as a 3 kg undershoot for the character's
`ProgressionAdherenceDetector`.

## Owner decisions (2026-09-24)

1. **Scope = the rest of the exercise.** Once the weight is changed, the current and the
   remaining sets of that exercise follow the new weight with the equivalent reps. No
   per-machine memory (a later, separate idea).
2. **The adjusted target counts.** The logged set's target snapshot is the adjusted
   weight × reps (95 × 11), so the medal and the adherence detector judge against it. The
   original prescription is not stored alongside.

## Behaviour

- Current row: changing the kg recomputes the reps field immediately. Typing reps afterwards
  wins until the weight changes again. Setting the weight back to the target restores the
  target reps.
- A small caption under the current row while adjusted: `95 kg-hoz igazítva · ajánlás 98 × 10`.
- Later (pending) rows show the draft weight and the equivalent reps instead of the target
  weight and the rep range, while the draft is adjusted.
- Next cursor row prefill: weight already carries over from the just-logged set
  (`prev?.weight ?? target`); reps now become the equivalent reps for that weight instead of
  snapping back to `targetReps`.
- Done rows: the rep-range verdict (`setStatus`) is shifted by the same rep delta
  (adjusted − target), so 95 × 11 against an 8–10 range is not flagged "cél felett".
- Logging: `handleLogSet` sends `targetWeightKg`/`targetReps` = the adjusted target when an
  adjustment applies; otherwise the original prescription (unchanged behaviour).

## The formula

Pure helper `frontend/src/features/train/logic/repEquivalence.ts`:

```
equivalentReps(targetWeightKg, targetReps, targetRIR, newWeightKg): number | null
  rtf   = targetReps + (targetRIR ?? 0)          // reps to failure
  e1rm  = targetWeightKg * (1 + rtf / 30)         // Epley (same as OneRepMax.java)
  rtf'  = 30 * (e1rm / newWeightKg - 1)
  reps' = round(rtf' - (targetRIR ?? 0)), clamped to [1, 50]
```

Returns `null` (= do not touch the reps) when: no target weight, weight ≤ 0, or the new weight
differs from the target by more than 20 %. Equal weight returns `targetReps` exactly.
Example: 98 × 10 @ RIR 2 → 95 kg gives 11.3 → **11**.

Plus `adjustedTarget(prescribedSet, weight)` → `{ targetWeightKg, targetReps } | null`
(null when the weight equals the target or no adjustment applies), used by the card, the
pending rows, the verdict shift and `handleLogSet`, so all four agree.

## Out of scope

Per-machine/equipment memory, storing the original prescription, backend changes, merging the
four existing frontend Epley copies.

## Testing

- `repEquivalence.test.ts`: table test — the 98→95 example, equal weight, heavier weight
  (fewer reps), >20 % swing → null, null target weight → null, clamp, null RIR.
- `WorkoutCard` tests: weight change updates reps + caption; manual reps survive; pending rows
  follow; back-to-target restores; ad-hoc (no prescription) untouched.
- `ActiveWorkoutPage` log payload: adjusted target sent.
- Frontend suite in both mock and real mode + build.

## Prior art

- **RP Hypertrophy app** — if the suggested weight isn't available, pick the nearest one and the
  app adjusts the rep target (https://hypertrophy.zendesk.com/hc/en-us/community/posts/15878948348823).
  Adopted: the user's weight wins, reps are derived.
- **Fitbod / Hevy plate calculators** — round the target to loadable weight, reps unchanged
  (https://help.fitbod.me/hc/en-us/articles/360007700013-Plate-Calculator,
  https://www.hevyapp.com/features/weight-plate-calculator/). Rejected for now: needs an
  equipment model; silently lowers effort.
- **Epley/Brzycki e1RM round-trip incl. RIR** — accurate to ~±5 % at ≤10 RTF, worse above
  (https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf). Adopted Epley (safer than Brzycki
  at high reps; already our backend formula); small swings cancel most of the error, hence the
  20 % guard.
- **Nuzzo et al. 2023 / arXiv 2603.17495** — exercise-specific and weight-dependent curves.
  Rejected for v1; the next set's logged RIR corrects residual error.

## Codebase terrain

- Targets are computed only in the backend (`SetRecommendationService`, `ProgressionDecider`);
  the frontend shows them. No rep equivalence existed; Epley lives in `OneRepMax.java` (REP_CAP
  12 for records — not reused here, the new helper has its own clamp) and in three private
  frontend copies.
- Card prefill: `WorkoutCard.tsx` `useEffect([id, cursor, count])` deliberately omits `weight`;
  the reps-follow-weight rule lives in the weight `onChange`, not the effect.
- Snapshot consumers: `MedalEvaluator` (TARGET_HIT, weight ≥ target and reps ≥ target, mirrored
  in `data/train/medalEvaluator.ts`) and `ProgressionAdherenceDetector` (≥ 2.5 kg under target).
  Decision 2 makes both judge against the adjusted target without backend changes.
- Next session: the reference set is the last session's heaviest working set — with all sets at
  95 it is 95 × 11, and progression continues from there (existing behaviour).
- No API contract change → no `api.gen.ts` regen. Hypertrophy-drive off → no prescription →
  helper returns null, ad-hoc path untouched.
