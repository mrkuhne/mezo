import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

type SubscriptionRequest = components['schemas']['PushSubscriptionRequest']
type TestResponse = components['schemas']['PushTestResponse']

export const notificationApi = {
  register: (body: SubscriptionRequest) =>
    apiFetch<void>('/api/notification/subscription', {
      method: 'POST',
      body: JSON.stringify(body satisfies SubscriptionRequest),
    }),
  unregister: (endpoint: string) =>
    apiFetch<void>(`/api/notification/subscription?endpoint=${encodeURIComponent(endpoint)}`, {
      method: 'DELETE',
    }),
  test: () => apiFetch<TestResponse>('/api/notification/test', { method: 'POST' }),
}
