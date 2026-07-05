// D' (mezo-t16y.1) — dual-mode Insights Weekly review.
//
// MOCK: byte-parity with the Phase-1 seed (`insights.ts` weekly + weeklySuggestion).
// REAL: deterministic composition over the user's own reads — fuel 7-day rollups (×2 weeks,
//   the F-P4 aggregate), sleep log, weight EWMA, gym/sport schedules and logged sessions
//   (`GET /api/train/workouts` + sport-sessions). Score is a DOCUMENTED formula (constants
//   below), gated to the honest „tanulom" null-state when no sub-score has data — never a
//   fabricated number. Design: docs/superpowers/specs/2026-07-05-insights-weekly-honest-design.md.

import { useQuery } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { mealApi } from '@/data/fuel/mealApi'
import { mondayIso, deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import { trainApi } from '@/data/train/trainApi'
import { useSleep } from '@/data/me/sleepHooks'
import { useWeight } from '@/data/me/weightHooks'
import { weekly as mockWeekly, weeklySuggestion as mockWeeklySuggestion } from '@/data/insights/insights'
import type { FuelWeekDay } from '@/data/fuel/mealApi'
import type { SleepEntry, WeeklyItem, WeeklyTrend } from '@/data/types'

/** Documented score constants (FE v0 — promote to backend config with the proactive epic). */
export const SLEEP_TARGET_H = 8
export const KCAL_BAND = 0.25
export const WEIGHT_RATE_EPSILON = 0.1

export function prevMondayIso(start: string): string {
  const [y, m, d] = start.split('-').map(Number)
  const prev = new Date(y, m - 1, d - 7)
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`
}

export function weekEndIso(start: string): string {
  const [y, m, d] = start.split('-').map(Number)
  const end = new Date(y, m - 1, d + 6)
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
}

/** ISO-8601 week number of the given date (used for the real-mode 'Hét N' title). */
export function isoWeekNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

/** ISO date within the Monday-based week starting at `start` (string compare — ISO sorts). */
export function inWeek(dateIso: string, start: string): boolean {
  return dateIso >= start && dateIso <= weekEndIso(start)
}

export interface WeekMetrics {
  kcalFactor: number | null
  proteinHitDays: number | null
  sleepAvgH: number | null
  sleepQualityAvg: number | null
  trainDone: number | null
  trainPlanned: number | null
}

export function deriveWeekMetrics(slice: {
  fuelDays: FuelWeekDay[]
  sleepEntries: SleepEntry[]
  trainDone: number | null
  trainPlanned: number | null
}): WeekMetrics {
  const logged = slice.fuelDays.filter((d) => d.consumed.kcal > 0)
  const kcalTarget = slice.fuelDays[0]?.targets.kcal ?? 0
  const kcalFactor = logged.length && kcalTarget > 0
    ? logged.reduce((a, d) => a + d.consumed.kcal, 0) / logged.length / kcalTarget
    : null
  const proteinHitDays = logged.length
    ? slice.fuelDays.filter((d) => d.targets.p > 0 && d.consumed.p >= d.targets.p).length
    : null
  const s = slice.sleepEntries
  return {
    kcalFactor,
    proteinHitDays,
    sleepAvgH: s.length ? s.reduce((a, e) => a + e.duration, 0) / s.length : null,
    sleepQualityAvg: s.length ? s.reduce((a, e) => a + e.quality, 0) / s.length : null,
    trainDone: slice.trainDone,
    trainPlanned: slice.trainPlanned,
  }
}

/** Higher-is-better comparison → arrow; missing data or a within-epsilon tie is honest 'flat'. */
export function trendOf(cur: number | null, prev: number | null, epsilon = 0): WeeklyTrend {
  if (cur == null || prev == null) return 'flat'
  const diff = cur - prev
  if (Math.abs(diff) <= epsilon) return 'flat'
  return diff > 0 ? 'up' : 'down'
}

/** Goal-ward arrow for the EWMA weekly rate (single-user cut: losing = good = 'up'). */
export function weightTrendOf(rate: number | null): WeeklyTrend {
  if (rate == null) return 'flat'
  if (rate <= -WEIGHT_RATE_EPSILON) return 'up'
  if (rate >= WEIGHT_RATE_EPSILON) return 'down'
  return 'flat'
}

export function deriveItems(cur: WeekMetrics, prev: WeekMetrics, weightRateKgPerWeek: number | null): WeeklyItem[] {
  const closeness = (f: number | null) => (f == null ? null : -Math.abs(f - 1))
  return [
    {
      label: 'Edzés',
      value: cur.trainDone != null && cur.trainPlanned != null && (cur.trainPlanned > 0 || cur.trainDone > 0)
        ? `${cur.trainDone}/${cur.trainPlanned}` : '—',
      trend: trendOf(cur.trainDone, prev.trainDone),
    },
    {
      label: 'Alvás átlag',
      value: cur.sleepAvgH != null && cur.sleepQualityAvg != null
        ? `${cur.sleepAvgH.toFixed(1)}h · minőség ${cur.sleepQualityAvg.toFixed(1)}` : '—',
      trend: trendOf(cur.sleepAvgH, prev.sleepAvgH, 0.1),
    },
    {
      label: 'Kcal pacing',
      value: cur.kcalFactor != null ? `${Math.round(cur.kcalFactor * 100)}% target` : '—',
      trend: trendOf(closeness(cur.kcalFactor), closeness(prev.kcalFactor), 0.02),
    },
    {
      label: 'Fehérje-napok',
      value: cur.proteinHitDays != null ? `${cur.proteinHitDays}/7` : '—',
      trend: trendOf(cur.proteinHitDays, prev.proteinHitDays),
    },
    {
      label: 'Súly trend',
      value: weightRateKgPerWeek != null
        ? `${weightRateKgPerWeek > 0 ? '+' : ''}${weightRateKgPerWeek.toFixed(2)} kg/hét` : '—',
      trend: weightTrendOf(weightRateKgPerWeek),
    },
  ]
}

/**
 * score = round(100 × mean(available sub-scores)); weight is EXCLUDED (goal-direction-dependent).
 * kcal: closeness to target inside a ±KCAL_BAND linear band · protein: hit-days/7 ·
 * sleep: avg/SLEEP_TARGET_H capped · train: done/planned capped (skipped when planned=0).
 * No sub-score has data → null → the page renders the „tanulom" null-state.
 */
export function deriveScore(m: WeekMetrics): number | null {
  const subs: number[] = []
  if (m.kcalFactor != null) subs.push(Math.max(0, 1 - Math.abs(m.kcalFactor - 1) / KCAL_BAND))
  if (m.proteinHitDays != null) subs.push(m.proteinHitDays / 7)
  if (m.sleepAvgH != null) subs.push(Math.min(1, m.sleepAvgH / SLEEP_TARGET_H))
  if (m.trainDone != null && m.trainPlanned != null && m.trainPlanned > 0) subs.push(Math.min(1, m.trainDone / m.trainPlanned))
  if (!subs.length) return null
  return Math.round((subs.reduce((a, b) => a + b, 0) / subs.length) * 100)
}

export interface WeeklyView {
  weekly: { title: string; score: number | null; delta: number | null; items: WeeklyItem[] }
  deltaLabel: string
  /** Mock: the seed prose. Real: null — the card renders the honest placeholder (proactive epic). */
  weeklySuggestion: string | null
  mode: 'mock' | 'live'
}

/** Inert-in-mock query helper (the fuelWeekHooks idiom): real fetches, mock resolves null. */
function useRealQuery<T>(key: readonly unknown[], fetcher: () => Promise<T>) {
  const mock = isMockMode()
  return useQuery({
    queryKey: key,
    queryFn: mock ? async () => null : fetcher,
    initialData: mock ? null : undefined,
    staleTime: mock ? Infinity : 0,
  })
}

export function useWeekly(): WeeklyView {
  const mock = isMockMode()
  const start = mondayIso()
  const prevStart = prevMondayIso(start)

  // Fuel rollups share the F-P4 cache key/shape (['fuelWeek', start] ⇒ FuelWeekData).
  const { data: curFuel } = useRealQuery(['fuelWeek', start], () => mealApi.getWeek(start))
  const { data: prevFuel } = useRealQuery(['fuelWeek', prevStart], () => mealApi.getWeek(prevStart))
  // Raw train reads under an own namespace — trainHooks' keys cache MAPPED domain shapes,
  // sharing them would collide (key consolidation: mezo-ah18.10).
  const { data: curWorkouts } = useRealQuery(['insightsWeekly', 'workouts', start], () => trainApi.listWorkouts(start, weekEndIso(start)))
  const { data: prevWorkouts } = useRealQuery(['insightsWeekly', 'workouts', prevStart], () => trainApi.listWorkouts(prevStart, weekEndIso(prevStart)))
  const { data: sportSessions } = useRealQuery(['insightsWeekly', 'sportSessions'], () => trainApi.sportSessions())
  const { data: gymSlots } = useRealQuery(['insightsWeekly', 'gymSchedule'], () => trainApi.gymSchedule())
  const { data: sportSlots } = useRealQuery(['insightsWeekly', 'sportSchedule'], () => trainApi.sportSchedule())
  const { sleepLog } = useSleep()
  const { weightTrends } = useWeight()

  if (mock) {
    return { weekly: mockWeekly, deltaLabel: 'vs hét 20', weeklySuggestion: mockWeeklySuggestion, mode: 'mock' }
  }

  const planned = gymSlots != null && sportSlots != null ? gymSlots.length + sportSlots.length : null
  // Distinct gym-workout DAYS (matches weekDoneDates semantics — two instances on one
  // calendar day count once) + sport sessions logged inside the week.
  const doneOf = (workouts: { date: string }[] | null | undefined, weekStart: string) =>
    workouts == null || sportSessions == null
      ? null
      : new Set(workouts.map((w) => w.date)).size + sportSessions.filter((s) => inWeek(s.date, weekStart)).length

  const cur = deriveWeekMetrics({
    fuelDays: curFuel?.days ?? [],
    sleepEntries: sleepLog.filter((e) => inWeek(e.date, start)),
    trainDone: doneOf(curWorkouts, start),
    trainPlanned: planned,
  })
  const prev = deriveWeekMetrics({
    fuelDays: prevFuel?.days ?? [],
    sleepEntries: sleepLog.filter((e) => inWeek(e.date, prevStart)),
    trainDone: doneOf(prevWorkouts, prevStart),
    trainPlanned: planned,
  })
  // Real-mode EWMA rate; the useWeight ZERO_TRENDS load-window fallback renders a benign 0.00.
  const weightRate = weightTrends.last7d.weeklyRate
  const score = deriveScore(cur)
  const prevScore = deriveScore(prev)

  return {
    weekly: {
      title: `Hét ${isoWeekNumber(start)} áttekintés · ${deriveWeekTitle(start)}`,
      score,
      delta: score != null && prevScore != null ? score - prevScore : null,
      items: deriveItems(cur, prev, weightRate),
    },
    deltaLabel: 'vs előző hét',
    weeklySuggestion: null,
    mode: 'live',
  }
}
