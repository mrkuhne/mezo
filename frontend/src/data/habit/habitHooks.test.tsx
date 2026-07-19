import { renderHook, waitFor, act } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useHabitDay, useHabitActions, useHabitSummary } from '@/data/habit/habitHooks'
import { API_BASE } from '@/data/_client/api'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

const DATE = '2026-07-19'

describe('useHabitDay (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('serves the seed synchronously', () => {
    const { result } = renderHook(() => useHabitDay(DATE), { wrapper: makeHookWrapper() })
    expect(result.current.habits).toHaveLength(10)
    expect(result.current.habits.filter((h) => h.chain === 'MORNING')).toHaveLength(6)
  })

  test('manual check flips the row and stays in cache', async () => {
    const wrapper = makeHookWrapper()
    const day = renderHook(() => useHabitDay(DATE), { wrapper })
    const actions = renderHook(() => useHabitActions(DATE), { wrapper })
    await act(() => actions.result.current.check('morning_sunlight'))
    await waitFor(() =>
      expect(day.result.current.habits.find((h) => h.key === 'morning_sunlight')?.status).toBe('done'))
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
