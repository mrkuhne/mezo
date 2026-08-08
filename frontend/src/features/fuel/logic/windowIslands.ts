// windowIslands — pure view-model for the "Mai ég" window-river (mezo-jgh9). Turns a composed
// FuelPlanToday's meal slots into a chronological river of islands (done/now/missed/future), each
// carrying its own capsule copy (essence/count), its hero subtitle and its protein-jump/day-score
// facts. Pure: no React, no ambient time, no `@/data/*` hook import — only types + the shared
// `toMin` helper (the same pattern heroWindow.ts uses). Feeds Task 4's WindowIsland component and
// Task 5's FuelMaiPage; do not rename the exports below, they are imported sight-unseen.

import { toMin } from '@/data/fuel/fuelConfig'
import type { DayBudget } from '@/features/fuel/logic/buildDayPlan'
import type { HeroResult } from '@/features/fuel/logic/heroWindow'
import type { MealMatchVerdict } from '@/features/fuel/logic/matchMealsToStack'
import type { FuelPlanToday, FuelSlot, MealSlot } from '@/data/types'

export type WindowIslandState = 'done' | 'now' | 'missed' | 'future'
export interface WindowFacts {
  proteinJump: { addG: number; fromG: number; toG: number; pctOfTarget: number } | null
  dayScore: { avg: number; aboveWeekly: boolean } | null // score-próza nincs (P8) — csak szám
}
export interface WindowIslandVM {
  key: string
  state: WindowIslandState
  emoji: string
  title: string
  time: string
  essence: string
  count: string
  subtitle: string
  meal: { name: string; kcal: number | null; p: number | null; fit: number | null; fromPlan: boolean } | null
  facts: WindowFacts
  stackDoses: { name: string; note: string }[]
  l1Count: number
}
export interface WindowRiverVM {
  islands: WindowIslandVM[]
  nowKey: string | null
  defaultKey: string
  doneSummary: { count: number; kcal: number; avgScore: number | null }
}

const SLOT_EMOJI: Record<MealSlot, string> = { breakfast: '🍳', lunch: '🥙', snack: '🥜', dinner: '🍲' }

function hasSlotKey(s: FuelSlot): s is FuelSlot & { slotKey: MealSlot } {
  return s.slotKey != null
}

function islandKey(slot: FuelSlot): string {
  return `${slot.time}-${slot.label}`
}

function mapState(state: FuelSlot['state']): WindowIslandState {
  return state === 'pending' ? 'future' : state
}

// done: "07:40 · zabkása + skyr" · missed: "12:30 · kimaradt — pótold" · other: time + best-known name.
function buildEssence(slot: FuelSlot): string {
  if (slot.state === 'missed') return `${slot.time} · kimaradt — pótold`
  return `${slot.time} · ${slot.mealName ?? slot.label}`
}

// done: "✓ 420 kcal · 92 p" (kcal+protein, straight from the slot) · missed: "Pótold" · other: the
// "még N ›" handle count.
function buildCount(slot: FuelSlot, l1Count: number): string {
  if (slot.state === 'done') return `✓ ${slot.kcal ?? 0} kcal · ${slot.p ?? 0} p`
  if (slot.state === 'missed') return 'Pótold'
  return `${l1Count} ›`
}

function buildMeal(slot: FuelSlot): WindowIslandVM['meal'] {
  if (slot.mealName == null && slot.kcal == null) return null
  return {
    name: slot.mealName ?? slot.label,
    kcal: slot.kcal ?? null,
    p: slot.p ?? null,
    // FuelSlot carries no per-window mezoFit score (that lives on Recipe, not the composed slot) —
    // always null until the planner threads one through.
    fit: null,
    fromPlan: !!slot.suggestedRecipeId,
  }
}

// Projects "if I ate this window now, where does today's protein land": addG is the window's own
// protein, fromG is what's already logged today (Σ done slots' p), toG/pctOfTarget follow. Only
// meaningful for a window not yet eaten — done/missed windows keep this null (already counted /
// already gone).
function buildProteinJump(slot: FuelSlot, consumedP: number, targetP: number): WindowFacts['proteinJump'] {
  const addG = slot.p ?? 0
  const fromG = consumedP
  const toG = fromG + addG
  const pctOfTarget = targetP > 0 ? Math.round((toG / targetP) * 100) : 0
  return { addG, fromG, toG, pctOfTarget }
}

// bigview herosub: ablak-határ + edzés-kapcsolat + (csúcshéten) Reta-jegy.
function buildSubtitle(slot: FuelSlot, nextTime: string, workoutTime: string | null, retaPeak: boolean): string {
  const parts: string[] = [`${slot.time}–${nextTime} ablak`]
  if (workoutTime) parts.push(`edzés ${workoutTime}`)
  if (retaPeak) parts.push('Reta-csúcshéten megnőtt étvágy')
  return parts.join(' · ')
}

export function buildWindowRiver(input: {
  plan: FuelPlanToday
  budget: DayBudget
  hero: HeroResult
  stackVerdict: MealMatchVerdict | null
  workoutTime: string | null
  retaPeak: boolean
  nowHHmm: string
}): WindowRiverVM {
  const { plan, budget, hero, stackVerdict, workoutTime, retaPeak } = input

  const mealSlots = plan.slots.filter(hasSlotKey).sort((a, z) => toMin(a.time) - toMin(z.time))
  const consumedProtein = mealSlots.filter(s => s.state === 'done').reduce((sum, s) => sum + (s.p ?? 0), 0)
  const nowKey = hero.hero.kind === 'open' ? islandKey(hero.hero.slot) : null

  const islands: WindowIslandVM[] = mealSlots.map((slot, i) => {
    const state = mapState(slot.state)
    const doses =
      stackVerdict && stackVerdict.zone === slot.slotKey
        ? [{ name: stackVerdict.mealTitle, note: stackVerdict.advice ?? stackVerdict.metric }]
        : []
    const nextTime = mealSlots[i + 1]?.time ?? plan.kitchenClose
    return {
      key: islandKey(slot),
      state,
      emoji: SLOT_EMOJI[slot.slotKey],
      title: slot.label,
      time: slot.time,
      essence: buildEssence(slot),
      count: buildCount(slot, doses.length),
      subtitle: buildSubtitle(slot, nextTime, workoutTime, retaPeak),
      meal: buildMeal(slot),
      facts: {
        proteinJump: state === 'now' || state === 'future' ? buildProteinJump(slot, consumedProtein, budget.p) : null,
        // No per-slot logged meal-score field exists on FuelSlot (and buildWindowRiver's input
        // carries no meals array to look one up by mealId) — always null until that's threaded in.
        dayScore: null,
      },
      stackDoses: doses,
      l1Count: doses.length,
    }
  })

  const doneMealSlots = mealSlots.filter(s => s.state === 'done')
  const doneSummary = {
    count: doneMealSlots.length,
    kcal: doneMealSlots.reduce((sum, s) => sum + (s.kcal ?? 0), 0),
    avgScore: null,
  }

  return { islands, nowKey, defaultKey: nowKey ?? 'keret', doneSummary }
}
