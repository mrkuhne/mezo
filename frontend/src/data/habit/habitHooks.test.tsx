import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useHabitDay, useHabitActions, useHabitSummary } from '@/data/habit/habitHooks'
import { API_BASE } from '@/data/_client/api'
import { gamificationProfileMock } from '@/data/gamification/gamificationMock'
import { GAMIFICATION_KEY } from '@/data/gamification/gamificationStore'
import { mockHabitDay } from '@/data/habit/habitMock'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'
import type { GamificationProfile } from '@/data/gamification/gamificationTypes'
import type { ReactNode } from 'react'

const DATE = '2026-07-19'

describe('useHabitDay (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('serves the seed synchronously', () => {
    const { result } = renderHook(() => useHabitDay(DATE), { wrapper: makeHookWrapper() })
    // 8 MORNING + 5 EVENING — bed_on_time is deliberately absent from the mock (mezo-o5hx)
    expect(result.current.habits).toHaveLength(13)
    expect(result.current.habits.filter((h) => h.chain === 'MORNING')).toHaveLength(8)
  })

  test('manual check flips the row and stays in cache', async () => {
    const wrapper = makeHookWrapper()
    const day = renderHook(() => useHabitDay(DATE), { wrapper })
    const actions = renderHook(() => useHabitActions(DATE), { wrapper })
    await act(() => actions.result.current.check('morning_sunlight'))
    await waitFor(() =>
      expect(day.result.current.habits.find((h) => h.key === 'morning_sunlight')?.status).toBe('done'))
  })

  test('a pipa a sor erő-értékét is emeli — a csík valódi változást animál', async () => {
    const wrapper = makeHookWrapper()
    const day = renderHook(() => useHabitDay(DATE), { wrapper })
    const actions = renderHook(() => useHabitActions(DATE), { wrapper })
    const pct = (k: string) => day.result.current.habits.find((h) => h.key === k)?.strengthPct

    // morning_pushups: seed 48%, a summary 18 done + 6 missed = 24 lezárt nap
    // round((48 * 24 / 100 + 1) * 100 / 25) = 50
    expect(pct('morning_pushups')).toBe(48)
    await act(() => actions.result.current.check('morning_pushups'))
    await waitFor(() => expect(pct('morning_pushups')).toBe(50))

    // a visszavonás a seed-értékre állít vissza — a pipa/visszavonás kör nem inflálja az erőt
    await act(() => actions.result.current.uncheck('morning_pushups'))
    await waitFor(() => expect(pct('morning_pushups')).toBe(48))
  })

  test('erő nélküli sor erő nélkül marad (minSample alatt a szerver is null-t ad)', async () => {
    const wrapper = makeHookWrapper()
    const day = renderHook(() => useHabitDay(DATE), { wrapper })
    const actions = renderHook(() => useHabitActions(DATE), { wrapper })
    await act(() => actions.result.current.check('evening_ritual'))
    await waitFor(() =>
      expect(day.result.current.habits.find((h) => h.key === 'evening_ritual')?.status).toBe('done'))
    expect(day.result.current.habits.find((h) => h.key === 'evening_ritual')?.strengthPct).toBeNull()
  })
})

describe('useHabitDay (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('returns the empty day while loading — never the seed', () => {
    const { result } = renderHook(() => useHabitDay(DATE), { wrapper: makeHookWrapper() })
    expect(result.current.habits).toHaveLength(0)
  })

  test('maps the wire day', async () => {
    server.use(http.get(`${API_BASE}/api/habit/day/${DATE}`, () =>
      HttpResponse.json({
        date: DATE,
        habits: [{ key: 'wake_on_time', chain: 'MORNING', position: 1, title: 'Ébredés időben',
          why: 'w', anchorCopy: 'a lánc kezdete', mode: 'DERIVED', status: 'done',
          doneAt: '2026-07-19T04:20:00Z', xp: 10, strengthPct: 82 }],
        levelUps: [],
      })))
    const { result } = renderHook(() => useHabitDay(DATE), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.habits).toHaveLength(1))
    expect(result.current.habits[0].strengthPct).toBe(82)
  })
})

describe('useHabitSummary (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('honest-empty default from MSW', async () => {
    const { result } = renderHook(() => useHabitSummary(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.data.habits).toHaveLength(0)
  })
})

/**
 * What a DUPLICATED habit control costs (mezo-mvb4.1). Today's Este face briefly offered the
 * `wind_down` habit twice — the `WindDownBanner`'s own row and a `TodoCard` row — from two
 * `useHabitActions` instances whose `pending` flags are independent, so tapping one left the
 * other live and a second `check()` could fire. The review could not establish whether that
 * double-awards XP; it does, in mock mode, and these two tests are the proof:
 * the mock arm calls `awardGamificationEvent({ type: 'HABIT', xpOverride })` UNCONDITIONALLY,
 * without asking whether the row is already `done`, and one habit is nowhere near the HABIT
 * daily cap of 10 (`xpValues.ts`). In REAL mode it cannot happen — `HabitService.check` rejects
 * an already-done row with a `HABIT_ALREADY_DONE` conflict
 * (`backend/.../feature/habit/service/HabitService.java:91`), so the second POST awards nothing.
 * The `pending` withdrawal is therefore the ONLY mock-mode guard, and it only guards the control
 * it belongs to — which is why a habit must never be offered by two controls at once.
 */
describe('check() is not idempotent in mock mode — a second tap awards the XP again', () => {
  let qc: QueryClient
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const totalXp = () =>
    (qc.getQueryData<GamificationProfile>(GAMIFICATION_KEY) ?? gamificationProfileMock).totalXp
  const WIND_DOWN_XP = mockHabitDay.find((h) => h.key === 'wind_down')!.xp

  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })
  afterEach(() => vi.unstubAllEnvs())

  test('one check awards the habit XP once', async () => {
    const before = totalXp()
    const { result } = renderHook(() => useHabitActions(DATE), { wrapper })
    await act(() => result.current.check('wind_down'))
    expect(totalXp()).toBe(before + WIND_DOWN_XP)
  })

  test('a second check on the same, already-done habit awards it AGAIN', async () => {
    const before = totalXp()
    const { result } = renderHook(() => useHabitActions(DATE), { wrapper })
    await act(() => result.current.check('wind_down'))
    await act(() => result.current.check('wind_down'))
    expect(totalXp()).toBe(before + WIND_DOWN_XP * 2)
  })
})
