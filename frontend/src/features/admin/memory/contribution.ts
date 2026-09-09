import type { AdminMemoryCandidate, AdminMemoryFusionConfig, AdminMemoryScoreBreakdown } from '@/data/admin/adminMemoryApi'

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

// runVerdictSentence (mezo-k5zy Task 3) — a plain-Hungarian, one-line "why did this win" verdict
// over a candidate's scoreBreakdown, for readers who will never open the stacked contribution bar.
//
// Deliberately independent of `decompose`/an `AdminMemoryCandidate`: it only needs the breakdown
// itself (+ the live fusion weights, optional) — no `contentSnapshot`/`candidateRefId` etc. — so
// callers that already have a bare breakdown (or a candidate predating today's live config) never
// have to fabricate a whole candidate/fusion object just to get a sentence.
//
// The production RRF constant (`mezo.companion.memory-platform.fusion.rrf-k`) DEFAULTS to 60 —
// the same value `contribution.test.ts`'s own `FUSION_UNIT` fixture uses — for a caller with no
// live fusion config at all (weights/rrfK omitted), so it still gets a sensible answer (every
// retriever weighted 1, i.e. "which retriever ranked this candidate highest").
//
// Fix round (F1): a caller that DOES have the live `AdminMemoryFusionConfig` (every real one
// does — `RunDetail.tsx` holds it right next to the stacked contribution bar this sentence is a
// gloss on) MUST pass its actual `rrfK`. Hardcoding 60 here made the verdict silently drift from
// the bar at any other k: a boost that only wins the verdict's comparison at k=60 can lose it (or
// vice versa) at the server's REAL k, so the sentence and the bar below it could contradict each
// other on an install that ever tunes this constant.
const DEFAULT_RRF_K = 60

const RETRIEVER_ORDER = ['dense', 'lexical', 'graph', 'facts'] as const

// Product wording per source (Rulings: mezo-k5zy Task 3) — the ONLY four retrievers the pipeline
// has today (RunDetail.tsx's own `RETRIEVER_COLORS` covers exactly this set).
const RETRIEVER_VERDICT: Record<string, string> = {
  dense: 'főleg tartalmi hasonlóság miatt',
  lexical: 'főleg szó szerinti egyezés miatt',
  graph: 'a tudásgráf kapcsolatai miatt',
  facts: 'egy rögzített tény miatt',
}

// Boost-led wording per key (Rulings: "mert kiemelt/friss/fontos emlék" for pinned/recency/
// salience). `sourceReliabilityBoost`/`temporalBoost` are real boost keys too (contribution.ts's
// own `BOOST_KEYS`) but outside the ruling's three named ones — given a sensible sentence anyway
// so a run whose winning signal was one of THESE never silently falls through to the generic
// no-signal sentence below.
const BOOST_VERDICT: Record<string, string> = {
  pinnedBoost: 'mert kiemelt emlék',
  recencyBoost: 'mert friss emlék',
  salienceBoost: 'mert fontos emlék',
  sourceReliabilityBoost: 'mert megbízható forrásból származik',
  temporalBoost: 'mert most van itt az ideje',
}

const NO_SIGNAL_VERDICT = 'nem állapítható meg egyértelmű ok — egyik retriever sem talált rá, kiemelés sem érvényesült'

/**
 * One-line verdict over a candidate's `scoreBreakdown`: names the dominant contribution source in
 * product words, or leads with a boost when it out-weighs every retriever.
 *
 * Tie behaviour (documented, not incidental): among retrievers, ties are broken by
 * `RETRIEVER_ORDER` (dense > lexical > graph > facts — the loop only replaces the champion on a
 * STRICT `>`, so the first-scanned retriever at the max value wins); between a boost and a
 * retriever, the retriever wins a tie (the boost must strictly EXCEED the best retriever
 * contribution, per the ruling's own "exceeds" wording — a boost that only MATCHES a retriever's
 * contribution is not "the" reason).
 */
export function runVerdictSentence(
  breakdown: AdminMemoryScoreBreakdown,
  fusionWeights?: AdminMemoryFusionConfig['retrieverWeights'],
  rrfK: number = DEFAULT_RRF_K,
): string {
  const ranks = breakdown.retrieverRanks ?? {}

  let bestRetriever: { key: string; value: number } | null = null
  const scoreOf = (rank: number, key: string) => (fusionWeights?.[key] ?? 1) / (rrfK + rank)
  // RETRIEVER_ORDER first, so a tie among the four known retrievers resolves to the documented
  // priority order; any OTHER retriever key (a future addition, or a stored run predating this
  // dictionary) still counts toward the comparison, just with no product-worded sentence of its
  // own if it happens to win.
  for (const key of RETRIEVER_ORDER) {
    const rank = ranks[key]
    if (rank == null) continue
    const value = scoreOf(rank, key)
    if (!bestRetriever || value > bestRetriever.value) bestRetriever = { key, value }
  }
  for (const [key, rank] of Object.entries(ranks)) {
    if (rank == null || (RETRIEVER_ORDER as readonly string[]).includes(key)) continue
    const value = scoreOf(rank, key)
    if (!bestRetriever || value > bestRetriever.value) bestRetriever = { key, value }
  }

  let bestBoost: { key: string; value: number } | null = null
  for (const key of BOOST_KEYS) {
    const value = breakdown[key]
    if (value == null) continue
    if (!bestBoost || value > bestBoost.value) bestBoost = { key, value }
  }

  if (bestBoost && (!bestRetriever || bestBoost.value > bestRetriever.value)) {
    return BOOST_VERDICT[bestBoost.key] ?? 'mert egy kiemelő szabály érvényesült'
  }
  if (bestRetriever) {
    return RETRIEVER_VERDICT[bestRetriever.key] ?? `a(z) ${bestRetriever.key} retriever miatt`
  }
  if (bestBoost) {
    return BOOST_VERDICT[bestBoost.key] ?? 'mert egy kiemelő szabály érvényesült'
  }
  return NO_SIGNAL_VERDICT
}
