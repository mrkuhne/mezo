import { describe, it, expect } from 'vitest'
import { movesRecipeScores, recipesUsingPantryItem } from '@/data/fuel/pantryImpact'
import type { PantryItemInput, Recipe } from '@/data/types'

const prev = {
  category: 'grains',
  per: 100,
  nova: 1 as const,
  fiberG: 10,
  sugarG: 2,
  saltG: 0.1,
  saturatedFatG: 0.5,
}

const base: PantryItemInput = { kind: 'food', name: 'Zab' }

describe('movesRecipeScores', () => {
  it('is false when only commerce/identity fields changed', () => {
    expect(movesRecipeScores(prev, { ...base, name: 'Zabpehely', brand: 'X', price: 990 })).toBe(false)
  })

  // The interesting one: a saved recipe's MACROS are frozen in its line snapshots
  // (backend RecipeService.fitLines), so editing a pantry item's kcal/P/C/F cannot move
  // an existing recipe's number — claiming a re-evaluation there would be a lie.
  it('is false when only the macros changed', () => {
    expect(movesRecipeScores(prev, { ...base, kcal: 380, proteinG: 14, carbsG: 61, fatG: 8 })).toBe(false)
  })

  it('is true when a live-read quality fact changed', () => {
    expect(movesRecipeScores(prev, { ...base, nova: 4 })).toBe(true)
    expect(movesRecipeScores(prev, { ...base, fiberG: 3 })).toBe(true)
    expect(movesRecipeScores(prev, { ...base, sugarG: 20 })).toBe(true)
    expect(movesRecipeScores(prev, { ...base, saltG: 1.4 })).toBe(true)
    expect(movesRecipeScores(prev, { ...base, saturatedFatG: 6 })).toBe(true)
  })

  it('is true when the category changed (plant-diversity input)', () => {
    expect(movesRecipeScores(prev, { ...base, category: 'nuts_seeds' })).toBe(true)
  })

  it('is true when the macro basis changed (scales the fact contributions)', () => {
    expect(movesRecipeScores(prev, { ...base, per: 30 })).toBe(true)
  })

  it('is false when a live-read fact is re-sent unchanged', () => {
    expect(movesRecipeScores(prev, { ...base, nova: 1, fiberG: 10 })).toBe(false)
  })

  it('treats an unknown previous state as a change (never guesses "nothing moved")', () => {
    expect(movesRecipeScores(undefined, { ...base, name: 'Zab' })).toBe(true)
  })

  it('detects a fact appearing where there was none', () => {
    expect(movesRecipeScores({ ...prev, fiberG: null }, { ...base, fiberG: 10 })).toBe(true)
  })
})

describe('recipesUsingPantryItem', () => {
  const recipes = [
    { id: 'r1', ingredients: [{ refId: 'p-zab' }, { refId: 'p-turo' }] },
    { id: 'r2', ingredients: [{ refId: 'p-turo' }] },
    { id: 'r3', ingredients: [] },
  ] as unknown as Recipe[]

  it('returns only the recipes that reference the item', () => {
    expect(recipesUsingPantryItem(recipes, 'p-zab')).toEqual(['r1'])
    expect(recipesUsingPantryItem(recipes, 'p-turo')).toEqual(['r1', 'r2'])
  })

  it('returns nothing for an unreferenced item', () => {
    expect(recipesUsingPantryItem(recipes, 'p-new')).toEqual([])
  })

  it('tolerates an empty/undefined recipe cache', () => {
    expect(recipesUsingPantryItem([], 'p-zab')).toEqual([])
  })
})
