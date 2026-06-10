import { buildKamraItems } from './kamraItems'
import { ingredients } from '@/data/pantry'
import { supplementsStash } from '@/data/fuel'

test('merges ingredients + stash into unified items with a kind', () => {
  const items = buildKamraItems(ingredients, supplementsStash)
  expect(items.length).toBeGreaterThan(ingredients.length)
  expect(items.every(i => ['food', 'supplement', 'stim', 'med'].includes(i.kind))).toBe(true)
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
