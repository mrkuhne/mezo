// Fuel P4 — dual-mode weekly plan (Terv) hook.
//
// MOCK: byte-parity with the Phase-1 seeds (`fuelWeek.ts` + `today.ts` volleyball).
// REAL: composes the LIVE week — gym days from Train's derived schedule (meso WHAT × slot WHEN),
//   volleyball from Train's sport schedule, the Reta strip from the medication cycle, and the
//   weekly stats from the 7-day rollup (`GET /api/fuel/week/{start}`). Surfaces with no real
//   source yet return honest-empty (`patterns`/`weeklySupplements` []) or null (`weeklyNote`,
//   `supplementsAdherence`) — never the seed (the `useStackRecommendations` precedent).
//   Design: docs/superpowers/specs/2026-07-04-fuel-p4-weekly-plan-design.md.
//
// React rules of hooks: every hook below is called UNCONDITIONALLY in both modes; only the
// returned value branches on `isMockMode()` (the P5 timelineHooks idiom).

import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { localDateString, huMonthDay } from '@/shared/lib/dates'
import { mealApi, type FuelWeekDay } from '@/data/fuel/mealApi'
import {
  weekTitle as mockWeekTitle,
  weeklyNote as mockWeeklyNote,
  retaWeek as mockRetaWeek,
  gymSchedule as mockGymSchedule,
  weeklySupplements as mockWeeklySupplements,
  recurringPatterns as mockPatterns,
  weeklyStats as mockWeeklyStats,
} from '@/data/fuel/fuelWeek'
import { volleyballSessions as mockVolleyball } from '@/data/today/today'
import { DEFAULT_BLOCK_MIN } from '@/data/fuel/fuelConfig'
import { DAY_ORDER } from '@/data/train/train'
import { useTrain } from '@/data/train/trainHooks'
import { useMedication } from '@/data/fuel/medicationHooks'
import type { GymScheduleSlotInput } from '@/data/train/trainApi'
import type {
  GymScheduleDay,
  MedicationCycleCell,
  RecurringPattern,
  RetaDayCell,
  RetaPhase,
  VolleyballSession,
  WeeklyStats,
  WeeklySupplementRow,
} from '@/data/types'

export interface FuelWeekView {
  /** Header title — mock keeps the demo week label, real derives the current Monday-based week. */
  title: string
  retaWeek: RetaDayCell[]
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

const PHASE_LABEL: Record<string, RetaPhase> = { peak: 'Peak', stable: 'Stable', trough: 'Trough' }

/** Medication cycle week → the Reta strip cells; empty (no dose → ghost cycle) stays empty. */
export function toRetaCells(week: MedicationCycleCell[]): RetaDayCell[] {
  return week.map((c) => ({
    d: c.day,
    label: PHASE_LABEL[c.phaseKey] ?? 'Stable',
    color: `var(--reta-d${c.day})`,
  }))
}

/** Train's derived gym day → grid-renderable: active timed days get the planner's default
 *  block width (duration has no DB home — presentational default, same as the Mai timeline). */
export function withDefaultDuration(d: GymScheduleDay): GymScheduleDay {
  return d.active && d.time && d.duration == null ? { ...d, duration: DEFAULT_BLOCK_MIN } : d
}

/** Sheet edits → Train's PUT body: one slot per active day with a time (day+time is all the
 *  gym-schedule contract persists; type/active live on the mesocycle template). */
export function gymDaysToSlots(days: GymScheduleDay[]): GymScheduleSlotInput[] {
  return days.flatMap((d) => {
    const dayOfWeek = DAY_ORDER.indexOf(d.day as (typeof DAY_ORDER)[number])
    return d.active && d.time && dayOfWeek >= 0 ? [{ dayOfWeek, time: d.time }] : []
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
  const { gymSchedule: trainGym, sport } = useTrain()
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
      retaWeek: mockRetaWeek,
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
    retaWeek: toRetaCells(cycle.week),
    gymSchedule: (trainGym?.weeklyTimes ?? []).map(withDefaultDuration),
    weeklySupplements: [],
    patterns: [],
    weeklyStats: deriveWeeklyStats(week?.days ?? []),
    volleyball: sport.schedule?.volleyball.sessions ?? [],
    weeklyNote: null,
  }
}

/** Gym-time write-through (P0a: Train owns the schedule, Fuel is a secondary editor).
 *  Mock: Train's saveGymSchedule no-ops (the page's local override carries the demo edit);
 *  real: PUT /api/train/gym-schedule + ['train','gymSchedule'] invalidation re-derives the week. */
export function useFuelWeekActions() {
  const { saveGymSchedule: saveTrainGymSchedule } = useTrain()
  const saveGymSchedule = useCallback(
    (days: GymScheduleDay[]) => saveTrainGymSchedule(gymDaysToSlots(days)),
    [saveTrainGymSchedule],
  )
  return { saveGymSchedule }
}
