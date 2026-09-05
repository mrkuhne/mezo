// Fuel P4 — dual-mode weekly plan (Terv) hook.
//
// MOCK: byte-parity with the Phase-1 seeds (`fuelWeek.ts` + `today.ts` volleyball).
// REAL: composes the LIVE week — gym days from Train's derived schedule (meso WHAT × slot WHEN),
//   volleyball from Train's sport schedule, the cycle strip from the medication cycle, and the
//   weekly stats from the 7-day rollup (`GET /api/fuel/week/{start}`). Surfaces with no real
//   source yet return honest-empty (`patterns`/`weeklySupplements` []) or null (`weeklyNote`,
//   `supplementsAdherence`) — never the seed (the `useReplanScenarios` precedent).
//   Design: docs/superpowers/specs/2026-07-04-fuel-p4-weekly-plan-design.md.
//
// React rules of hooks: every hook below is called UNCONDITIONALLY in both modes; only the
// returned value branches on `isMockMode()` (the P5 timelineHooks idiom).

import { useQuery } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { addDays, localDateString, huMonthDay } from '@/shared/lib/dates'
import { mealApi, type FuelWeekDay } from '@/data/fuel/mealApi'
import {
  weekTitle as mockWeekTitle,
  weeklyNote as mockWeeklyNote,
  medCycleWeek as mockMedCycleWeek,
  gymSchedule as mockGymSchedule,
  weeklySupplements as mockWeeklySupplements,
  recurringPatterns as mockPatterns,
  weeklyStats as mockWeeklyStats,
} from '@/data/fuel/fuelWeek'
import { volleyballSessions as mockVolleyball } from '@/data/today/today'
import { DEFAULT_BLOCK_MIN } from '@/data/fuel/fuelConfig'
import { useTrain } from '@/data/train/trainHooks'
import { useMedication } from '@/data/fuel/medicationHooks'
import { DAY_ORDER } from '@/data/train/train'
import { isSportSlotSkipped, type SportSlotSkip } from '@/features/train/logic/weekAgenda'
import type {
  GymScheduleDay,
  MedicationCycleCell,
  RecurringPattern,
  MedCycleDayCell,
  MedCyclePhase,
  VolleyballSession,
  WeeklyStats,
  WeeklySupplementRow,
} from '@/data/types'

export interface FuelWeekView {
  /** Header title — mock keeps the demo week label, real derives the current Monday-based week. */
  title: string
  medCycleWeek: MedCycleDayCell[]
  gymSchedule: GymScheduleDay[]
  weeklySupplements: WeeklySupplementRow[]
  patterns: RecurringPattern[]
  weeklyStats: WeeklyStats
  volleyball: VolleyballSession[]
  /** Stats-card coach prose — mock seed string; real null (proactive-epic surface). */
  weeklyNote: string | null
}

/** Monday (DAY_ORDER week start) of the week containing `d`, as a local YYYY-MM-DD. */
export function mondayIso(d: Date = new Date()): string {
  const shift = (d.getDay() + 6) % 7
  return localDateString(new Date(d.getFullYear(), d.getMonth(), d.getDate() - shift))
}

/** 'Máj 18 – 24' / cross-month 'Jún 29 – Júl 5' for the week starting at `startIso`. */
export function deriveWeekTitle(startIso: string): string {
  const [y, m, d] = startIso.split('-').map(Number)
  const end = new Date(y, m - 1, d + 6)
  const endLabel = end.getMonth() === m - 1 ? String(end.getDate()) : huMonthDay(localDateString(end))
  return `${huMonthDay(startIso)} – ${endLabel}`
}

const PHASE_LABEL: Record<string, MedCyclePhase> = { peak: 'Peak', stable: 'Stable', trough: 'Trough' }

/** Medication cycle week → the cycle strip cells; empty (no dose → ghost cycle) stays empty. */
export function toMedCycleCells(week: MedicationCycleCell[]): MedCycleDayCell[] {
  return week.map((c) => ({
    d: c.day,
    label: PHASE_LABEL[c.phaseKey] ?? 'Stable',
    color: `var(--medcycle-d${c.day})`,
  }))
}

/** Train's derived gym day → grid-renderable: active timed days get the planner's default
 *  block width (duration has no DB home — presentational default, same as the Mai timeline). */
export function withDefaultDuration(d: GymScheduleDay): GymScheduleDay {
  return d.active && d.time && d.duration == null ? { ...d, duration: DEFAULT_BLOCK_MIN } : d
}

/** Drops any recurring sport-slot occurrence `skips` hides (mezo-cq06) — mirrors
 *  `buildWeekAgenda`'s identity match (weekday index + time + ISO date), but this grid renders
 *  the RAW weekly session list (each session carries a `day` label, not an already-resolved
 *  weekday index), and a one-off event pins its own `date` rather than deriving one from
 *  `start` + weekday, so both cases are handled the same way weekAgenda's own filter does. */
export function filterSkippedSessions(
  sessions: VolleyballSession[],
  skips: SportSlotSkip[],
  start: string,
): VolleyballSession[] {
  return sessions.filter((s) => {
    const dayOfWeek = DAY_ORDER.indexOf(s.day as (typeof DAY_ORDER)[number])
    const date = s.date ?? addDays(start, dayOfWeek)
    return !isSportSlotSkipped(skips, dayOfWeek, s.time, date)
  })
}

/** Weekly stats from the 7-day rollup: kcal avg over days with any logged kcal; protein-hit =
 *  days meeting the protein target; adherence stays null (honest `—`) until P8. */
export function deriveWeeklyStats(days: FuelWeekDay[]): WeeklyStats {
  const kcalTarget = days[0]?.targets.kcal ?? 0
  const logged = days.filter((d) => d.consumed.kcal > 0)
  const kcalAvg = logged.length ? logged.reduce((a, d) => a + d.consumed.kcal, 0) / logged.length : 0
  return {
    kcalTarget,
    kcalAvgFactor: kcalTarget > 0 ? kcalAvg / kcalTarget : 0,
    proteinHitDays: days.filter((d) => d.targets.p > 0 && d.consumed.p >= d.targets.p).length,
    supplementsAdherence: null,
  }
}

export function useFuelWeek(): FuelWeekView {
  const mock = isMockMode()
  const { gymSchedule: trainGym, sport, sportSlotSkips } = useTrain()
  const { cycle } = useMedication()
  const start = mondayIso()
  const { data: week } = useQuery({
    queryKey: ['fuelWeek', start],
    queryFn: mock ? async () => null : () => mealApi.getWeek(start),
    initialData: mock ? null : undefined,
    staleTime: mock ? Infinity : 0,
  })

  if (mock) {
    return {
      title: mockWeekTitle,
      medCycleWeek: mockMedCycleWeek,
      gymSchedule: mockGymSchedule,
      weeklySupplements: mockWeeklySupplements,
      patterns: mockPatterns,
      weeklyStats: mockWeeklyStats,
      volleyball: mockVolleyball,
      weeklyNote: mockWeeklyNote,
    }
  }
  return {
    title: deriveWeekTitle(start),
    medCycleWeek: toMedCycleCells(cycle.week),
    gymSchedule: (trainGym?.weeklyTimes ?? []).map(withDefaultDuration),
    weeklySupplements: [],
    patterns: [],
    weeklyStats: deriveWeeklyStats(week?.days ?? []),
    volleyball: filterSkippedSessions(sport.schedule?.volleyball.sessions ?? [], sportSlotSkips, start),
    weeklyNote: null,
  }
}
