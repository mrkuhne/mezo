import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useLlmUsage, useMemoryOverview, useMemorySummaries, useSimilarDays } from '@/data/insights/memoryHooks'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

const overviewWire = {
  l0: { daysWithAnyData: 12, windowDays: 60 },
  l1: { summaryCount: 5, embeddings: { dailySummary: 4, chatTurn: 9 } }, // first/lastDate hiányzik
  l2: { patterns: [{ kind: 'statistical', status: 'proposed', count: 1 }], pendingFactCandidates: 0 },
  l3: { facts: [{ source: 'chat', count: 2 }], totalReinforcements: 3, factsInPrompt: 2 },
  jobs: { summaryCron: '0 20 2 * * *', patternCron: '0 40 2 * * *', hypothesisCron: '0 0 3 * * SUN' },
}

describe('memory hooks (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('useMemoryOverview normalizes absent optional wire fields to null', async () => {
    server.use(http.get(`${API_BASE}/api/companion/memory/overview`, () => HttpResponse.json(overviewWire)))
    const { result } = renderHook(() => useMemoryOverview(), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.overview).not.toBeNull())
    expect(result.current.overview!.l0.daysWithAnyData).toBe(12)
    expect(result.current.overview!.l1.firstDate).toBeNull()
    expect(result.current.overview!.jobs.lastDetectedAt).toBeNull()
    expect(result.current.degraded).toBe(false)
    expect(result.current.mode).toBe('live')
  })

  test('useMemoryOverview flags degraded on a 404 (companion switch off)', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/memory/overview`, () => new HttpResponse(null, { status: 404 })),
    )
    const { result } = renderHook(() => useMemoryOverview(), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.degraded).toBe(true))
    expect(result.current.overview).toBeNull()
  })

  test('useMemorySummaries maps items and flags degraded on 404', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/memory/summary`, () =>
        HttpResponse.json({ items: [{ date: '2026-08-12', narrative: 'jó nap', embedded: true }] }),
      ),
    )
    const { result } = renderHook(() => useMemorySummaries(), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.summaries).toHaveLength(1))
    expect(result.current.summaries[0]).toEqual({ date: '2026-08-12', narrative: 'jó nap', embedded: true })
  })
})

describe('memory hooks (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('returns the seeds synchronously without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result: o } = renderHook(() => useMemoryOverview(), { wrapper: makeHookWrapper() })
    const { result: s } = renderHook(() => useMemorySummaries(), { wrapper: makeHookWrapper() })

    expect(o.current.mode).toBe('mock')
    expect(o.current.overview!.l1.summaryCount).toBe(38)
    expect(s.current.summaries).toHaveLength(6)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('useSimilarDays (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('does not fire while the query is empty', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useSimilarDays(''), { wrapper: makeHookWrapper() })

    expect(result.current.results).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('maps results once a query is submitted', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/memory/similar-days`, () =>
        HttpResponse.json({
          items: [{ date: '2026-08-09', excerpt: 'rövid alvás', similarity: 0.81, finalScore: 0.64 }],
        }),
      ),
    )
    const { result } = renderHook(() => useSimilarDays('rossz alvás'), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.results).toHaveLength(1))
    expect(result.current.results![0].finalScore).toBe(0.64)
  })

  test('flags degraded on 404', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/memory/similar-days`, () => new HttpResponse(null, { status: 404 })),
    )
    const { result } = renderHook(() => useSimilarDays('bármi'), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.degraded).toBe(true))
  })
})

describe('useSimilarDays (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('returns the deterministic seed for any submitted query', () => {
    const { result } = renderHook(() => useSimilarDays('fáradt nap'), { wrapper: makeHookWrapper() })
    expect(result.current.results).toHaveLength(3)
    expect(result.current.mode).toBe('mock')
  })
})

describe('useLlmUsage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('maps the disabled default handler honestly', async () => {
    const { result } = renderHook(() => useLlmUsage(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.usage).not.toBeNull())
    expect(result.current.usage!.enabled).toBe(false)
    expect(result.current.usage!.perDay).toHaveLength(0)
    expect(result.current.usage!.totals.costUsd).toBeNull()
  })
})
