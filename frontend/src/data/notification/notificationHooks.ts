import { useCallback, useEffect, useState } from 'react'
import { isMockMode } from '@/data/_client/mode'
import type { components } from '@/data/_client/api.gen'
import { notificationApi } from '@/data/notification/notificationApi'
import { mockPushState } from '@/data/notification/notificationMock'
import type { PushSubscriptionState } from '@/data/types'

type SubscriptionRequest = components['schemas']['PushSubscriptionRequest']

/** Decodes a URL-safe base64 VAPID key into the Uint8Array `applicationServerKey` wants.
 *  Built via `new Uint8Array(length)` + index assignment (not `.from()`) — `applicationServerKey`
 *  wants `BufferSource` (backed by a plain `ArrayBuffer`), and `Uint8Array.from()` types its
 *  result against the wider `ArrayBufferLike`, which TS then rejects at the call site. */
function urlB64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** Unwraps sub.toJSON() into the wire request — the classic bug here is sending the nested
 *  `{ keys: { p256dh, auth } }` shape instead of flattening it; the backend contract is flat. */
function toSubscriptionRequest(sub: PushSubscription): SubscriptionRequest {
  const json = sub.toJSON()
  return {
    endpoint: json.endpoint ?? sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
    userAgent: navigator.userAgent,
  }
}

const browserSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window

const browserStandalone = () =>
  typeof window !== 'undefined'
  && (window.matchMedia?.('(display-mode: standalone)').matches === true
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true)

/**
 * Dual-mode bridge to the browser's Push API. Deliberately NOT a useDualQuery: the source
 * of truth for `enabled` is the BROWSER (registration.pushManager.getSubscription()), not
 * the server. In mock mode every action short-circuits against the module-level
 * `mockPushState` and never touches Notification/navigator.serviceWorker/PushManager —
 * jsdom has none of those, and so does a real device the mock layer has no business probing.
 */
export function usePushSubscription(): PushSubscriptionState {
  const mock = isMockMode()
  // `supported`/`standalone` reflect the REAL device, in both modes — jsdom naturally reports
  // false (no serviceWorker/PushManager) regardless of mock, which is what keeps `subscribe()`
  // resolving false under both `pnpm test` and `VITE_USE_MOCK=true pnpm test`. Only the ACTIONS
  // below (the mount effect + subscribe/unsubscribe) branch on `mock` to avoid ever calling into
  // Notification/serviceWorker/PushManager — a presence check is not the same as invoking them.
  const supported = browserSupported()
  const standalone = browserStandalone()

  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : 'default',
  )
  const [enabled, setEnabled] = useState(mock ? mockPushState.enabled : false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (mock || !supported) return
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => {})
  }, [mock, supported])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supported) return false
    if (mock) {
      mockPushState.enabled = true
      setEnabled(true)
      return true
    }
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return false
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC ?? ''),
      })
      await notificationApi.register(toSubscriptionRequest(sub))
      setEnabled(true)
      return true
    } finally {
      setBusy(false)
    }
  }, [mock, supported])

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!supported) return
    if (mock) {
      mockPushState.enabled = false
      setEnabled(false)
      return
    }
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await notificationApi.unregister(sub.endpoint)
        await sub.unsubscribe()
      }
      setEnabled(false)
    } finally {
      setBusy(false)
    }
  }, [mock, supported])

  const sendTest = useCallback(async (): Promise<{ attempted: number; sent: number }> => {
    if (mock) return { attempted: 1, sent: mockPushState.enabled ? 1 : 0 }
    return notificationApi.test()
  }, [mock])

  return { supported, standalone, permission, enabled, busy, subscribe, unsubscribe, sendTest }
}
