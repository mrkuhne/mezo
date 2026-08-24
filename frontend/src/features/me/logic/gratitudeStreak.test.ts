import { describe, expect, it } from 'vitest'
import { gratitudeStreakDays } from './gratitudeStreak'

describe('gratitudeStreakDays', () => {
  it('counts consecutive days ending today', () => {
    expect(gratitudeStreakDays(['2026-08-21', '2026-08-20', '2026-08-20', '2026-08-19'], '2026-08-21')).toBe(3)
  })
  it('starts from yesterday when today is still empty', () => {
    expect(gratitudeStreakDays(['2026-08-20', '2026-08-19'], '2026-08-21')).toBe(2)
  })
  it('is 0 when the last entry is older than yesterday', () => {
    expect(gratitudeStreakDays(['2026-08-18'], '2026-08-21')).toBe(0)
  })
  it('is 0 for no entries', () => {
    expect(gratitudeStreakDays([], '2026-08-21')).toBe(0)
  })
})
