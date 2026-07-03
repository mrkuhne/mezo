import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { patternsApi } from '@/data/insights/patternsApi'
import { patterns as mockPatterns, recentlyConfirmed as mockRecentlyConfirmed } from '@/data/insights/insights'
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

/** The L2 decision surface — persisted in real mode, cache-local in mock. */
export function usePatternActions() {
  const queryClient = useQueryClient()
  const mock = isMockMode()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: PATTERNS_KEY })

  const mutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: PatternStatus }) => {
      if (mock) {
        queryClient.setQueryData<PatternsBootstrap>(PATTERNS_KEY, (current) => {
          if (!current) return current
          const status = DECISION_TO_STATUS[decision]
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
