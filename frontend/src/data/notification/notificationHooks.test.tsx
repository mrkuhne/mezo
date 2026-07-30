import { renderHook, act, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePushSubscription } from '@/data/notification/notificationHooks'
import { isMockMode } from '@/data/_client/mode'
import { API_BASE } from '@/data/_client/api'
import { resetMockPushState } from '@/data/notification/notificationMock'
import { server } from '@/test/msw/server'

/** A syntactically valid base64url VAPID public key (the RFC 8291 §5 `as_public` vector) —
 *  `urlB64ToUint8Array` runs `atob()` over it, so it cannot be an arbitrary placeholder.
 *  `.env` deliberately ships `VITE_VAPID_PUBLIC` blank, so every real-mode test that expects
 *  to reach `pushManager.subscribe()` has to stub it in. */
const VAPID_PUBLIC =
  'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'

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
  vi.unstubAllEnvs()
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
    vi.stubEnv('VITE_VAPID_PUBLIC', VAPID_PUBLIC) // else the missing-key guard would short-circuit
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
    vi.stubEnv('VITE_VAPID_PUBLIC', VAPID_PUBLIC)
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

  it('mock mode ignores a blank VITE_VAPID_PUBLIC — the guard is a real-mode-only concern', async () => {
    if (!isMockMode()) return
    // A capable browser has to be stubbed in: `subscribe()` returns false on an unsupported
    // device before the mock short-circuit, so without this the assertion would pass vacuously.
    stubSupportedBrowser()
    vi.stubEnv('VITE_VAPID_PUBLIC', '')
    const { result } = renderHook(() => usePushSubscription())
    let outcome: boolean | undefined
    await act(async () => { outcome = await result.current.subscribe() })
    expect(outcome).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('a blank VITE_VAPID_PUBLIC surfaces vapid-missing and never attempts pushManager.subscribe()', async () => {
    if (isMockMode()) return
    // The exact state a fresh deploy hits when the frontend build step never received the key:
    // urlB64ToUint8Array('') would hand subscribe() a zero-length applicationServerKey and it
    // would reject with InvalidAccessError — undiagnosable from the UI.
    vi.stubEnv('VITE_VAPID_PUBLIC', '')
    const { requestPermission, subscribe: pushManagerSubscribe } = stubSupportedBrowser()

    const { result } = renderHook(() => usePushSubscription())
    let outcome: boolean | undefined
    await act(async () => { outcome = await result.current.subscribe() })

    expect(outcome).toBe(false)
    expect(result.current.error).toBe('vapid-missing')
    expect(pushManagerSubscribe).not.toHaveBeenCalled()
    expect(requestPermission).not.toHaveBeenCalled() // not even a permission prompt is spent
  })

  it('a failing register() after a successful browser subscribe() surfaces register-failed instead of reporting enabled', async () => {
    if (isMockMode()) return
    vi.stubEnv('VITE_VAPID_PUBLIC', VAPID_PUBLIC)
    const fakeSubscription = {
      endpoint: 'https://push.example/split-state',
      toJSON: () => ({
        endpoint: 'https://push.example/split-state',
        keys: { p256dh: 'FAKE_P256DH==', auth: 'FAKE_AUTH==' },
      }),
    } as unknown as PushSubscription
    stubSupportedBrowser({ subscribe: vi.fn().mockResolvedValue(fakeSubscription) })
    server.use(http.post(`${API_BASE}/api/notification/subscription`,
      () => new HttpResponse(null, { status: 500 })))

    const { result } = renderHook(() => usePushSubscription())
    let outcome: boolean | undefined
    await act(async () => { outcome = await result.current.subscribe() })

    // The browser subscription is live but the server has no row — claiming `enabled: true`
    // here is the lie that makes /test answer `0 próbálkozás` forever with nothing to see.
    expect(outcome).toBe(false)
    expect(result.current.enabled).toBe(false)
    expect(result.current.error).toBe('register-failed')
  })

  it('re-registers an existing browser subscription on mount, self-healing a missing server row', async () => {
    if (isMockMode()) return
    const fakeSubscription = {
      endpoint: 'https://push.example/self-heal',
      toJSON: () => ({
        endpoint: 'https://push.example/self-heal',
        keys: { p256dh: 'HEAL_P256DH==', auth: 'HEAL_AUTH==' },
      }),
    } as unknown as PushSubscription
    stubSupportedBrowser({ getSubscription: vi.fn().mockResolvedValue(fakeSubscription) })

    const bodies: unknown[] = []
    server.use(http.post(`${API_BASE}/api/notification/subscription`, async ({ request }) => {
      bodies.push(await request.json())
      return new HttpResponse(null, { status: 204 })
    }))

    const { result } = renderHook(() => usePushSubscription())

    // The endpoint is an idempotent upsert, so re-registering what the browser already holds is
    // safe — and it repairs both a register() that failed mid-flow and a 404/410 prune.
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toEqual({
      endpoint: 'https://push.example/self-heal',
      p256dh: 'HEAL_P256DH==',
      auth: 'HEAL_AUTH==',
      userAgent: navigator.userAgent,
    })
    expect(result.current.enabled).toBe(true)
    expect(result.current.error).toBeNull()
  })
})
