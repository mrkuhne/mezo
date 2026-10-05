// Életvonal model — pure (no React). A 12-week weight curve (weekly averages), a sleep band,
// stations and a projection flag, built only from stored data.
// Honesty rules: fewer than two measured weeks → null (no curve, no invented point);
// stations come only from stored events (a whole-kg crossing of the weekly average toward the
// goal, a perk unlock); the projection is drawn only when the 4-week rate heads to the target.
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
  if (targetKg != null) {
    // Direction: target below the first average ⇒ down. Stations beyond the target are still shown.
    const down = targetKg < points[0].avgKg
    // Running best (min for down, max for up): a station fires on the FIRST crossing only.
    let best = points[0].avgKg
    for (let i = 1; i < points.length; i++) {
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
    project: targetKg != null && weeklyRate4w !== 0 && Math.sign(weeklyRate4w) === Math.sign(targetKg - latest),
  }
}
