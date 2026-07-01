import { expect, test } from 'vitest'
import { buildPickables } from './pantryPickables'
import type { Ingredient, SupplementStashItem } from './types'

const food = (over: Partial<Ingredient> = {}): Ingredient => ({
  id: 'f1', name: 'Csirkemell', brand: 'kifli', source: 'kifli.hu', category: 'protein',
  per: 100, unit: 'g', macros: { kcal: 110, p: 23, c: 0, f: 1.5 },
  price: 0, priceUnit: '', pkg: '', micros: [], nova: 1, stock: null,
  lastUsed: '—', usedInRecipes: 0, ...over,
})

const supp = (over: Partial<SupplementStashItem> = {}): SupplementStashItem => ({
  id: 's1', name: 'Magnézium-glicinát', brand: 'Pure', type: 'supplement', category: 'sleep',
  dose: '300mg', form: 'kapszula', stock: 10, stockUnit: 'db',
  protocol: '', timing: 'evening', taken: false, ...over,
})

test('buildPickables maps a food ingredient to kind food and keeps its id', () => {
  const out = buildPickables([food()], [])
  expect(out).toHaveLength(1)
  expect(out[0].kind).toBe('food')
  expect(out[0].id).toBe('f1')
})

test('buildPickables includes a stash supplement (raw id) with defaults for missing per/unit/macros', () => {
  const out = buildPickables([], [supp()])
  expect(out).toHaveLength(1)
  expect(out[0].kind).toBe('supplement')
  expect(out[0].id).toBe('s1') // raw id — NOT the buildKamraItems 'stash-' prefix
  expect(out[0].per).toBe(100)
  expect(out[0].unit).toBe('g')
  expect(out[0].macros).toEqual({ kcal: 0, p: 0, c: 0, f: 0 })
})

test('buildPickables preserves supplement macros/per/unit when present (post mezo-1za9)', () => {
  const out = buildPickables([], [supp({ per: 30, unit: 'g', macros: { kcal: 120, p: 24, c: 3, f: 2 } })])
  expect(out[0].per).toBe(30)
  expect(out[0].macros).toEqual({ kcal: 120, p: 24, c: 3, f: 2 })
})

test('buildPickables maps stimulant/medication stash to stim/med kinds', () => {
  const out = buildPickables([], [supp({ id: 'a', type: 'stimulant' }), supp({ id: 'b', type: 'medication' })])
  expect(out.find(p => p.id === 'a')?.kind).toBe('stim')
  expect(out.find(p => p.id === 'b')?.kind).toBe('med')
})

test('buildPickables skips a stash item already mirrored as a food ingredient (stashRefId)', () => {
  const out = buildPickables([food({ id: 'wheyFood', stashRefId: 'whey' })], [supp({ id: 'whey', name: 'Whey' })])
  expect(out).toHaveLength(1)
  expect(out[0].id).toBe('wheyFood')
})

test('buildPickables derives supplement/stim kind from a food category prefix', () => {
  const out = buildPickables(
    [food({ id: 'x', category: 'supplement-stim' }), food({ id: 'y', category: 'supplement' })],
    [],
  )
  expect(out.find(p => p.id === 'x')?.kind).toBe('stim')
  expect(out.find(p => p.id === 'y')?.kind).toBe('supplement')
})
