import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import { usePatterns, usePatternActions } from '@/data/insights/patternsHooks'
import { patterns as mockPatterns } from '@/data/insights/insights'

describe('usePatterns (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('serves the seeded patterns synchronously', () => {
    const { result } = renderHook(() => usePatterns(), { wrapper: makeHookWrapper() })
    expect(result.current.patterns).toHaveLength(mockPatterns.length)
    expect(result.current.mode).toBe('mock')
    expect(result.current.degraded).toBe(false)
  })

  test('decide updates the cached status and the confirmed list', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ read: usePatterns(), actions: usePatternActions() }), { wrapper })

    act(() => result.current.actions.decide(mockPatterns[0].id, 'confirm'))

    await waitFor(() => {
      const p = result.current.read.patterns.find((x) => x.id === mockPatterns[0].id)
      expect(p?.status).toBe('confirmed')
      expect(result.current.read.recentlyConfirmed).toContain(mockPatterns[0].title)
    })
  })
})

describe('usePatterns (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('maps the wire rows and derives recentlyConfirmed from confirmed rows', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern`, () =>
        HttpResponse.json([
          {
            id: 'w1',
            kind: 'statistical',
            category: 'physiology',
            categoryLabel: 'Fiziológia',
            title: 'Alvásminőség ↔ másnapi edzés-RPE',
            mechanism: 'Erős negatív együttjárás.',
            evidence: ['r=-0.82', 'n=14 nap'],
            confidence: null,
            critique: null,
            status: 'proposed',
            lastDetectedAt: '2026-07-04T02:40:00Z',
          },
          {
            id: 'w2',
            kind: 'statistical',
            category: 'trigger',
            categoryLabel: 'Trigger',
            title: 'Késői étkezés ↔ rákövetkező alvásminőség',
            mechanism: 'Közepes erősségű negatív együttjárás.',
            evidence: ['r=-0.51', 'n=21 nap'],
            confidence: null,
            critique: null,
            status: 'confirmed',
            lastDetectedAt: '2026-07-04T02:40:00Z',
          },
        ]),
      ),
    )
    const { result } = renderHook(() => usePatterns(), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.patterns).toHaveLength(2))
    expect(result.current.patterns[0].confidence).toBeUndefined()
    expect(result.current.patterns[0].critique).toBeUndefined()
    expect(result.current.patterns[0].kind).toBe('statistical')
    expect(result.current.recentlyConfirmed).toEqual(['Késői étkezés ↔ rákövetkező alvásminőség'])
    expect(result.current.mode).toBe('live')
  })

  test('a switch-off 404 renders the honest degraded state', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern`, () =>
        HttpResponse.json([{ code: 'NOT_FOUND' }], { status: 404 }),
      ),
    )
    const { result } = renderHook(() => usePatterns(), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.degraded).toBe(true))
    expect(result.current.patterns).toHaveLength(0)
  })

  test('decide POSTs the decision and refetches', async () => {
    let decided: string | null = null
    server.use(
      http.post(`${API_BASE}/api/companion/pattern/:id/decision`, async ({ request }) => {
        decided = ((await request.json()) as { decision: string }).decision
        return HttpResponse.json({
          id: 'p1',
          kind: 'ai_hypothesis',
          category: 'physiology',
          categoryLabel: 'Fiziológia',
          title: 't',
          mechanism: 'm',
          evidence: [],
          confidence: 0.8,
          critique: null,
          status: 'monitoring',
          lastDetectedAt: '2026-07-04T02:40:00Z',
        })
      }),
    )
    const { result } = renderHook(() => usePatternActions(), { wrapper: makeHookWrapper() })

    act(() => result.current.decide('p1', 'monitor'))

    await waitFor(() => expect(decided).toBe('monitor'))
  })
})
