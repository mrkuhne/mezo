import type { AdminMemoryCandidate, AdminMemoryFusionConfig } from '@/data/admin/adminMemoryApi'

export interface Contribution {
  /** retriever name, or a boost key like 'recencyBoost' */
  key: string
  /** 1-based rank inside that retriever; null for a boost, or for a retriever that missed it */
  rank: number | null
  /** the additive amount this segment contributed to finalScore */
  value: number
  kind: 'retriever' | 'boost'
}

const BOOST_KEYS = [
  'pinnedBoost',
  'sourceReliabilityBoost',
  'temporalBoost',
  'salienceBoost',
  'recencyBoost',
] as const

/**
 * One candidate's finalScore, decomposed into the segments the stacked bar draws
 * (Elastic RRF `explain` + the Azure sub-score table: rank + weighted contribution per source,
 * absent sources shown EXPLICITLY, boosts as their own segments, the reranker kept out of the
 * bar entirely).
 *
 * Each retriever's RRF share is `weight / (rrfK + rank)` — the same expression
 * MemoryCandidateFusion applies (`value.rrf += weight / (config.rrfConstant() + rank)`), so the
 * segments sum to the stored `rrf` up to floating-point error. `absent` retrievers (not present
 * in `scoreBreakdown.retrieverRanks`) are returned with `rank: null, value: 0` so the bar can
 * render a muted "–" instead of silently omitting a source, which is the single most misleading
 * thing a hybrid-retrieval explainer can do.
 *
 * NOT included in the bar: `rerankerScore`. The pipeline stores 1/postRerankRank, i.e. a
 * restatement of `rank` — it is not additive and putting it in a stacked bar would invent a
 * contribution that does not exist. It is a separate column, labelled as a position.
 *
 * The retriever universe is the union of the LIVE fusion config's `retrieverWeights` keys (so a
 * retriever that returned nothing for THIS candidate but exists in the pipeline still renders as
 * an explicit "–") and whatever `retrieverRanks` itself carries, in case a stored run predates a
 * retriever that config no longer lists.
 */
export function decompose(
  candidate: AdminMemoryCandidate,
  fusion: AdminMemoryFusionConfig,
): { segments: Contribution[]; rrfSum: number; storedRrf: number; drift: number } {
  const breakdown = candidate.scoreBreakdown
  const retrieverRanks = breakdown.retrieverRanks ?? {}
  const retrieverWeights = fusion.retrieverWeights ?? {}
  const retrieverNames = Array.from(new Set([...Object.keys(retrieverWeights), ...Object.keys(retrieverRanks)]))

  let rrfSum = 0
  const segments: Contribution[] = retrieverNames.map((name) => {
    const rank = retrieverRanks[name]
    if (rank == null) {
      return { key: name, rank: null, value: 0, kind: 'retriever' }
    }
    const weight = retrieverWeights[name] ?? 1
    const value = weight / (fusion.rrfK + rank)
    rrfSum += value
    return { key: name, rank, value, kind: 'retriever' }
  })

  for (const boostKey of BOOST_KEYS) {
    const value = breakdown[boostKey]
    // A null/undefined boost is SKIPPED — not rendered as a zero-value segment — because a
    // boost that never applied is different from one that applied and contributed nothing.
    if (value != null) {
      segments.push({ key: boostKey, rank: null, value, kind: 'boost' })
    }
  }

  const storedRrf = breakdown.rrf
  const drift = rrfSum - storedRrf

  return { segments, rrfSum, storedRrf, drift }
}
