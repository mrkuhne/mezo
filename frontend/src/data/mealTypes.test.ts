import { describe, it, expectTypeOf } from 'vitest'
import type { MealSlot, MealItemSource, MealItemLine, MealInput, MealItemInput, FuelMeal } from '@/data/types'

describe('meal domain types', () => {
  it('MealSlot is the 4-slot union', () => {
    expectTypeOf<MealSlot>().toEqualTypeOf<'breakfast' | 'lunch' | 'dinner' | 'snack'>()
  })

  it('MealItemLine carries source + refId + contribution + optional nova', () => {
    const line: MealItemLine = {
      source: 'recipe', refId: 'r1', amount: 1, unit: 'adag',
      name: 'Túrós zabkása', contribution: { kcal: 580, p: 42, c: 78, f: 12 }, nova: 3,
    }
    expectTypeOf(line.source).toEqualTypeOf<MealItemSource>()
    expectTypeOf(line.refId).toBeString()
    expectTypeOf(line.contribution.kcal).toBeNumber()
  })

  it('FuelMeal gains structured mealItems + real loggedAt/mealDate, keeps legacy items', () => {
    expectTypeOf<FuelMeal>().toHaveProperty('mealItems').toEqualTypeOf<MealItemLine[]>()
    expectTypeOf<FuelMeal>().toHaveProperty('loggedAt').toBeString()
    expectTypeOf<FuelMeal>().toHaveProperty('mealDate').toBeString()
    expectTypeOf<FuelMeal>().toHaveProperty('items').toEqualTypeOf<string[]>()
  })

  it('MealInput is the editor payload (slot + nullable loggedAt/title + items)', () => {
    const input: MealInput = {
      slot: 'breakfast', loggedAt: null, title: null,
      items: [{ source: 'pantry', refId: 'p-zab', amount: 70, unit: 'g' } satisfies MealItemInput],
    }
    expectTypeOf(input.items[0]).toEqualTypeOf<MealItemInput>()
  })
})
