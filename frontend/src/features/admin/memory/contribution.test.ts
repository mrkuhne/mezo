import { describe, expect, it } from 'vitest'
import { decompose, runVerdictSentence } from '@/features/admin/memory/contribution'
import type { AdminMemoryCandidate, AdminMemoryFusionConfig, AdminMemoryScoreBreakdown } from '@/data/admin/adminMemoryApi'

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

function breakdown(overrides: Partial<AdminMemoryScoreBreakdown>): AdminMemoryScoreBreakdown {
  return { retrieverRanks: {}, rrf: 0, finalScore: 0, ...overrides }
}

describe('runVerdictSentence — dominant retriever', () => {
  it('names dense when it out-scores every other retriever', () => {
    const b = breakdown({ retrieverRanks: { dense: 1, lexical: 5 } })
    expect(runVerdictSentence(b)).toBe('főleg tartalmi hasonlóság miatt')
  })

  it('names lexical when IT out-scores dense', () => {
    const b = breakdown({ retrieverRanks: { dense: 5, lexical: 1 } })
    expect(runVerdictSentence(b)).toBe('főleg szó szerinti egyezés miatt')
  })

  it('names graph and facts too (the pipeline\'s other two retriever sources)', () => {
    expect(runVerdictSentence(breakdown({ retrieverRanks: { graph: 1, dense: 5 } }))).toBe('a tudásgráf kapcsolatai miatt')
    expect(runVerdictSentence(breakdown({ retrieverRanks: { facts: 1, dense: 5 } }))).toBe('egy rögzített tény miatt')
  })

  it('live fusion weights can flip the dominant retriever despite equal ranks', () => {
    const b = breakdown({ retrieverRanks: { dense: 1, lexical: 1 } })
    // Unweighted, this is the dense/lexical TIE case (see below) — dense wins by priority order.
    // A live lexical weight of 3 vs dense's default 1 must flip the verdict to lexical.
    expect(runVerdictSentence(b, { dense: 1, lexical: 3 })).toBe('főleg szó szerinti egyezés miatt')
  })
})

describe('runVerdictSentence — boost-led', () => {
  it('leads with the boost when it strictly exceeds the best retriever contribution', () => {
    // dense rank 1, rrfK 60 default => 1/61 ≈ 0.0164 — a realistic recencyBoost (0.05) exceeds it.
    const b = breakdown({ retrieverRanks: { dense: 1 }, recencyBoost: 0.05 })
    expect(runVerdictSentence(b)).toBe('mert friss emlék')
  })

  it('maps pinned/recency/salience to the ruling\'s three product sentences', () => {
    expect(runVerdictSentence(breakdown({ pinnedBoost: 1 }))).toBe('mert kiemelt emlék')
    expect(runVerdictSentence(breakdown({ recencyBoost: 1 }))).toBe('mert friss emlék')
    expect(runVerdictSentence(breakdown({ salienceBoost: 1 }))).toBe('mert fontos emlék')
  })

  it('a boost that only MATCHES (never exceeds) the best retriever does NOT win the lead', () => {
    // dense rank 1 => 1/61; an EXACT-equal boost must not out-verdict the retriever ("exceeds").
    const b = breakdown({ retrieverRanks: { dense: 1 }, pinnedBoost: 1 / 61 })
    expect(runVerdictSentence(b)).toBe('főleg tartalmi hasonlóság miatt')
  })
})

describe('runVerdictSentence — sensible tie behaviour', () => {
  it('dense wins a same-value tie against lexical (documented priority order)', () => {
    const b = breakdown({ retrieverRanks: { dense: 1, lexical: 1 } })
    expect(runVerdictSentence(b)).toBe('főleg tartalmi hasonlóság miatt')
  })

  it('lexical wins a same-value tie against graph/facts (priority order continues)', () => {
    const b = breakdown({ retrieverRanks: { lexical: 1, graph: 1, facts: 1 } })
    expect(runVerdictSentence(b)).toBe('főleg szó szerinti egyezés miatt')
  })
})

describe('runVerdictSentence — no signal', () => {
  it('is honest when neither a retriever nor a boost contributed anything', () => {
    expect(runVerdictSentence(breakdown({}))).toBe(
      'nem állapítható meg egyértelmű ok — egyik retriever sem talált rá, kiemelés sem érvényesült',
    )
  })
})
