import { describe, it, expect } from 'vitest'
import type { Recipe, RecipeIngredientLine, RecipeInput } from '@/data/types'

describe('Recipe type extensions (per-line name + contribution, RecipeInput)', () => {
  it('a RecipeIngredientLine carries refId + optional name + contribution', () => {
    const line: RecipeIngredientLine = {
      refId: '11111111-1111-4111-8111-111111111111',
      amount: 70, unit: 'g', note: 'főtt',
      name: 'Zabpehely',
      contribution: { kcal: 260, p: 9, c: 42, f: 5 },
    }
    expect(line.refId).toMatch(/^[0-9a-f-]+$/)
    expect(line.name).toBe('Zabpehely')
    expect(line.contribution).toEqual({ kcal: 260, p: 9, c: 42, f: 5 })
  })

  it('a Recipe exposes line-level name/contribution and a nullable mezoFit.score', () => {
    const recipe: Recipe = {
      id: 'r1', name: 'Teszt', slot: 'Reggeli', category: 'breakfast',
      createdDate: 'Ma', timesLogged: 0, avgScore: 0, lastLogged: '—',
      servings: 1, prepMins: 5, cookMins: 0, tags: ['x'],
      ingredients: [{ refId: 'p1', amount: 70, unit: 'g', name: 'Zab', contribution: { kcal: 260, p: 9, c: 42, f: 5 } }],
      macros: { kcal: 260, p: 9, c: 42, f: 5 },
      novaDominant: 1,
      mezoFit: { score: null, fitsFor: [] },
      starred: false,
    }
    expect(recipe.ingredients[0].name).toBe('Zab')
    expect(recipe.mezoFit.score).toBeNull()
  })

  it('a RecipeInput is the editor save payload (pantryItemId lines)', () => {
    const input: RecipeInput = {
      name: 'Új recept', slot: null, category: 'lunch', servings: 2,
      prepMins: 10, cookMins: 20, tags: [], starred: false,
      ingredients: [{ pantryItemId: 'p1', amount: 200, unit: 'g', note: null }],
    }
    expect(input.ingredients[0].pantryItemId).toBe('p1')
    expect(input.category).toBe('lunch')
  })
})
