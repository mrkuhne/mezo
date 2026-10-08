import { expect, test } from 'vitest'
import { canSkipMealOn, mealSkipKeys, mealSkipLabel } from '@/features/fuel/logic/mealSkips'

test('numbers same-kind windows in time order', () => {
  expect(mealSkipKeys([{ slotKey: 'breakfast' }, { slotKey: 'snack' }, { slotKey: 'lunch' }, { slotKey: 'snack' }, { slotKey: 'dinner' }]))
    .toEqual(['breakfast#1', 'snack#1', 'lunch#1', 'snack#2', 'dinner#1'])
})

test('allows today and 7 days back, never the future', () => {
  expect(canSkipMealOn('2026-09-28', '2026-09-28')).toBe(true)
  expect(canSkipMealOn('2026-09-21', '2026-09-28')).toBe(true)
  expect(canSkipMealOn('2026-09-20', '2026-09-28')).toBe(false)
  expect(canSkipMealOn('2026-09-29', '2026-09-28')).toBe(false)
})

test('mealSkipLabel: no reason, free text, chip label', () => {
  expect(mealSkipLabel({ reasonCategory: 'NONE' })).toBe('ok nélkül')
  expect(mealSkipLabel({ reasonCategory: 'OTHER', reasonText: 'Munka' })).toBe('„Munka”')
  expect(mealSkipLabel({ reasonCategory: 'NOT_HUNGRY' })).toBe('Nem vagyok éhes')
})
