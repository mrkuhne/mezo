// ============================================================
// Mezo · mesoWeekDone — what the CURRENT week actually held, keyed by weekday
// (mezo-me75u.5, U5). The Terv tab's week list used to draw the plan only, so
// every day card read identically whether you had already trained or not. The
// owner's approved U5 card separates „megvolt · ma · jön", and a done day must
// show what HAPPENED, never the plan's numbers under a „Megvolt" stamp.
//
// Source: the week's completed instances (`useWeekMuscleLog().details`) — the
// same cached reads the Terhelés tab already makes, so the two surfaces can
// never disagree and the second visit costs nothing.
//
// HONESTY — what this does NOT report. A record count is deliberately absent:
// „records set in this session" exists nowhere on `WorkoutDetailResponse`; the
// frozen meso report owns `records`, and `/api/train/exercise-records` is an
// all-time per-exercise aggregate. Deriving „was this a record" here would mean
// fetching that aggregate and re-running the comparison the backend already owns
// — so the day card states sets, minutes and exercises, the three things the
// instance itself carries (the MesoFutamokPage rule: a number we cannot read is
// left out, not guessed).
// ============================================================
import { actualMinutes } from '@/features/train/logic/actualDuration'
import type { WorkoutDetailResponse } from '@/data/train/trainApi'

export type DayDone = {
  /** Logged working sets — `exercises[].sets` is already "non-skipped logged sets". */
  sets: number
  /** Measured minutes (actualDuration's honest clock), or null when nothing usable was timed. */
  minutes: number | null
  /** Exercises that actually carry a logged set; a skipped one is not "worked". */
  exercises: number
}

/**
 * Completed instances of the week, aggregated per `dayLabel` ('Hét'…'Vas').
 *
 * Aggregation is by WEEKDAY, not by template session: a day that held both its
 * meso session and a custom workout reports their sum, which is what „mi volt
 * ezen a napon" means to the reader. Minutes sum only over the sessions that
 * could be timed; a week with none reports null rather than 0.
 */
export function doneByDay(details: WorkoutDetailResponse[]): Map<string, DayDone> {
  const byDay = new Map<string, DayDone>()
  for (const d of details) {
    if (d.status !== 'completed') continue
    const sets = d.exercises.reduce((n, e) => n + e.sets.length, 0)
    const exercises = d.exercises.filter((e) => e.sets.length > 0).length
    const minutes = actualMinutes(d)
    const prev = byDay.get(d.dayLabel)
    byDay.set(d.dayLabel, prev
      ? {
          sets: prev.sets + sets,
          exercises: prev.exercises + exercises,
          minutes: prev.minutes == null && minutes == null ? null : (prev.minutes ?? 0) + (minutes ?? 0),
        }
      : { sets, minutes, exercises })
  }
  return byDay
}
