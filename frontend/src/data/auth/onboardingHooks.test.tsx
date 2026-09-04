import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'
import { API_BASE, setToken } from '@/data/_client/api'
import { useOnboardingActions } from '@/data/auth/onboardingHooks'
import { localDateString } from '@/shared/lib/dates'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function captureCalls() {
  const calls: { url: string; body: unknown }[] = []
  server.use(
    http.put(`${API_BASE}/api/biometrics/profile`, async ({ request }) => {
      calls.push({ url: 'profile', body: await request.json() })
      return HttpResponse.json({ sex: 'F', heightCm: 168, birthDate: '1994-02-11', activityLevel: 'MIXED', tdeeBootstrap: null })
    }),
    http.post(`${API_BASE}/api/biometrics/weight`, async ({ request }) => {
      calls.push({ url: 'weight', body: await request.json() })
      return HttpResponse.json({ id: 'w9', date: localDateString(), value: 61.5, note: null }, { status: 201 })
    }),
    http.post(`${API_BASE}/api/auth/onboarding-complete`, () => {
      calls.push({ url: 'complete', body: null })
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

test('real mode: complete() runs profile → weight → onboarding-complete in that order with the contract bodies', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  const calls = captureCalls()
  const { result } = renderHook(() => useOnboardingActions(), { wrapper: makeHookWrapper() })
  await act(() => result.current.complete({ sex: 'F', heightCm: 168, birthDate: '1994-02-11', weightKg: 61.5 }))
  expect(calls.map((c) => c.url)).toEqual(['profile', 'weight', 'complete'])
  expect(calls[0].body).toEqual({ sex: 'F', heightCm: 168, birthDate: '1994-02-11', activityLevel: 'MIXED' })
  expect(calls[1].body).toEqual({ date: localDateString(), weightKg: 61.5 })
  await waitFor(() => expect(result.current.pending).toBe(false))
})

test('real mode: a failing profile PUT rejects before the weight is logged', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  const calls = captureCalls()
  server.use(http.put(`${API_BASE}/api/biometrics/profile`, () =>
    HttpResponse.json([{ code: 'VALIDATION_INVALID_VALUE', message: 'x', fieldName: 'heightCm' }], { status: 400 })))
  const { result } = renderHook(() => useOnboardingActions(), { wrapper: makeHookWrapper() })
  await expect(result.current.complete({ sex: 'M', heightCm: 10, birthDate: '1994-02-11', weightKg: 61.5 })).rejects.toBeDefined()
  expect(calls).toEqual([])
})

test('mock mode: complete() resolves without touching the network', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const calls = captureCalls()
  const { result } = renderHook(() => useOnboardingActions(), { wrapper: makeHookWrapper() })
  await act(() => result.current.complete({ sex: 'M', heightCm: 181, birthDate: '1993-05-14', weightKg: 84.5 }))
  expect(calls).toEqual([])
})
