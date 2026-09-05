import type { PantryItemInput, Recipe } from '@/data/types'

/**
 * What a pantry write can still move on an ALREADY-SAVED recipe (mezo-b9gv).
 *
 * A recipe line freezes its macro snapshot at save time, so the backend's fit pass
 * (`RecipeService.fitLines`) takes kcal/protein/carbs/fat from the LINE, not from the pantry row.
 * Only these facts are re-read from the live pantry item: NOVA class, fiber/sugar/salt/saturated
 * fat, the category (plant-diversity input) and the macro basis (which scales those fact
 * contributions). Editing a price, a brand — or even the macros — therefore cannot change an
 * existing recipe's number, and invalidating its caches for that would light the
 * „Mezo újraértékeli a receptet…" banner on a recipe nothing happened to (the honesty invariant
 * from mezo-uavr).
 */
export interface ScoredPantryFacts {
  category?: string | null
  per?: number
  nova?: number | null
  fiberG?: number | null
  sugarG?: number | null
  saltG?: number | null
  saturatedFatG?: number | null
}

/** Absent in the input means "leave unchanged" (the partial-merge write contract), not "cleared". */
function changed(before: string | number | null | undefined, after: string | number | undefined): boolean {
  return after !== undefined && after !== (before ?? undefined)
}

/**
 * Would this pantry write move the score of a recipe that uses the item?
 * An unknown previous state answers `true` — we never claim "nothing moved" on a guess.
 */
export function movesRecipeScores(prev: ScoredPantryFacts | undefined, next: PantryItemInput): boolean {
  if (!prev) {
    return true
  }
  return (
    changed(prev.category, next.category)
    || changed(prev.per, next.per)
    || changed(prev.nova, next.nova)
    || changed(prev.fiberG, next.fiberG)
    || changed(prev.sugarG, next.sugarG)
    || changed(prev.saltG, next.saltG)
    || changed(prev.saturatedFatG, next.saturatedFatG)
  )
}

/** Ids of the cached recipes whose lines reference this pantry item (`refId` === pantryItemId). */
export function recipesUsingPantryItem(recipes: Recipe[], pantryItemId: string): string[] {
  return recipes
    .filter(r => r.ingredients.some(line => line.refId === pantryItemId))
    .map(r => r.id)
}
