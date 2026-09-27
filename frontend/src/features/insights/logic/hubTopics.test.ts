import { describe, expect, it } from 'vitest'
import { groupBy, topicOf } from '@/features/insights/logic/hubTopics'
import type { KnowledgeObservation } from '@/data/insights/knowledgeHubApi'

const obs = (over: Partial<KnowledgeObservation>): KnowledgeObservation => ({
  patternId: 'o', title: 't', confirmedAt: '2026-09-01T00:00:00Z', recheckedAt: null, status: 'confirmed',
  factId: null, factMutedReason: null, factMutedAt: null, replacesPatternId: null, replacedByPatternId: null,
  topicKey: null, evidence: [], evidenceSources: [], ...over,
})

describe('topicOf', () => {
  it('person topic keys are Kapcsolatok', () => {
    expect(topicOf(obs({ topicKey: '1a2b-effect-mental-person' }))).toBe('Kapcsolatok')
  })
  it('majority evidence source decides', () => {
    expect(topicOf(obs({ evidenceSources: ['sleep_log', 'sleep_log', 'check_in'] }))).toBe('Alvás')
    expect(topicOf(obs({ evidenceSources: ['meal'] }))).toBe('Étkezés')
    expect(topicOf(obs({ evidenceSources: ['workout_session'] }))).toBe('Edzés')
  })
  it('no records → Egyéb', () => {
    expect(topicOf(obs({}))).toBe('Egyéb')
  })
})

describe('groupBy', () => {
  it('keeps the given order and drops empty groups', () => {
    expect(groupBy([{ k: 'b' }, { k: 'a' }, { k: 'b' }], (x) => x.k as 'a' | 'b' | 'c', ['c', 'b', 'a']))
      .toEqual([{ key: 'b', items: [{ k: 'b' }, { k: 'b' }] }, { key: 'a', items: [{ k: 'a' }] }])
  })
})
