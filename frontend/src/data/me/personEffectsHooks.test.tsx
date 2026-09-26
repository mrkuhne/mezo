import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import { usePersonEffects } from '@/data/me/personEffectsHooks'
import { MOCK_PERSON_EFFECTS } from '@/data/me/people'
import type { PersonEffectsResponse } from '@/data/me/personEffectsApi'

describe('usePersonEffects (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('seeds the fixture person\'s effect rows synchronously', () => {
    const { result } = renderHook(() => usePersonEffects('pp-petra'), { wrapper: makeHookWrapper() })
    expect(result.current.effects).toEqual(MOCK_PERSON_EFFECTS['pp-petra'])
    expect(result.current.effects).toHaveLength(3)
    expect(result.current.effects.some(e => e.metric === 'stress' && e.direction === 'lower')).toBe(true)
    expect(result.current.isPending).toBe(false)
  })

  it('returns [] for a person with no effect rows', () => {
    const { result } = renderHook(() => usePersonEffects('pp-adam'), { wrapper: makeHookWrapper() })
    expect(result.current.effects).toEqual([])
  })

  it('returns [] while personId is undefined', () => {
    const { result } = renderHook(() => usePersonEffects(undefined), { wrapper: makeHookWrapper() })
    expect(result.current.effects).toEqual([])
  })
})

describe('usePersonEffects (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('fetches by personId and maps wire → domain (strengthBand→strength, confidenceTier→confidence)', async () => {
    const personId = '11111111-1111-1111-1111-111111111111'
    let queried: string | null = null
    server.use(http.get(`${API_BASE}/api/companion/effects`, ({ request }) => {
      queried = new URL(request.url).searchParams.get('personId')
      const body: PersonEffectsResponse = {
        effects: [{
          metric: 'mental', direction: 'higher', strengthBand: 'eros', confidenceTier: 'kozepes',
          meanDiff: 0.55, subjectDays: 12, complementDays: 40, computedAt: '2026-07-03T20:14:00Z',
        }],
      }
      return HttpResponse.json(body)
    }))
    const { result } = renderHook(() => usePersonEffects(personId), { wrapper: makeHookWrapper() })
    // unresolved window: empty, never the mock seed
    expect(result.current.effects).toEqual([])
    await waitFor(() => expect(result.current.effects).toHaveLength(1))
    expect(queried).toBe(personId)
    expect(result.current.effects[0]).toEqual({
      metric: 'mental', direction: 'higher', strength: 'eros', confidence: 'kozepes',
      meanDiff: 0.55, subjectDays: 12,
    })
  })

  it('does not fetch while personId is undefined', () => {
    let called = false
    server.use(http.get(`${API_BASE}/api/companion/effects`, () => { called = true; return HttpResponse.json({ effects: [] }) }))
    const { result } = renderHook(() => usePersonEffects(undefined), { wrapper: makeHookWrapper() })
    expect(result.current.effects).toEqual([])
    expect(called).toBe(false)
  })
})
