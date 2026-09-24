import type { PrescribedSet } from '@/data/types'

/** Beyond this relative swing the Epley round-trip is guesswork — the reps are left alone. */
const MAX_SWING = 0.2
const MIN_REPS = 1
const MAX_REPS = 50

/**
 * Reps at `weightKg` that cost the same effort as the prescribed set (mezo-l95v4): the
 * prescription's reps-to-failure (reps + RIR) → Epley e1RM (same formula as backend
 * `OneRepMax`) → reps-to-failure at the new weight → minus the same RIR. Null = do not
 * touch the reps (no target, nonsense weight, or too big a swing to trust).
 */
export function equivalentReps(p: PrescribedSet | null, weightKg: number): number | null {
  const tw = p?.targetWeightKg
  if (p == null || tw == null || tw <= 0 || !(weightKg > 0)) return null
  if (weightKg === tw) return p.targetReps
  if (Math.abs(weightKg / tw - 1) > MAX_SWING) return null
  const rir = p.targetRIR ?? 0
  const e1rm = tw * (1 + (p.targetReps + rir) / 30)
  const reps = Math.round(30 * (e1rm / weightKg - 1) - rir)
  return Math.min(MAX_REPS, Math.max(MIN_REPS, reps))
}

/** The target the set is judged and logged against after a weight swap; null = the prescription stands. */
export function adjustedTarget(
  p: PrescribedSet | null,
  weightKg: number,
): { targetWeightKg: number; targetReps: number } | null {
  if (p?.targetWeightKg == null || weightKg === p.targetWeightKg) return null
  const reps = equivalentReps(p, weightKg)
  return reps == null ? null : { targetWeightKg: weightKg, targetReps: reps }
}

/** The exercise's rep range moved by the same delta as the adjusted target. */
export function adjustedRange(
  ex: { repMin: number; repMax: number },
  p: PrescribedSet | null,
  weightKg: number,
): { repMin: number; repMax: number } {
  const a = adjustedTarget(p, weightKg)
  if (a == null || p == null) return { repMin: ex.repMin, repMax: ex.repMax }
  const d = a.targetReps - p.targetReps
  return { repMin: ex.repMin + d, repMax: ex.repMax + d }
}
