import { describe, expect, it } from 'vitest'
import { actualMinutes } from '@/features/train/logic/actualDuration'

describe('actualMinutes', () => {
  it('prefers elapsed wall clock when both stamps exist', () => {
    expect(actualMinutes({
      startedAt: '2026-09-02T17:00:00Z',
      finishedAt: '2026-09-02T18:11:00Z',
      activeSeconds: 3000,
    })).toBe(71)
  })

  it('falls back to active seconds when the session was auto-closed', () => {
    expect(actualMinutes({
      startedAt: '2026-09-02T17:00:00Z', finishedAt: null, activeSeconds: 3000,
    })).toBe(50)
  })

  it('returns null when nothing was measured', () => {
    expect(actualMinutes({ startedAt: null, finishedAt: null, activeSeconds: null })).toBeNull()
  })

  it('returns null for a zero-length measurement rather than showing 0 perc', () => {
    expect(actualMinutes({
      startedAt: '2026-09-02T17:00:00Z', finishedAt: '2026-09-02T17:00:10Z', activeSeconds: null,
    })).toBeNull()
  })

  // Fix wave (final-branch-review, mezo-1jm8): elapsed wall clock is uncapped, so a same-day
  // late finish (log until 09:00, tap finish at 20:00) rendered hours of idle time as "tény"
  // truth. The rule (see ELAPSED_OVER_ACTIVE_BUDGET_SECONDS in actualDuration.ts): elapsed wins
  // while it is within a 30-minute budget of activeSeconds; beyond that, activeSeconds wins.
  describe('the elapsed-vs-active cap', () => {
    it.each([
      // [label, startedAt, finishedAt, activeSeconds, expectedMinutes]
      ['elapsed close to active (10 min over, within budget) -> elapsed wins',
        '2026-09-02T17:00:00Z', '2026-09-02T18:20:00Z', 3600, 80],
      ['elapsed exactly at the budget boundary -> elapsed wins',
        '2026-09-02T17:00:00Z', '2026-09-02T18:30:00Z', 3600, 90],
      ['elapsed wildly above active (a same-day late finish) -> active wins',
        '2026-09-02T09:00:00Z', '2026-09-02T20:00:00Z', 3000, 50],
      ['active absent -> elapsed still used, since that is all there is',
        '2026-09-02T17:00:00Z', '2026-09-02T18:11:00Z', null, 71],
    ] as const)('%s', (_label, startedAt, finishedAt, activeSeconds, expected) => {
      expect(actualMinutes({ startedAt, finishedAt, activeSeconds })).toBe(expected)
    })
  })
})
