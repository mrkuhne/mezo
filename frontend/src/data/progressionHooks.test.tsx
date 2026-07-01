import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { useProgressionProfile } from '@/data/hooks'
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
