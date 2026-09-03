import { describe, expect, test } from 'vitest'
import { defaultMealSlot } from '@/features/fuel/logic/defaultMealSlot'

describe('defaultMealSlot', () => {
  test.each([
    [6, 'breakfast'],
    [10, 'breakfast'],
    [11, 'lunch'],
    [14, 'lunch'],
    [15, 'dinner'],
    [20, 'dinner'],
    [21, 'snack'],
    [23, 'snack'],
  ] as const)('hour %i → %s', (h, expected) => {
    expect(defaultMealSlot(new Date(2026, 0, 1, h))).toBe(expected)
  })
})
