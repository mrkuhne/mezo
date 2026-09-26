import { describe, expect, it } from 'vitest'
import { buildEnergyBreakdown } from '@/features/fuel/logic/buildEnergyBreakdown'
import type { PlannerBlock } from '@/features/fuel/logic/buildDayPlan'

const blocks: PlannerBlock[] = [
  { kind: 'gym', time: '18:00', durationMin: 60, label: 'Gym' },
  { kind: 'sport', time: '20:00', durationMin: 90, label: 'Röplabda' },
]

describe('buildEnergyBreakdown', () => {
  it('maps the served energy + blocks + segment into a full three-section breakdown', () => {
    const bd = buildEnergyBreakdown({
      energy: { base: 2272, planned: 1290, extra: 0, balance: -869, target: 2693 },
      blocks,
      weightKg: 86,
      tdeeBootstrap: { bmr: 1893, neat: 1.2, formula: 'KATCH' },
      segment: { dailyEnergyBalanceKcal: -869, projectedRateKgPerWk: -0.79, label: 'Nyári cut' },
      activityLabel: 'Ülő',
      goalLabel: 'Nyári cut',
    })!
    expect(bd.base).toMatchObject({ kcal: 2272, bmr: 1893, neat: 1.2, neatLabel: 'Ülő', formula: 'KATCH' })
    expect(bd.movement.kcal).toBe(1290)
    expect(bd.movement.isWeeklyAvg).toBe(true) // the planned share is the weekly plan's part of the day
    expect(bd.movement.blocks?.map(b => b.label)).toEqual(['Gym', 'Röplabda'])
    expect(bd.movement.blocks?.[0].kcal).toBeGreaterThan(0)
    expect(bd.deficit).toMatchObject({ kcal: -869, goalLabel: 'Nyári cut' })
    expect(bd.deficit?.rateKgPerWk).toBeCloseTo(0.79) // absolute rate
    expect(bd.target).toBe(2693)
  })

  it('returns null when there is no tdeeBootstrap (static energy path)', () => {
    expect(
      buildEnergyBreakdown({
        energy: { base: 2066, planned: 0, extra: 0, balance: 0, target: 2066 },
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
      energy: { base: 2272, planned: 1290, extra: 0, balance: 0, target: 3562 },
      blocks,
      weightKg: 86,
      tdeeBootstrap: { bmr: 1893, neat: 1.2, formula: 'KATCH' },
      segment: null,
      activityLabel: 'Ülő',
      goalLabel: 'Nyári cut',
    })!
    expect(bd.deficit).toBeUndefined()
  })

  it('per-block kcal is the net model at rest BMR/24; a null-duration run defaults to 45′ (mezo-32m82)', () => {
    const rest = 1920 / 24 // 80 kcal/h
    const bd = buildEnergyBreakdown({
      energy: { base: 2304, planned: 0, extra: 0, balance: 0, target: 2304 },
      blocks: [
        { kind: 'gym', time: '18:00', durationMin: 60, label: 'Gym' },
        { kind: 'sport', sport: 'volleyball', time: '20:00', durationMin: 120, label: 'Röplabda' },
        { kind: 'run', time: '07:00', durationMin: null, label: 'Futás' },
      ],
      weightKg: 95,
      tdeeBootstrap: { bmr: 1920, neat: 1.2, formula: 'MSJ' },
      segment: null,
      activityLabel: 'Ülő',
      goalLabel: '',
    })!
    expect(bd.movement.blocks?.map(b => [b.min, b.kcal])).toEqual([
      [60, (3.5 - 1) * rest],
      [120, (4 - 1) * rest * 2],
      [45, Math.round((9.3 - 1) * rest * (45 / 60))],
    ])
  })

  it('movement = planned + extra; the summand parts are exactly the served parts and close on the total (mezo-32m82)', () => {
    const energy = { base: 2356, planned: 570, extra: 572, balance: -327, target: 3171 }
    const bd = buildEnergyBreakdown({
      energy,
      blocks,
      weightKg: 86,
      tdeeBootstrap: { bmr: 1963, neat: 1.2, formula: 'KATCH' },
      segment: null,
      activityLabel: 'Ülő',
      goalLabel: 'Cut',
    })!
    expect(bd.movement.kcal).toBe(energy.planned + energy.extra)
    expect(bd.movement.parts).toEqual([
      { key: 'planned', label: 'A heti terved mai része', kcal: energy.planned },
      { key: 'extra', label: 'Terven kívüli mozgás', kcal: energy.extra },
    ])
    expect(bd.movement.parts!.reduce((a, p) => a + p.kcal, 0)).toBe(bd.movement.kcal)
    // per-block previews stay, informational only
    expect(bd.movement.blocks?.map(b => b.label)).toEqual(['Gym', 'Röplabda'])
    expect(bd.base.kcal + bd.movement.kcal + bd.deficit!.kcal).toBe(bd.target)
  })

  it('no extra → only the planned part, still closing', () => {
    const bd = buildEnergyBreakdown({
      energy: { base: 2356, planned: 570, extra: 0, balance: -327, target: 2599 },
      blocks,
      weightKg: 86,
      tdeeBootstrap: { bmr: 1963, neat: 1.2, formula: 'KATCH' },
      segment: null,
      activityLabel: 'Ülő',
      goalLabel: 'Cut',
    })!
    expect(bd.movement.parts?.map(p => p.key)).toEqual(['planned'])
    expect(bd.movement.parts!.reduce((a, p) => a + p.kcal, 0)).toBe(bd.movement.kcal)
  })
})
