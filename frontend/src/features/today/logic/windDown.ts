/**
 * The single source of truth for the evening/night phase windows (spec D2/D8/D9,
 * 2026-07-24-sleep-night-layer-design.md). Everything is minute-of-day math, wrap-aware,
 * so a past-midnight bed (00:15) works: dim 22:45-23:15, winddown 23:15-00:15.
 * The circadian dark-theme window (D9) is exactly "any phase active" — one clock, no drift.
 */
export type WindDownPhase = 'none' | 'dim' | 'winddown' | 'night'
export interface AnchorTimes { bedTime: string; wakeTime: string }

export const DIM_LEAD_MIN = 90
export const WINDDOWN_LEAD_MIN = 60
export const MORNING_LEAD_MIN = 30

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const wrap = (m: number) => ((m % 1440) + 1440) % 1440
/** Half-open [start, end) containment on the circular 24h clock. */
const inWindow = (now: number, start: number, end: number) =>
  start <= end ? now >= start && now < end : now >= start || now < end

export function windDownPhase(now: Date, goal: AnchorTimes): WindDownPhase {
  const n = now.getHours() * 60 + now.getMinutes()
  const bed = toMin(goal.bedTime)
  const morningEnd = wrap(toMin(goal.wakeTime) - MORNING_LEAD_MIN)
  if (inWindow(n, wrap(bed - DIM_LEAD_MIN), wrap(bed - WINDDOWN_LEAD_MIN))) return 'dim'
  if (inWindow(n, wrap(bed - WINDDOWN_LEAD_MIN), bed)) return 'winddown'
  if (inWindow(n, bed, morningEnd)) return 'night'
  return 'none'
}

export function minsToBed(now: Date, bedTime: string): number {
  const n = now.getHours() * 60 + now.getMinutes()
  return wrap(toMin(bedTime) - n)
}

export function fmtMinsToBed(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h} ó ${m} p` : `${m} p`
}

export function isDarkWindow(now: Date, goal: AnchorTimes): boolean {
  return windDownPhase(now, goal) !== 'none'
}
