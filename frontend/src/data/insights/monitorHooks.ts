import { ApiError } from '@/data/_client/api'
import { useDualQuery } from '@/data/useDualQuery'
import { monitorApi } from '@/data/insights/monitorApi'
import { patternMonitor as mockMonitor } from '@/data/insights/insights'
import type { PatternMonitor } from '@/data/types'

const MONITOR_KEY = ['pattern-monitor']

export interface PatternMonitorBootstrap {
  monitor: PatternMonitor | null
  degraded: boolean
  mode: 'mock' | 'live'
}

const MOCK: PatternMonitorBootstrap = { monitor: mockMonitor, degraded: false, mode: 'mock' }
const EMPTY: PatternMonitorBootstrap = { monitor: null, degraded: false, mode: 'live' }

/** Élő kapu-diagnosztika (mezo-viqs) — a companion switch kikapcsolva 404 ⇒ degraded. */
export function usePatternMonitor() {
  const { data, isPending } = useDualQuery<PatternMonitorBootstrap>({
    queryKey: MONITOR_KEY,
    mockData: MOCK,
    realFetch: async () => {
      try {
        return { monitor: await monitorApi.get(), degraded: false, mode: 'live' as const }
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return { ...EMPTY, degraded: true }
        throw e
      }
    },
    realEmpty: EMPTY,
  })
  return { ...data, isPending }
}
