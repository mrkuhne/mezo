// ============================================================
// Mezo · Fuel · Kamra — unified-item builder
// Port: prototype/src/fuel-kamra.jsx:32–52 (stashAsItems + ingItems + allItems).
//
// Merges the scraped grocery/supplement ingredients (food) with the supplement
// stash (supplement/stim/med) into one PantryItem shape for KamraCard. Stash
// items already linked to an ingredient via `stashRefId` are skipped to avoid
// duplicate cards (whey/kreatin/aakg are both in `ingredients` and the stash).
// ============================================================
import type { Ingredient, PantryItem, PantryItemKind, SupplementStashItem } from '@/data/types'

export function buildKamraItems(
  ingredients: Ingredient[],
  stash: SupplementStashItem[],
): PantryItem[] {
  // Supplements from the stash that aren't already represented as an ingredient.
  const stashAsItems: PantryItem[] = stash
    .filter(s => !ingredients.find(i => i.stashRefId === s.id))
    .map(s => {
      const kind: PantryItemKind =
        s.type === 'medication' ? 'med' : s.type === 'stimulant' ? 'stim' : 'supplement'
      const category =
        s.type === 'medication' ? 'med' : s.type === 'stimulant' ? 'supplement-stim' : 'supplement'
      return {
        id: 'stash-' + s.id,
        name: s.name,
        brand: s.brand,
        source: s.source ?? (s.brand.toLowerCase().includes('myprotein') ? 'myprotein.hu' : 'manual'),
        category,
        kind,
        dose: s.dose,
        form: s.form,
        protocol: s.protocol,
        stock: s.stock !== null ? { qty: s.stock, unit: s.stockUnit ?? '' } : null,
        stashRefId: s.id,
        isStashOnly: true,
        caffeine: s.caffeine,
        // Nutrition + commerce (mezo-1za9) — carry through so supplement cards/detail show
        // macros/nutrients/price like food. Undefined-safe: absent on pure dose/protocol items.
        per: s.per,
        unit: s.unit,
        macros: s.macros,
        fiberG: s.fiberG,
        sugarG: s.sugarG,
        saltG: s.saltG,
        saturatedFatG: s.saturatedFatG,
        price: s.price,
        priceUnit: s.priceUnit,
        pkg: s.pkg,
        micros: s.micros,
        nova: s.nova,
      }
    })

  const ingItems: PantryItem[] = ingredients.map(i => ({
    ...i,
    kind: i.category.startsWith('supplement-stim')
      ? 'stim'
      : i.category.startsWith('supplement')
        ? 'supplement'
        : 'food',
  }))

  return [...ingItems, ...stashAsItems]
}
