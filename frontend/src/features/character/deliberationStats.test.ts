import { describe, expect, test } from 'vitest'
import { deliberationStats } from './deliberationStats'
import type { ConferenceThread } from '@/data/character/characterApi'

const THREADS: ConferenceThread[] = [
  {
    dimensionKey: 'physical',
    title: 'Fizikai',
    items: [
      {
        index: 0, expertKey: 'doki', text: 'a', kind: 'NEW', claimId: null, sensitive: false,
        reactions: [
          { expertKey: 'edzo', stance: 'SUPPORT', argument: 's' },
          { expertKey: 'drill', stance: 'CHALLENGE', argument: 'c' },
        ],
        skeptic: { verdict: 'KEEP', argument: 'k' },
        chair: { accepted: true, confidence: 0.8, reason: 'r' },
      },
      {
        index: 1, expertKey: 'doki', text: 'b', kind: 'NEW', claimId: null, sensitive: false,
        reactions: [],
        skeptic: null,
        chair: { accepted: false, confidence: null, reason: 'r2' },
      },
    ],
  },
  {
    dimensionKey: null,
    title: 'Egyéb javaslatok',
    items: [
      {
        index: 2, expertKey: 'drill', text: 'c', kind: 'NEW', claimId: null, sensitive: false,
        reactions: [{ expertKey: 'doki', stance: 'NUANCE', argument: 'n' }],
        skeptic: { verdict: 'KILL', argument: 'k2' },
        chair: null,
      },
    ],
  },
]

describe('deliberationStats', () => {
  test('counts every round from the threads', () => {
    expect(deliberationStats(THREADS)).toEqual({
      proposals: 3,
      reactions: 3,
      skepticVerdicts: 2,
      accepted: 1,
      rejected: 1,
    })
  })

  test('a missing chair ruling counts as neither accepted nor rejected', () => {
    const stats = deliberationStats(THREADS)
    expect(stats.accepted + stats.rejected).toBe(2)
    expect(stats.proposals).toBe(3)
  })

  test('null and empty input yield all zeros', () => {
    const zero = { proposals: 0, reactions: 0, skepticVerdicts: 0, accepted: 0, rejected: 0 }
    expect(deliberationStats(null)).toEqual(zero)
    expect(deliberationStats([])).toEqual(zero)
  })
})
