import { ApiError } from '@/data/_client/api'
import { useDualQuery } from '@/data/useDualQuery'
import { patternDetailApi } from '@/data/insights/patternDetailApi'
import { mockPatternPairDetail } from '@/data/insights/insights'
import type { PatternPairDetail } from '@/data/types'

/** The bare query-key prefix — exported so a write elsewhere (e.g. `usePatternActions().decide`,
 *  `patternsHooks.ts`) can invalidate/patch every cached pairKey's detail without importing the
 *  full per-key builder. */
export const PATTERN_PAIR_DETAIL_KEY = ['pattern-pair-detail']
const detailKey = (pairKey: string) => [...PATTERN_PAIR_DETAIL_KEY, pairKey]

export interface PatternPairDetailBootstrap {
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
