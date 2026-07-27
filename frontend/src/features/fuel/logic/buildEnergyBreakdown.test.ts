import { describe, expect, it } from 'vitest'
import { buildEnergyBreakdown } from '@/features/fuel/logic/buildEnergyBreakdown'
import type { PlannerBlock } from '@/features/fuel/logic/buildDayPlan'

const blocks: PlannerBlock[] = [
  { kind: 'gym', time: '18:00', durationMin: 60, label: 'Gym' },
  { kind: 'sport', time: '20:00', durationMin: 90, label: 'Röplabda' },
]

describe('buildEnergyBreakdown', () => {
  it('maps plan.energy + blocks + segment into a full three-section breakdown', () => {
    const bd = buildEnergyBreakdown({
      energy: { base: 2272, activity: 1290, balance: -869, target: 2693 },
      blocks,
      weightKg: 86,
      tdeeBootstrap: { bmr: 1893, neat: 1.2, formula: 'KATCH' },
      segment: { dailyEnergyBalanceKcal: -869, projectedRateKgPerWk: -0.79, label: 'Nyári cut' },
      activityLabel: 'Ülő',
      goalLabel: 'Nyári cut',
    })!
    expect(bd.base).toMatchObject({ kcal: 2272, bmr: 1893, neat: 1.2, neatLabel: 'Ülő', formula: 'KATCH' })
    expect(bd.movement.kcal).toBe(1290)
    expect(bd.movement.isWeeklyAvg).toBe(false)
    expect(bd.movement.blocks?.map(b => b.label)).toEqual(['Gym', 'Röplabda'])
    expect(bd.movement.blocks?.[0].kcal).toBeGreaterThan(0)
    expect(bd.deficit).toMatchObject({ kcal: -869, goalLabel: 'Nyári cut' })
    expect(bd.deficit?.rateKgPerWk).toBeCloseTo(0.79) // absolute rate
    expect(bd.target).toBe(2693)
  })

  it('returns null when there is no tdeeBootstrap (static energy path)', () => {
    expect(
      buildEnergyBreakdown({
        energy: { base: 2066, activity: 0, balance: 0, target: 2066 },
        blocks: [],
        weightKg: 0,
        tdeeBootstrap: null,
        segment: null,
        activityLabel: '',
        goalLabel: '',
      }),
    ).toBeNull()
  })

  it('omits the deficit section when balance is zero', () => {
    const bd = buildEnergyBreakdown({
      energy: { base: 2272, activity: 1290, balance: 0, target: 3562 },
      blocks,
      weightKg: 86,
      tdeeBootstrap: { bmr: 1893, neat: 1.2, formula: 'KATCH' },
      segment: null,
      activityLabel: 'Ülő',
      goalLabel: 'Nyári cut',
    })!
    expect(bd.deficit).toBeUndefined()
  })
})
