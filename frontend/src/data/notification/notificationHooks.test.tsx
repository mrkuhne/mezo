import { renderHook, act } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePushSubscription } from '@/data/notification/notificationHooks'
import { isMockMode } from '@/data/_client/mode'
import { API_BASE } from '@/data/_client/api'
import { resetMockPushState } from '@/data/notification/notificationMock'
import { server } from '@/test/msw/server'

/** Stubs a fake "supported" browser (Notification + PushManager + navigator.serviceWorker)
 *  so real-mode subscribe()/unsubscribe() flows can be exercised under jsdom, which has none
 *  of these globals natively. Returns the pushManager spies so tests can assert on them. */
function stubSupportedBrowser(opts: {
  requestPermission?: ReturnType<typeof vi.fn>
  getSubscription?: ReturnType<typeof vi.fn>
  subscribe?: ReturnType<typeof vi.fn>
} = {}) {
  const requestPermission = opts.requestPermission ?? vi.fn().mockResolvedValue('granted')
  const getSubscription = opts.getSubscription ?? vi.fn().mockResolvedValue(undefined)
  const subscribe = opts.subscribe ?? vi.fn()
  vi.stubGlobal('Notification', { requestPermission, permission: 'default' })
  vi.stubGlobal('PushManager', function PushManagerStub() {})
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve({ pushManager: { getSubscription, subscribe } }) },
    configurable: true,
  })
  return { requestPermission, getSubscription, subscribe }
}

afterEach(() => {
  vi.unstubAllGlobals()
  if ('serviceWorker' in navigator) {
    // @ts-expect-error test-only teardown of the property defined by stubSupportedBrowser
    delete navigator.serviceWorker
  }
  resetMockPushState()
})

describe('usePushSubscription', () => {
  it('reports unsupported in jsdom without crashing', () => {
    const { result } = renderHook(() => usePushSubscription())
    // jsdom has no PushManager in either mode → the hook must degrade, never throw.
    expect(result.current.supported).toBe(false)
    expect(result.current.enabled).toBe(false)
    expect(typeof result.current.subscribe).toBe('function')
  })

  it('subscribe() resolves false when unsupported', async () => {
    const { result } = renderHook(() => usePushSubscription())
    let outcome: boolean | undefined
    await act(async () => { outcome = await result.current.subscribe() })
    expect(outcome).toBe(false)
  })

  it('mock mode never reports a live subscription', () => {
    if (!isMockMode()) return
    const { result } = renderHook(() => usePushSubscription())
    expect(result.current.enabled).toBe(false)
  })

  // Real-mode only: jsdom has no Notification/serviceWorker/PushManager, so these stub them
  // in to exercise the flow the mock-mode branch never runs. Skipped under VITE_USE_MOCK=true.

  it('denied permission resolves subscribe() to false rather than throwing', async () => {
    if (isMockMode()) return
    const { subscribe: pushManagerSubscribe } = stubSupportedBrowser({
      requestPermission: vi.fn().mockResolvedValue('denied'),
    })
    const { result } = renderHook(() => usePushSubscription())
    expect(result.current.supported).toBe(true)

    let outcome: boolean | undefined
    await act(async () => { outcome = await result.current.subscribe() })

    expect(outcome).toBe(false)
    expect(pushManagerSubscribe).not.toHaveBeenCalled() // never reaches pushManager.subscribe() once denied
  })

  it('subscribe() unwraps subscription.toJSON().keys into a flat p256dh/auth request body', async () => {
    if (isMockMode()) return
    const fakeSubscription = {
      endpoint: 'https://push.example/abc123',
      toJSON: () => ({
        endpoint: 'https://push.example/abc123',
        keys: { p256dh: 'FAKE_P256DH==', auth: 'FAKE_AUTH==' },
      }),
    } as unknown as PushSubscription
    stubSupportedBrowser({ subscribe: vi.fn().mockResolvedValue(fakeSubscription) })

    let capturedBody: unknown
    server.use(http.post(`${API_BASE}/api/notification/subscription`, async ({ request }) => {
      capturedBody = await request.json()
      return new HttpResponse(null, { status: 204 })
    }))

    const { result } = renderHook(() => usePushSubscription())
    let outcome: boolean | undefined
    await act(async () => { outcome = await result.current.subscribe() })

    expect(outcome).toBe(true)
    // The classic bug: sending the nested `{ keys: { p256dh, auth } }` shape instead of the
    // flat wire contract — assert the unwrapped body, not just that *some* call happened.
    expect(capturedBody).toEqual({
      endpoint: 'https://push.example/abc123',
      p256dh: 'FAKE_P256DH==',
      auth: 'FAKE_AUTH==',
      userAgent: navigator.userAgent,
    })
  })

  it('mock mode never reaches for Notification/serviceWorker/PushManager, even when the browser has them', async () => {
    if (!isMockMode()) return
    // `supported` reflects the real device (true here, since we stub one in) — mock mode still
    // must never call INTO Notification.requestPermission / pushManager.getSubscription/subscribe,
    // or the backend, when driving subscribe()/unsubscribe()/sendTest() off mockPushState instead.
    const { requestPermission, getSubscription, subscribe: pushManagerSubscribe } = stubSupportedBrowser()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const { result } = renderHook(() => usePushSubscription())
    expect(result.current.supported).toBe(true)

    let subscribeOutcome: boolean | undefined
    await act(async () => { subscribeOutcome = await result.current.subscribe() })
    await act(async () => { await result.current.unsubscribe() })
    await act(async () => { await result.current.sendTest() })

    expect(subscribeOutcome).toBe(true) // mock's own short-circuit success, not a real subscription
    expect(requestPermission).not.toHaveBeenCalled()
    expect(getSubscription).not.toHaveBeenCalled()
    expect(pushManagerSubscribe).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled() // never calls the backend either
  })
})
