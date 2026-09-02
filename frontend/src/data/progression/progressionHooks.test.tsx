import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { useAchievements, useGrowthWeek, useProgressionProfile } from '@/data/hooks'
import { makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

afterEach(() => vi.unstubAllEnvs())

test('mock mode seeds the profile fixture synchronously', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useProgressionProfile(), { wrapper: makeHookWrapper() })
  expect(result.current.data.athleteLevel).toBe(4.3)
  expect(result.current.data.radarAxes).toHaveLength(6)
})

test('real mode fetches the profile from /api/progression/profile', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/progression/profile`, () =>
    HttpResponse.json({
      athleteLevel: 2.1, streakWeeks: 1,
      athletic: [], muscle: [],
      radarAxes: [{ axis: 'Erő', value: 2.0 }],
      highlights: {},
    })))
  const { result } = renderHook(() => useProgressionProfile(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.data.athleteLevel).toBe(2.1))
})

test('real mode shows the ghost profile (athleteLevel null) on a 404 (switch off)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/progression/profile`, () => new HttpResponse(null, { status: 404 })))
  const { result } = renderHook(() => useProgressionProfile(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.isPending).toBe(false))
  expect(result.current.data.athleteLevel).toBeNull()
})

test('mock mode seeds the 9-badge achievements fixture synchronously', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useAchievements(), { wrapper: makeHookWrapper() })
  expect(result.current.data.badges).toHaveLength(9)
  expect(result.current.data.badges.filter((b) => b.achieved)).toHaveLength(4)
  expect(result.current.data.perks).toHaveLength(3)
})

test('real mode fetches achievements from /api/progression/achievements', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const { result } = renderHook(() => useAchievements(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.data.badges).toHaveLength(1))
  expect(result.current.data.badges[0].key).toBe('first_quest')
  expect(result.current.data.perks).toEqual([])
})

test('useGrowthWeek: mock mode seeds the fixture synchronously', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useGrowthWeek('2026-08-31'), { wrapper: makeHookWrapper() })
  expect(result.current.data?.questCompleted).toBe(6)
  expect(result.current.data?.savingsHuf).toBe(12000)
})

test('useGrowthWeek: real mode fetches /api/progression/growth-week/{date}', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/progression/growth-week/:date`, ({ params }) =>
    HttpResponse.json({ weekStart: params.date, questCompleted: 2, questClosed: 3, lifeXp: 40, activities: 1, savingsHuf: 0 })))
  const { result } = renderHook(() => useGrowthWeek('2026-08-31'), { wrapper: makeHookWrapper() })
  expect(result.current.data).toBeNull() // honest null while unresolved, never the seed
  await waitFor(() => expect(result.current.data?.questCompleted).toBe(2))
  expect(result.current.data?.weekStart).toBe('2026-08-31')
})

test('useGrowthWeek: real mode 404 resolves to null (no retry storm)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/progression/growth-week/:date`, () => new HttpResponse(null, { status: 404 })))
  const { result } = renderHook(() => useGrowthWeek('2026-08-31'), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.isPending).toBe(false))
  expect(result.current.data).toBeNull()
})
