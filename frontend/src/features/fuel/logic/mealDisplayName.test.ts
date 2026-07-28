import { describe, it, expect } from 'vitest'
import { mealDisplayName } from '@/features/fuel/logic/mealDisplayName'
import type { FuelMeal, MealItemLine } from '@/data/types'

// Minimal FuelMeal factory — mealDisplayName only reads `title` + `mealItems[].name`.
function meal(title: string, names: string[]): FuelMeal {
  const mealItems = names.map(
    (name): MealItemLine => ({
      source: 'pantry',
      refId: '',
      amount: 1,
      unit: 'g',
      name,
      contribution: { kcal: 0, p: 0, c: 0, f: 0 },
    }),
  )
  return { title, mealItems } as FuelMeal
}

describe('mealDisplayName', () => {
  it('returns the title when present', () => {
    expect(mealDisplayName(meal('Túrós zabkása', ['Zabpehely', 'Túró']))).toBe('Túrós zabkása')
  })

  it('derives a joined name from item names when the title is empty', () => {
    expect(mealDisplayName(meal('', ['Alma', 'Banán']))).toBe('Alma, Banán')
  })

  it('returns undefined when there is no title and no items', () => {
    expect(mealDisplayName(meal('', []))).toBeUndefined()
  })

  it('returns undefined when the title is empty and item names are blank', () => {
    expect(mealDisplayName(meal('', ['', '  ']))).toBeUndefined()
  })
})
