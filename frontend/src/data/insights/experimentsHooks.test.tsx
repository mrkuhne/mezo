import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useExperiments } from '@/data/insights/experimentsHooks'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

const proposedRow = {
  id: 'e1',
  title: 'Esti magnézium',
  hypothesis: 'Korábbi adagolás → mélyebb alvás.',
  status: 'proposed',
  metricKey: 'sleep_avg',
  expectedDirection: 'up',
  startDate: null,
  totalDays: 7,
  outcome: null,
  outcomeGood: null,
  generatedAt: '2026-07-07T06:45:00Z',
}

describe('useExperiments (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('maps a proposed wire row with a zero day counter', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/experiment`, () => HttpResponse.json([proposedRow])),
    )
    const { result } = renderHook(() => useExperiments(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.experiments).toHaveLength(1))
    const e = result.current.experiments[0]
    expect(e.status).toBe('proposed')
    expect(e.day).toBe(0)
    expect(e.total).toBe(7)
    expect(e.outcomeGood).toBeUndefined()
    expect(result.current.mode).toBe('live')
  })

  test('returns [] on the default empty array (honest empty state)', async () => {
    const { result } = renderHook(() => useExperiments(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.mode).toBe('live'))
    expect(result.current.experiments).toEqual([])
  })
})

describe('useExperiments (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('returns the seed without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useExperiments(), { wrapper: makeHookWrapper() })
    expect(result.current.mode).toBe('mock')
    expect(result.current.experiments.length).toBeGreaterThan(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
