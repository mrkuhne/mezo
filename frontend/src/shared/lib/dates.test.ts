import { describe, expect, it, test } from 'vitest'
import { currentWeekOf, huMonthDay, huMonthDayAged, localDateString, mondayOf, nowOffsetIso, offsetIso } from '@/shared/lib/dates'

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

describe('mondayOf', () => {
  test('a Wednesday maps to its Monday', () => { expect(mondayOf('2026-09-02')).toBe('2026-08-31') })
  test('a Monday maps to itself', () => { expect(mondayOf('2026-08-31')).toBe('2026-08-31') })
  test('a Sunday maps to the PREVIOUS Monday (ISO week)', () => { expect(mondayOf('2026-09-06')).toBe('2026-08-31') })
})

// huMonthDayAged (mezo-lf3cv): month+day for a recent date, the YEAR spelled out once the
// date is old enough to be misread as recent („Szep 3 óta" on a 2026 September screen).
describe('huMonthDayAged', () => {
  const today = new Date(2026, 8, 17) // 2026-09-17

  it.each([
    ['2026-09-03', 'Szep 3'],           // two weeks ago
    ['2026-01-04', 'Jan 4'],            // inside the ~10-month window, another year or not
    ['2025-12-20', 'Dec 20'],           // still inside it
    ['2025-09-03', '2025. Szep 3'],     // a YEAR ago — the measured case
    ['2024-06-01', '2024. Jún 1'],      // long past
    ['2027-01-04', '2027. Jan 4'],      // a future year is never bare either
  ])('%s → %s', (iso, expected) => {
    expect(huMonthDayAged(iso, today)).toBe(expected)
  })

  it('agrees with huMonthDay for anything recent (same label, no year)', () => {
    expect(huMonthDayAged('2026-05-01', today)).toBe(huMonthDay('2026-05-01'))
  })
})
