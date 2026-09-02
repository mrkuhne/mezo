// ============================================================
// Mezo · sessionLength — plan-recipe session-duration estimator
// (mezo-oyhy.3, spec 2026-08-06; profile-calibrated path added Task 12,
// spec 2026-09-02-workout-timing, mezo-dzbm). The SINGLE duration source
// across the app: MesoEditor hero, structureLint session-length rule, prep
// pill, TrainToday chip, Today facts. Pure derivation from the exercise
// recipe; inter-set rests reuse the live rest engine's numbers
// (restSecondsFor). Pacing constants live in SESSION_TIME — one place to
// tune. The data layer's durationEst field still exists but no UI reads it.
//
// `estimateSessionMinutes` now takes an optional `SessionTimingProfile`
// (GET /api/train/timing-profile, Task 11). Only the TrainToday chip and
// the MesoEditor hero pass it — those are the two "how long will THIS
// session take ME" reads. structureLint, peakWeekFit, programFit and
// prepBriefing deliberately stay on the static path: they encode
// programming RULES (e.g. structureLint's 45-90 minute band), not personal
// predictions, and a per-user calibrated number would drift those bands
// out from under their own thresholds.
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

/** Learned pacing, in seconds (GET /api/train/timing-profile). Every field is always present —
 *  the backend fills unlearned components with the static seeds, so there is no cold-start branch. */
export interface SessionTimingProfile {
  leadInSeconds: number
  setCycleCompoundSeconds: number
  setCycleIsolationSeconds: number
  transitionSeconds: number
}

/**
 * Whole-session estimate in whole minutes; 0 for an empty list.
 *
 * With a profile, the sum mirrors EXACTLY how the backend measures (TimingObservationExtractor):
 * a lead-in, one set cycle per interval WITHIN each exercise (n-1 for n sets), and one transition
 * per exercise boundary. Measurement and estimate share one decomposition — that consistency is
 * what makes the learned numbers mean anything.
 *
 * Without a profile the original static formula runs unchanged. structureLint's session-length
 * band and peakWeekFit deliberately stay on that path: they are programming RULES, not personal
 * predictions, and a per-user band would drift out from under its own thresholds.
 */
export function estimateSessionMinutes(
  exercises: SessionTimeExercise[],
  profile?: SessionTimingProfile,
): number {
  if (exercises.length === 0) return 0
  if (!profile) return staticEstimate(exercises)
  let seconds = profile.leadInSeconds
  for (const ex of exercises) {
    const sets = ex.workingSets + ex.warmupSets
    const cycle = ex.type === 'compound'
      ? profile.setCycleCompoundSeconds
      : profile.setCycleIsolationSeconds
    seconds += Math.max(0, sets - 1) * cycle
  }
  seconds += Math.max(0, exercises.length - 1) * profile.transitionSeconds
  return Math.round(seconds / 60)
}

/** The original static formula (Rounds ONCE on the total), moved here verbatim as the
 *  no-profile path — bit-identical to what every pre-Task-12 caller still gets. */
function staticEstimate(exercises: SessionTimeExercise[]): number {
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
