import type { RunningBlockResponse, RunPrescribedSession, RunWeek } from '@/lib/runningApi'

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
