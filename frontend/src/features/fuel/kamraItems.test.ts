import { buildKamraItems } from '@/features/fuel/kamraItems'
import { ingredients } from '@/data/pantry'
import { supplementsStash } from '@/data/fuel'
import type { SupplementStashItem } from '@/data/types'

test('merges ingredients + stash into unified items with a kind', () => {
  const items = buildKamraItems(ingredients, supplementsStash)
  expect(items.length).toBeGreaterThan(ingredients.length)
  expect(items.every(i => ['food', 'supplement', 'stim', 'med'].includes(i.kind))).toBe(true)
})

test('carries macros / nutrients / price / source from a supplement stash item onto the built card (mezo-1za9)', () => {
  const stash: SupplementStashItem[] = [{
    id: 'coll', name: 'Collagen Protein', brand: '', type: 'supplement', category: 'supplement',
    dose: '20g', form: '', stock: null, stockUnit: null, protocol: '', timing: 'flexible', taken: false,
    source: 'manual', per: 100, unit: 'g', macros: { kcal: 360, p: 90, c: 0, f: 0 },
    price: 20490, fiberG: 0, sugarG: 0, saltG: 0, saturatedFatG: null,
  }]
  const [item] = buildKamraItems([], stash)
  expect(item.kind).toBe('supplement')
  expect(item.macros).toEqual({ kcal: 360, p: 90, c: 0, f: 0 })
  expect(item.price).toBe(20490)
  expect(item.source).toBe('manual')
  expect(item.per).toBe(100)
})

test('skips stash items already linked via an ingredient stashRefId, yielding 25 unified items', () => {
  const items = buildKamraItems(ingredients, supplementsStash)
  expect(items).toHaveLength(25) // 18 ingredients + (10 stash − 3 linked: whey/kreatin/aakg)
  // linked stash twins are NOT duplicated as stash-only items
  const stashOnlyIds = items.filter(i => i.isStashOnly).map(i => i.id)
  expect(stashOnlyIds).not.toContain('stash-whey')
  expect(stashOnlyIds).not.toContain('stash-kreatin')
  expect(stashOnlyIds).not.toContain('stash-aakg')
})
