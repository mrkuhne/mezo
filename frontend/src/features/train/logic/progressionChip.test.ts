import { describe, expect, it } from 'vitest'
import type { ProgressionSignal } from '@/data/types'
import { overflowWhy, progressionChip } from './progressionChip'

const sig = (over: Partial<ProgressionSignal>): ProgressionSignal => ({
  lever: 'hold', deltaKg: null, deltaReps: null, targetWeightKg: 100, targetReps: 8, rationale: '', ...over,
})

describe('progressionChip', () => {
  it('weight up', () => expect(progressionChip(sig({ lever: 'weight', deltaKg: 2.5 }))).toEqual({ text: '↑ +2,5 kg', tone: 'up' }))
  it('weight down', () => expect(progressionChip(sig({ lever: 'weight', deltaKg: -2.5 }))).toEqual({ text: '↓ −2,5 kg', tone: 'down' }))
  it('deload', () => expect(progressionChip(sig({ lever: 'deload', deltaKg: -10 }))).toEqual({ text: '↓ −10 kg', tone: 'down' }))
  it('rep build', () => expect(progressionChip(sig({ lever: 'rep', deltaReps: 1 }))).toEqual({ text: '↑ +1 ism.', tone: 'up' }))
  it('hold', () => expect(progressionChip(sig({ lever: 'hold' }))).toEqual({ text: 'tartjuk', tone: 'hold' }))
})

describe('overflowWhy', () => {
  const why = 'A 10 kg +25% ugrás lenne → előbb 13 ismétlés 8 kg-mal'
  it('shows the reason for reps past the range top', () =>
    expect(overflowWhy(12, sig({ lever: 'rep', deltaReps: 1, targetReps: 13, rationale: why }))).toBe(why))
  it('stays quiet for an in-range rep build', () =>
    expect(overflowWhy(12, sig({ lever: 'rep', deltaReps: 1, targetReps: 12, rationale: 'x' }))).toBeNull())
  it('stays quiet for a weight move', () =>
    expect(overflowWhy(8, sig({ lever: 'weight', deltaKg: 2.5, targetReps: 9, rationale: 'x' }))).toBeNull())
  it('stays quiet without a signal', () => expect(overflowWhy(12, null)).toBeNull())
})
