import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

type FeedResponse = components['schemas']['NotificationFeedResponse']

export const notificationFeedApi = {
  feed: () => apiFetch<FeedResponse>('/api/notification/feed'),
  readAll: () => apiFetch<void>('/api/notification/feed/read-all', { method: 'POST' }),
}
