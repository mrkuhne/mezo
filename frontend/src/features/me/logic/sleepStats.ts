import type { SleepEntry, SleepGoal } from '@/data/types'

/** FE display config for the two scores (backend has no consumer — spec §5: scores are FE-pure). */
export const REGULARITY_WINDOW_DAYS = 14
export const EFFICIENCY_TARGET_PCT = 85

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** Shortest circular distance between two HH:mm points on the 24h clock (0..720). */
function circularDiffMin(a: string, b: string): number {
  const d = Math.abs(toMin(a) - toMin(b))
  return Math.min(d, 1440 - d)
}

/** Signed circular delta actual−target in minutes (−720..+720; late = positive). */
function signedDeltaMin(actual: string, target: string): number {
  let d = toMin(actual) - toMin(target)
  if (d > 720) d -= 1440
  if (d < -720) d += 1440
  return d
}

const isoMinusDays = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d - days))
  return date.toISOString().slice(0, 10)
}

/**
 * Fraction of the last-N nights whose bedtime AND wakeup fall within ±band of the goal's derived
 * targets (Walker's regularity lever, spec D2). Window anchors to the LATEST log date, not "today" —
 * pure and mock-seed safe. Nights without both ends are unscorable and skipped. Null when nothing scores.
 */
export function regularityScore(logs: SleepEntry[], goal: SleepGoal, windowDays: number): number | null {
  if (logs.length === 0) return null
  const latest = logs.reduce((max, e) => (e.date > max ? e.date : max), logs[0].date)
  const from = isoMinusDays(latest, windowDays - 1)
  const scorable = logs.filter((e) => e.date >= from && e.bedtime && e.wakeup)
  if (scorable.length === 0) return null
  const inBand = scorable.filter(
    (e) =>
      circularDiffMin(e.bedtime, goal.bedTime) <= goal.regularityBandMin &&
      circularDiffMin(e.wakeup, goal.wakeTime) <= goal.regularityBandMin,
  )
  return inBand.length / scorable.length
}

/**
 * Sleep efficiency in percent: asleep ÷ in-bed (spec D6). Prefers the tracker's inBedMin;
 * falls back to the bedtime→wakeup span (midnight-wrapped). Capped at 100; null without a span.
 */
export function efficiencyPct(entry: SleepEntry): number | null {
  const asleepMin = entry.duration * 60
  const inBed = entry.inBedMin ?? (entry.bedtime && entry.wakeup
    ? ((toMin(entry.wakeup) - toMin(entry.bedtime) + 1440) % 1440) || null
    : null)
  if (!inBed) return null
  return Math.min(100, (asleepMin / inBed) * 100)
}

/** Signed minutes the night's bedtime missed the goal's target bed by (late = positive). */
export function bedDeltaMin(entry: SleepEntry, goal: SleepGoal): number | null {
  if (!entry.bedtime) return null
  return signedDeltaMin(entry.bedtime, goal.bedTime)
}
