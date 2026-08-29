import { describe, it, expect } from 'vitest'
import { roundMacro, lineContribution, enrichLine, computeRecipeMacros, computeRecipeMacrosWithOverrides } from '@/data/fuel/recipeMacros'
import type { Ingredient, RecipeIngredientLine } from '@/data/types'

const zab: Ingredient = {
  id: 'ing-zab', name: 'Zabpehely', brand: '', source: 'kifli.hu', category: 'carb',
  per: 100, unit: 'g', macros: { kcal: 372, p: 13.5, c: 60, f: 7 },
  price: 0, priceUnit: '', pkg: '', micros: [], nova: 1, stock: null,
  lastUsed: '—', usedInRecipes: 0,
}

describe('recipeMacros (shared contribution/rollup formula)', () => {
  it('roundMacro rounds to whole numbers (matching backend setScale(0, HALF_UP))', () => {
    expect(roundMacro(42.04)).toBe(42)
    expect(roundMacro(9.449)).toBe(9)
    expect(roundMacro(4.9)).toBe(5)
  })

  it('lineContribution scales per-100 macros by amount/per', () => {
    // 70g of zab: factor 0.7 → kcal 372*0.7=260.4→260, p 13.5*0.7=9.45→9, c 60*0.7=42, f 7*0.7=4.9→5
    expect(lineContribution(70, 100, zab.macros)).toEqual({ kcal: 260, p: 9, c: 42, f: 5 })
  })

  it('per defaults to 1 for discrete units (amount/1 = amount)', () => {
    // 1 "db" egg @ per:1 macros {kcal:78,...} → factor 1
    const egg = { kcal: 78, p: 6, c: 0.6, f: 5.5 }
    expect(lineContribution(1, 1, egg)).toEqual({ kcal: 78, p: 6, c: 1, f: 6 })
    expect(lineContribution(2, 0, egg)).toEqual({ kcal: 156, p: 12, c: 1, f: 11 }) // per 0 → treated as 1
  })

  it('enrichLine fills name + contribution from the ingredient', () => {
    const line: RecipeIngredientLine = { refId: 'ing-zab', amount: 70, unit: 'g' }
    const out = enrichLine(line, zab)
    expect(out.name).toBe('Zabpehely')
    expect(out.contribution).toEqual({ kcal: 260, p: 9, c: 42, f: 5 })
    expect(out.refId).toBe('ing-zab')
  })

  it('enrichLine zeros the contribution when the ingredient is missing', () => {
    const line: RecipeIngredientLine = { refId: 'gone', amount: 70, unit: 'g' }
    const out = enrichLine(line, undefined)
    expect(out.name).toBe('gone')
    expect(out.contribution).toEqual({ kcal: 0, p: 0, c: 0, f: 0 })
  })

  it('computeRecipeMacros sums enriched line contributions', () => {
    const lines: RecipeIngredientLine[] = [
      { refId: 'ing-zab', amount: 70, unit: 'g', contribution: { kcal: 260, p: 9, c: 42, f: 5 } },
      { refId: 'ing-mez', amount: 12, unit: 'g', contribution: { kcal: 37, p: 0, c: 10, f: 0 } },
    ]
    expect(computeRecipeMacros(lines)).toEqual({ kcal: 297, p: 9, c: 52, f: 5 })
  })
})

describe('computeRecipeMacrosWithOverrides', () => {
  // Mirrors the backend fixture: per-100g 110/13/4/4.5, lines 250 g and 20 g.
  const src = {
    id: 'ing-x', name: 'Túró', per: 100, unit: 'g',
    macros: { kcal: 110, p: 13, c: 4, f: 4.5 },
  } as unknown as Ingredient
  const lines: RecipeIngredientLine[] = [
    { refId: 'ing-x', amount: 250, unit: 'g' },
    { refId: 'ing-x', amount: 20, unit: 'g' },
  ]

  it('reproduces the stored rollup when there are no overrides', () => {
    // 250 g -> 275/33/10/11 ; 20 g -> 22/3/1/1 ; sum 297/36/11/12
    expect(computeRecipeMacrosWithOverrides(lines, [src], {})).toEqual(
      { kcal: 297, p: 36, c: 11, f: 12 })
  })

  it('drops a line overridden to 0', () => {
    expect(computeRecipeMacrosWithOverrides(lines, [src], { 1: 0 })).toEqual(
      { kcal: 275, p: 33, c: 10, f: 11 })
  })

  it('scales a halved line', () => {
    // 125 g -> 137.5/16.25/5/5.625 -> 138/16/5/6 ; plus 22/3/1/1 -> 160/19/6/7
    expect(computeRecipeMacrosWithOverrides(lines, [src], { 0: 125 })).toEqual(
      { kcal: 160, p: 19, c: 6, f: 7 })
  })

  it('rounds each line before summing, exactly like the backend', () => {
    // THE rounding-order guard, mirroring RecipeMapperOverrideRollupTest. Both lines at 4 g:
    //   per line   kcal 1.1×4 = 4.4 -> 4 ; p 0.13×4 = 0.52 -> 1
    //   per-line-then-sum : kcal 8   ; p 2
    //   sum-then-round    : kcal 8.8 -> 9 ; p 1.04 -> 1
    // Both macros disagree between the strategies, so this genuinely discriminates them —
    // unlike the halved-line case above (159.5 rounds to 160 either way).
    const m = computeRecipeMacrosWithOverrides(lines, [src], { 0: 4, 1: 4 })
    expect(m.kcal).toBe(8)
    expect(m.p).toBe(2)
  })

  it('keys by array index so a repeated ingredient is disambiguated', () => {
    // both lines share refId 'ing-x'; overriding index 1 must not touch index 0
    expect(computeRecipeMacrosWithOverrides(lines, [src], { 1: 40 }).kcal).toBe(275 + 44)
  })

  it('keeps the server-frozen contribution for an untouched line, even if the pantry row drifted', () => {
    // the recipe line was frozen at 110 kcal; the live pantry row now says 999 kcal/100 g
    const drifted = { ...src, macros: { kcal: 999, p: 99, c: 99, f: 99 } } as unknown as Ingredient
    const frozen: RecipeIngredientLine[] = [
      { refId: 'ing-x', amount: 100, unit: 'g', contribution: { kcal: 110, p: 13, c: 4, f: 5 } },
      { refId: 'ing-x', amount: 100, unit: 'g', contribution: { kcal: 110, p: 13, c: 4, f: 5 } },
    ]
    // nothing overridden -> both lines must report their frozen values, not the drifted rate
    expect(computeRecipeMacrosWithOverrides(frozen, [drifted], {})).toEqual(
      { kcal: 220, p: 26, c: 8, f: 10 })
  })

  it('keeps an untouched line whole when its pantry source is gone', () => {
    const orphan: RecipeIngredientLine[] = [
      { refId: 'ing-deleted', amount: 50, unit: 'g', contribution: { kcal: 55, p: 6, c: 2, f: 2 } },
    ]
    expect(computeRecipeMacrosWithOverrides(orphan, [], {})).toEqual({ kcal: 55, p: 6, c: 2, f: 2 })
  })

  it('rescales the frozen contribution for an overridden line whose pantry source is gone', () => {
    const orphan: RecipeIngredientLine[] = [
      { refId: 'ing-deleted', amount: 50, unit: 'g', contribution: { kcal: 55, p: 6, c: 2, f: 2 } },
    ]
    // halving 50 g -> factor 0.5 over the frozen 55/6/2/2. Falling back to 0 here would erase a line
    // the server still counts in full from its own frozen snapshot.
    expect(computeRecipeMacrosWithOverrides(orphan, [], { 0: 25 })).toEqual(
      { kcal: 28, p: 3, c: 1, f: 1 })
  })
})

import {
  NO_NUTRIENTS, lineNutrients, sumNutrients, computeRecipeNutrients,
  computeRecipeNutrientsWithOverrides, rescaleFrozenNutrients, factsOf,
} from '@/data/fuel/recipeMacros'

// The single normalizer behind enrichLine, computeRecipeNutrientsWithOverrides,
// LogFlowPage's pantry-arm line, and ImportItemSheet's preview (mezo-m6uv review finding 3).
describe('factsOf', () => {
  it('reads the four fields off any structurally-matching source', () => {
    const src = { fiberG: 3.2, sugarG: 4.1, saltG: 0.4, saturatedFatG: 2.8 }
    expect(factsOf(src)).toEqual({ fiberG: 3.2, sugarG: 4.1, saltG: 0.4, saturatedFatG: 2.8 })
  })

  it('keeps a missing field null — never coerced to 0', () => {
    const src = { fiberG: undefined, sugarG: null, saltG: 0.4, saturatedFatG: undefined }
    expect(factsOf(src)).toEqual({ fiberG: null, sugarG: null, saltG: 0.4, saturatedFatG: null })
  })

  it('returns NO_NUTRIENTS for an absent source, never a fabricated value', () => {
    expect(factsOf(undefined)).toEqual(NO_NUTRIENTS)
    expect(factsOf(null)).toEqual(NO_NUTRIENTS)
  })

  it('accepts an Ingredient and a PantryLookupItem-shaped source alike (structural typing)', () => {
    // Ingredient-shaped (extra unrelated fields present)
    const ingredientLike = { id: 'x', fiberG: 1, sugarG: null, saltG: null, saturatedFatG: 0.5 }
    expect(factsOf(ingredientLike)).toEqual({ fiberG: 1, sugarG: null, saltG: null, saturatedFatG: 0.5 })
    // PantryLookupItem-shaped (different unrelated fields, same four)
    const pantryLookupLike = { name: 'x', per: 100, unit: 'g', fiberG: null, sugarG: 2, saltG: 0.1, saturatedFatG: null }
    expect(factsOf(pantryLookupLike)).toEqual({ fiberG: null, sugarG: 2, saltG: 0.1, saturatedFatG: null })
  })
})

test('lineNutrients scales per-basis facts and keeps three decimals', () => {
  const src = { fiberG: 3.25, sugarG: 4.1, saltG: 0.4, saturatedFatG: 2.8 }
  expect(lineNutrients(200, 100, src)).toEqual({ fiberG: 6.5, sugarG: 8.2, saltG: 0.8, saturatedFatG: 5.6 })
})

// The FE twin of the backend's boundary test (MealApiIT, mezo-m6uv): a small salt contribution must
// NOT collapse to 0.1 the way one-decimal storage rounding did. Fails if roundGram goes back to /10.
test('lineNutrients keeps a small salt contribution intact instead of rounding it up', () => {
  const src = { fiberG: null, sugarG: null, saltG: 0.4, saturatedFatG: null }
  expect(lineNutrients(20, 100, src).saltG).toBe(0.08)
})

test('lineNutrients keeps a missing fact null — never 0', () => {
  const src = { fiberG: null, sugarG: 4, saltG: null, saturatedFatG: null }
  expect(lineNutrients(100, 100, src)).toEqual({ fiberG: null, sugarG: 4, saltG: null, saturatedFatG: null })
})

test('sumNutrients is null-preserving: partial sum, null only when every line is null', () => {
  const withFacts = { fiberG: 3, sugarG: null, saltG: 0.4, saturatedFatG: null }
  expect(sumNutrients([withFacts, NO_NUTRIENTS])).toEqual({ fiberG: 3, sugarG: null, saltG: 0.4, saturatedFatG: null })
  expect(sumNutrients([NO_NUTRIENTS, NO_NUTRIENTS])).toEqual(NO_NUTRIENTS)
})

test('an empty override map reproduces the plain nutrient rollup', () => {
  const lines = [
    { refId: 'a', amount: 200, unit: 'g', nutrients: { fiberG: 6.4, sugarG: null, saltG: 0.8, saturatedFatG: 5.6 } },
    { refId: 'b', amount: 150, unit: 'g' },
  ]
  expect(computeRecipeNutrientsWithOverrides(lines, [], {})).toEqual(computeRecipeNutrients(lines))
})

test('an overridden line rescales from the live source when one resolves', () => {
  const lines = [{ refId: 'a', amount: 200, unit: 'g', nutrients: { fiberG: 6.4, sugarG: null, saltG: 0.8, saturatedFatG: 5.6 } }]
  const ingredients = [{
    id: 'a', name: 'Túró', brand: '', source: 'manual' as const, category: 'dairy',
    per: 100, unit: 'g', macros: { kcal: 110, p: 13, c: 4, f: 4.5 },
    fiberG: 3.2, sugarG: null, saltG: 0.4, saturatedFatG: 2.8,
    price: 0, priceUnit: '', pkg: '', micros: [], nova: 1 as const, stock: null,
    lastUsed: '', usedInRecipes: 0,
  }]
  expect(computeRecipeNutrientsWithOverrides(lines, ingredients, { 0: 100 })).toEqual(
    { fiberG: 3.2, sugarG: null, saltG: 0.4, saturatedFatG: 2.8 })
})

test('rescaleFrozenNutrients falls back to the frozen contribution when the source is gone', () => {
  const frozen = { fiberG: 6.4, sugarG: null, saltG: 0.8, saturatedFatG: 5.6 }
  expect(rescaleFrozenNutrients(frozen, 100, 200)).toEqual({ fiberG: 3.2, sugarG: null, saltG: 0.4, saturatedFatG: 2.8 })
  expect(rescaleFrozenNutrients(undefined, 100, 200)).toEqual(NO_NUTRIENTS)
})
