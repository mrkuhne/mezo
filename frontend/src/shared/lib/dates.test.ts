import { expect, test } from 'vitest'
import { currentWeekOf, localDateString, nowOffsetIso, offsetIso } from '@/shared/lib/dates'

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

// offsetIso/nowOffsetIso must ALWAYS carry a numeric ±hh:mm offset (never bare/UTC-shifted) so the
// server's `.toLocalDate()` day key lands on the chosen browser-local calendar day. The regex is
// TZ-agnostic (asserts the shape, not this machine's offset) so it passes in any runner timezone.
test('offsetIso: preserves date+time and appends a numeric ±hh:mm offset', () => {
  expect(offsetIso('2026-07-02', '08:30')).toMatch(/^2026-07-02T08:30:00[+-]\d{2}:\d{2}$/)
})

test('nowOffsetIso: is offset-bearing (±hh:mm), to the minute, in local wall-clock', () => {
  // `new Date('...T08:30:00')` (no zone) parses as LOCAL time, so the wall-clock stays 08:30.
  expect(nowOffsetIso(new Date('2026-07-02T08:30:00'))).toMatch(/^2026-07-02T08:30:00[+-]\d{2}:\d{2}$/)
})
