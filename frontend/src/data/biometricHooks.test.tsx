import { renderHook, act, waitFor } from '@testing-library/react'
import { useQueryClient } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useBiometricProfile, useBiometricActions } from './biometricHooks'
import { biometricProfile as mockProfile } from './goals'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

test('useBiometricProfile (real mode) returns the profile + isComplete', async () => {
  server.use(
    http.get(`${API_BASE}/api/biometrics/profile`, () =>
      HttpResponse.json({
        sex: 'M',
        heightCm: 182,
        birthDate: '1990-01-01',
        bodyFatPct: 14,
        activityLevel: 'VERY',
        tdeeBootstrap: { bmr: 1800, tdee: 3105, pal: 1.725, formula: 'KATCH', computedAt: '2026-05-01T06:00:00Z' },
      }),
    ),
  )
  const { result } = renderHook(() => useBiometricProfile(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.profile).not.toBeNull())
  expect(result.current.profile?.heightCm).toBe(182)
  expect(result.current.profile?.tdeeBootstrap?.tdee).toBe(3105)
  expect(result.current.isComplete).toBe(true)
})

test('useBiometricProfile (real mode) treats a 404 as no profile (null, not complete, no throw)', async () => {
  server.use(
    http.get(`${API_BASE}/api/biometrics/profile`, () => new HttpResponse(null, { status: 404 })),
  )
  const { result } = renderHook(() => useBiometricProfile(), { wrapper: makeHookWrapper() })
  // The 404 path must NOT throw — the query resolves to null (a normal "not set
  // up" state), so isLoading settles and the profile is null.
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.profile).toBeNull()
  expect(result.current.isComplete).toBe(false)
})

test('useBiometricActions (real mode) upsert PUTs the body + invalidates biometricProfile + goals', async () => {
  let putBody: unknown = null
  server.use(
    http.put(`${API_BASE}/api/biometrics/profile`, async ({ request }) => {
      putBody = await request.json()
      return HttpResponse.json({ ...(putBody as object), tdeeBootstrap: null })
    }),
  )
  const wrapper = makeHookWrapper()
  const { result } = renderHook(() => useBiometricActions(), { wrapper })
  await act(async () => {
    await result.current.upsert({ sex: 'F', heightCm: 168, birthDate: '1992-05-05', activityLevel: 'MODERATE', bodyFatPct: 22 })
  })
  expect(putBody).toEqual({ sex: 'F', heightCm: 168, birthDate: '1992-05-05', activityLevel: 'MODERATE', bodyFatPct: 22 })
})

test('useBiometricActions (real mode) invalidates biometricProfile + goals on success', async () => {
  server.use(
    http.put(`${API_BASE}/api/biometrics/profile`, () =>
      HttpResponse.json({ sex: 'M', heightCm: 180, birthDate: '1991-03-01', tdeeBootstrap: null }),
    ),
  )
  // Spy on the QueryClient the wrapper hands to the hook to assert the exact
  // keys invalidated in onSuccess (the goalHooks invalidation idiom).
  const wrapper = makeHookWrapper()
  const invalidated: unknown[] = []
  const { result } = renderHook(
    () => {
      const qc = useQueryClient()
      vi.spyOn(qc, 'invalidateQueries').mockImplementation((filters?: { queryKey?: unknown }) => {
        invalidated.push(filters?.queryKey)
        return Promise.resolve()
      })
      return useBiometricActions()
    },
    { wrapper },
  )
  await act(async () => {
    await result.current.upsert({ sex: 'M', heightCm: 180, birthDate: '1991-03-01', activityLevel: 'MODERATE' })
  })
  expect(invalidated).toContainEqual(['biometricProfile'])
  expect(invalidated).toContainEqual(['goals'])
})

// --- mock mode ---------------------------------------------------------------

test('useBiometricProfile (mock mode) returns the static complete profile', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useBiometricProfile(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.profile).not.toBeNull())
  expect(result.current.profile).toEqual(mockProfile)
  expect(result.current.isComplete).toBe(true)
})

test('useBiometricActions (mock mode) upsert is a no-op that resolves without hitting the API', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  // No MSW handler is needed in mock mode; resolving cleanly proves it short-circuits.
  const { result } = renderHook(() => useBiometricActions(), { wrapper: makeHookWrapper() })
  await act(async () => {
    await result.current.upsert({ sex: 'M', heightCm: 180, birthDate: '1991-03-01', activityLevel: 'MODERATE' })
  })
  expect(result.current.pending).toBe(false)
})
