import type { RunningBlockResponse, RunPrescribedSession, RunWeek } from '@/data/train/runningApi'
import { addDays, localDateString } from '@/shared/lib/dates'

/** The active block's current-week RunWeek, or null. */
export function currentWeekOf(block: RunningBlockResponse | null): RunWeek | null {
  if (!block) return null
  return block.structure.weeks.find((w) => w.weekNumber === block.currentWeek) ?? null
}
/** Prescribed running sessions for one weekday index (0=Hét..6=Vas) in the active block's current week. */
export function runSessionsForDay(block: RunningBlockResponse | null, dayIdx: number): RunPrescribedSession[] {
  const w = currentWeekOf(block)
  return w ? w.sessions.filter((s) => s.dayOfWeek === dayIdx) : []
}
/** Today's weekday index, Monday=0 (matches DAY_ORDER). */
export function todayIdx(now = new Date()): number {
  return (now.getDay() + 6) % 7
}

/**
 * The real calendar date (local ISO) of a weekday index (0=Hét..6=Vas) within
 * the CURRENT Monday-start week — used to log a prescribed session against
 * its actual day even when the CTA is retroactive ("Pótold"). Prescribed
 * sessions only carry a weekday, not a date (they repeat every week of the
 * block), so "today's Tuesday" is the honest date to attach to a log — not
 * the block's arbitrary startDate.
 */
export function dateForDayOfWeek(dayOfWeek: number, now = new Date()): string {
  const today = localDateString(now)
  const monday = addDays(today, -todayIdx(now))
  return addDays(monday, dayOfWeek)
}
