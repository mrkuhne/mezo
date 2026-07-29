// Mai page hero selection (mezo-rrtj) — pure. buildDayPlan already encodes the day's state
// (exactly one `now` while the day is awake, `missed` for past-unlogged windows, none after
// bedtime), so the hero is a projection of that, never a second state machine.

import { toMin } from '@/data/fuel/fuelConfig'
import { isMealSlot } from '@/features/fuel/logic/dayZones'
import type { PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import type { FuelSlot } from '@/data/types'

export interface HeroOpen {
  kind: 'open'
  slot: FuelSlot
  /** True when the planner attached a recipe suggestion — drives the CTA copy. */
  suggestion: boolean
  /** Derived, plain-text rationale. NEVER LLM prose (the coach layer owns prose). */
  why: string
  /**
   * True when the slot's own time is at/before `nowHHmm` — the window is actually open.
   * False when buildDayPlan promoted the EARLIEST unlogged window to `'now'` because the
   * clock precedes every window (the day hasn't reached its first meal yet): `'now'` there
   * means "the window in focus", not "already open" — the hero copy must say so (mezo-rrtj).
   */
  started: boolean
}
export interface HeroClosed {
  kind: 'closed'
  consumedKcal: number
  targetKcal: number
  doneCount: number
  totalCount: number
  proteinG: number
  proteinTargetG: number
}
export type HeroWindow = HeroOpen | HeroClosed
export interface HeroResult {
  hero: HeroWindow
  missed: FuelSlot[]
}

function deriveWhy(slot: FuelSlot, blocks: PlannerBlock[], budget: { c: number }): string {
  const next = blocks
    .filter(b => toMin(b.time) > toMin(slot.time))
    .sort((a, z) => toMin(a.time) - toMin(z.time))[0]
  if (next && slot.c && budget.c) {
    const share = Math.round((slot.c / budget.c) * 100)
    return `${next.label} ${next.time} — ez az ablak viszi a napi szénhidrát ${share}%-át`
  }
  if (slot.kcal && slot.p) return `${slot.kcal} kcal ebben az ablakban — ${slot.p} g fehérje a napi célhoz`
  if (slot.kcal) return `${slot.kcal} kcal ebben az ablakban`
  return ''
}

export function pickHeroWindow(input: {
  slots: FuelSlot[]
  blocks: PlannerBlock[]
  budget: { kcal: number; p: number; c: number }
  consumed: { kcal: number; p: number }
  nowHHmm: string
}): HeroResult {
  const { slots, blocks, budget, consumed, nowHHmm } = input
  const missed = slots
    .filter(s => s.state === 'missed' && isMealSlot(s))
    .sort((a, z) => toMin(a.time) - toMin(z.time))
  const now = slots.find(s => s.state === 'now')

  if (now) {
    return {
      hero: {
        kind: 'open',
        slot: now,
        suggestion: !!now.suggestedRecipeId,
        why: deriveWhy(now, blocks, budget),
        started: toMin(now.time) <= toMin(nowHHmm),
      },
      missed,
    }
  }
  const windows = slots.filter(isMealSlot)
  return {
    hero: {
      kind: 'closed',
      consumedKcal: consumed.kcal,
      targetKcal: budget.kcal,
      doneCount: windows.filter(s => s.state === 'done').length,
      totalCount: windows.length,
      proteinG: consumed.p,
      proteinTargetG: budget.p,
    },
    missed,
  }
}
