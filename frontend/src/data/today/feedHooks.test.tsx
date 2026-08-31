import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useCompanionFeed } from '@/data/today/feedHooks'
import { localDateString } from '@/shared/lib/dates'

afterEach(() => {
  vi.unstubAllEnvs()
})

const feedFixture = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    date: '2026-07-06',
    kind: 'morning',
    eyebrow: 'Reggeli briefing · Reta nap 3',
    body: ['Jól aludtál, **7.4 óra**.', 'Ma leg-day vár.'],
    refs: [{ kind: 'Sleep', label: 'regeneráció' }, { kind: 'Memory', label: '2026-07-05' }],
    generatedAt: '2026-07-06T05:45:00Z',
  },
]

describe('useCompanionFeed (real mode default)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('maps the wire feed to FeedMessage[]', async () => {
    server.use(http.get(`${API_BASE}/api/proactive/feed`, () => HttpResponse.json(feedFixture)))
    const { result } = renderHook(() => useCompanionFeed(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current).toHaveLength(1))
    // The companion_message row id — the W4.1 feedback artifactId (mezo-b3pp.15). Without it
    // the Today thread cannot vote on a feed message at all.
    expect(result.current[0].id).toBe('11111111-1111-4111-8111-111111111111')
    expect(result.current[0].kind).toBe('morning')
    expect(result.current[0].eyebrow).toBe('Reggeli briefing · Reta nap 3')
    expect(result.current[0].body).toEqual([
      { type: 'p', text: 'Jól aludtál, **7.4 óra**.' },
      { type: 'p', text: 'Ma leg-day vár.' },
    ])
    expect(result.current[0].refs).toEqual([
      { kind: 'Sleep', label: 'regeneráció' },
      { kind: 'Memory', label: '2026-07-05' },
    ])
    expect(result.current[0].generatedAt).toBe('2026-07-06T05:45:00Z')
  })

  it('returns [] on the default honest-empty handler', async () => {
    const { result } = renderHook(() => useCompanionFeed(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current).toEqual([]))
  })

  it('returns [] on error (never crashes the thread)', async () => {
    server.use(http.get(`${API_BASE}/api/proactive/feed`, () => new HttpResponse(null, { status: 500 })))
    const { result } = renderHook(() => useCompanionFeed(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current).toEqual([]))
  })

  // mezo-b3pp.36: an intervention push deep-links to the card's OWN generation day, which for
  // a card deferred across midnight is the day BEFORE the push arrives — NapMezoPage calls this
  // hook a second time with that earlier day to pull the one card in.
  it('fetches the requested day when a date is passed, cached under a per-date key', async () => {
    server.use(http.get(`${API_BASE}/api/proactive/feed`, ({ request }) => {
      const url = new URL(request.url)
      expect(url.searchParams.get('date')).toBe('2026-07-05')
      return HttpResponse.json(feedFixture)
    }))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useCompanionFeed('2026-07-05'), { wrapper })
    await waitFor(() => expect(result.current).toHaveLength(1))
    // per-date cache key: the earlier day's read lives at its own entry, not overwriting today's.
    expect(client.getQueryData(['companionFeed', '2026-07-05'])).toHaveLength(1)
    expect(client.getQueryData(['companionFeed', localDateString()])).toBeUndefined()
  })

  it('defaults to the local day when no date is passed', async () => {
    server.use(http.get(`${API_BASE}/api/proactive/feed`, ({ request }) => {
      const url = new URL(request.url)
      expect(url.searchParams.get('date')).toBe(localDateString())
      return HttpResponse.json(feedFixture)
    }))
    const { result } = renderHook(() => useCompanionFeed(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current).toHaveLength(1))
  })
})

describe('useCompanionFeed (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('returns [] synchronously without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useCompanionFeed(), { wrapper: makeHookWrapper() })
    expect(result.current).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
