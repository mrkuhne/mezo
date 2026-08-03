import { describe, expect, it } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import { suggestedWarmupSets } from '@/features/train/logic/warmupSuggest'

function mkEx(overrides: Pick<GymExercise, 'id' | 'muscle' | 'type'> & Partial<GymExercise>): GymExercise {
  return {
    name: overrides.id,
    warmupSets: 0,
    workingSets: 3,
    repMin: 6,
    repMax: 10,
    targetRIR: 2,
    ...overrides,
  }
}
function mkDay(exercises: GymExercise[]): MesoDay {
  return { day: 'H', type: 'Push', muscle: 'chest', exerciseCount: exercises.length, exercises }
}

describe('suggestedWarmupSets', () => {
  it('plyo exercise → 0', () => {
    const day = mkDay([mkEx({ id: 'a', muscle: 'quad', type: 'plyo' })])
    expect(suggestedWarmupSets(day, 'a')).toBe(0)
  })

  it('bodyweight-ish (no anchor, repMax >= 15) → 0', () => {
    const day = mkDay([mkEx({ id: 'a', muscle: 'chest-mid', type: 'compound', anchorWeightKg: null, repMax: 15 })])
    expect(suggestedWarmupSets(day, 'a')).toBe(0)
  })

  it('first non-plyo compound opening its group → 3', () => {
    const day = mkDay([mkEx({ id: 'a', muscle: 'chest-mid', type: 'compound', repMax: 10 })])
    expect(suggestedWarmupSets(day, 'a')).toBe(3)
  })

  it('first compound with a light anchor (< 60kg) → 2', () => {
    const day = mkDay([mkEx({ id: 'a', muscle: 'chest-mid', type: 'compound', anchorWeightKg: 40, repMax: 10 })])
    expect(suggestedWarmupSets(day, 'a')).toBe(2)
  })

  it('first compound with a heavy anchor (>= 60kg) stays at 3', () => {
    const day = mkDay([mkEx({ id: 'a', muscle: 'chest-mid', type: 'compound', anchorWeightKg: 80, repMax: 10 })])
    expect(suggestedWarmupSets(day, 'a')).toBe(3)
  })

  it('a later compound of an already-hit group → 1', () => {
    const day = mkDay([
      mkEx({ id: 'a', muscle: 'chest-mid', type: 'compound', repMax: 10 }),
      mkEx({ id: 'b', muscle: 'chest-upper', type: 'compound', repMax: 10 }),
    ])
    expect(suggestedWarmupSets(day, 'b')).toBe(1)
  })

  it('isolation opening its group → 1', () => {
    const day = mkDay([mkEx({ id: 'a', muscle: 'back-wide', type: 'isolation', repMax: 12 })])
    expect(suggestedWarmupSets(day, 'a')).toBe(1)
  })

  it('isolation after the group was hit → 0', () => {
    const day = mkDay([
      mkEx({ id: 'a', muscle: 'back-wide', type: 'compound', repMax: 10 }),
      mkEx({ id: 'b', muscle: 'back-mid', type: 'isolation', repMax: 12 }),
    ])
    expect(suggestedWarmupSets(day, 'b')).toBe(0)
  })

  it('plyo rows do not count toward "group hit" — a compound after a plyo of the same group is still first', () => {
    const day = mkDay([
      mkEx({ id: 'a', muscle: 'quad', type: 'plyo' }),
      mkEx({ id: 'b', muscle: 'quad', type: 'compound', repMax: 10 }),
    ])
    expect(suggestedWarmupSets(day, 'b')).toBe(3)
  })

  it('unknown budget group (e.g. a sport row) → 0', () => {
    const day = mkDay([mkEx({ id: 'a', muscle: 'sport', type: 'compound', repMax: 10 })])
    expect(suggestedWarmupSets(day, 'a')).toBe(0)
  })

  it('unknown exercise id → 0 (defensive)', () => {
    const day = mkDay([mkEx({ id: 'a', muscle: 'chest-mid', type: 'compound', repMax: 10 })])
    expect(suggestedWarmupSets(day, 'missing')).toBe(0)
  })
})
