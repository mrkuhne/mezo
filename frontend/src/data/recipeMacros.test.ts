import { describe, it, expect } from 'vitest'
import { roundMacro, lineContribution, enrichLine, computeRecipeMacros } from './recipeMacros'
import type { Ingredient, RecipeIngredientLine } from './types'

const zab: Ingredient = {
  id: 'ing-zab', name: 'Zabpehely', brand: '', source: 'kifli.hu', category: 'carb',
  per: 100, unit: 'g', macros: { kcal: 372, p: 13.5, c: 60, f: 7 },
  price: 0, priceUnit: '', pkg: '', micros: [], nova: 1, stock: null,
  lastUsed: '—', usedInRecipes: 0,
}

describe('recipeMacros (shared contribution/rollup formula)', () => {
  it('roundMacro rounds to one decimal', () => {
    expect(roundMacro(42.04)).toBe(42)
    expect(roundMacro(9.449)).toBe(9.4)
    expect(roundMacro(4.9)).toBe(4.9)
  })

  it('lineContribution scales per-100 macros by amount/per', () => {
    // 70g of zab: factor 0.7 → kcal 372*0.7=260.4→260.4, p 13.5*0.7=9.45→9.5, c 60*0.7=42, f 7*0.7=4.9
    expect(lineContribution(70, 100, zab.macros)).toEqual({ kcal: 260.4, p: 9.5, c: 42, f: 4.9 })
  })

  it('per defaults to 1 for discrete units (amount/1 = amount)', () => {
    // 1 "db" egg @ per:1 macros {kcal:78,...} → factor 1
    const egg = { kcal: 78, p: 6, c: 0.6, f: 5.5 }
    expect(lineContribution(1, 1, egg)).toEqual({ kcal: 78, p: 6, c: 0.6, f: 5.5 })
    expect(lineContribution(2, 0, egg)).toEqual({ kcal: 156, p: 12, c: 1.2, f: 11 }) // per 0 → treated as 1
  })

  it('enrichLine fills name + contribution from the ingredient', () => {
    const line: RecipeIngredientLine = { refId: 'ing-zab', amount: 70, unit: 'g' }
    const out = enrichLine(line, zab)
    expect(out.name).toBe('Zabpehely')
    expect(out.contribution).toEqual({ kcal: 260.4, p: 9.5, c: 42, f: 4.9 })
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
      { refId: 'ing-zab', amount: 70, unit: 'g', contribution: { kcal: 260.4, p: 9.5, c: 42, f: 4.9 } },
      { refId: 'ing-mez', amount: 12, unit: 'g', contribution: { kcal: 36.5, p: 0, c: 9.9, f: 0 } },
    ]
    expect(computeRecipeMacros(lines)).toEqual({ kcal: 296.9, p: 9.5, c: 51.9, f: 4.9 })
  })
})
