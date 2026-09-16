import { describe, expect, test } from 'vitest'
import { barProgress, recordFor, todayBest } from './recordFor'

// recordFor (mezo-88iwa.7, T6 Task 5) — catalogId-when-present-else-name identity match.

interface Row { catalogId?: string | null; name: string; tag: string }

const rows: Row[] = [
  { catalogId: 'cat-1', name: 'Chest Supported Row', tag: 'by-id' },
  { name: 'Chest Supported Row', tag: 'legacy-same-name' },
  { name: 'Hammer Curl', tag: 'by-name' },
]

describe('recordFor', () => {
  test.each([
    { desc: 'exercise with a catalogId matches the record carrying the same catalogId', exercise: { catalogId: 'cat-1', name: 'Chest Supported Row' }, want: 'by-id' },
    { desc: 'exercise with a catalogId does NOT fall back to a same-named legacy row when its catalogId has no match', exercise: { catalogId: 'cat-9', name: 'Chest Supported Row' }, want: undefined },
    { desc: 'exercise with no catalogId matches by exact name', exercise: { name: 'Hammer Curl' }, want: 'by-name' },
    { desc: 'exercise with no catalogId and no name match returns undefined', exercise: { name: 'Face Pull' }, want: undefined },
    { desc: 'a catalogId that happens to equal another record\'s name is not a name-based accident', exercise: { catalogId: 'Hammer Curl', name: 'Nope' }, want: undefined },
  ])('$desc', ({ exercise, want }) => {
    const found = recordFor(rows, exercise)
    expect(found?.tag).toBe(want)
  })
})

describe('todayBest', () => {
  test('no sets -> null e1RM, zero volume', () => {
    expect(todayBest([])).toEqual({ e1rm: null, e1rmSet: null, volume: 0 })
  })

  test('picks the highest-e1RM eligible set, ignores reps above the 12 cap', () => {
    const sets = [
      { weight: 100, reps: 5 },   // e1rm = 100*35/30 = 116.67
      { weight: 80, reps: 13 },   // ineligible (reps > 12) — must not win despite high e1rm
      { weight: 90, reps: 10 },   // e1rm = 90*40/30 = 120
    ]
    const best = todayBest(sets)
    expect(best.e1rm).toBeCloseTo(120, 4)
    expect(best.e1rmSet).toEqual({ weight: 90, reps: 10 })
  })

  test('a bodyweight set (weight 0) contributes no e1RM and no volume', () => {
    const best = todayBest([{ weight: 0, reps: 15 }])
    expect(best.e1rm).toBeNull()
    expect(best.volume).toBe(0)
  })

  test('volume sums weight×reps across every logged set, eligible or not', () => {
    const best = todayBest([{ weight: 20, reps: 10 }, { weight: 20, reps: 13 }])
    expect(best.volume).toBe(20 * 10 + 20 * 13)
  })
})

describe('barProgress', () => {
  // Fix wave M1: an ABSENT or incomparable record is not something today can "beat".
  test.each([
    { desc: 'no record row at all (first-ever logging) — a big number today beats nothing', now: 50, target: 0 },
    { desc: 'nothing logged today either', now: 0, target: 0 },
    {
      desc: 'LEGJOBB SZETT against a BODYWEIGHT record (no weightKg → e1RM target 0) vs a weighted set today',
      now: 137.5, target: 0,
    },
  ])('never beaten when there is no comparable target: $desc', ({ now, target }) => {
    expect(barProgress(now, target)).toEqual({ share: 0, beaten: false })
  })

  test('share is capped at 100 even when now exceeds target', () => {
    expect(barProgress(150, 100)).toEqual({ share: 100, beaten: true })
  })

  test('below target: share reflects the ratio, not beaten', () => {
    expect(barProgress(50, 100)).toEqual({ share: 50, beaten: false })
  })

  test('exactly at target: not beaten (strictly greater required)', () => {
    expect(barProgress(100, 100)).toEqual({ share: 100, beaten: false })
  })
})
