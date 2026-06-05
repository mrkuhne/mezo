import { buildKamraItems } from './kamraItems'
import { ingredients } from '@/data/pantry'
import { supplementsStash } from '@/data/fuel'

test('merges ingredients + stash into unified items with a kind', () => {
  const items = buildKamraItems(ingredients, supplementsStash)
  expect(items.length).toBeGreaterThan(ingredients.length)
  expect(items.every(i => ['food', 'supplement', 'stim', 'med'].includes(i.kind))).toBe(true)
})
