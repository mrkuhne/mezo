import { describe, expect, it } from 'vitest'
import type { PrescribedSet } from '@/data/types'
import { adjustedRange, adjustedTarget, equivalentReps } from '@/features/train/logic/repEquivalence'

const set = (w: number | null, reps: number, rir: number | null = 2): PrescribedSet =>
  ({ kind: 'working', targetWeightKg: w, targetReps: reps, targetRIR: rir })

describe('equivalentReps', () => {
  it.each([
    ['owner example: 98 × 10 @2 → 95 kg', set(98, 10), 95, 11],
    ['same weight keeps the target', set(98, 10), 98, 10],
    ['heavier weight → fewer reps', set(98, 10), 100, 9],
    ['a ~18 % drop is still allowed', set(98, 10), 80, 19],
    ['null RIR counts as 0', set(100, 10, null), 95, 12],
    ['clamped to at least 1', set(20, 1, 0), 24, 1],
  ])('%s', (_l, p, w, expected) => {
    expect(equivalentReps(p, w)).toBe(expected)
  })

  it.each([
    ['no prescription', null, 95],
    ['no target weight', set(null, 10), 95],
    ['zero weight', set(98, 10), 0],
    ['more than 20 % off', set(98, 10), 75],
  ])('%s → null', (_l, p, w) => {
    expect(equivalentReps(p, w)).toBeNull()
  })
})

describe('adjustedTarget', () => {
  it('returns the swapped weight with the equivalent reps', () => {
    expect(adjustedTarget(set(98, 10), 95)).toEqual({ targetWeightKg: 95, targetReps: 11 })
  })
  it('is null at the target weight and outside the guard', () => {
    expect(adjustedTarget(set(98, 10), 98)).toBeNull()
    expect(adjustedTarget(set(98, 10), 60)).toBeNull()
  })
})

describe('adjustedRange', () => {
  it('shifts the rep range by the rep delta', () => {
    expect(adjustedRange({ repMin: 8, repMax: 10 }, set(98, 10), 95)).toEqual({ repMin: 9, repMax: 11 })
  })
  it('keeps the range when nothing is adjusted', () => {
    expect(adjustedRange({ repMin: 8, repMax: 10 }, set(98, 10), 98)).toEqual({ repMin: 8, repMax: 10 })
  })
})
