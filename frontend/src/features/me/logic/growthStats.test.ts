import { expect, test } from 'vitest'
import { growthStats } from '@/features/me/logic/growthStats'
import { GHOST_PROGRESSION_PROFILE, progressionProfileMock } from '@/data/progression/progressionMock'

test('sums XP, counts skills and finds the best level across bands', () => {
  const s = growthStats(progressionProfileMock)
  expect(s.totalXp).toBe(18985)   // 1085 + 9350 + 8550 (GrowthPage.test precedent)
  expect(s.skillCount).toBe(33)
  expect(s.bestLevel).toBe(7)     // max_strength Lv 7
  expect(s.lifeXp).toBe(1085)
  expect(s.lifeAvg).toBeCloseTo(1.75, 2)
  expect(s.muscleBest).toBe(6)
  expect(s.athleticAvg).toBeCloseTo(4.58, 2)
})
test('ghost profile yields zeros and nulls, never NaN', () => {
  const s = growthStats(GHOST_PROGRESSION_PROFILE)
  expect(s).toEqual({ totalXp: 0, skillCount: 0, bestLevel: 0, lifeAvg: null, muscleBest: null, lifeXp: 0, athleticAvg: null })
})
