import { describe, expect, it } from 'vitest'
import { deriveGoalTargetDate, buildGoalSettingsRequest } from '@/features/me/logic/goalSettings'
import { goalResponse } from '@/data/me/goals'

describe('remaining goal pace', () => {
  it('derives a date from remaining weight and rounds up to a complete day', () => {
    expect(deriveGoalTargetDate('2026-09-20', 94.2, 88, .4, 'cut')).toBe('2027-01-07')
    expect(deriveGoalTargetDate('2026-09-20', 94.2, 88, .8, 'cut')).toBe('2026-11-14')
  })
  it('rejects invalid, reached and contradictory targets, and has no maintenance arrival date', () => {
    expect(deriveGoalTargetDate('2026-09-20', 94, 88, 0, 'cut')).toBeNull()
    expect(deriveGoalTargetDate('2026-09-20', 94, 98, .4, 'cut')).toBeNull()
    expect(deriveGoalTargetDate('2026-09-20', 94, 94, .4, 'cut')).toBeNull()
    expect(deriveGoalTargetDate('2026-09-20', 94, 94, .4, 'maintain')).toBeNull()
    expect(deriveGoalTargetDate('2026-09-20', 88, 90, .5, 'bulk')).toBe('2026-10-18')
  })
  it('preserves original baseline, guards and planner fields in the full upsert', () => {
    const result = buildGoalSettingsRequest(goalResponse, 88, '2027-01-07')
    expect(result).toMatchObject({ startDate: goalResponse.startDate, startWeightKg: goalResponse.startWeightKg, guards: goalResponse.guards, mealsPerDay: goalResponse.mealsPerDay, wakeTime: goalResponse.wakeTime, targetWeightKg: 88, targetDate: '2027-01-07' })
    expect(result).not.toHaveProperty('rateTargetPctPerWeek')
  })
})
