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

/** Élő kapu-diagnosztika (mezo-viqs) — a companion switch kikapcsolva 404 ⇒ degraded.
 *  `isError`/`refetch` (mezo-viqs fix wave, the habitAdminHooks.ts/useHabitCatalog precedent):
 *  a 404 is caught above and mapped to the honest `degraded` card, so `isError` only ever fires
 *  on a genuinely failed fetch (500, network) — MotorPage needs it to tell that apart from the
 *  "unresolved yet" window, both of which otherwise read as `monitor === null`. */
export function usePatternMonitor() {
  const { data, isPending, isError, refetch } = useDualQuery<PatternMonitorBootstrap>({
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
  return { ...data, isPending, isError, refetch }
}
