import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { useCheckins } from '@/data/hooks'
import { buildDaySlots } from '@/data/today/checkinHooks'
import type { CheckInResponse } from '@/data/me/biometricsApi'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'

afterEach(() => {
  vi.unstubAllEnvs()
})

test('buildDaySlots derives wall-clock states for empty slots', () => {
  const at = (h: number, m: number) => new Date(2026, 6, 4, h, m)
  expect(buildDaySlots([], at(14, 30)).map(s => s.state)).toEqual(['skipped', 'skipped', 'now', 'pending'])
  expect(buildDaySlots([], at(5, 0)).map(s => s.state)).toEqual(['pending', 'pending', 'pending', 'pending'])
  expect(buildDaySlots([], at(21, 0)).map(s => s.state)).toEqual(['skipped', 'skipped', 'skipped', 'now'])
})

test('buildDaySlots overlays server rows onto the canonical slots', () => {
  const rows: CheckInResponse[] = [
    {
      id: 'c1', date: '2026-07-04', slotTime: '06:30', state: 'done',
      energy: 7, stress: 3, body: 6, mental: 7, note: 'reggel', savedAt: '2026-07-04T06:31:00Z',
    },
  ]
  const slots = buildDaySlots(rows, new Date(2026, 6, 4, 9, 0))
  expect(slots[0]).toMatchObject({ time: '06:30', state: 'done', note: 'reggel' })
  expect(slots[0].values).toEqual({ energy: 7, stress: 3, body: 6, mental: 7 })
  expect(slots[1].state).toBe('pending')
})

test('useCheckins (real mode) hydrates the strip from the day read', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/biometrics/checkin`, () =>
      HttpResponse.json([
        {
          id: 'c1', date: '2026-07-04', slotTime: '06:30', state: 'done',
          energy: 8, stress: 2, body: 7, mental: 8, note: null, savedAt: '2026-07-04T06:31:00Z',
        },
      ]),
    ),
  )
  const { result } = renderHook(() => useCheckins(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.checkins[0].state).toBe('done'))
  expect(result.current.checkins[0].values?.energy).toBe(8)
})

test('useCheckins (real mode) updates the slot locally AND POSTs exactly once with the slot body', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')

  let postCount = 0
  let lastBody: Record<string, unknown> | null = null
  server.use(
    http.post(`${API_BASE}/api/biometrics/checkin`, async ({ request }) => {
      postCount += 1
      lastBody = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({ id: 'c1', ...lastBody, savedAt: '2026-06-01T09:00:00Z' }, { status: 200 })
    }),
  )

  const { result } = renderHook(() => useCheckins(), { wrapper: makeHookWrapper() })

  // Slot 2 is the '14:00' "now" slot in initialCheckins.
  act(() => {
    result.current.saveCheckIn(2, {
      state: 'done',
      values: { energy: 8, stress: 3, body: 7, mental: 8 },
      note: 'délutáni',
    })
  })

  // Local optimistic update is synchronous.
  expect(result.current.checkins[2].state).toBe('done')
  expect(result.current.checkins[2].values?.energy).toBe(8)

  await waitFor(() => expect(postCount).toBe(1))
  expect(lastBody).not.toBeNull()
  expect(lastBody).toMatchObject({
    slotTime: '14:00',
    state: 'done',
    energy: 8, stress: 3, body: 7, mental: 8,
    note: 'délutáni',
  })
  expect(typeof lastBody!.date).toBe('string')
})

test('useCheckins (real mode) save invalidates the day quest read (read-triggered evaluation)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.post(`${API_BASE}/api/biometrics/checkin`, () =>
      HttpResponse.json({ id: 'c1', savedAt: '2026-06-01T09:00:00Z' }, { status: 200 })),
  )
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const spy = vi.spyOn(qc, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useCheckins(), { wrapper })

  act(() => {
    result.current.saveCheckIn(2, { state: 'done', values: { energy: 8, stress: 3, body: 7, mental: 8 }, note: null })
  })

  await waitFor(() => {
    const keys = spy.mock.calls.map(c => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
    expect(keys.some(k => k.includes('checkins'))).toBe(true)
    expect(keys.some(k => k.includes('dailyQuests'))).toBe(true)
  })
})

test('useCheckins (mock mode) updates the slot locally and never fetches', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  let postCount = 0
  server.use(
    http.post(`${API_BASE}/api/biometrics/checkin`, () => {
      postCount += 1
      return HttpResponse.json({ id: 'c1', savedAt: '2026-06-01T09:00:00Z' }, { status: 200 })
    }),
  )

  const { result } = renderHook(() => useCheckins(), { wrapper: makeHookWrapper() })

  act(() => {
    result.current.saveCheckIn(2, { state: 'done', values: { energy: 6, stress: 4, body: 5, mental: 6 }, note: null })
  })

  expect(result.current.checkins[2].state).toBe('done')
  expect(result.current.checkins[2].values?.energy).toBe(6)

  // Give any stray async POST a chance to fire, then assert none did.
  await new Promise(r => setTimeout(r, 20))
  expect(postCount).toBe(0)
})
