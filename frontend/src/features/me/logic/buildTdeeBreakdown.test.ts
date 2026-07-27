import { describe, expect, it } from 'vitest'
import { buildTdeeBreakdown } from '@/features/me/logic/buildTdeeBreakdown'
import type { BiometricProfileResponse } from '@/data/me/biometricProfileApi'

const profile = {
  sex: 'M',
  heightCm: 192,
  birthDate: '1993-01-01',
  bodyFatPct: 18,
  activityLevel: 'DESK',
  tdeeBootstrap: {
    bmr: 1893,
    neat: 1.2,
    neatBaselineKcal: 2272,
    weeklyEatKcalPerDay: 1207,
    tdee: 3479,
    formula: 'KATCH',
    computedAt: '2026-07-27T06:00:00Z',
  },
} as unknown as BiometricProfileResponse

describe('buildTdeeBreakdown', () => {
  it('maps tdeeBootstrap + activity into a deficit-free weekly-avg breakdown', () => {
    const bd = buildTdeeBreakdown(profile)!
    expect(bd.base).toMatchObject({ kcal: 2272, bmr: 1893, neat: 1.2, neatLabel: 'Ülő', formula: 'KATCH' })
    expect(bd.movement).toMatchObject({ kcal: 1207, isWeeklyAvg: true })
    expect(bd.movement.blocks).toBeUndefined()
    expect(bd.deficit).toBeUndefined()
    expect(bd.target).toBe(3479)
  })

  it('returns null when tdeeBootstrap is absent', () => {
    expect(buildTdeeBreakdown({ ...profile, tdeeBootstrap: null } as unknown as BiometricProfileResponse)).toBeNull()
  })
})
