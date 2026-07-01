import { expect, test } from 'vitest'
import { currentWeekOf, localDateString } from '@/lib/dates'

// ISO date for `n` calendar days ago (negative = in the future), in local time.
function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localDateString(d)
}

test('currentWeekOf: a plan starting today is on week 1', () => {
  expect(currentWeekOf(isoDaysAgo(0), 8)).toBe(1)
})

test('currentWeekOf: 7 / 14 days in → week 2 / 3', () => {
  expect(currentWeekOf(isoDaysAgo(7), 8)).toBe(2)
  expect(currentWeekOf(isoDaysAgo(14), 8)).toBe(3)
})

test('currentWeekOf: a future start clamps to week 1 (never 0)', () => {
  expect(currentWeekOf(isoDaysAgo(-7), 8)).toBe(1)
})

test('currentWeekOf: past the end clamps to the last week', () => {
  expect(currentWeekOf(isoDaysAgo(100), 8)).toBe(8)
})
