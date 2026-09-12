// Fuel P4 — dual-mode weekly plan (Terv) hook.
//
// MOCK: byte-parity with the Phase-1 seeds (`fuelWeek.ts` + `today.ts` volleyball).
// REAL: composes the LIVE week — gym days from Train's derived schedule (meso WHAT × slot WHEN),
//   volleyball from Train's sport schedule, the cycle strip from the medication cycle, and the
//   weekly stats from the 7-day rollup (`GET /api/fuel/week/{start}`). Surfaces with no real
//   source yet return honest-empty (`patterns`/`weeklySupplements` []) or null (`weeklyNote`,
//   `supplementsAdherence`) — never the seed.
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
  mockWeekRollup,
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
  /** C1 (mezo-83g0): the ISO Monday this view describes — the weekly picture needs the axis. */
  start: string
  /** C1 (mezo-83g0): the 7-day rollup itself, so the Trendek weekly picture can draw the days
   *  against their budgets. Empty until the real-mode fetch resolves — never a seeded stand-in. */
  weekDays: FuelWeekDay[]
  /** C2 (mezo-83g0): the week's meal-score average, 0..1. The backend has always computed it
   *  (`FuelWeekResponse.mealScoreAvg`); until this slice the mapper discarded it. Honest-null:
   *  null means "no scored meal this week", NOT zero. */
  mealScoreAvg: number | null
  /** C2 (mezo-83g0): the week's weight average in kg — null when the week has no weigh-in. */
  weightAvgKg: number | null
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

/** C1/C2 (mezo-83g0): EGY hétfő 7 napos rollupja, a weekly endpoint egyetlen olvasásából. */
export interface FuelWeekRollupView {
  weekDays: FuelWeekDay[]
  mealScoreAvg: number | null
  weightAvgKg: number | null
  /** A valós olvasás még nem oldódott fel — a nézet ilyenkor nem állíthat semmit a hétről. */
  isPending: boolean
}

/**
 * Egy ADOTT hétfő rollupja — `useFuelWeek` PONTOS query-kulcsával és cache-alakjával
 * (`['fuelWeek', start]`), hogy a Trendek hét-váltója és a hét-a-héthez delták ne töltsék be
 * ugyanazt a hetet kétszer (C1/C2, mezo-83g0). `useFuelWeek` maga is ezen keresztül olvas, tehát
 * a kulcs EGY helyen van definiálva, nem két másolatban.
 *
 * Mock mód: a kért hétfőre átdátumozott determinisztikus hét. A „melyik hétfő a mostani" döntés
 * ITT születik (a seed-modul nem olvas órát): a mostani hétfő előtti bármelyik hétfő a `'past'`
 * variánst kapja, így két egymást követő hét SOHA nem azonos — különben minden delta nulla volna.
 * Valós mód: a backend hete, feloldódásig őszintén üres — seed soha.
 */
export function useFuelWeekRollup(start: string): FuelWeekRollupView {
  const mock = isMockMode()
  const { data: week, isPending } = useQuery({
    queryKey: ['fuelWeek', start],
    queryFn: mock ? async () => null : () => mealApi.getWeek(start),
    initialData: mock ? null : undefined,
    staleTime: mock ? Infinity : 0,
  })
  if (mock) {
    const rollup = mockWeekRollup(start, start < mondayIso() ? 'past' : 'current')
    return {
      weekDays: rollup.days,
      mealScoreAvg: rollup.mealScoreAvg,
      weightAvgKg: rollup.weightAvgKg,
      isPending: false,
    }
  }
  return {
    weekDays: week?.days ?? [],
    // Honest-null: before the fetch resolves there is no average — not a zero.
    mealScoreAvg: week?.mealScoreAvg ?? null,
    weightAvgKg: week?.weightAvgKg ?? null,
    isPending,
  }
}

/** `startIso` — C1 (mezo-83g0): the ISO Monday to describe; omitted means the current week.
 *  Only Trendek's week switch passes one; every other caller keeps the current week verbatim. */
export function useFuelWeek(startIso?: string): FuelWeekView {
  const mock = isMockMode()
  const { gymSchedule: trainGym, sport, sportSlotSkips } = useTrain()
  const { cycle } = useMedication()
  const start = startIso ?? mondayIso()
  const rollup = useFuelWeekRollup(start)

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
      start,
      // Mock mode seeds a deterministic rollup (byte-stable, re-dated to the requested Monday).
      // Real mode NEVER substitutes one — an unresolved week is honestly empty.
      weekDays: rollup.weekDays,
      mealScoreAvg: rollup.mealScoreAvg,
      weightAvgKg: rollup.weightAvgKg,
    }
  }
  return {
    title: deriveWeekTitle(start),
    medCycleWeek: toMedCycleCells(cycle.week),
    gymSchedule: (trainGym?.weeklyTimes ?? []).map(withDefaultDuration),
    weeklySupplements: [],
    patterns: [],
    weeklyStats: deriveWeeklyStats(rollup.weekDays),
    volleyball: filterSkippedSessions(sport.schedule?.volleyball.sessions ?? [], sportSlotSkips, start),
    weeklyNote: null,
    start,
    weekDays: rollup.weekDays,
    mealScoreAvg: rollup.mealScoreAvg,
    weightAvgKg: rollup.weightAvgKg,
  }
}
