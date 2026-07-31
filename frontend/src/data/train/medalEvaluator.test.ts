import { beforeEach, describe, expect, test } from 'vitest'
import { evaluateMockSetMedals, resetMockMedalHistory, type MedalEvaluationRequest } from '@/data/train/medalEvaluator'
import type { MedalType } from '@/data/train/medalTypes'

// Mirrors backend/src/test/java/io/mrkuhne/mezo/feature/train/service/MedalEvaluatorTest.java
// case-for-case (spec 2026-07-30-medal-collection-design.md §13 — deliberate duplication,
// not a defect). resetMockMedalHistory() in beforeEach: the mock history is module state.

function set(name: string, weightKg: number, reps: number, opts?: Partial<MedalEvaluationRequest>): MedalEvaluationRequest {
  return {
    exerciseName: name, lastWeek: null, date: '2026-07-20', weightKg, reps,
    targetWeightKg: null, targetReps: null, setIndex: 0,
    ...opts,
  }
}

/** Logs a set purely to seed the running history as a "prior" — mirrors the backend
 * test helper's `prior(kg, reps)`, since the mock evaluator has no way to inject priors
 * without replaying a call. */
function seedPrior(name: string, weightKg: number, reps: number): void {
  evaluateMockSetMedals(set(name, weightKg, reps))
}

function kinds(medals: ReturnType<typeof evaluateMockSetMedals>): MedalType[] {
  return medals.map((m) => m.type)
}

beforeEach(() => {
  resetMockMedalHistory()
})

describe('evaluateMockSetMedals', () => {
  test('awards nothing when there is no prior history', () => {
    expect(evaluateMockSetMedals(set('Chest Supported Row', 100, 8))).toEqual([])
  })

  test('awards WEIGHT + E1RM when the load beats every prior', () => {
    seedPrior('Chest Supported Row', 100, 8)
    const medals = evaluateMockSetMedals(set('Chest Supported Row', 102.5, 8))
    expect(kinds(medals)).toEqual(expect.arrayContaining(['WEIGHT', 'E1RM']))
    expect(medals.find((m) => m.type === 'WEIGHT')?.previousValue).toBe(100)
    expect(medals.find((m) => m.type === 'E1RM')?.previousValue).toBeCloseTo(126.7, 1)
  })

  test('awards REPS_AT_WEIGHT when more reps are logged at a weight already lifted', () => {
    seedPrior('Lat Pulldown', 100, 8)
    const medals = evaluateMockSetMedals(set('Lat Pulldown', 100, 9))
    expect(kinds(medals)).toContain('REPS_AT_WEIGHT')
    const m = medals.find((x) => x.type === 'REPS_AT_WEIGHT')
    expect(m?.previousValue).toBe(8)
    expect(m?.value).toBe(9)
  })

  test('does not award REPS_AT_WEIGHT when that weight was never lifted before', () => {
    seedPrior('Hammer Curl', 100, 8)
    const medals = evaluateMockSetMedals(set('Hammer Curl', 97.5, 12))
    expect(kinds(medals)).not.toContain('REPS_AT_WEIGHT')
  })

  test('awards nothing when the set only ties the record', () => {
    seedPrior('Face Pull', 100, 8)
    expect(evaluateMockSetMedals(set('Face Pull', 100, 8))).toEqual([])
  })

  test('awards TARGET_HIT (previousValue null) when both prescribed values are met', () => {
    seedPrior('Cable Pull-Around', 100, 8)
    const medals = evaluateMockSetMedals(set('Cable Pull-Around', 100, 8, { targetWeightKg: 100, targetReps: 8 }))
    expect(kinds(medals)).toContain('TARGET_HIT')
    const m = medals.find((x) => x.type === 'TARGET_HIT')
    expect(m?.previousValue).toBeNull()
    expect(m?.previousDate).toBeNull()
    expect(m?.value).toBe(8)
  })

  test('awards TARGET_HIT even with no prior history at all (first-ever set)', () => {
    const medals = evaluateMockSetMedals(set('Overhead Press', 60, 10, { targetWeightKg: 60, targetReps: 10 }))
    expect(kinds(medals)).toEqual(['TARGET_HIT'])
  })

  test('does not award TARGET_HIT when the reps fall short', () => {
    seedPrior('Leg Press', 100, 8)
    const medals = evaluateMockSetMedals(set('Leg Press', 100, 7, { targetWeightKg: 100, targetReps: 8 }))
    expect(kinds(medals)).not.toContain('TARGET_HIT')
  })

  test('does not award TARGET_HIT when the load falls short', () => {
    seedPrior('Leg Curl', 100, 8)
    const medals = evaluateMockSetMedals(set('Leg Curl', 97.5, 10, { targetWeightKg: 100, targetReps: 8 }))
    expect(kinds(medals)).not.toContain('TARGET_HIT')
  })

  test('does not award TARGET_HIT when no target was prescribed', () => {
    const medals = evaluateMockSetMedals(set('Hip Thrust', 100, 8, { targetWeightKg: null, targetReps: null }))
    expect(kinds(medals)).not.toContain('TARGET_HIT')
  })

  test('awards E1RM alone when more reps at a lighter load beat the estimate', () => {
    // 95 × 12 → e1RM 133.0 beats 100 × 8 → e1RM 126.67, but the load itself is lower.
    seedPrior('Barbell Squat', 100, 8)
    const medals = evaluateMockSetMedals(set('Barbell Squat', 95, 12))
    expect(kinds(medals)).toEqual(['E1RM'])
  })

  test('seeds the baseline from lastWeek, so the very first mock set can already beat it', () => {
    const medals = evaluateMockSetMedals(
      set('T-Bar Row', 102.5, 8, { lastWeek: { weight: 100, reps: 8 } }),
    )
    expect(kinds(medals)).toEqual(expect.arrayContaining(['WEIGHT', 'E1RM']))
  })

  test('resetMockMedalHistory clears cross-test state', () => {
    seedPrior('Incline DB Curl', 100, 8)
    resetMockMedalHistory()
    // With history cleared, the same weight+reps is a fresh baseline again — nothing fires.
    expect(evaluateMockSetMedals(set('Incline DB Curl', 100, 8))).toEqual([])
  })
})
