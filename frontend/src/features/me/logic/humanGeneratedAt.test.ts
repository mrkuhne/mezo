import { describe, expect, test } from 'vitest'
import { humanGeneratedAt } from '@/features/me/logic/humanGeneratedAt'

/** Built as LOCAL wall-clock so the assertions never depend on the runner's zone. */
const at = (y: number, m: number, d: number, hh: number, mm: number) =>
  new Date(y, m - 1, d, hh, mm).toISOString()

describe('humanGeneratedAt', () => {
  const now = new Date(2026, 4, 27, 9, 0) // 2026-05-27, Wednesday

  test('today / yesterday get their own words', () => {
    expect(humanGeneratedAt(at(2026, 5, 27, 6, 15), now)).toBe('ma 06:15')
    expect(humanGeneratedAt(at(2026, 5, 26, 18, 5), now)).toBe('tegnap 18:05')
  })

  test('inside the last week it names the weekday, like the prototype', () => {
    expect(humanGeneratedAt(at(2026, 5, 25, 6, 15), now)).toBe('hétfő 06:15')
    expect(humanGeneratedAt(at(2026, 5, 22, 20, 0), now)).toBe('péntek 20:00')
  })

  test('older than a week falls back to a date — never a stale weekday name', () => {
    expect(humanGeneratedAt(at(2026, 5, 18, 6, 15), now)).toBe('máj 18. 06:15')
  })

  test('an absent or unparseable stamp prints nothing at all', () => {
    expect(humanGeneratedAt(null, now)).toBeNull()
    expect(humanGeneratedAt(undefined, now)).toBeNull()
    expect(humanGeneratedAt('not-a-date', now)).toBeNull()
  })
})
