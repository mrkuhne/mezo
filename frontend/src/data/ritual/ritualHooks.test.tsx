import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useRitualDay, useRitualActions } from '@/data/ritual/ritualHooks'
import { useHabitDay } from '@/data/habit/habitHooks'
import { API_BASE } from '@/data/_client/api'
import { awardGamificationEvent } from '@/data/gamification/gamificationStore'
import type { RitualDay } from '@/data/types'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

/** Deep-equality match for a spied invalidateQueries call's queryKey argument. */
const keyEquals = (a: unknown, b: unknown[]) => JSON.stringify(a) === JSON.stringify(b)

// awardGamificationEvent is a side effect of a mock close — spy on it (vi.mock is
// hoisted; the top-level import above resolves to the mocked fn).
vi.mock('@/data/gamification/gamificationStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/gamification/gamificationStore')>()
  return { ...actual, awardGamificationEvent: vi.fn() }
})
const awardMock = vi.mocked(awardGamificationEvent)

const DATE = '2026-07-20'

/** Wrapper backed by a client whose ['ritualDay', DATE] cache is pre-seeded to `day`. */
function seededWrapper(day: RitualDay) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['ritualDay', DATE], day)
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

const dayWith = (closed: boolean): RitualDay => ({
  date: DATE,
  closed,
  closedAt: closed ? '2026-07-20T20:30:00Z' : null,
  window: { opensAt: '21:15', prepStartsAt: '21:45', bedTime: '22:30' },
})

describe('useRitualDay (mock mode)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    awardMock.mockClear()
  })
  afterEach(() => vi.unstubAllEnvs())

  test('serves the seed synchronously (open window, not closed)', () => {
    const { result } = renderHook(() => useRitualDay(DATE), { wrapper: makeHookWrapper() })
    expect(result.current.data.closed).toBe(false)
    expect(result.current.data.window.opensAt).toBe('21:15')
  })

  test('close patches the cache to closed + awards HABIT xp exactly once', async () => {
    const wrapper = seededWrapper(dayWith(false))
    const day = renderHook(() => useRitualDay(DATE), { wrapper })
    const actions = renderHook(() => useRitualActions(DATE), { wrapper })

    await act(() => actions.result.current.close())
    await waitFor(() => expect(day.result.current.data.closed).toBe(true))
    expect(awardMock).toHaveBeenCalledTimes(1)
    expect(awardMock).toHaveBeenCalledWith(expect.anything(), { type: 'HABIT', xpOverride: 10 })

    // Idempotent: closing an already-closed day does NOT award a second time.
    await act(() => actions.result.current.close())
    expect(awardMock).toHaveBeenCalledTimes(1)
  })
})

describe('useRitualDay (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('honest-empty while unresolved — never the seed', () => {
    const { result } = renderHook(() => useRitualDay(DATE), { wrapper: makeHookWrapper() })
    expect(result.current.data.closed).toBe(false)
    expect(result.current.data.window.opensAt).not.toBe('21:15') // the mock seed's opensAt
  })

  test('maps the wire day', async () => {
    server.use(http.get(`${API_BASE}/api/ritual/day/${DATE}`, () =>
      HttpResponse.json({
        date: DATE,
        closed: false,
        closedAt: null,
        window: { opensAt: '21:15', prepStartsAt: '21:45', bedTime: '22:30' },
      })))
    const { result } = renderHook(() => useRitualDay(DATE), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.data.window.opensAt).toBe('21:15'))
    expect(result.current.data.closed).toBe(false)
  })

  test('close POSTs and invalidates all 6 ritual-adjacent keys', async () => {
    server.use(http.post(`${API_BASE}/api/ritual/close`, () =>
      HttpResponse.json({
        date: DATE,
        closed: true,
        closedAt: '2026-07-25T20:24:00Z',
        window: { opensAt: '21:15', prepStartsAt: '21:45', bedTime: '22:30' },
      })))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const actions = renderHook(() => useRitualActions(DATE), { wrapper })

    const result = await act(() => actions.result.current.close())
    expect(result.closed).toBe(true)

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey)
    for (const key of [
      ['ritualDay', DATE],
      ['habitDay', DATE],
      ['dailyQuests', DATE],
      ['gamificationDay', DATE],
      ['gamification'],
      ['progressionProfile'],
    ]) {
      expect(invalidatedKeys).toContainEqual(key)
    }
  })

  // mezo-ywz1: the derived evening_ritual completion (+10 XP + level_up_event) is persisted
  // ONLY by the GET /api/habit/day the habitDay invalidation triggers. If the harvest-critical
  // keys (gamificationDay/gamification/progressionProfile) are invalidated concurrently with —
  // rather than strictly after — that refetch settling, the harvest re-read can race the award
  // and under-report. This test gates the habitDay refetch behind a controllable promise and
  // asserts the harvest-critical invalidation is NOT issued until that refetch resolves.
  test('close awaits the habitDay refetch to settle BEFORE invalidating the harvest-critical keys', async () => {
    server.use(http.post(`${API_BASE}/api/ritual/close`, () =>
      HttpResponse.json({
        date: DATE, closed: true, closedAt: '2026-07-25T20:24:00Z',
        window: { opensAt: '21:15', prepStartsAt: '21:45', bedTime: '22:30' },
      })))
    // Unblocked handler for the INITIAL habitDay mount (mirrors RitualPage mounting useHabitDay
    // as an observer) — this must settle before we install the gated handler below, otherwise
    // the mount's own in-flight fetch (not the invalidation's refetch) could be what we gate.
    server.use(http.get(`${API_BASE}/api/habit/day/${DATE}`, () =>
      HttpResponse.json({ date: DATE, habits: [], levelUps: [] })))

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )

    // Gives ['habitDay', DATE] an active observer — exactly what RitualPage's new
    // useHabitDay(date) mount provides — so close()'s invalidateQueries(['habitDay', DATE])
    // actually triggers (and can be awaited on) a refetch instead of a no-op mark-stale.
    const habitDayHook = renderHook(() => useHabitDay(DATE), { wrapper })
    await waitFor(() => expect(client.getQueryState(['habitDay', DATE])?.status).toBe('success'))

    const actions = renderHook(() => useRitualActions(DATE), { wrapper })
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    // NOW gate the habitDay GET behind a controllable promise — this is the refetch the
    // close()-triggered invalidation depends on.
    let resolveHabitDay: () => void = () => {}
    const habitDayGate = new Promise<void>((resolve) => { resolveHabitDay = resolve })
    server.use(http.get(`${API_BASE}/api/habit/day/${DATE}`, async () => {
      await habitDayGate
      return HttpResponse.json({ date: DATE, habits: [], levelUps: [] })
    }))

    const closePromise = actions.result.current.close()

    // Wait until the habitDay invalidation has been ISSUED (i.e. the close() POST resolved
    // and the code reached the habitDay invalidate line) — but its gated refetch is still
    // in flight.
    await waitFor(() => {
      expect(invalidateSpy.mock.calls.some((c) => keyEquals(c[0]?.queryKey, ['habitDay', DATE]))).toBe(true)
    })
    // The harvest-critical keys must NOT be invalidated yet — proves the awaited-sequence
    // ordering, not just eventual-consistency ordering of unawaited fire-and-forget calls.
    expect(invalidateSpy.mock.calls.some((c) => keyEquals(c[0]?.queryKey, ['gamificationDay', DATE]))).toBe(false)
    expect(invalidateSpy.mock.calls.some((c) => keyEquals(c[0]?.queryKey, ['gamification']))).toBe(false)
    expect(invalidateSpy.mock.calls.some((c) => keyEquals(c[0]?.queryKey, ['progressionProfile']))).toBe(false)

    resolveHabitDay()
    const result = await closePromise
    expect(result.closed).toBe(true)

    const keysInOrder = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey)
    const habitDayIdx = keysInOrder.findIndex((k) => keyEquals(k, ['habitDay', DATE]))
    const gamificationDayIdx = keysInOrder.findIndex((k) => keyEquals(k, ['gamificationDay', DATE]))
    expect(habitDayIdx).toBeGreaterThanOrEqual(0)
    expect(gamificationDayIdx).toBeGreaterThan(habitDayIdx)

    habitDayHook.unmount()
  })
})
