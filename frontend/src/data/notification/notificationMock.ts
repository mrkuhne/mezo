// Mock-mode push state — a plain module-level mutable, NOT a mock "seed" fed through
// useDualQuery: usePushSubscription() is not a dual-mode query (see notificationHooks.ts).
// This is the only state mock mode's subscribe()/unsubscribe()/sendTest() touch; they must
// never reach for Notification/navigator.serviceWorker/PushManager.
export const mockPushState: { enabled: boolean } = { enabled: false }

/** Test-only reset — call between tests so mock push state doesn't leak across cases. */
export function resetMockPushState(): void {
  mockPushState.enabled = false
}
