import { act, render, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { server } from '@/test/msw/server'
import { API_BASE, setToken } from '@/data/_client/api'
import { QueryProvider } from '@/app/providers/QueryProvider'
import { LanguageProvider, LANG_KEY, getLang, setLang } from '@/shared/i18n'
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
  // counts (re)mounts: the provider must remount its subtree on a switch
  mounts += 1
  return null
}

function renderApp() {
  mounts = 0
  return render(
    <QueryProvider>
      <LanguageProvider>
        <Probe />
        <Mounted />
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
    const toasts: ToastMessage[] = []
    const off = onToast((t) => toasts.push(t))
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    await bootAs('hu')
    act(() => setting.setLanguage('en'))
    expect(getLang()).toBe('en')
    await waitFor(() => expect(toasts.length).toBe(1))
    expect(toasts[0]).toMatchObject({ kind: 'error' })
    await settled() // the toast is emitted a tick BEFORE the rollback handler runs
    expect(getLang()).toBe('hu')
    expect(cached()).toBe('hu')
    expect(cachedMe()?.language).toBe('hu')
    await waitFor(() => expect(setting.pending).toBe(false))
    expect(getLang()).toBe('hu')
    off(); err.mockRestore()
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
