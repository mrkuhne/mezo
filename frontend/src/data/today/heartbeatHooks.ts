import { useQuery } from '@tanstack/react-query'
import { ApiError } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { heartbeatApi } from '@/data/today/heartbeatApi'
import { localDateString } from '@/shared/lib/dates'
import type { CompanionNote } from '@/data/types'

/**
 * The day's heartbeat note (proactive H1). Mock mode: always null — the Phase-1 Today has no
 * such card (byte parity). Real mode: today's latest note, or null while loading / on 404
 * (no elapsed window yet, no narrative memory, switch off) / on error — the card is simply
 * absent (honest absence, roadmap §H1).
 */
export function useCompanionNote(): CompanionNote | null {
  const mock = isMockMode()
  const date = localDateString()
  const q = useQuery<CompanionNote | null>({
    queryKey: ['heartbeat', date],
    queryFn: mock
      ? async () => null
      : async () => {
          try {
            return await heartbeatApi.get(date)
          } catch (e) {
            if (e instanceof ApiError && e.status === 404) return null
            throw e
          }
        },
    initialData: mock ? null : undefined,
    staleTime: mock ? Infinity : undefined,
    retry: false,
  })
  return q.data ?? null
}
