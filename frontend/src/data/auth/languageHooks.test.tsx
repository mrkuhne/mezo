import { act, render, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { server } from '@/test/msw/server'
import { API_BASE, setToken } from '@/data/_client/api'
import { QueryProvider } from '@/app/providers/QueryProvider'
import { LanguageBoundary, LanguageProvider, LANG_KEY, getLang, setLang, subscribe } from '@/shared/i18n'
import { onToast, type ToastMessage } from '@/shared/lib/toastBus'
import { ME_QUERY_KEY, useAuthActions } from '@/data/auth/authHooks'
import { useLanguageSetting } from '@/data/auth/languageHooks'
import { makeHookWrapper } from '@/test/queryWrapper'
import type { MeResponse } from '@/data/auth/authApi'

const meBody = (language: 'hu' | 'en'): MeResponse => ({
  id: '00000000-0000-0000-0000-000000000001', email: 'owner@mezo.local', name: 'Owner',
  role: 'OWNER', onboarded: true, mustChangePassword: false, timezone: 'Europe/Budapest', language,
})

let client!: QueryClient
let setting!: ReturnType<typeof useLanguageSetting>
let mounts = 0

function Probe() {
  client = useQueryClient()
  setting = useLanguageSetting()
  return null
}
function Mounted() {
  // counts (re)mounts: the boundary must remount its subtree on a switch
  mounts += 1
  return null
}

function renderApp() {
  mounts = 0
  return render(
    <QueryProvider>
      <LanguageProvider>
        <LanguageBoundary>
          <Probe />
          <Mounted />
        </LanguageBoundary>
      </LanguageProvider>
    </QueryProvider>,
  )
}

/** Renders the app and waits until nothing is in flight, then pins the account language. */
async function bootAs(language: 'hu' | 'en') {
  renderApp()
  await waitFor(() => expect(client).toBeDefined())
  await waitFor(() => expect(client.isFetching()).toBe(0))
  act(() => client.setQueryData(ME_QUERY_KEY, meBody(language)))
  await waitFor(() => expect(getLang()).toBe(language))
}

const cached = () => localStorage.getItem(LANG_KEY)
const cachedMe = () => client.getQueryData<MeResponse>(ME_QUERY_KEY)

/**
 * Waits until no mutation is in flight. `setting.pending` cannot say this: the switch remounts the
 * caller, and the fresh hook instance starts out not pending. The observable truth is the client's
 * mutation cache (a mutation leaves "pending" only after its error/success handlers have run, so
 * the rollback or the cached `me` write is complete by then).
 */
const settled = () => waitFor(() => expect(client.isMutating()).toBe(0))

// A write still in flight when its test ends would complete inside a LATER test and write its
// stale `me` into that test's cache (the module-level client survives `clear()`), flipping the
// language under it. Every test therefore ends only once its writes have settled.
afterEach(async () => {
  if (client) await settled()
  client?.clear(); vi.unstubAllEnvs(); setToken(null); setLang('hu')
})

describe('real mode', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('adopts the account language when me loads and writes the device cache', async () => {
    setLang('hu')
    server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json(meBody('en'))))
    renderApp()
    await waitFor(() => expect(getLang()).toBe('en'))
    expect(cached()).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('PUT /api/auth/me/language, then me in the cache carries it (and the remounted caller is fine)', async () => {
    server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json(meBody('hu'))))
    let body: unknown
    server.use(http.put(`${API_BASE}/api/auth/me/language`, async ({ request }) => {
      body = await request.json()
      await new Promise((r) => setTimeout(r, 30))
      return HttpResponse.json(meBody('en'))
    }))
    await bootAs('hu')
    const mountsBefore = mounts
    act(() => setting.setLanguage('en'))
    // optimistic: the store, the device cache and the cached me change at once
    expect(getLang()).toBe('en')
    expect(cached()).toBe('en')
    expect(cachedMe()?.language).toBe('en')
    expect(mounts).toBeGreaterThan(mountsBefore) // the subtree really remounted mid-flight
    await waitFor(() => expect(body).toEqual({ language: 'en' }))
    await settled()
    await waitFor(() => expect(setting.pending).toBe(false))
    expect(getLang()).toBe('en')
    expect(cachedMe()?.language).toBe('en')
  })

  it('the in-flight write is not overwritten by the stale account language', async () => {
    server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json(meBody('hu'))))
    server.use(http.put(`${API_BASE}/api/auth/me/language`, async () => {
      await new Promise((r) => setTimeout(r, 80))
      return HttpResponse.json(meBody('en'))
    }))
    await bootAs('hu')
    act(() => setting.setLanguage('en'))
    await act(async () => { await new Promise((r) => setTimeout(r, 40)) })
    expect(getLang()).toBe('en') // still en while pending
    await settled()
    await waitFor(() => expect(setting.pending).toBe(false))
    expect(getLang()).toBe('en')
  })

  it.each([
    ['500', () => HttpResponse.json([{ code: 'INTERNAL_ERROR', message: 'x' }], { status: 500 })],
    ['network error', () => HttpResponse.error()],
  ])('failure (%s): store, device cache and cached me roll back, and the save-failed toast shows', async (_n, resolver) => {
    server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json(meBody('hu'))))
    server.use(http.put(`${API_BASE}/api/auth/me/language`, resolver))
    // what the app looked like at the moment the toast was emitted
    const toasts: Array<{ toast: ToastMessage; lang: string; me: string | undefined }> = []
    const off = onToast((toast) => toasts.push({ toast, lang: getLang(), me: cachedMe()?.language }))
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    await bootAs('hu')
    act(() => setting.setLanguage('en'))
    expect(getLang()).toBe('en')
    await waitFor(() => expect(toasts.length).toBe(1))
    // the toast comes AFTER the rollback, in the language rolled back to
    expect(toasts[0]).toEqual({ toast: { kind: 'error', text: 'Mentés sikertelen — próbáld újra' }, lang: 'hu', me: 'hu' })
    await settled()
    expect(getLang()).toBe('hu')
    expect(cached()).toBe('hu')
    expect(cachedMe()?.language).toBe('hu')
    await waitFor(() => expect(setting.pending).toBe(false))
    expect(getLang()).toBe('hu')
    expect(toasts.length).toBe(1) // exactly one: the app's default mutation-error toast stays silent here
    off(); err.mockRestore()
  })

  describe('two quick taps (hu -> en -> hu)', () => {
    /** A PUT handler whose responses the test releases by hand, in the order the requests arrived. */
    function heldPut() {
      const requests: Array<{ language: string; release: (r: Response) => void }> = []
      server.use(http.put(`${API_BASE}/api/auth/me/language`, async ({ request }) => {
        const { language } = (await request.json()) as { language: string }
        return new Promise<Response>((release) => { requests.push({ language, release }) })
      }))
      return requests
    }
    /** Every language the store announced from here on. */
    function watchLang() {
      const seen: string[] = []
      const off = subscribe(() => seen.push(getLang()))
      return { seen, off }
    }

    it('the late answer to the first tap never flips the app back: the second choice stands everywhere', async () => {
      server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json(meBody('hu'))))
      const requests = heldPut()
      await bootAs('hu')
      act(() => setting.setLanguage('en'))
      await waitFor(() => expect(requests.length).toBe(1))
      act(() => setting.setLanguage('hu')) // the remounted caller taps back while the first write is in flight
      expect(getLang()).toBe('hu')
      const { seen, off } = watchLang()
      const meSeen: Array<string | undefined> = []
      const offCache = client.getQueryCache().subscribe(() => meSeen.push(cachedMe()?.language))

      requests[0].release(HttpResponse.json(meBody('en'))) // the first answer arrives after the second tap
      await waitFor(() => expect(requests.length).toBe(2)) // the writes reach the server one by one, in tap order
      expect(requests.map((r) => r.language)).toEqual(['en', 'hu'])
      expect(getLang()).toBe('hu')
      expect(cachedMe()?.language).toBe('hu')
      requests[1].release(HttpResponse.json(meBody('hu')))
      await settled()

      expect(getLang()).toBe('hu')
      expect(cached()).toBe('hu')
      expect(cachedMe()?.language).toBe('hu')
      expect(seen).toEqual([]) // the store never moved after the second tap
      expect(meSeen.filter((l) => l !== 'hu')).toEqual([]) // nor did the cached me
      off(); offCache()
    })

    it('both writes fail: the app returns to where the chain began, with one toast', async () => {
      server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json(meBody('hu'))))
      const requests = heldPut()
      const toasts: ToastMessage[] = []
      const offToast = onToast((t) => toasts.push(t))
      const err = vi.spyOn(console, 'error').mockImplementation(() => {})
      await bootAs('hu')
      act(() => setting.setLanguage('en'))
      await waitFor(() => expect(requests.length).toBe(1))
      act(() => setting.setLanguage('hu'))
      act(() => setting.setLanguage('en')) // ends on English, optimistically
      expect(getLang()).toBe('en')
      const fail = () => HttpResponse.json([{ code: 'INTERNAL_ERROR', message: 'x' }], { status: 500 })
      requests[0].release(fail())
      await waitFor(() => expect(requests.length).toBe(2))
      expect(getLang()).toBe('en') // a superseded failure changes nothing
      expect(toasts).toEqual([])
      requests[1].release(fail())
      await waitFor(() => expect(requests.length).toBe(3))
      requests[2].release(fail())
      await settled()
      expect(getLang()).toBe('hu')
      expect(cached()).toBe('hu')
      expect(cachedMe()?.language).toBe('hu')
      expect(toasts).toEqual([{ kind: 'error', text: 'Mentés sikertelen — próbáld újra' }])
      offToast(); err.mockRestore()
    })

    it('the first write lands, the second fails: the app returns to what the server holds', async () => {
      server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json(meBody('hu'))))
      const requests = heldPut()
      const err = vi.spyOn(console, 'error').mockImplementation(() => {})
      await bootAs('hu')
      act(() => setting.setLanguage('en'))
      await waitFor(() => expect(requests.length).toBe(1))
      act(() => setting.setLanguage('hu'))
      requests[0].release(HttpResponse.json(meBody('en')))
      await waitFor(() => expect(requests.length).toBe(2))
      requests[1].release(HttpResponse.json([{ code: 'INTERNAL_ERROR', message: 'x' }], { status: 500 }))
      await settled()
      expect(getLang()).toBe('en')
      expect(cached()).toBe('en')
      expect(cachedMe()?.language).toBe('en')
      err.mockRestore()
    })
  })

  it('registration sends the resolved language', async () => {
    setLang('en')
    let body: Record<string, unknown> = {}
    server.use(http.post(`${API_BASE}/api/auth/register`, async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({ token: 'fresh' })
    }))
    const { result } = renderHook(() => useAuthActions(), { wrapper: makeHookWrapper() })
    await result.current.register({ inviteCode: 'ABC', name: 'N', email: 'a@b.c', password: 'pw' })
    expect(body.language).toBe('en')
  })

  it('every request carries Accept-Language of the current language; an explicit header wins', async () => {
    const seen: string[] = []
    server.use(http.get(`${API_BASE}/api/auth/me`, ({ request }) => {
      seen.push(request.headers.get('accept-language') ?? '')
      return HttpResponse.json(meBody('hu'))
    }))
    const { apiFetch } = await import('@/data/_client/api')
    setLang('hu')
    await apiFetch('/api/auth/me')
    setLang('en')
    await apiFetch('/api/auth/me')
    await apiFetch('/api/auth/me', { headers: { 'Accept-Language': 'de' } })
    expect(seen).toEqual(['hu', 'en', 'de'])
  })

  it('the event-stream request carries Accept-Language too', async () => {
    let header = ''
    server.use(http.post(`${API_BASE}/api/x/stream`, ({ request }) => {
      header = request.headers.get('accept-language') ?? ''
      return new HttpResponse('event: done\ndata: {}\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
    }))
    const { apiSse } = await import('@/data/_client/api')
    setLang('en')
    for await (const _ of apiSse('/api/x/stream', { method: 'POST' })) { /* drain */ }
    expect(header).toBe('en')
  })
})

describe('mock mode', () => {
  it('switches locally, never fetches', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    let fetched = false
    server.use(http.put(`${API_BASE}/api/auth/me/language`, () => { fetched = true; return HttpResponse.json(meBody('en')) }))
    renderApp()
    expect(getLang()).toBe('hu') // mockMe carries hu and wins
    act(() => setting.setLanguage('en'))
    expect(getLang()).toBe('en')
    expect(cached()).toBe('en')
    expect(cachedMe()?.language).toBe('en')
    await new Promise((r) => setTimeout(r, 30))
    expect(getLang()).toBe('en') // the sync effect does not flip it back
    expect(fetched).toBe(false)
  })
})
