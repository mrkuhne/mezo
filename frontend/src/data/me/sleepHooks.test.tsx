import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { useSleep } from '@/data/hooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

test('useSleep (real mode) loads the sleep log from the API and exposes lastNight', async () => {
  const { result } = renderHook(() => useSleep(), { wrapper: makeHookWrapper() })
  // Default MSW fixture (mezo-fk9a) now carries 3 nights so the average card's 3-night
  // gate can be exercised — lastNight is the most recent (2026-06-01, the hypnogram row).
  await waitFor(() => expect(result.current.sleepLog.length).toBe(3))
  expect(result.current.lastNight).toMatchObject({ date: '2026-06-01', duration: 7.5, quality: 9 })
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

test('useSleep.logSleep invalidates ["habitDay"] and the day quest read (derived habit + quest re-derive)', async () => {
  // The wake_on_time habit + sleep_target quest are re-derived server-side on the next
  // habitDay / dailyQuests read — a sleep log must nudge both, or the ✓ never appears.
  const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
  server.use(
    http.post(`${API_BASE}/api/biometrics/sleep`, async ({ request }) => {
      const body = (await request.json()) as { date: string; bedtime: string; wakeup: string; durationH: number; quality: number; awakenings: number }
      return HttpResponse.json(
        { id: 's2', date: body.date, bedtime: body.bedtime, wakeup: body.wakeup, duration: body.durationH, quality: body.quality, awakenings: body.awakenings, mealToSleep: 0, notes: null },
        { status: 201 },
      )
    }),
    http.get(`${API_BASE}/api/biometrics/sleep`, () =>
      HttpResponse.json([{ id: 's1', date: '2026-06-01', bedtime: '23:10', wakeup: '06:40', duration: 7.5, quality: 8, awakenings: 1, mealToSleep: 0, notes: null }])),
  )

  const { result } = renderHook(() => useSleep(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.sleepLog.length).toBe(1))

  act(() => {
    result.current.logSleep({ date: '2026-06-02', bedtime: '22:30', wakeup: '06:30', durationH: 8.0, quality: 9, awakenings: 0 })
  })

  await waitFor(() => {
    const keys = invalidateSpy.mock.calls.map(c => JSON.stringify((c[0] as { queryKey?: unknown })?.queryKey))
    expect(keys).toContain(JSON.stringify(['habitDay']))
    expect(keys).toContain(JSON.stringify(['dailyQuests', '2026-06-02']))
  })
})

describe('useSleep (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  // Whole-branch review FIX 1 (mezo-fk9a): the mock mutationFn used to rebuild the SleepEntry
  // field by field and drop `hypnogram` — a screenshot night saved in mock mode became
  // `lastNight` with no hypnogram, so "Az éjszaka íve" vanished the instant it was saved.
  it('logSleep carries the hypnogram through into the stored entry', async () => {
    const { result } = renderHook(() => useSleep(), { wrapper: makeHookWrapper() })
    const before = result.current.sleepLog.length
    const hypnogram = { bucketMin: 15, stages: 'AADDDLLLRRRAAAA' }

    act(() => {
      result.current.logSleep({
        date: '2026-07-31', bedtime: '23:00', wakeup: '06:30', durationH: 7.5,
        quality: 8, awakenings: 0, source: 'screenshot', hypnogram,
      })
    })

    await waitFor(() => expect(result.current.sleepLog.length).toBe(before + 1))
    expect(result.current.lastNight?.date).toBe('2026-07-31')
    expect(result.current.lastNight?.hypnogram).toEqual(hypnogram)
  })
})
