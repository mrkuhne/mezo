// ============================================================
// Mezo · Fuel · Kamra — unified-item builder
// Port: prototype/src/fuel-kamra.jsx:32–52 (stashAsItems + ingItems + allItems).
//
// Merges the scraped grocery/supplement ingredients (food) with the supplement
// stash (supplement/stim/med) into one PantryItem shape for KamraCard. Stash
// items already linked to an ingredient via `stashRefId` are skipped to avoid
// duplicate cards (whey/kreatin are both in `ingredients` and the stash).
// ============================================================
import type { Ingredient, PantryItem, PantryItemKind, SupplementStashItem } from '@/data/types'
import type { Icon3DName } from '@/shared/ui/clay'
import { m } from '@/shared/i18n'
import type { fuelKamraHu } from '@/shared/i18n/messages/fuel-kamra.hu'

/** A kategória felirata a pillanatnyi nyelven (a szerver a KULCSOT küldi). Ismeretlen kulcs változatlanul megy ki;
 *  `null` = a tételnek nincs kategóriája. HÍVÁSKOR olvas — sosem modul-konstansba. */
export function pantryCategoryLabel(key: string | null | undefined): string | null {
  if (key == null || key === '') return null
  const cat = m().fuelKamra.cat as Record<string, string>
  return cat[key] ?? key
}

type CatKey = keyof typeof fuelKamraHu.cat
/** Étel ikonja a kategóriájából (prototípus `KIC`); ami nincs benne, az a gabona-jel. */
const FOOD_ICON: Partial<Record<CatKey, Icon3DName>> = {
  protein: 't-meat', meat: 't-meat', fish: 't-meat', eggs: 't-meat',
  dairy: 't-protein', cheese: 't-protein', 'supplement-protein': 't-protein',
  carb: 't-carb', grains: 't-carb', pasta: 't-carb', bakery: 't-carb',
  fat: 't-avocado', nuts_seeds: 't-avocado', oils_fats: 't-avocado',
  veggie: 't-fiber', vegetables: 't-fiber', fruit: 't-fiber', fruits: 't-fiber', legumes: 't-fiber',
  condiments: 't-sugar', snacks: 't-sugar', other: 't-sugar',
}
/** The four kinds in shelf order, and the glyph of each (the hero's four jars, the filter). */
export const KAMRA_KINDS: PantryItemKind[] = ['food', 'supplement', 'stim', 'med']
export const KAMRA_KIND_ICON: Record<PantryItemKind, Icon3DName> = { food: 't-carb', supplement: 't-supps', stim: 't-bolt', med: 't-syringe' }

/** Egy ÉTEL jele a kategóriájából (prototípus `KIC`): a kamra-választó sorai és a logoló piszkozat-sorai is ezt kérik. */
export function pantryCategoryIcon(category: string | null | undefined): Icon3DName {
  return FOOD_ICON[(category ?? '') as CatKey] ?? 't-carb'
}

/** Egy tétel jele (prototípus `kic`): ételnél a kategória, minden másnál a fajta. */
export function kamraItemIcon(item: { kind: PantryItemKind | string; category?: string | null }): Icon3DName {
  if (item.kind === 'food') return pantryCategoryIcon(item.category)
  return KAMRA_KIND_ICON[item.kind as PantryItemKind] ?? 't-stack'
}

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
        source: s.source ?? ((s.brand ?? '').toLowerCase().includes('myprotein') ? 'myprotein.hu' : 'manual'),
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
        // S4 (mezo-qw37.4): shared-catalog provenance — carry through like the food arm below.
        catalogId: s.catalogId,
        sharedFrom: s.sharedFrom,
        catalogEditable: s.catalogEditable,
      }
    })

  const ingItems: PantryItem[] = ingredients.map(i => ({ ...i }))

  return [...ingItems, ...stashAsItems]
}
