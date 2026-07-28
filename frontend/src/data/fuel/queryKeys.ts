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
