// Életvonal model — pure (no React). A 12-week weight curve (weekly averages), a sleep band,
// stations and a projection flag, built only from stored data.
// Honesty rules: fewer than two measured weeks → null (no curve, no invented point);
// stations come only from stored events (a whole-kg crossing of the weekly average toward the
// goal, a perk unlock); the projection is drawn only when the 4-week rate heads to the target.
// „First crossing" is judged against the WHOLE weight log, not only the window: a low that has
// aged out of the 12 weeks still counts, so re-crossing it is not announced as a first.
import type { Goal, SleepEntry, WeightEntry } from '@/data/types'
import { addDays, localDateString, mondayOf } from '@/shared/lib/dates'

export interface LifelinePoint { weekStart: string; avgKg: number }
export interface LifelineStation { index: number; kind: 'kg' | 'perk'; title: string; dateIso: string; caption: string }
export interface Lifeline {
  points: LifelinePoint[]            // oldest → newest, only weeks WITH a measurement
  deltaKg: number                    // last avg − first avg
  sleepHours: (number | null)[]      // one per point, weekly mean duration, null = no night logged
  stations: LifelineStation[]
  targetKg: number | null
  remainingKg: number | null         // |latest − target|, null without a target
  reached: boolean                   // latest average at or beyond the target in the goal's direction; false without a goal
  project: boolean                   // draw the dotted line only when the 4-week rate heads to the target
}

interface Input {
  weightLog: WeightEntry[]
  sleepLog: SleepEntry[]
  perks: { name: string; effectCopy: string; unlockedAt: string }[]
  goal: Pick<Goal, 'targetWeight'> | null
  weeklyRate4w: number
  todayIso: string
  weeks?: number
}

const round = (n: number, digits: number): number => +n.toFixed(digits)
const mean = (xs: number[]): number => xs.reduce((a, x) => a + x, 0) / xs.length

function bucketByWeek<T>(items: T[], dateOf: (t: T) => string, from: string, to: string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const it of items) {
    const wk = mondayOf(dateOf(it))
    if (wk < from || wk > to) continue
    const list = map.get(wk)
    if (list) list.push(it)
    else map.set(wk, [it])
  }
  return map
}

export function buildLifeline(input: Input): Lifeline | null {
  const { weightLog, sleepLog, perks, goal, weeklyRate4w, todayIso } = input
  const from = mondayOf(addDays(todayIso, -((input.weeks ?? 12) - 1) * 7))
  const to = mondayOf(todayIso)

  const weightWeeks = bucketByWeek(weightLog, (e) => e.date, from, to)
  const points: LifelinePoint[] = [...weightWeeks.keys()].sort().map((weekStart) => {
    return { weekStart, avgKg: round(mean(weightWeeks.get(weekStart)!.map((e) => e.value)), 2) }
  })
  if (points.length < 2) return null

  const latest = points[points.length - 1].avgKg
  const deltaKg = round(latest - points[0].avgKg, 2)

  const sleepWeeks = bucketByWeek(sleepLog, (e) => e.date, from, to)
  const sleepHours = points.map((p) => {
    const nights = sleepWeeks.get(p.weekStart)
    return nights?.length ? round(mean(nights.map((n) => n.duration)), 1) : null
  })

  const stations: LifelineStation[] = []
  const targetKg = goal?.targetWeight ?? null
  let reached = false
  if (targetKg != null) {
    // Weekly averages BEFORE the window (oldest first) — history the curve no longer draws.
    const earlierWeeks = new Map<string, number[]>()
    for (const e of weightLog) {
      const wk = mondayOf(e.date)
      if (wk >= from) continue
      const list = earlierWeeks.get(wk)
      if (list) list.push(e.value)
      else earlierWeeks.set(wk, [e.value])
    }
    const earlier = [...earlierWeeks.keys()].sort().map((wk) => round(mean(earlierWeeks.get(wk)!), 2))
    // Direction: target below the earliest known weekly average ⇒ down (the earliest in the whole
    // log, so a target passed before the window does not flip it). Stations beyond the target
    // are still shown.
    const down = targetKg < (earlier.length > 0 ? earlier[0] : points[0].avgKg)
    reached = down ? latest <= targetKg : latest >= targetKg
    // Running best (min for down, max for up): a station fires on the FIRST crossing only. It is
    // seeded from every pre-window week; without one, from the window's first point (which then
    // has nothing to be compared against, so it cannot be a station itself).
    let best = earlier.length > 0 ? (down ? Math.min(...earlier) : Math.max(...earlier)) : points[0].avgKg
    for (let i = earlier.length > 0 ? 0 : 1; i < points.length; i++) {
      const cur = points[i].avgKg
      // One station per crossing event, naming the furthest boundary passed toward the goal.
      const n = down
        ? Math.floor(cur) < Math.floor(best) ? Math.floor(cur) + 1 : null
        : Math.ceil(cur) > Math.ceil(best) ? Math.ceil(cur) - 1 : null
      best = down ? Math.min(best, cur) : Math.max(best, cur)
      if (n == null) continue
      stations.push({
        index: i, kind: 'kg',
        title: `${n} kg ${down ? 'alatt' : 'fölött'}`,
        dateIso: points[i].weekStart,
        caption: `Először ment a heti átlagod ${n} kg ${down ? 'alá' : 'fölé'}.`,
      })
    }
  }
  for (const perk of perks) {
    const dateIso = localDateString(new Date(perk.unlockedAt)) // UTC instant → local calendar day
    const index = points.findIndex((p) => p.weekStart === mondayOf(dateIso))
    if (index < 0) continue
    stations.push({ index, kind: 'perk', title: `Új képesség: ${perk.name}`, dateIso, caption: perk.effectCopy })
  }
  stations.sort((a, b) => a.index - b.index)

  return {
    points, deltaKg, sleepHours, stations, targetKg,
    remainingKg: targetKg != null ? Math.abs(latest - targetKg) : null,
    reached,
    project: targetKg != null && weeklyRate4w !== 0 && Math.sign(weeklyRate4w) === Math.sign(targetKg - latest),
  }
}
