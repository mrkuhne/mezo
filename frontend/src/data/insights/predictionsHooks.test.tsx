import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { usePredictions } from '@/data/insights/predictionsHooks'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

const wireRow = {
  id: 'p1',
  title: 'Hét 27 testsúly csökken',
  basis: 'Reta D3-D7 alacsonyabb intake.',
  confidence: null,
  metricKey: 'weight_trend',
  expectedDirection: 'down',
  validFrom: '2026-07-07',
  validTo: '2026-07-13',
  status: 'pending',
  generatedAt: '2026-07-07T06:30:00Z',
}

describe('usePredictions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('maps wire rows, preserving null confidence and deriving the window label', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/prediction`, () => HttpResponse.json([wireRow])),
    )
    const { result } = renderHook(() => usePredictions(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.predictions).toHaveLength(1))
    const p = result.current.predictions[0]
    expect(p.confidence).toBeNull()
    expect(p.status).toBe('pending')
    expect(p.date).toMatch(/júl/)   // HU short-month window label
    expect(result.current.mode).toBe('live')
  })

  test('returns [] on the default empty array (honest empty state)', async () => {
    const { result } = renderHook(() => usePredictions(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.mode).toBe('live'))
    expect(result.current.predictions).toEqual([])
  })
})

describe('usePredictions (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('returns the seed without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => usePredictions(), { wrapper: makeHookWrapper() })
    expect(result.current.mode).toBe('mock')
    expect(result.current.predictions.length).toBeGreaterThan(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
