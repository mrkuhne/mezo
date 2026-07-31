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
})
