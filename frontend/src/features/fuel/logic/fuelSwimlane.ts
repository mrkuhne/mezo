// ============================================================
// Mezo · fuelSwimlane — pure view-model for the Fuel hub's WINDOW SWIMLANE
// (Design 2.0 F3.1, mezo-d20.4.1). Source of truth:
// docs/design_2.0/2026-08-27-fuel-design-iterations.md §1-2 + prototype
// fuel-body.html `wtile`/`macBlock`.
//
// Replaces the window-RIVER's island model (windowIslands.ts, retired from the
// hub in F8): every user-scheduled eating window becomes ONE tile in a
// horizontally scrolling lane — done / now / missed / future — each carrying a
// kcal mini-tile and three mini macro rings whose fill is that meal's share of
// the DAILY target (echoing the hero rings, iterations §1 iteration 2).
//
// Pure: no React, no ambient time, no `@/data/*` hook import — only types plus
// the shared `toMin`/`pct` helpers (the heroWindow.ts / keretHero.ts pattern).
// Do not rename the exports: they are imported sight-unseen by WindowLane.tsx
// and FuelMaiPage.tsx.
// ============================================================
import { pct } from '@/shared/lib/pct'
import { toMin } from '@/data/fuel/fuelConfig'
import { isMealSlot } from '@/features/fuel/logic/dayZones'
import { mealDisplayName } from '@/features/fuel/logic/mealDisplayName'
import type { DayBudget } from '@/features/fuel/logic/buildDayPlan'
import type { FuelMeal, FuelSlot, MealSlot } from '@/data/types'

export type WindowTileState = 'done' | 'now' | 'missed' | 'future'

/** The clay window icons the iteration log commissioned (`assets/clay-icons.svg`). */
export type WindowIconName = 'i-reggeli' | 'i-ebed' | 'i-snack' | 'i-vacsora'

const SLOT_ICON: Record<MealSlot, WindowIconName> = {
  breakfast: 'i-reggeli',
  lunch: 'i-ebed',
  snack: 'i-snack',
  dinner: 'i-vacsora',
}

/** One mini macro ring on a window tile. `pct` is the meal's share of the DAILY
 *  target, so the three rings read as "how much of today this one meal carries". */
export interface TileRingVM {
  key: 'p' | 'c' | 'f'
  /** The ring's centre glyph — P / C / F (prototype `data-l`). */
  letter: string
  /** Full HU label for the aria description (Fehérje / Szénhidrát / Zsír). */
  label: string
  grams: number
  pct: number
  color: string
}

export interface WindowTileVM {
  /** Stable per-window key — the `${time}-${label}` identity buildDayPlan's slots carry. */
  key: string
  slotKey: MealSlot
  state: WindowTileState
  icon: WindowIconName
  /** The window's own label (Reggeli / Tízórai / …) — the tile's uppercase eyebrow. */
  label: string
  /** Wall-clock of the window; a done window shows the window's own time (the composed
   *  slot carries no separate logged-at time). */
  time: string
  /** Best-known name: the logged meal for a done window, the plan's meal otherwise,
   *  falling back to the window label — `ghost` marks that fallback. */
  name: string
  /** True when the name is only the window label — nothing real is planned here yet. */
  ghost: boolean
  /** "a tervből" is only honest when the window actually carries a plan suggestion. */
  fromPlan: boolean
  /** Window/meal kcal — null when the composition carries none (no fabricated 0). */
  kcal: number | null
  rings: TileRingVM[]
  /** The logged meal behind a done tile (score sheet target); null on every other state. */
  mealId: string | null
  /** AI score in percent — null on an unscored (fresh) log → "✨ folyamatban". */
  scorePct: number | null
  /** A done tile's score chip is only a button when the meal carries a breakdown —
   *  MealScoreSheet renders null without one, so a breakdown-less chip is a dead tap. */
  scorable: boolean
}

export interface WindowLaneVM {
  tiles: WindowTileVM[]
  /** The `now` window's key (the lane auto-scrolls to it), null when no window is open. */
  nowKey: string | null
}

function tileKey(slot: FuelSlot): string {
  return `${slot.time}-${slot.label}`
}

function ringOf(
  key: TileRingVM['key'], letter: string, label: string, grams: number | null, target: number, color: string,
): TileRingVM {
  const g = grams ?? 0
  return { key, letter, label, grams: g, pct: Math.round(pct(g, target)), color }
}

/**
 * Builds the hub's window lane from the composed day.
 *
 * `plan.slots` already carries the authoritative per-window state (buildDayPlan's
 * fixed-plan pass sets done/now/missed/pending) — this module never re-derives it
 * from a clock. Done windows join their logged meal off `slot.mealId` for the real
 * macros + the AI score (the join `keretHero.ts`'s `doneMealRows` does).
 */
export function buildWindowLane(input: {
  slots: FuelSlot[]
  budget: DayBudget
  meals: FuelMeal[]
}): WindowLaneVM {
  const { slots, budget, meals } = input
  const byId = new Map(meals.map(m => [m.id, m]))

  const windows = slots
    .filter((s): s is FuelSlot & { slotKey: MealSlot } => isMealSlot(s) && s.slotKey != null)
    .slice()
    .sort((a, z) => toMin(a.time) - toMin(z.time))

  const tiles = windows.map((slot): WindowTileVM => {
    const state: WindowTileState = slot.state === 'pending' ? 'future' : slot.state
    const meal = slot.mealId != null ? byId.get(slot.mealId) : undefined
    const done = state === 'done'

    const planName = slot.mealName ?? (meal ? mealDisplayName(meal) : undefined)
    const name = planName ?? slot.label

    const kcal = (done ? meal?.kcal : undefined) ?? slot.kcal ?? null
    const p = (done ? meal?.p : undefined) ?? slot.p ?? null
    const c = (done ? meal?.c : undefined) ?? slot.c ?? null
    const f = (done ? meal?.f : undefined) ?? slot.f ?? null

    return {
      key: tileKey(slot),
      slotKey: slot.slotKey,
      state,
      icon: SLOT_ICON[slot.slotKey],
      label: slot.label,
      time: slot.time,
      name,
      ghost: planName == null,
      // `fromPlan` mirrors windowIslands.ts's own rule (mezo-jgh9): only a real plan
      // suggestion earns the "a tervből" meta — a budget-only window says nothing.
      fromPlan: slot.suggestedRecipeId != null,
      kcal,
      rings: [
        ringOf('p', 'P', 'Fehérje', p, budget.p, 'var(--macro-protein)'),
        ringOf('c', 'C', 'Szénhidrát', c, budget.c, 'var(--macro-carbs)'),
        ringOf('f', 'F', 'Zsír', f, budget.f, 'var(--macro-fat)'),
      ],
      mealId: done ? (slot.mealId ?? null) : null,
      scorePct: done && meal?.score != null ? Math.round(meal.score * 100) : null,
      scorable: done && meal?.breakdown != null,
    }
  })

  return { tiles, nowKey: tiles.find(t => t.state === 'now')?.key ?? null }
}

/**
 * Past-day normalisation (mezo-1j3z): a múltban nincs MOST és nincs jövő —
 * minden be nem logolt ablak „kimaradt · még pótolható". Pure, a state-forrás
 * (buildDayPlan) érintetlen; a /fuel/log page futtatja át rajta a lane-t, ha
 * a választott nap nem a mai.
 */
export function asPastDayLane(vm: WindowLaneVM): WindowLaneVM {
  return {
    tiles: vm.tiles.map(t =>
      t.state === 'now' || t.state === 'future' ? { ...t, state: 'missed' } : t,
    ),
    nowKey: null,
  }
}
