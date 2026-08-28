import { expect, test } from 'vitest'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'
import { prevMonday, nextMonday, isCurrentWeek } from '@/features/me/logic/weekNav'

test('prevMonday/nextMonday step by exactly 7 days', () => {
  expect(prevMonday('2026-05-18')).toBe('2026-05-11')
  expect(nextMonday('2026-05-18')).toBe('2026-05-25')
})

test('prevMonday/nextMonday cross a month boundary', () => {
  expect(prevMonday('2026-06-01')).toBe('2026-05-25')
  expect(nextMonday('2026-05-25')).toBe('2026-06-01')
})

test('prevMonday/nextMonday cross a year boundary', () => {
  expect(prevMonday('2027-01-04')).toBe('2026-12-28')
  expect(nextMonday('2026-12-28')).toBe('2027-01-04')
})

test('isCurrentWeek is true only for today\'s Monday', () => {
  const today = mondayIso()
  expect(isCurrentWeek(today)).toBe(true)
  expect(isCurrentWeek(prevMonday(today))).toBe(false)
  expect(isCurrentWeek(nextMonday(today))).toBe(false)
})
