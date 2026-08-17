import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

type SubscriptionRequest = components['schemas']['PushSubscriptionRequest']
type TestResponse = components['schemas']['PushTestResponse']
type NotificationPref = components['schemas']['NotificationPref']
type NotificationPrefListResponse = components['schemas']['NotificationPrefListResponse']
type NotificationPrefListRequest = components['schemas']['NotificationPrefListRequest']
type NotificationScheduleRequest = components['schemas']['NotificationScheduleRequest']

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
  /** All 14 categories, always — a stored row wins, a missing one reports the code default. */
  prefs: () => apiFetch<NotificationPrefListResponse>('/api/notification/pref'),
  /** Per-category upsert (never a full replace) — safe to send just the one changed category. */
  putPrefs: (prefs: NotificationPref[]) =>
    apiFetch<void>('/api/notification/pref', {
      method: 'PUT',
      body: JSON.stringify({ prefs } satisfies NotificationPrefListRequest),
    }),
  /** Replaces the FE-owned recurring schedule for every category listed in `body.categories`
   *  (`checkin` / `fuel_slot` only — the backend 400s on anything else). */
  putSchedule: (body: NotificationScheduleRequest) =>
    apiFetch<void>('/api/notification/schedule', {
      method: 'PUT',
      body: JSON.stringify(body satisfies NotificationScheduleRequest),
    }),
}
