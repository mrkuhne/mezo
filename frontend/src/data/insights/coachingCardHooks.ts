import { mockCoachingCard } from '@/data/insights/coachingCardMock'
import { feedApi } from '@/data/today/feedApi'
import { useDualQuery, DEFAULT_QUERY_STALE_TIME_MS } from '@/data/useDualQuery'
import { localDateString } from '@/shared/lib/dates'
import type { FeedMessage } from '@/data/types'

/**
 * The ONE advice card delivered on `date` (mezo-6269.3) — the coaching surface's own read of the
 * companion feed. Not `useCompanionFeed`: that hook swallows a failed fetch into `[]`, which the
 * card page cannot tell apart from "no card today". Here the two are different screens, so the
 * read goes through `useDualQuery` and keeps `isPending`/`isError` honest. The query key is the
 * feed's own prefix + date, so `useAdviceActions`' invalidation of `['companionFeed']` refreshes
 * this card too — the applied state stays server-driven, with no second action path.
 */
export function useCoachingCard(date: string = localDateString()): {
  card: FeedMessage | null
  isPending: boolean
  isError: boolean
} {
  const { data, isPending, isError } = useDualQuery<FeedMessage | null>({
    queryKey: ['companionFeed', date, 'advice'],
    mockData: mockCoachingCard(date),
    realFetch: () => feedApi.get(date).then((rows) => rows.find((m) => m.kind === 'advice') ?? null),
    realEmpty: null,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { card: data, isPending, isError }
}
