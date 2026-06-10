import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useSleep } from './hooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

test('useSleep (real mode) loads the sleep log from the API and exposes lastNight', async () => {
  const { result } = renderHook(() => useSleep(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.sleepLog.length).toBe(1))
  expect(result.current.lastNight).toMatchObject({ date: '2026-06-01', duration: 7.5, quality: 8 })
})

test('useSleep.logSleep POSTs (mapping durationH) and the new entry appears after invalidation', async () => {
  let posted = false
  server.use(
    http.post(`${API_BASE}/api/biometrics/sleep`, async ({ request }) => {
      posted = true
      const body = (await request.json()) as {
        date: string; bedtime: string; wakeup: string; durationH: number
        quality: number; awakenings: number; note?: string | null
      }
      // The hook must map durationH → the POST body field 'durationH'.
      expect(body.durationH).toBe(8.0)
      return HttpResponse.json(
        {
          id: 's2', date: body.date, bedtime: body.bedtime, wakeup: body.wakeup,
          duration: body.durationH, quality: body.quality, awakenings: body.awakenings,
          mealToSleep: 0, notes: body.note ?? null,
        },
        { status: 201 },
      )
    }),
    http.get(`${API_BASE}/api/biometrics/sleep`, () =>
      HttpResponse.json(
        posted
          ? [
              { id: 's1', date: '2026-06-01', bedtime: '23:10', wakeup: '06:40', duration: 7.5, quality: 8, awakenings: 1, mealToSleep: 0, notes: null },
              { id: 's2', date: '2026-06-02', bedtime: '22:30', wakeup: '06:30', duration: 8.0, quality: 9, awakenings: 0, mealToSleep: 0, notes: null },
            ]
          : [{ id: 's1', date: '2026-06-01', bedtime: '23:10', wakeup: '06:40', duration: 7.5, quality: 8, awakenings: 1, mealToSleep: 0, notes: null }],
      ),
    ),
  )

  const { result } = renderHook(() => useSleep(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.sleepLog.length).toBe(1))

  act(() => {
    result.current.logSleep({
      date: '2026-06-02', bedtime: '22:30', wakeup: '06:30',
      durationH: 8.0, quality: 9, awakenings: 0,
    })
  })

  await waitFor(() => expect(posted).toBe(true))
  await waitFor(() => expect(result.current.sleepLog.length).toBe(2))
  expect(result.current.lastNight).toMatchObject({ date: '2026-06-02', duration: 8.0, quality: 9 })
})
