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
import type { FuelMeal, FuelPlanToday, FuelSlot, MealSlot } from '@/data/types'

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
  /** The `?w=` key that should be big absent a valid param — the now-window, else the
   *  chronologically first remaining island (a trailing missed run with no now window),
   *  else null when nothing is left to select (every window done — mezo-c9t5: the retired
   *  `keret` fallback is gone, there is no belt to fall back onto anymore). */
  defaultKey: string | null
  /** The day's done windows, merged (mezo-c9t5 — replaces the old belt/per-island done
   *  capsules): null when nothing is done yet (no fabricated empty capsule). `avgScore` is
   *  the scored done meals' average `scorePct` (meals joined off each done slot's `mealId`,
   *  the same join `keretHero.ts`'s `doneMealRows` does) — null when none of today's done
   *  meals carry a score. */
  doneGroup: { count: number; kcal: number; avgScore: number | null } | null
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

// WindowIsland's L1 always renders three rows (ablak étkezése/tervezz, csere a tervben, AI
// naplózás) regardless of doses — plus one row per stack dose. l1Count must mirror exactly what
// the L1 renders (WindowIsland.tsx), or the capsule/hero "még N ›" handle undercounts (e.g. "0 ›"
// on a window with no doses, when the L1 it opens actually has 3 rows).
const L1_BASE_ROWS = 3

// missed: "Pótold" · other: the "még N ›" handle count. (Done windows never reach this function —
// buildWindowRiver filters them out before building islands; they merge into `doneGroup` instead.)
function buildCount(slot: FuelSlot, l1Count: number): string {
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
  stackVerdicts: MealMatchVerdict[]
  workoutTime: string | null
  retaPeak: boolean
  nowHHmm: string
  /** Today's logged meals — joined against each done slot's `mealId` to build `doneGroup.avgScore`
   *  (mezo-c9t5). Not otherwise threaded into the islands: a per-window logged-meal score is still
   *  P8 scope (facts.dayScore stays null below, unchanged). */
  meals: FuelMeal[]
}): WindowRiverVM {
  const { plan, budget, hero, stackVerdicts, workoutTime, retaPeak, meals } = input

  const mealSlots = plan.slots.filter(hasSlotKey).sort((a, z) => toMin(a.time) - toMin(z.time))
  const consumedProtein = mealSlots.filter(s => s.state === 'done').reduce((sum, s) => sum + (s.p ?? 0), 0)
  const nowKey = hero.hero.kind === 'open' ? islandKey(hero.hero.slot) : null

  // Done windows merge into `doneGroup` (mezo-c9t5) — they no longer get their own island, so the
  // river only builds islands for the still-open ones (now/missed/future). `nextTime` below still
  // reads the ORIGINAL (unfiltered) `mealSlots[i + 1]` so a remaining window's subtitle boundary
  // math is unaffected by a done neighbor being skipped.
  const islands: WindowIslandVM[] = mealSlots
    .map((slot, i) => ({ slot, i }))
    .filter(({ slot }) => slot.state !== 'done')
    .map(({ slot, i }) => {
      const state = mapState(slot.state)
      // Every zone-matching verdict lands on this window's L1 — not just the first one found —
      // so a day with matches in multiple zones doesn't silently drop doses from all but one.
      const doses = stackVerdicts
        .filter((v) => v.zone === slot.slotKey)
        .map((v) => ({ name: v.mealTitle, note: v.advice ?? v.metric }))
      const l1Count = L1_BASE_ROWS + doses.length
      const nextTime = mealSlots[i + 1]?.time ?? plan.kitchenClose
      return {
        key: islandKey(slot),
        state,
        emoji: SLOT_EMOJI[slot.slotKey],
        title: slot.label,
        time: slot.time,
        essence: buildEssence(slot),
        count: buildCount(slot, l1Count),
        subtitle: buildSubtitle(slot, nextTime, workoutTime, retaPeak),
        meal: buildMeal(slot),
        facts: {
          proteinJump: state === 'now' || state === 'future' ? buildProteinJump(slot, consumedProtein, budget.p) : null,
          // No per-slot logged meal-score field exists on FuelSlot — always null until a per-window
          // score feed exists (P8 scope); the day's done-meal scores now live in `doneGroup` instead.
          dayScore: null,
        },
        stackDoses: doses,
        l1Count,
      }
    })

  const doneMealSlots = mealSlots.filter(s => s.state === 'done')
  const mealById = new Map(meals.map(m => [m.id, m]))
  const scoredPct = doneMealSlots
    .map(s => (s.mealId != null ? mealById.get(s.mealId)?.score : null))
    .filter((v): v is number => v != null)
    .map(v => Math.round(v * 100))
  const avgScore = scoredPct.length > 0 ? Math.round(scoredPct.reduce((sum, v) => sum + v, 0) / scoredPct.length) : null
  const doneGroup = doneMealSlots.length > 0
    ? { count: doneMealSlots.length, kcal: doneMealSlots.reduce((sum, s) => sum + (s.kcal ?? 0), 0), avgScore }
    : null

  return { islands, nowKey, defaultKey: nowKey ?? islands[0]?.key ?? null, doneGroup }
}
