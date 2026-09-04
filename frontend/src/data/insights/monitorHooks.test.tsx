import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { usePatternMonitor } from '@/data/insights/monitorHooks'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

const wire = {
  windowFrom: '2026-06-13',
  windowTo: '2026-08-10',
  lookbackDays: 60,
  minN: 8,
  cron: '0 40 2 * * *',
  lastRunAt: '2026-08-11T00:40:00Z',
  pairs: [
    {
      key: 'checkin-stress~sleep-quality',
      title: 'Stressz-szint ↔ aznapi alvásminőség',
      category: 'trigger',
      categoryLabel: 'Trigger',
      lagDays: 0,
      metricAKey: 'checkin-stress',
      metricALabel: 'stressz-szint',
      metricBKey: 'sleep-quality',
      metricBLabel: 'alvásminőség',
      verdict: 'few_days',
      alignedDays: 5,
      missingDays: 3,
      bottleneckMetricKey: 'checkin-stress',
    },
  ],
  metrics: [
    { key: 'checkin-stress', label: 'stressz-szint', coveredDays: 5, windowDays: 60, pairCount: 1 },
  ],
}

describe('usePatternMonitor (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('normalizes absent optional wire fields to null', async () => {
    server.use(http.get(`${API_BASE}/api/companion/pattern/monitor`, () => HttpResponse.json(wire)))
    const { result } = renderHook(() => usePatternMonitor(), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.monitor).not.toBeNull())
    const pair = result.current.monitor!.pairs[0]
    expect(pair.verdict).toBe('few_days')
    expect(pair.missingDays).toBe(3)
    expect(pair.r).toBeNull()
    expect(pair.status).toBeNull()
    expect(result.current.monitor!.metrics[0].lastDayWithData).toBeNull()
    expect(result.current.degraded).toBe(false)
    expect(result.current.mode).toBe('live')
  })

  test('flags degraded on a 404 (companion switch off)', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/pattern/monitor`, () => new HttpResponse(null, { status: 404 })),
    )
    const { result } = renderHook(() => usePatternMonitor(), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.degraded).toBe(true))
    expect(result.current.monitor).toBeNull()
  })
})

describe('usePatternMonitor (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('returns the mixed-verdict seed synchronously', () => {
    const { result } = renderHook(() => usePatternMonitor(), { wrapper: makeHookWrapper() })

    expect(result.current.mode).toBe('mock')
    expect(result.current.monitor!.pairs).toHaveLength(9)
    const verdicts = new Set(result.current.monitor!.pairs.map((p) => p.verdict))
    expect(verdicts).toEqual(new Set(['live', 'few_days', 'no_data', 'degenerate', 'imbalanced_groups']))
    expect(result.current.monitor!.metrics).toHaveLength(13)
  })
})
