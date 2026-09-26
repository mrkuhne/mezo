import type { QueryClient } from '@tanstack/react-query'

/**
 * The Fuel domain's shared TanStack query keys.
 *
 * They live here because writes on one aggregate invalidate another's cache across module
 * boundaries — a recipe write touches the pantry (usedInRecipes), a pantry write touches the
 * recipes that reference the item (mezo-b9gv) — and importing a key from the neighbouring hook
 * module would make `pantryHooks` ↔ `recipeHooks` circular. One definition, no drift.
 */
export const PANTRY_KEY = ['pantry'] as const
export const RECIPES_KEY = ['recipes'] as const
export const RECIPE_BREAKDOWN_KEY = (id: string) => ['recipeBreakdown', id] as const

/** The Fuel day / week read roots (`['fuelDay', date]`, `['fuelWeek', start]`). */
export const FUEL_DAY_ROOT = ['fuelDay'] as const
export const FUEL_WEEK_ROOT = ['fuelWeek'] as const

/**
 * A logged session (sport, run, finished workout) moves the served Fuel target (mezo-32m82):
 * planned-done flips the day-type pick, an unplanned one adds extra kcal — so the Fuel day + week
 * reads refetch at once instead of showing a stale target. Real mode only (callers gate).
 */
export function invalidateFuelTargets(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: FUEL_DAY_ROOT })
  qc.invalidateQueries({ queryKey: FUEL_WEEK_ROOT })
}
