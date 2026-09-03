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
// Do not rename the exports: they are imported sight-unseen by WindowBlock.tsx,
// FuelLogHeroTile.tsx, FuelLogPage.tsx and FuelMaiPage.tsx (WindowLane retired, mezo-byo1).
// ============================================================
import { pct } from '@/shared/lib/pct'
import { FIBER_TARGET_G, toMin } from '@/data/fuel/fuelConfig'
import { isMealSlot } from '@/features/fuel/logic/dayZones'
import { mealDisplayName } from '@/features/fuel/logic/mealDisplayName'
import { mealContextOf, type MealContext } from '@/features/fuel/logic/mealContext'
import { macroSplit } from '@/features/fuel/logic/macroSplit'
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

/** What a ring's `pct` is measured against (mezo-tjua):
 *  - `'day'` — the meal's share of the DAILY target ("how much of today this window carries").
 *    Every ring on a PLANNED window (now/missed/future), plus a done tile's Rost ring.
 *  - `'meal'` — the macro's share of THIS MEAL's own energy ("what the plate is made of").
 *    A logged (done) window's P/C/F rings; the three add up to 100. */
export type TileRingBasis = 'day' | 'meal'

/** One mini macro ring on a window tile. `pct`'s meaning follows `basis` — a planned window
 *  still asks "how much of today", a logged one answers "what was this meal made of". */
export interface TileRingVM {
  key: 'p' | 'c' | 'f' | 'r'
  /** The ring's centre glyph — P / C / F / R (prototype `data-l`). */
  letter: string
  /** Full HU label for the aria description (Fehérje / Szénhidrát / Zsír). */
  label: string
  grams: number
  pct: number
  basis: TileRingBasis
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
  /** The role the meal was SCORED under (Standard / Pre / Post) — done tiles only, null when
   *  unscored or planned (mezo-zeeq; the derivation lives in logic/mealContext.ts). */
  context: MealContext | null
}

export interface WindowLaneVM {
  tiles: WindowTileVM[]
  /** The `now` window's key (the lane auto-scrolls to it), null when no window is open. */
  nowKey: string | null
}

/**
 * A window's identity, `${time}-${label}`.
 *
 * EXPORTED on purpose (mezo-bq2t): this key is the contract two pages agree on ACROSS a URL —
 * /fuel/log puts it in `?w=`, /fuel/log/uj resolves the window (and its plan-recipe prefill)
 * back out of it. A hand-copied second implementation would let a change here silently break
 * that round trip, so both sides — and their tests — must derive the key from this one symbol.
 */
export function tileKey(slot: FuelSlot): string {
  return `${slot.time}-${slot.label}`
}

function ringOf(
  key: TileRingVM['key'], letter: string, label: string, grams: number | null, target: number, color: string,
): TileRingVM {
  const g = grams ?? 0
  return { key, letter, label, grams: g, pct: Math.round(pct(g, target)), basis: 'day', color }
}

/** A logged window's P/C/F rings, re-based onto the meal's OWN composition (mezo-tjua) — same
 *  grams, same colors, only `pct`/`basis` change. A meal with no macro energy at all (the
 *  composition carries none) keeps the day-basis rings rather than printing a fabricated split. */
function asMealBasis(rings: TileRingVM[], macros: { p: number | null; c: number | null; f: number | null }): TileRingVM[] {
  const split = macroSplit(macros)
  if (split == null) return rings
  return rings.map(r => (r.key === 'r' ? r : { ...r, pct: split[r.key], basis: 'meal' as const }))
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

    let rings: TileRingVM[] = [
      ringOf('p', 'P', 'Fehérje', p, budget.p, 'var(--macro-protein)'),
      ringOf('c', 'C', 'Szénhidrát', c, budget.c, 'var(--macro-carbs)'),
      ringOf('f', 'F', 'Zsír', f, budget.f, 'var(--macro-fat)'),
    ]
    // A LOGGED window answers "what was this meal made of" instead of "how much of today did it
    // take" (mezo-tjua) — the day-relative reading stays on the KeretHero rings and on every
    // still-planned window, which is where a keret question is still the useful one.
    if (done) rings = asMealBasis(rings, { p, c, f })
    // Rost only where it is real (mezo-zeeq): a done tile's logged meal carrying fiberG —
    // FuelSlot has no fiber, so a planned window never grows a fabricated 4th ring. It is not part
    // of the energy split (fiber is not a macro the plate is built from), so it stays day-basis.
    if (done && meal?.fiberG != null) {
      rings.push(ringOf('r', 'R', 'Rost', meal.fiberG, FIBER_TARGET_G, 'var(--macro-fiber)'))
    }

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
      rings,
      mealId: done ? (slot.mealId ?? null) : null,
      scorePct: done && meal?.score != null ? Math.round(meal.score * 100) : null,
      scorable: done && meal?.breakdown != null,
      context: done && meal ? mealContextOf(meal) : null,
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
