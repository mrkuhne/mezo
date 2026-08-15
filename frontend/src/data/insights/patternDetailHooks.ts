import { ApiError } from '@/data/_client/api'
import { useDualQuery } from '@/data/useDualQuery'
import { patternDetailApi } from '@/data/insights/patternDetailApi'
import { mockPatternPairDetail } from '@/data/insights/insights'
import type { PatternPairDetail } from '@/data/types'

const detailKey = (pairKey: string) => ['pattern-pair-detail', pairKey]

interface PatternPairDetailBootstrap {
  detail: PatternPairDetail | null
  notFound: boolean
  mode: 'mock' | 'live'
}

const EMPTY: PatternPairDetailBootstrap = { detail: null, notFound: false, mode: 'live' }

/** Egy katalógus-pár teljes részletező nézete (mezo-tk88.5, `/insights/patterns/:pairKey`) —
 *  dual-mode. `notFound` egyetlen becsületes állapot mindkét 404-forrásra: ismeretlen
 *  pár-kulcs ÉS kikapcsolt companion switch szándékosan megkülönböztethetetlen (a kapu-diagnosztika
 *  ezt már a monitor-hookban is így kezeli, lásd monitorHooks.ts `degraded`). */
export function usePatternPairDetail(pairKey: string) {
  const mockDetail = mockPatternPairDetail(pairKey)
  const mock: PatternPairDetailBootstrap = { detail: mockDetail, notFound: mockDetail === null, mode: 'mock' }
  const { data, isPending, isError, refetch } = useDualQuery<PatternPairDetailBootstrap>({
    queryKey: detailKey(pairKey),
    mockData: mock,
    realFetch: async () => {
      try {
        return { detail: await patternDetailApi.get(pairKey), notFound: false, mode: 'live' as const }
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return { ...EMPTY, notFound: true }
        throw e
      }
    },
    realEmpty: EMPTY,
  })
  return { ...data, degraded: false as const, isPending, isError, refetch }
}
