import { describe, expect, it } from 'vitest'
import { decompose } from '@/features/admin/memory/contribution'
import type { AdminMemoryCandidate, AdminMemoryFusionConfig } from '@/data/admin/adminMemoryApi'

const FUSION_UNIT: AdminMemoryFusionConfig = { rrfK: 60, retrieverWeights: { dense: 1, lexical: 1 } }

function candidate(overrides: Partial<AdminMemoryCandidate['scoreBreakdown']>): AdminMemoryCandidate {
  return {
    rank: 1,
    selected: true,
    candidateKind: 'memory_item',
    candidateRefId: 'c-1',
    contentSnapshot: 'x',
    scoreBreakdown: { retrieverRanks: {}, rrf: 0, finalScore: 0, ...overrides },
  }
}

describe('decompose — Elastic RRF documentation example', () => {
  it('rank 1 in one retriever, rank 3 in another, unit weights: 1/61 + 1/63', () => {
    const c = candidate({ retrieverRanks: { dense: 1, lexical: 3 }, rrf: 1 / 61 + 1 / 63, finalScore: 1 / 61 + 1 / 63 })
    const { segments, rrfSum, storedRrf, drift } = decompose(c, FUSION_UNIT)
    const dense = segments.find((s) => s.key === 'dense')!
    const lexical = segments.find((s) => s.key === 'lexical')!
    expect(dense.value).toBeCloseTo(1 / 61, 12)
    expect(lexical.value).toBeCloseTo(1 / 63, 12)
    expect(rrfSum).toBeCloseTo(1 / 61 + 1 / 63, 12)
    expect(storedRrf).toBeCloseTo(1 / 61 + 1 / 63, 12)
    expect(Math.abs(drift)).toBeLessThan(1e-9)
  })
})

describe('decompose — absent retrievers', () => {
  it('a retriever missing from retrieverRanks comes back as rank: null, value: 0, still in segments', () => {
    const c = candidate({ retrieverRanks: { dense: 2 }, rrf: 1 / 62, finalScore: 1 / 62 })
    const { segments } = decompose(c, FUSION_UNIT)
    const lexical = segments.find((s) => s.key === 'lexical')
    expect(lexical).toBeDefined()
    expect(lexical).toMatchObject({ rank: null, value: 0, kind: 'retriever' })
  })
})

describe('decompose — weights', () => {
  it('a non-unit weight reproduces weight / (k + rank)', () => {
    const fusion: AdminMemoryFusionConfig = { rrfK: 60, retrieverWeights: { dense: 2, lexical: 1 } }
    const c = candidate({ retrieverRanks: { dense: 1, lexical: 1 }, rrf: 2 / 61 + 1 / 61, finalScore: 2 / 61 + 1 / 61 })
    const { segments } = decompose(c, fusion)
    expect(segments.find((s) => s.key === 'dense')!.value).toBeCloseTo(2 / 61, 12)
    expect(segments.find((s) => s.key === 'lexical')!.value).toBeCloseTo(1 / 61, 12)
  })
})

describe('decompose — drift', () => {
  it('is non-zero when the live fusion weights no longer match what the run was fused with', () => {
    // Stored as if fused with dense weight 1; live config now weights dense at 2.
    const liveFusion: AdminMemoryFusionConfig = { rrfK: 60, retrieverWeights: { dense: 2 } }
    const c = candidate({ retrieverRanks: { dense: 1 }, rrf: 1 / 61, finalScore: 1 / 61 })
    const { drift } = decompose(c, liveFusion)
    expect(Math.abs(drift)).toBeGreaterThan(1e-6)
  })

  it('matches within 1e-9 for a candidate built from consistent values', () => {
    const c = candidate({ retrieverRanks: { dense: 4 }, rrf: 1 / 64, finalScore: 1 / 64 })
    const { drift } = decompose(c, { rrfK: 60, retrieverWeights: { dense: 1 } })
    expect(Math.abs(drift)).toBeLessThan(1e-9)
  })
})

describe('decompose — boosts', () => {
  it('boosts appear as their own segments', () => {
    const c = candidate({ retrieverRanks: { dense: 1 }, rrf: 1 / 61, recencyBoost: 0.05, finalScore: 1 / 61 + 0.05 })
    const { segments } = decompose(c, FUSION_UNIT)
    const boost = segments.find((s) => s.key === 'recencyBoost')
    expect(boost).toMatchObject({ rank: null, value: 0.05, kind: 'boost' })
  })

  it('a null boost is skipped, not treated as a 0-value visible segment', () => {
    const c = candidate({ retrieverRanks: { dense: 1 }, rrf: 1 / 61, recencyBoost: null, finalScore: 1 / 61 })
    const { segments } = decompose(c, FUSION_UNIT)
    expect(segments.find((s) => s.key === 'recencyBoost')).toBeUndefined()
  })
})
