import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { patternsApi } from '@/data/insights/patternsApi'
import { patterns as mockPatterns, recentlyConfirmed as mockRecentlyConfirmed } from '@/data/insights/insights'
import { PATTERN_PAIR_DETAIL_KEY, type PatternPairDetailBootstrap } from '@/data/insights/patternDetailHooks'
import type { Pattern, PatternRowStatus, PatternStatus } from '@/data/types'

const PATTERNS_KEY = ['patterns']

export interface PatternsBootstrap {
  patterns: Pattern[]
  recentlyConfirmed: string[]
  degraded: boolean
  mode: 'mock' | 'live'
}

const MOCK_PATTERNS: PatternsBootstrap = {
  patterns: mockPatterns,
  recentlyConfirmed: mockRecentlyConfirmed,
  degraded: false,
  mode: 'mock',
}

const EMPTY_PATTERNS: PatternsBootstrap = { patterns: [], recentlyConfirmed: [], degraded: false, mode: 'live' }

const DECISION_TO_STATUS: Record<PatternStatus, PatternRowStatus> = {
  confirm: 'confirmed',
  monitor: 'monitoring',
  reject: 'rejected',
}

/** The pattern inbox bootstrap — real mode lists the V3.1 backend; switch-off 404 = degraded. */
export function usePatterns() {
  const { data, isPending } = useDualQuery<PatternsBootstrap>({
    queryKey: PATTERNS_KEY,
    mockData: MOCK_PATTERNS,
    realFetch: async () => {
      try {
        const patterns = await patternsApi.list()
        return {
          patterns,
          recentlyConfirmed: patterns
            .filter((p) => p.status === 'confirmed')
            .slice(0, 5)
            .map((p) => p.title),
          degraded: false,
          mode: 'live' as const,
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return { ...EMPTY_PATTERNS, degraded: true }
        throw e
      }
    },
    realEmpty: EMPTY_PATTERNS,
  })
  return { ...data, isPending }
}

/** The L2 decision surface — persisted in real mode, cache-local in mock. Writes through TWO
 *  caches, `['patterns']` (the dashboard) and `['pattern-pair-detail', pairKey]` (the detail page,
 *  mezo-tk88.5) — a decision made from either surface must be visible on both without a reload. */
export function usePatternActions() {
  const queryClient = useQueryClient()
  const mock = isMockMode()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: PATTERNS_KEY })
    // Prefix match — no `pairKey` known here, and none needed: this invalidates every cached
    // detail query at once (there's normally at most one warm on screen).
    queryClient.invalidateQueries({ queryKey: PATTERN_PAIR_DETAIL_KEY })
  }

  const mutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: PatternStatus }) => {
      if (mock) {
        const status = DECISION_TO_STATUS[decision]
        queryClient.setQueryData<PatternsBootstrap>(PATTERNS_KEY, (current) => {
          if (!current) return current
          const patterns = current.patterns.map((p) => (p.id === id ? { ...p, status } : p))
          const confirmedTitle = patterns.find((p) => p.id === id && status === 'confirmed')?.title
          return {
            ...current,
            patterns,
            recentlyConfirmed: confirmedTitle
              ? [confirmedTitle, ...current.recentlyConfirmed.filter((t) => t !== confirmedTitle)]
              : current.recentlyConfirmed,
          }
        })
        // Same decision, mirrored onto any warm detail-page cache entry for this pattern — only
        // `pattern.status` moves; the append-only event history/journal stays the static seed.
        queryClient.setQueriesData<PatternPairDetailBootstrap>({ queryKey: PATTERN_PAIR_DETAIL_KEY }, (current) => {
          if (!current?.detail?.pattern || current.detail.pattern.id !== id) return current
          return { ...current, detail: { ...current.detail, pattern: { ...current.detail.pattern, status } } }
        })
        return
      }
      await patternsApi.decide(id, decision)
    },
    onSuccess: mock ? undefined : invalidate,
  })

  return {
    decide: (id: string, decision: PatternStatus) => mutation.mutate({ id, decision }),
    pending: mutation.isPending,
  }
}
