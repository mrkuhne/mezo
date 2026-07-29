import { NOTIFICATION_CATEGORIES } from '@/data/types'
import type { NotificationCategoryKey, NotificationPrefView } from '@/data/types'

// Mock-mode push state — a plain module-level mutable, NOT a mock "seed" fed through
// useDualQuery: usePushSubscription() is not a dual-mode query (see notificationHooks.ts).
// This is the only state mock mode's subscribe()/unsubscribe()/sendTest() touch; they must
// never reach for Notification/navigator.serviceWorker/PushManager.
export const mockPushState: { enabled: boolean } = { enabled: false }

/** Test-only reset — call between tests so mock push state doesn't leak across cases. */
export function resetMockPushState(): void {
  mockPushState.enabled = false
}

// ── Notification prefs seed (N2/N3 settings list) — the code defaults, verbatim off the
// backend's NotificationCategory enum (defaultEnabled/defaultLeadMinutes): 7 of 11 ON, only
// `gym` carries a non-zero lead. Used both as the mock-mode `useDualQuery` seed AND as the
// real-mode pre-resolve ghost (data/notification/notificationPrefHooks.ts) — the same "no
// stored row = code default" honesty the backend itself guarantees. ─────────────────────────
const DEFAULT_ENABLED: Record<NotificationCategoryKey, boolean> = {
  briefing: true, gym: true, medication: true, ritual: true, lights_out: true,
  weekly: true, memoir: true, wind_down: false, midday: false, checkin: false, fuel_slot: false,
}
const DEFAULT_LEAD_MINUTES: Record<NotificationCategoryKey, number> = {
  briefing: 0, gym: 30, medication: 0, ritual: 0, lights_out: 0,
  weekly: 0, memoir: 0, wind_down: 0, midday: 0, checkin: 0, fuel_slot: 0,
}

export const notificationPrefSeed: NotificationPrefView[] = NOTIFICATION_CATEGORIES.map((category) => ({
  category,
  enabled: DEFAULT_ENABLED[category],
  leadMinutes: DEFAULT_LEAD_MINUTES[category],
}))
