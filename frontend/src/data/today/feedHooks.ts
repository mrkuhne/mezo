import { useQuery } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { feedApi } from '@/data/today/feedApi'
import { localDateString } from '@/shared/lib/dates'
import type { FeedMessage } from '@/data/types'

/**
 * The unified companion-message feed for the FE's LOCAL day (companion-feed, mezo-gst9) — the
 * MezoChip thread's single data source. Mock mode: always `[]` synchronously — Phase-1 byte
 * parity; the thread falls back to the labelled demo briefing card (mezoMessages.ts). Real
 * mode: the day's persisted feed, polled every 60s so cron-kind arrivals (midday/evening) and
 * event-triggered kinds (sleep/weight, born from the sleep/weight log mutations' invalidation)
 * land without a manual reload. The endpoint is an honest-empty list (never a 404) — any error
 * still degrades to `[]` rather than crashing the thread.
 */
export function useCompanionFeed(): FeedMessage[] {
  const mock = isMockMode()
  const date = localDateString()
  const q = useQuery<FeedMessage[]>({
    queryKey: ['companionFeed', date],
    queryFn: mock
      ? async () => []
      : async () => {
          try {
            return await feedApi.get(date)
          } catch {
            return []
          }
        },
    initialData: mock ? [] : undefined,
    staleTime: mock ? Infinity : undefined,
    refetchInterval: mock ? undefined : 60_000,
    retry: false,
  })
  return q.data ?? []
}
