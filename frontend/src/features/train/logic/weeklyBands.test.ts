import { describe, expect, it } from 'vitest'
import { weeklyBands } from './weeklyBands'
import type { MesoDay } from '@/data/types'

const ex = (muscle: string, sets: number, type: 'compound' | 'isolation' = 'compound') =>
  ({ id: muscle + sets, name: muscle, muscle, warmupSets: 1, workingSets: sets, repMin: 8, repMax: 10, targetRIR: 1, type })
const days: MesoDay[] = [
  { day: 'Hét', type: 'Upper', muscle: 'back', exerciseCount: 2, exercises: [ex('back-mid', 6), ex('chest-mid', 4)] },
  { day: 'Csü', type: 'Upper', muscle: 'back', exerciseCount: 2, exercises: [ex('back-wide', 6), ex('chest-upper', 4)] },
]

describe('weeklyBands', () => {
  it('sums planned working sets per coarse group and pairs them with the tier band', () => {
    const rows = weeklyBands(days, { back: 'emphasize' })
    const back = rows.find((r) => r.group === 'back')!
    expect(back).toMatchObject({ planned: 12, start: 12, ceiling: 22, tier: 'emphasize', step: '+2' })
    const chest = rows.find((r) => r.group === 'chest')!
    expect(chest).toMatchObject({ planned: 8, start: 8, ceiling: 14, tier: 'grow' })
  })
  it('orders by ceiling desc so Emphasize reads first and never prints a percentage label', () => {
    const rows = weeklyBands(days, { back: 'emphasize' })
    expect(rows[0].group).toBe('back')
    expect(rows.every((r) => typeof r.pct === 'number')).toBe(true)
  })
  it('marks maintain as hold', () => {
    const rows = weeklyBands(days, { chest: 'maintain' })
    expect(rows.find((r) => r.group === 'chest')).toMatchObject({ step: 'hold', ceiling: 8 })
  })
})
