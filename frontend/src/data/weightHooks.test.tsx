import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useWeight } from './weightHooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

test('useWeight (real mode) loads the weight log from the API', async () => {
  const { result } = renderHook(() => useWeight(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.weightLog.length).toBe(1))
  expect(result.current.weightLog[0]).toMatchObject({ date: '2026-06-01', value: 82.5 })
})

test('useWeight (real mode) returns a zero trend (NOT the mock seed) before the trend query resolves', () => {
  // "no static fallback in real mode": the goal hero "Tempó" must not flash the fake
  // mock pace (−0.5 kg/hét, 78.96 kg avg) before the backend EWMA trend lands.
  server.use(http.get(`${API_BASE}/api/biometrics/weight/trend`, () => new Promise(() => {}))) // never resolves
  const { result } = renderHook(() => useWeight(), { wrapper: makeHookWrapper() })
  expect(result.current.weightTrends.last7d.avg).toBe(0)
  expect(result.current.weightTrends.last7d.weeklyRate).toBe(0)
  expect(result.current.weightTrends.last4w.weeklyRate).toBe(0)
})

test('useWeight (real mode) folds the backend EWMA trend into weightTrends', async () => {
  server.use(
    http.get(`${API_BASE}/api/biometrics/weight/trend`, () =>
      HttpResponse.json({
        ewmaSeries: [{ date: '2026-06-01', trendKg: 82.5 }],
        latestTrendKg: 82.5,
        weeklyRateKgPerWeek: -0.42,
        weeklyRatePctPerWeek: -0.51,
        last4wRateKgPerWeek: -0.63,
        dataSufficiency: 'full',
      }),
    ),
  )
  const { result } = renderHook(() => useWeight(), { wrapper: makeHookWrapper() })
  // The real EWMA weekly rates land in the WeightTrends shape the views read.
  await waitFor(() => expect(result.current.weightTrends.last7d.weeklyRate).toBe(-0.42))
  expect(result.current.weightTrends.last4w.weeklyRate).toBe(-0.63)
  // The hero number (last7d.avg) tracks the latest EWMA trend.
  expect(result.current.weightTrends.last7d.avg).toBe(82.5)
})

test('useWeight.logWeight POSTs and the new entry appears after invalidation', async () => {
  let posted = false
  // After the POST fires, the GET must return the appended list (server-side truth).
  server.use(
    http.post(`${API_BASE}/api/biometrics/weight`, async ({ request }) => {
      posted = true
      const body = (await request.json()) as { date: string; weightKg: number; note?: string | null }
      return HttpResponse.json({ id: 'w2', date: body.date, value: body.weightKg, note: body.note ?? null }, { status: 201 })
    }),
    http.get(`${API_BASE}/api/biometrics/weight`, () =>
      HttpResponse.json(
        posted
          ? [
              { id: 'w1', date: '2026-06-01', value: 82.5, note: null },
              { id: 'w2', date: '2026-06-02', value: 81.9, note: null },
            ]
          : [{ id: 'w1', date: '2026-06-01', value: 82.5, note: null }],
      ),
    ),
  )

  const { result } = renderHook(() => useWeight(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.weightLog.length).toBe(1))

  act(() => {
    result.current.logWeight({ date: '2026-06-02', weightKg: 81.9 })
  })

  await waitFor(() => expect(posted).toBe(true))
  await waitFor(() => expect(result.current.weightLog.length).toBe(2))
  expect(result.current.weightLog[1]).toMatchObject({ date: '2026-06-02', value: 81.9 })
})
