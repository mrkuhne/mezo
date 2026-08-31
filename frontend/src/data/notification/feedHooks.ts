import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { notificationFeedApi } from '@/data/notification/feedApi'
import { notificationFeedSeed } from '@/data/notification/feedMock'
import type { components } from '@/data/_client/api.gen'
import type { AppNotificationKindKey, AppNotificationView } from '@/data/types'

const FEED_KEY = ['notification-feed'] as const

function toView(item: components['schemas']['NotificationFeedItem']): AppNotificationView {
  return {
    id: item.id,
    // A wire-kind sima string. A backend enum bővülhet anélkül, hogy ez a build tudna róla —
    // ezért a leképezést `notificationKindMeta()`-n át kell olvasni, nem nyers indexeléssel
    // (mezo-ntf8: egy `weekly_review_ready` sor elvitte az egész feed-oldalt).
    kind: item.kind as AppNotificationKindKey,
    title: item.title,
    body: item.body ?? null,
    deeplink: item.deeplink,
    occurredAt: item.occurredAt,
    readAt: item.readAt ?? null,
  }
}

/** The in-app notification feed (bd mezo-gzhp.1). Real mode's pre-resolve value is the honest
 *  EMPTY list (never the demo seed — the badge must not flash a fabricated count at a live user);
 *  refresh rides refetchOnWindowFocus (TanStack default) + app open, no interval polling. */
export function useNotificationFeed(): { items: AppNotificationView[]; isPending: boolean } {
  const { data, isPending } = useDualQuery<AppNotificationView[]>({
    queryKey: FEED_KEY,
    mockData: notificationFeedSeed,
    realFetch: async () => (await notificationFeedApi.feed()).items.map(toView),
    realEmpty: [],
  })
  return { items: data, isPending }
}

export function useNotificationFeedActions(): { markAllRead: () => Promise<void> } {
  const qc = useQueryClient()
  const mock = isMockMode()

  const mutation = useMutation({
    mutationFn: async () => {
      if (mock) return
      await notificationFeedApi.readAll()
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: FEED_KEY })
      const previous = qc.getQueryData<AppNotificationView[]>(FEED_KEY)
      const now = new Date().toISOString()
      qc.setQueryData<AppNotificationView[]>(FEED_KEY, (rows) =>
        (rows ?? []).map((n) => (n.readAt ? n : { ...n, readAt: now })))
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(FEED_KEY, context.previous)
    },
    onSettled: () => {
      if (!mock) qc.invalidateQueries({ queryKey: FEED_KEY })
    },
  })

  const markAllRead = useCallback(
    (): Promise<void> => mutation.mutateAsync().then(() => undefined),
    [mutation],
  )
  return { markAllRead }
}
