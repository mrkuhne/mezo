import { useQuery } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { feedApi } from '@/data/today/feedApi'
import { localDateString } from '@/shared/lib/dates'
import type { FeedMessage } from '@/data/types'

/**
 * The unified companion-message feed for a given day (companion-feed, mezo-gst9), defaulting to
 * the FE's LOCAL day — the MezoChip thread's single data source. `date` is an explicit opt-in
 * (mezo-b3pp.36): an intervention push deep-links to the card's OWN generation day, which for a
 * card deferred across midnight is the day BEFORE the push arrives, so `NapMezoPage` calls this
 * a second time with that earlier day to pull the one card in — the query key already includes
 * the date, so this is a per-date cache entry, not a second request for the same day. Mock mode:
 * always `[]` synchronously — Phase-1 byte parity; the thread falls back to the labelled demo
 * briefing card (mezoMessages.ts). Real mode: the day's persisted feed, polled every 60s so
 * cron-kind arrivals (midday/evening) and event-triggered kinds (sleep/weight, born from the
 * sleep/weight log mutations' invalidation) land without a manual reload. The endpoint is an
 * honest-empty list (never a 404) — any error still degrades to `[]` rather than crashing the
 * thread.
 */
export function useCompanionFeed(date: string = localDateString()): FeedMessage[] {
  const mock = isMockMode()
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
