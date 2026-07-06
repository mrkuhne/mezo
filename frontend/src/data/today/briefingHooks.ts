import { useQuery } from '@tanstack/react-query'
import { ApiError } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { briefingApi } from '@/data/today/briefingApi'
import { localDateString } from '@/shared/lib/dates'
import type { Briefing } from '@/data/types'

/**
 * The generated morning briefing (proactive B1.2). Mock mode: always null — the mock card is
 * the Phase-1 static resolved by resolveBriefing (byte parity). Real mode: the server briefing
 * for today, or null while loading / on 404 (no narrative memory or switch off) / on error —
 * the consumer falls back to the labelled static card (the B1.2 fallback decision).
 */
export function useBriefing(): Briefing | null {
  const mock = isMockMode()
  const date = localDateString()
  const q = useQuery<Briefing | null>({
    queryKey: ['briefing', date],
    queryFn: mock
      ? async () => null
      : async () => {
          try {
            return await briefingApi.get(date)
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
