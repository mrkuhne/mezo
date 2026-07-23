// Fuel day-planner constants (Fuel P5). Pinned Global Constraints from the planner spec —
// the single source of truth for slot placement, snapping, weighting and recipe-fit math.
// Time helpers convert between 'HH:mm' wall-clock strings and minutes-since-midnight.

import type { MealSlot } from '@/data/types'

// mealsPerDay is the only planner default left here — the wake/bed day-anchor moved
// to the sleep goal (mezo-dbsr), which is always set (mock seed / real ghost).
export const PLANNER_DEFAULTS = { mealsPerDay: 4 } as const
export const CAFFEINE_CUTOFF = '14:00'
export const EATING_START_OFFSET_MIN = 45
export const KITCHEN_CLOSE_OFFSET_MIN = 90
export const PRE_WORKOUT_SNAP_MIN = 75
export const POST_WORKOUT_SNAP_MIN = 45
export const DEFAULT_BLOCK_MIN = 60
export const MIN_SLOT_GAP_MIN = 90
export const SLOT_WEIGHT = { main: 2, snack: 1, postWorkoutMain: 2.5 } as const
export const RECIPE_FIT_TOLERANCE = 0.2
export const FAT_KCAL_SHARE = 0.275

/** 'HH:mm' → minutes since midnight. */
export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** minutes since midnight → zero-padded 'HH:mm', clamped to 00:00..23:59. */
export function toHHmm(min: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.round(min)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** A planner window label ('Reggeli'/'Ebéd'/'Vacsora'/'Uzsonna'/…) → the `MealSlot` enum the
 *  LogMealSheet segmented control speaks. The three mains map 1:1; every snack window falls to
 *  'snack'. Mirrors `mealSlotKey` (buildDayPlan) but keyed on the display label, not `FuelMeal.slot`. */
export function slotKeyOfLabel(label: string): MealSlot {
  const s = label.toLowerCase()
  if (s.includes('reggeli')) return 'breakfast'
  if (s.includes('ebéd') || s.includes('ebed')) return 'lunch'
  if (s.includes('vacsora')) return 'dinner'
  return 'snack'
}
