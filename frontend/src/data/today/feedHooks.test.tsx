import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useCompanionFeed } from '@/data/today/feedHooks'

afterEach(() => {
  vi.unstubAllEnvs()
})

const feedFixture = [
  {
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
