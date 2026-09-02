// Fuel Keret-hero pure view-model (mezo-c9t5, keret-hero iteration). Turns the composed day
// (DayBudget + logged meals + the FuelPlanToday slot list + the water tally) into the hero's
// remaining-kcal + segmented day-bar + 5 macro/rost/víz rings, and re-homes the AI meal-score onto
// the day's done windows (mezo-cs8b — windowIslands.ts couldn't do this: it never got a `meals`
// array to join a slot's `mealId` against). Pure: no React, no ambient time, no `@/data/*` hook
// import — only types + the shared `toMin`/`pct` helpers, the heroWindow.ts/windowIslands.ts
// pattern. Feeds Task 2's KeretHero.tsx and Task 3's FuelMaiPage; do not rename the exports below,
// they are imported sight-unseen.
// Design: docs/superpowers/specs/2026-08-09-fuel-keret-hero-design.md §1.2-1.4.

import { pct } from '@/shared/lib/pct'
import { FIBER_TARGET_G, toMin } from '@/data/fuel/fuelConfig'
import { isMealSlot } from '@/features/fuel/logic/dayZones'
import { mealDisplayName } from '@/features/fuel/logic/mealDisplayName'
import type { DayBudget } from '@/features/fuel/logic/buildDayPlan'
import type { FuelMeal, FuelSlot } from '@/data/types'

export interface RingVM { key: 'p' | 'c' | 'f' | 'fiber' | 'water'; label: string; pct: number; value: string; target: string; color: string }
export interface DaySegVM { widthPct: number; toneAlt: boolean }
export interface KeretHeroVM {
  remainingKcal: number
  consumedKcal: number
  targetKcal: number
  doneCount: number
  totalCount: number
  segments: DaySegVM[]
  nowFrac: number | null
  chips: { base: number; activity: number; balance: number } | null
  rings: RingVM[]
}

function ring(key: RingVM['key'], label: string, value: number, target: number, color: string, unit: string): RingVM {
  return {
    key,
    label,
    pct: Math.round(pct(value, target)),
    value: `${Math.round(value)}${unit}`,
    target: `${Math.round(target)}${unit}`,
    color,
  }
}

export function buildKeretHero(input: {
  budget: DayBudget
  staticEnergy: boolean
  consumed: { kcal: number; p: number; c: number; f: number }
  meals: FuelMeal[]
  water: { currentMl: number; targetMl: number }
  slots: FuelSlot[]
  nowHHmm: string
}): KeretHeroVM {
  const { budget, staticEnergy, consumed, meals, water, slots, nowHHmm } = input

  // Meal windows only (mirrors the retired DayBudgetCard's `windows`/`doneWindows` — a workout or
  // a stack/protocol slot is never an eating window, so it never enters the day-bar or the n/m count).
  const windows = slots.filter(isMealSlot).slice().sort((a, z) => toMin(a.time) - toMin(z.time))
  const doneWindows = windows.filter(s => s.state === 'done')

  const segments: DaySegVM[] = doneWindows.map((s, i) => ({
    // Segments share ONE denominator (budget.kcal) with the track background the component draws
    // behind them (the day-bar's unfilled remainder now plays that role, no separate ghost
    // element), so an individual window can never blow the bar past 100% on its own — an
    // overshoot day still shows a legible (if crowded) bar rather than a broken layout.
    widthPct: pct(s.kcal ?? 0, budget.kcal),
    toneAlt: i % 2 === 1,
  }))

  // Most-jelző: buildKeretHero gets no wake/bed day-anchor (unlike the retired DayBudgetCard, which
  // placed it on the full wake→bed axis) — so the marker is placed on the span of the day's OWN
  // meal windows instead (same population the segments are drawn from). No open window (every
  // window done, or none scheduled) → no marker; a single window (zero span) → no marker either.
  let nowFrac: number | null = null
  if (windows.some(s => s.state === 'now')) {
    const times = windows.map(s => toMin(s.time))
    const min = Math.min(...times)
    const max = Math.max(...times)
    if (max > min) nowFrac = Math.min(1, Math.max(0, (toMin(nowHHmm) - min) / (max - min)))
  }

  // Rost-összegzés (mezo-c9t5, frontend-only): Σ the day's logged meals' `fiberG`; a meal with no
  // fiberG (undefined or explicit null — the wire doesn't carry it for every meal yet) contributes 0,
  // never fabricated. Cél = the static FIBER_TARGET_G default (no settings-field yet).
  const fiberG = meals.reduce((sum, m) => sum + (m.fiberG ?? 0), 0)

  const rings: RingVM[] = [
    ring('p', 'Fehérje', consumed.p, budget.p, 'var(--macro-protein)', ' g'),
    ring('c', 'Szénhidrát', consumed.c, budget.c, 'var(--macro-carbs)', ' g'),
    ring('f', 'Zsír', consumed.f, budget.f, 'var(--macro-fat)', ' g'),
    ring('fiber', 'Rost', fiberG, FIBER_TARGET_G, 'var(--macro-fiber)', ' g'),
    ring('water', 'Víz', water.currentMl, water.targetMl, 'var(--sky)', ' ml'),
  ]

  return {
    // Honest negative on an overshoot day — no clamp. `KeretHero` already formats a negative
    // remainingKcal with the Unicode minus (U+2212) via its `fmt` helper.
    remainingKcal: budget.kcal - consumed.kcal,
    consumedKcal: consumed.kcal,
    targetKcal: budget.kcal,
    doneCount: doneWindows.length,
    totalCount: windows.length,
    segments,
    nowFrac,
    // Static-energy days (no biometric profile — plan.energy.activity/balance both 0) hide the chip
    // row entirely (the retired DayBudgetCard's `staticEnergy` rule); balance passes through RAW —
    // the deficit/surplus sign glyph is the component's formatting job, not this module's.
    chips: staticEnergy ? null : { base: budget.energy.base, activity: budget.energy.activity, balance: budget.energy.balance },
    rings,
  }
}

export type MealRole = 'pre' | 'post' | 'standard'
export const MEAL_ROLE_LABEL: Record<MealRole, string> = {
  pre: 'EDZÉS ELŐTTI',
  post: 'EDZÉS UTÁNI',
  standard: 'STANDARD',
}

/** MealRole derivation (mezo-c9t5, controller decision — Task 1 found no FE field for this):
 *  'pre' when the meal lands 0-90min BEFORE the workout's start, 'post' when 0-120min AFTER,
 *  else 'standard'. No workout today (`workoutTime` null) → always 'standard'. The two windows
 *  touch at the workout's own start minute (diff 0) — resolved as 'post' (a meal logged exactly
 *  at kickoff reads as "after the whistle", not "before"), so the two ranges never overlap. */
export function deriveMealRole(mealTimeHHmm: string, workoutTime: string | null): MealRole {
  if (workoutTime == null) return 'standard'
  const diff = toMin(mealTimeHHmm) - toMin(workoutTime)
  if (diff >= 0 && diff <= 120) return 'post'
  if (diff < 0 && diff >= -90) return 'pre'
  return 'standard'
}

export interface DoneMealRow { mealId: string; name: string; time: string; kcal: number | null; proteinG: number | null; scorePct: number | null }

/** The day's done meal windows, chronologically, each row's meal joined off `slot.mealId` (the join
 *  windowIslands.ts's `buildWindowRiver` couldn't do — it never received a `meals` array). */
export function doneMealRows(meals: FuelMeal[], slots: FuelSlot[]): DoneMealRow[] {
  const byId = new Map(meals.map(m => [m.id, m]))
  return slots
    .filter((s): s is FuelSlot & { mealId: string } => isMealSlot(s) && s.state === 'done' && s.mealId != null)
    .slice()
    .sort((a, z) => toMin(a.time) - toMin(z.time))
    .map((s): DoneMealRow => {
      const meal = byId.get(s.mealId)
      return {
        mealId: s.mealId,
        name: s.mealName ?? (meal ? mealDisplayName(meal) : undefined) ?? '',
        time: s.time,
        kcal: meal?.kcal ?? s.kcal ?? null,
        proteinG: meal?.p ?? s.p ?? null,
        scorePct: meal?.score != null ? Math.round(meal.score * 100) : null,
      }
    })
}

/** The average of the given score percentages, rounded; null/undefined entries ignored (a
 *  score-less done meal), no scored value at all → null (never a fake 0). Shared by this
 *  module's own `doneMealRows` (each row's `scorePct`) and windowIslands.ts's `buildWindowRiver`
 *  (a done slot's joined meal score) — both need "average of today's done-meal AI scores", so it
 *  lives here (the module that owns `DoneMealRow`/`doneMealRows`) rather than each computing its
 *  own reduce. */
export function aiAverage(scorePcts: (number | null | undefined)[]): number | null {
  const scored = scorePcts.filter((v): v is number => v != null)
  if (scored.length === 0) return null
  return Math.round(scored.reduce((sum, v) => sum + v, 0) / scored.length)
}

/** Past-day normalisation (mezo-zeeq, the asPastDayLane shape): useFuelTimeline's energy chips
 *  and the wall-clock now-marker describe TODAY even when `date` is in the past — a past-day
 *  hero drops both instead of showing today's Alap/Mozgás/Cél under yesterday's meals. Consumed
 *  kcal, segments, rings and water read the date's own data and stay. */
export function asPastDayHero(vm: KeretHeroVM): KeretHeroVM {
  return { ...vm, chips: null, nowFrac: null }
}
