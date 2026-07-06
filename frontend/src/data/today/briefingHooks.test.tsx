import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useBriefing } from '@/data/today/briefingHooks'

afterEach(() => {
  vi.unstubAllEnvs()
})

const briefingFixture = {
  date: '2026-07-06',
  eyebrow: 'Reggeli briefing · Reta nap 3',
  body: ['Jól aludtál, **7.4 óra**.', 'Ma leg-day vár.'],
  refs: [{ kind: 'Sleep', label: 'regeneráció' }, { kind: 'Memory', label: '2026-07-05' }],
  generatedAt: '2026-07-06T05:45:00Z',
}

describe('useBriefing (real mode default)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  it('maps the server briefing to the FE Briefing shape (no confidence)', async () => {
    server.use(http.get(`${API_BASE}/api/proactive/briefing`, () => HttpResponse.json(briefingFixture)))
    const { result } = renderHook(() => useBriefing(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current!.eyebrow).toBe('Reggeli briefing · Reta nap 3')
    expect(result.current!.body).toEqual([
      { type: 'p', text: 'Jól aludtál, **7.4 óra**.' },
      { type: 'p', text: 'Ma leg-day vár.' },
    ])
    expect(result.current!.refs).toEqual([
      { kind: 'Sleep', label: 'regeneráció' },
      { kind: 'Memory', label: '2026-07-05' },
    ])
    expect(result.current!.confidence).toBeUndefined()
  })

  it('returns null on 404 (honest absence — the default handler)', async () => {
    const { result } = renderHook(() => useBriefing(), { wrapper: makeHookWrapper() })
    // the msw default is 404 → the hook resolves to null and stays null
    await waitFor(() => expect(result.current).toBeNull())
  })
})

describe('useBriefing (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  it('returns null without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useBriefing(), { wrapper: makeHookWrapper() })
    expect(result.current).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
