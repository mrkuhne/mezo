// ============================================================
// Mezo · Recipe ingredient pickables (mezo-3vu4)
// One list of everything that can go INTO a recipe: the food ingredients plus the
// supplement/stim/med stash (protein powder etc. are legit recipe inputs). Lives in
// the data layer because BOTH the FE picker/editor (usePickableIngredients) AND the
// mock recipe builder (recipeHooks.buildRecipe) resolve lines through it, so they can
// never drift. Mirrors buildKamraItems' food+stash merge, but keeps the RAW pantry id
// (a recipe line stores `pantryItemId = id`, so it must resolve back 1:1) and
// normalizes every item to the Ingredient shape the picker + editor already consume,
// tagged with `kind`. Stash items already mirrored as a food ingredient (stashRefId)
// are skipped to avoid a duplicate row.
// ============================================================
import { useMemo } from 'react'
import { usePantry } from '@/data/fuel/pantryHooks'
import type { Ingredient, PantryItemKind, SupplementStashItem } from '@/data/types'

/** An Ingredient the recipe picker can offer, tagged with its pantry kind. */
export interface PickableIngredient extends Ingredient {
  kind: PantryItemKind
}

const ZERO = { kcal: 0, p: 0, c: 0, f: 0 }

// A food's kind is encoded in its category prefix (same rule as buildKamraItems).
function foodKind(category: string): PantryItemKind {
  return category.startsWith('supplement-stim')
    ? 'stim'
    : category.startsWith('supplement')
      ? 'supplement'
      : 'food'
}

// Map a stash supplement onto the Ingredient shape, filling defaults for the
// nutrition/commerce facts a pure dose/protocol item lacks (mezo-1za9 made these
// optional). Keeps the raw id so a saved recipe line resolves back to it.
function supplementToPickable(s: SupplementStashItem): PickableIngredient {
  return {
    id: s.id,
    name: s.name,
    brand: s.brand,
    source: s.source ?? 'manual',
    category: s.category,
    per: s.per ?? 100,
    unit: s.unit ?? 'g',
    macros: s.macros ?? { ...ZERO },
    fiberG: s.fiberG,
    sugarG: s.sugarG,
    saltG: s.saltG,
    saturatedFatG: s.saturatedFatG,
    price: s.price ?? 0,
    priceUnit: s.priceUnit ?? '',
    pkg: s.pkg ?? '',
    micros: s.micros ?? [],
    nova: s.nova ?? 1,
    stock: s.stock != null ? { qty: s.stock, unit: s.stockUnit ?? '', expires: null } : null,
    lastUsed: '—',
    usedInRecipes: 0,
    kind: s.type === 'medication' ? 'med' : s.type === 'stimulant' ? 'stim' : 'supplement',
  }
}

/** Merge foods + stash into one pickable list (foods first, then stash-only). */
export function buildPickables(
  ingredients: Ingredient[],
  stash: SupplementStashItem[],
): PickableIngredient[] {
  const foods: PickableIngredient[] = ingredients.map(i => ({ ...i, kind: foodKind(i.category) }))
  const supplements: PickableIngredient[] = stash
    .filter(s => !ingredients.some(i => i.stashRefId === s.id))
    .map(supplementToPickable)
  return [...foods, ...supplements]
}

/** Live pickable list from the pantry cache — the single source the picker AND the
 *  editor's line-resolution draw from, so they can never drift apart. */
export function usePickableIngredients(): PickableIngredient[] {
  const { ingredients, stash } = usePantry()
  return useMemo(() => buildPickables(ingredients, stash), [ingredients, stash])
}

const KIND_LABEL: Record<PantryItemKind, string> = {
  food: 'Étel',
  supplement: 'Kieg.',
  stim: 'Stim.',
  med: 'Gyógyszer',
}
/** Short Hungarian label for the picker/editor type badge. */
export function kindLabel(kind: PantryItemKind): string {
  return KIND_LABEL[kind]
}
