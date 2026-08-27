import { isoWeekNumber } from '@/data/insights/weeklyHooks'

test('isoWeekNumber: ISO-8601 week number', () => {
  expect(isoWeekNumber('2026-06-29')).toBe(27)
})
