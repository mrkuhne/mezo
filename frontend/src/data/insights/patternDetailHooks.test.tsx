import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { usePatternPairDetail } from '@/data/insights/patternDetailHooks'
import { patternMonitor as mockMonitor } from '@/data/insights/insights'
import { API_BASE } from '@/data/_client/api'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

const SHOWCASE_KEY = 'sleep-quality~next-day-training-rpe'
const CATALOG_ONLY_KEY = 'checkin-stress~sleep-quality'

describe('usePatternPairDetail (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('serves the seeded showcase detail synchronously for its pair key', () => {
    const { result } = renderHook(() => usePatternPairDetail(SHOWCASE_KEY), { wrapper: makeHookWrapper() })

    expect(result.current.mode).toBe('mock')
    expect(result.current.notFound).toBe(false)
    expect(result.current.degraded).toBe(false)
    const detail = result.current.detail!
    expect(detail.pair.key).toBe(SHOWCASE_KEY)
    expect(detail.pattern?.status).toBe('confirmed')
    expect(detail.pattern?.pairKey).toBe(SHOWCASE_KEY)
    expect(detail.events).toHaveLength(9)
    expect(detail.events[0]).toMatchObject({ kind: 'snapshot', r: -0.18 })
    expect(detail.events.at(-1)).toMatchObject({ kind: 'reinforced', reinforcementCount: 4 })
    const confirmed = detail.events.find((e) => e.kind === 'confirmed')
    expect(confirmed?.occurredAt.slice(0, 10)).toBe('2026-07-12')
    expect(detail.days).toHaveLength(24)
    expect(detail.impact.fact).toMatchObject({ reinforcementCount: 4, includeInPrompt: true })
    expect(detail.impact.predictions).toHaveLength(2)
    expect(detail.impact.predictions.map((p) => p.status).sort()).toEqual(['pending', 'validated'])
    expect(detail.impact.experiments).toHaveLength(1)
    expect(detail.impact.experiments[0].status).toBe('active')
    expect(detail.impact.challenges).toHaveLength(1)
    expect(detail.impact.challenges[0].status).toBe('completed')
  })

  test('synthesizes a minimal detail (pattern: null, empty history/impact) for a gathering catalog pair', () => {
    const { result } = renderHook(() => usePatternPairDetail(CATALOG_ONLY_KEY), { wrapper: makeHookWrapper() })

    expect(result.current.notFound).toBe(false)
    const detail = result.current.detail!
    expect(detail.pair.key).toBe(CATALOG_ONLY_KEY)
    expect(detail.pair).toEqual(mockMonitor.pairs.find((p) => p.key === CATALOG_ONLY_KEY))
    expect(detail.pattern).toBeNull()
    expect(detail.events).toEqual([])
    expect(detail.days).toEqual([])
    expect(detail.impact).toEqual({ fact: null, predictions: [], experiments: [], challenges: [] })
  })

  test('an unknown catalog key renders the honest not-found state', () => {
    const { result } = renderHook(() => usePatternPairDetail('not-a-real-pair'), { wrapper: makeHookWrapper() })

    expect(result.current.notFound).toBe(true)
    expect(result.current.detail).toBeNull()
  })
})

describe('usePatternPairDetail (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  const wirePair = {
    key: SHOWCASE_KEY,
    title: 'Alvásminőség ↔ másnapi edzés-RPE',
    category: 'physiology',
    categoryLabel: 'Fiziológia',
    lagDays: 1,
    metricAKey: 'sleep-quality',
    metricALabel: 'alvásminőség',
    metricBKey: 'training-rpe',
    metricBLabel: 'edzés-RPE',
    mechanismHu: 'A rosszabb alvás másnap nehezebbnek érződő edzést hozhat.',
    questionHu: 'Könnyebb az edzés, ha jól aludtál?',
    expectedDirection: 'negative',
    whenPositiveHu: 'a jobb alvás után {erősség} nehezebbnek érződött az edzés',
    whenNegativeHu: 'a jobb alvás után {erősség} könnyebbnek érződött az edzés',
    metricADomain: 'sleep',
    metricBDomain: 'train',
    verdict: 'live',
    alignedDays: 32,
    r: -0.58,
    n: 32,
    p: 0.001,
    status: 'confirmed',
  }

  test('maps the wire response, reusing toPattern for the pattern field', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern/pair/${SHOWCASE_KEY}`, () =>
        HttpResponse.json({
          pair: wirePair,
          pattern: {
            id: 'w-pattern-1',
            kind: 'statistical',
            pairKey: SHOWCASE_KEY,
            category: 'physiology',
            categoryLabel: 'Fiziológia',
            title: 'Alvásminőség ↔ másnapi edzés-RPE',
            mechanism: 'A rosszabb alvás másnap nehezebbnek érződő edzést hozhat.',
            evidence: ['r=-0.58', 'n=32 nap'],
            confidence: null,
            critique: null,
            status: 'confirmed',
            lastDetectedAt: '2026-08-13T02:40:00Z',
          },
          events: [
            { kind: 'snapshot', occurredAt: '2026-06-03T02:40:00Z', r: -0.18, n: 14, p: 0.52 },
            { kind: 'confirmed', occurredAt: '2026-07-12T09:15:00Z' },
          ],
          days: [{ date: '2026-08-13', a: 8.8, b: 4.1 }],
          impact: {
            fact: { id: 'fact-1', text: 'Ha rosszul alszol, nehezebbnek érzed másnap az edzést.', reinforcementCount: 4, includeInPrompt: true },
            predictions: [{ id: 'pr1', title: 'Csütörtök RPE > 7', status: 'validated' }],
            experiments: [],
            challenges: [],
          },
        }),
      ),
    )
    const { result } = renderHook(() => usePatternPairDetail(SHOWCASE_KEY), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.detail).not.toBeNull())
    const detail = result.current.detail!
    expect(result.current.mode).toBe('live')
    expect(result.current.notFound).toBe(false)
    expect(detail.pair.key).toBe(SHOWCASE_KEY)
    expect(detail.pair.missingDays).toBeNull() // normalized like monitorApi's toPair
    expect(detail.pair.bottleneckMetricKey).toBeNull()
    // toPattern reuse: nullable confidence/critique on a statistical row stay absent (undefined)
    expect(detail.pattern?.confidence).toBeUndefined()
    expect(detail.pattern?.critique).toBeUndefined()
    expect(detail.pattern?.kind).toBe('statistical')
    expect(detail.pattern?.status).toBe('confirmed')
    expect(detail.events).toHaveLength(2)
    expect(detail.events[0]).toMatchObject({ kind: 'snapshot', r: -0.18, n: 14, p: 0.52 })
    expect(detail.events[1]).toEqual({ kind: 'confirmed', occurredAt: '2026-07-12T09:15:00Z' })
    expect(detail.days).toEqual([{ date: '2026-08-13', a: 8.8, b: 4.1 }])
    expect(detail.impact.fact?.reinforcementCount).toBe(4)
    expect(detail.impact.predictions).toEqual([{ id: 'pr1', title: 'Csütörtök RPE > 7', status: 'validated' }])
  })

  test('maps a gathering pair with no persisted row (pattern: null)', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern/pair/${CATALOG_ONLY_KEY}`, () =>
        HttpResponse.json({
          pair: { ...wirePair, key: CATALOG_ONLY_KEY, status: null },
          pattern: null,
          events: [],
          days: [],
          impact: { fact: null, predictions: [], experiments: [], challenges: [] },
        }),
      ),
    )
    const { result } = renderHook(() => usePatternPairDetail(CATALOG_ONLY_KEY), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.detail).not.toBeNull())
    expect(result.current.detail?.pattern).toBeNull()
    expect(result.current.notFound).toBe(false)
  })

  test('a 404 (unknown pair key OR companion switch off) renders the honest not-found state', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern/pair/not-a-real-pair`, () =>
        HttpResponse.json([{ code: 'NOT_FOUND' }], { status: 404 }),
      ),
    )
    const { result } = renderHook(() => usePatternPairDetail('not-a-real-pair'), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.notFound).toBe(true))
    expect(result.current.detail).toBeNull()
    expect(result.current.degraded).toBe(false)
  })
})
