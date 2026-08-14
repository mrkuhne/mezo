import { ApiError } from '@/data/_client/api'
import { useDualQuery } from '@/data/useDualQuery'
import { memoryApi } from '@/data/insights/memoryApi'
import { memoryOverview as mockOverview, memorySummaries as mockSummaries } from '@/data/insights/memory'
import type { MemoryOverview, MemorySummaryItem } from '@/data/types'

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
