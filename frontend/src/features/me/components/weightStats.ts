import type { WeightEntry, GoalKind } from '@/data/types'
import type { GoalResponse } from '@/data/me/goalApi'
import { localDateString } from '@/shared/lib/dates'

export type Period = '7d' | '30d' | '90d' | '1y'
export type WeekDir = 'down' | 'up' | 'flat'

export interface WeekAggregate {
  startIso: string
  endIso: string
  entries: WeightEntry[]
  avg: number
  low: number
  count: number
  delta: number | null   // avg − previous week's avg
  direction: WeekDir     // sign(lastEntry − firstEntry) within the week
  sparkPoints: number[]
}
export interface DayRow { iso: string; value: number; dod: number | null }
export interface PlanTrajectory { plan: { iso: string; kg: number }[]; tolKg: number }

export const TOLERANCE_KG = 1.0
const MA_WINDOW = 3
const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }

const parseIso = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const isoMinusDays = (iso: string, days: number): string => {
  const d = parseIso(iso)
  d.setDate(d.getDate() - days)
  return localDateString(d)
}
export const daysBetween = (aIso: string, bIso: string): number =>
  Math.round((parseIso(bIso).getTime() - parseIso(aIso).getTime()) / 86_400_000)

export const latestValue = (log: WeightEntry[]): number | null =>
  log.length ? log[log.length - 1].value : null

export function changeFromStart(log: WeightEntry[], startWeight: number | null): number | null {
  const latest = latestValue(log)
  if (latest === null) return null
  const start = startWeight ?? log[0].value
  return +(latest - start).toFixed(1) // signed; negative = lost
}

export function progressPct(start: number, latest: number, target: number | null): number | null {
  if (target === null || start === target) return null
  const pct = target < start
    ? ((start - latest) / (start - target)) * 100   // cut
    : ((latest - start) / (target - start)) * 100   // bulk
  return Math.round(Math.max(0, Math.min(100, pct)))
}

export function etaWeeks(latest: number, target: number | null, weeklyRate: number): number | null {
  if (target === null || weeklyRate === 0) return null
  const weeks = (target - latest) / weeklyRate
  if (!isFinite(weeks) || weeks <= 0) return null
  return Math.max(1, Math.round(weeks))
}

export const isImprovement = (delta: number, goalKind?: GoalKind): boolean =>
  goalKind === 'bulk' ? delta > 0 : delta < 0

export const fmtSigned = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}`

export function movingAverage(values: number[], win = MA_WINDOW): number[] {
  return values.map((_, i) => {
    const s = values.slice(Math.max(0, i - win + 1), i + 1)
    return s.reduce((a, x) => a + x, 0) / s.length
  })
}

export function periodWindow(log: WeightEntry[], period: Period): { startIso: string; endIso: string } | null {
  if (!log.length) return null
  const endIso = log[log.length - 1].date
  return { startIso: isoMinusDays(endIso, PERIOD_DAYS[period] - 1), endIso }
}
export function sliceByPeriod(log: WeightEntry[], period: Period): WeightEntry[] {
  const w = periodWindow(log, period)
  return w ? log.filter(e => e.date >= w.startIso && e.date <= w.endIso) : []
}

const mondayOf = (iso: string): string => {
  const d = parseIso(iso)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return localDateString(d)
}

export function groupByWeek(log: WeightEntry[]): WeekAggregate[] {
  const byWeek = new Map<string, WeightEntry[]>()
  for (const e of log) {
    const k = mondayOf(e.date)
    const arr = byWeek.get(k) ?? []
    arr.push(e)
    byWeek.set(k, arr)
  }
  const asc = [...byWeek.keys()].sort().map((startIso): WeekAggregate => {
    const entries = byWeek.get(startIso)!
    const values = entries.map(e => e.value)
    // avg & delta are stored at FULL precision (no rounding) so test assertions use
    // toBeCloseTo and the components round for display (avg → toFixed(1), delta → fmtSigned).
    const avg = values.reduce((a, x) => a + x, 0) / values.length
    const diff = values[values.length - 1] - values[0]
    const direction: WeekDir = Math.abs(diff) < 0.05 ? 'flat' : diff < 0 ? 'down' : 'up'
    return { startIso, endIso: isoMinusDays(startIso, -6), entries, avg, low: Math.min(...values), count: entries.length, direction, sparkPoints: values, delta: null }
  })
  for (let i = 1; i < asc.length; i++) asc[i].delta = asc[i].avg - asc[i - 1].avg
  return asc.reverse()
}

export function dayRows(log: WeightEntry[], week: WeekAggregate): DayRow[] {
  const rows: DayRow[] = []
  for (let i = 0; i < log.length; i++) {
    const e = log[i]
    if (e.date >= week.startIso && e.date <= week.endIso) {
      rows.push({ iso: e.date, value: e.value, dod: i > 0 ? +(e.value - log[i - 1].value).toFixed(1) : null })
    }
  }
  return rows.reverse()
}

export function planTrajectory(goalResponse: GoalResponse | null, windowStartIso: string, windowEndIso: string): PlanTrajectory | null {
  if (!goalResponse || goalResponse.targetWeightKg == null) return null
  const { startDate: sIso, targetDate: tIso } = goalResponse
  const sKg = Number(goalResponse.startWeightKg)
  const tKg = Number(goalResponse.targetWeightKg)
  const span = daysBetween(sIso, tIso)
  const kgAt = (iso: string): number => {
    if (span <= 0) return tKg
    const f = Math.max(0, Math.min(1, daysBetween(sIso, iso) / span))
    return +(sKg + f * (tKg - sKg)).toFixed(2)
  }
  const isos = [windowStartIso, windowEndIso]
  if (sIso > windowStartIso && sIso < windowEndIso) isos.push(sIso)
  if (tIso > windowStartIso && tIso < windowEndIso) isos.push(tIso)
  const uniq = [...new Set(isos)].sort()
  return { plan: uniq.map(iso => ({ iso, kg: kgAt(iso) })), tolKg: TOLERANCE_KG }
}
