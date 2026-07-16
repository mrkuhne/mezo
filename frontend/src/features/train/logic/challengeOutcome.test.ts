import { describe, expect, it } from 'vitest'
import { evaluateChallenge } from '@/features/train/logic/challengeOutcome'
import type { Challenge } from '@/data/types'

const base: Challenge = {
  id: 'c1', type: 'PR', typeLabel: 'PR kísérlet', exerciseId: 'e1', target: '85 kg × 8',
  risk: 'low', why: '', refs: [], glory: '', targetWeightKg: 85, targetReps: 8,
}

describe('evaluateChallenge (FE mirror of ChallengeOutcomeEvaluator)', () => {
  it('is inconclusive with no logged sets', () => {
    expect(evaluateChallenge(base, [])).toBe('inconclusive')
  })
  it('PR: any set at/above target weight AND reps hits', () => {
    expect(evaluateChallenge(base, [{ weight: 85, reps: 9, rir: 0 }])).toBe('hit')
    expect(evaluateChallenge(base, [{ weight: 85, reps: 7, rir: 0 }])).toBe('miss')
    expect(evaluateChallenge({ ...base, targetWeightKg: null }, [{ weight: 85, reps: 9, rir: 0 }])).toBe('miss')
  })
  it('Depth: the LAST set at/below target RIR hits', () => {
    const depth: Challenge = { ...base, type: 'Depth', targetRir: 0 }
    expect(evaluateChallenge(depth, [{ weight: 40, reps: 12, rir: 2 }, { weight: 40, reps: 10, rir: 0 }])).toBe('hit')
    expect(evaluateChallenge(depth, [{ weight: 40, reps: 10, rir: 0 }, { weight: 40, reps: 12, rir: 2 }])).toBe('miss')
  })
  it('Volume: logged set count at/above target hits', () => {
    const vol: Challenge = { ...base, type: 'Volume', targetSets: 3 }
    const s = { weight: 40, reps: 12, rir: 2 }
    expect(evaluateChallenge(vol, [s, s, s])).toBe('hit')
    expect(evaluateChallenge(vol, [s, s])).toBe('miss')
  })
})
