import { useQuery } from '@tanstack/react-query'
import { ApiError } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { memoryApi } from '@/data/insights/memoryApi'
import {
  memoryOverview as mockOverview,
  memorySummaries as mockSummaries,
  similarDaysSeed,
} from '@/data/insights/memory'
import type { MemoryOverview, MemorySummaryItem, SimilarDay } from '@/data/types'

const isSwitchedOff = (err: unknown) => err instanceof ApiError && err.status === 404

export interface MemoryOverviewBootstrap {
  overview: MemoryOverview | null
  degraded: boolean
  mode: 'mock' | 'live'
}

const OVERVIEW_MOCK: MemoryOverviewBootstrap = { overview: mockOverview, degraded: false, mode: 'mock' }
const OVERVIEW_EMPTY: MemoryOverviewBootstrap = { overview: null, degraded: false, mode: 'live' }

/** A memória-rétegek áttekintése (mezo-al1i) — companion switch off 404 ⇒ degraded. */
export function useMemoryOverview() {
  const { data, isPending, isError, refetch } = useDualQuery<MemoryOverviewBootstrap>({
    queryKey: ['memory', 'overview'],
    mockData: OVERVIEW_MOCK,
    realFetch: async () => {
      try {
        return { overview: await memoryApi.overview(), degraded: false, mode: 'live' as const }
      } catch (e) {
        if (isSwitchedOff(e)) return { ...OVERVIEW_EMPTY, degraded: true }
        throw e
      }
    },
    realEmpty: OVERVIEW_EMPTY,
  })
  return { ...data, isPending, isError, refetch }
}

export interface MemorySummariesBootstrap {
  summaries: MemorySummaryItem[]
  degraded: boolean
  mode: 'mock' | 'live'
}

const SUMMARIES_MOCK: MemorySummariesBootstrap = { summaries: mockSummaries, degraded: false, mode: 'mock' }
const SUMMARIES_EMPTY: MemorySummariesBootstrap = { summaries: [], degraded: false, mode: 'live' }

/** Az L1 napló (mezo-al1i) — teljes lista date-desc; a tartomány-szűrés a szerveren opció marad. */
export function useMemorySummaries() {
  const { data, isPending } = useDualQuery<MemorySummariesBootstrap>({
    queryKey: ['memory', 'summaries'],
    mockData: SUMMARIES_MOCK,
    realFetch: async () => {
      try {
        return { summaries: await memoryApi.summaries(), degraded: false, mode: 'live' as const }
      } catch (e) {
        if (isSwitchedOff(e)) return { ...SUMMARIES_EMPTY, degraded: true }
        throw e
      }
    },
    realEmpty: SUMMARIES_EMPTY,
  })
  return { ...data, isPending }
}

export interface SimilarDaySearch {
  results: SimilarDay[] | null
  degraded: boolean
  mode: 'mock' | 'live'
}

const SEARCH_EMPTY: SimilarDaySearch = { results: null, degraded: false, mode: 'live' }

/**
 * Lusta hasonló-nap kereső (mezo-al1i) — üres query-vel nem tüzel (a gomb indítja, nem a gépelés).
 * Mock módban determinisztikus seedet ad; 404 (companion off) ⇒ degraded.
 */
export function useSimilarDays(query: string) {
  const mock = isMockMode()
  const enabled = query.trim() !== ''
  const q = useQuery<SimilarDaySearch>({
    queryKey: ['memory', 'similar', query],
    enabled,
    staleTime: mock ? Infinity : 60_000,
    initialData: mock && enabled
      ? { results: similarDaysSeed, degraded: false, mode: 'mock' } : undefined,
    queryFn: mock
      ? async () => ({ results: similarDaysSeed, degraded: false, mode: 'mock' as const })
      : async () => {
          try {
            return { results: await memoryApi.similarDays(query, 3), degraded: false, mode: 'live' as const }
          } catch (e) {
            if (isSwitchedOff(e)) return { results: null, degraded: true, mode: 'live' as const }
            throw e
          }
        },
  })
  return { ...(q.data ?? SEARCH_EMPTY), isFetching: q.isFetching }
}
