// ============================================================
// Mezo · sessionLength — plan-recipe session-duration estimator
// (mezo-oyhy.3, spec 2026-08-06). The SINGLE duration source across the
// app: MesoEditor hero, structureLint session-length rule, prep pill,
// TrainToday chip, Today facts. Pure derivation from the exercise recipe;
// inter-set rests reuse the live rest engine's numbers (restSecondsFor).
// Pacing constants live in SESSION_TIME — one place to tune. The data
// layer's durationEst field still exists but no UI reads it.
// ============================================================
import type { ExerciseKind } from '@/data/types'
import { restSecondsFor } from '@/features/train/logic/restTimer'

/** Minimal structural input — GymExercise and LoggedWorkoutExercise both satisfy it. */
export interface SessionTimeExercise {
  type: ExerciseKind
  workingSets: number
  warmupSets: number
  repMin: number
  repMax: number
}

export const SESSION_TIME = {
  /** Working-rep execution seconds. */
  repSeconds: 3.5,
  /** Explosive (plyo) reps are faster. */
  plyoRepSeconds: 2,
  /** One warm-up set's execution. */
  warmupSetSeconds: 20,
  /** Rest after a warm-up set. */
  warmupRestSeconds: 45,
  /** Per-exercise setup/plate/move overhead. */
  transitionSeconds: 90,
  /** Session-level warm-up block (the prep screen's fixed 8-minute block). */
  warmupBlockMinutes: 8,
} as const

/** Whole-session estimate in whole minutes; 0 for an empty list. Rounds ONCE on the total. */
export function estimateSessionMinutes(exercises: SessionTimeExercise[]): number {
  if (exercises.length === 0) return 0
  let seconds = 0
  for (const ex of exercises) {
    const avgReps = (ex.repMin + ex.repMax) / 2
    const repSec = ex.type === 'plyo' ? SESSION_TIME.plyoRepSeconds : SESSION_TIME.repSeconds
    seconds += ex.workingSets * avgReps * repSec
    seconds += Math.max(0, ex.workingSets - 1) * restSecondsFor(ex.type)
    seconds += ex.warmupSets * (SESSION_TIME.warmupSetSeconds + SESSION_TIME.warmupRestSeconds)
    seconds += SESSION_TIME.transitionSeconds
  }
  return Math.round(seconds / 60) + SESSION_TIME.warmupBlockMinutes
}
