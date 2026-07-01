import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useGoalCreation } from '@/data/me/goalHooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => vi.unstubAllEnvs())

test('useGoalCreation (real) creates+activates the goal (no profile PUT), then onSuccess', async () => {
  const calls: string[] = []
  server.use(
    // The biometric profile PUT must NOT be called during goal creation (G6, mezo-06n):
    // biometrics now live on the Profile and are a precondition, not a wizard payload.
    http.put(`${API_BASE}/api/biometrics/profile`, () => { calls.push('profile'); return HttpResponse.json({ sex: 'M', heightCm: 180, birthDate: '1991-03-01' }) }),
    http.post(`${API_BASE}/api/goals`, () => { calls.push('goal'); return HttpResponse.json({ id: 'g1', title: 'Nyári cut', trajectory: 'cut', guards: ['strength'], status: 'planned', startDate: '2026-06-01', targetDate: '2026-07-27', startWeightKg: 84.2, rateTargetPctPerWeek: 0.7 }) }),
    http.post(`${API_BASE}/api/goals/g1/activate`, () => { calls.push('activate'); return HttpResponse.json({ id: 'g1', status: 'active' }) }),
  )
  const onSuccess = vi.fn()
  const { result } = renderHook(() => useGoalCreation(), { wrapper: makeHookWrapper() })
  act(() => result.current.submit(
    { goal: { title: 'Nyári cut', trajectory: 'cut', guards: ['strength'], startDate: '2026-06-01', targetDate: '2026-07-27', startWeightKg: 84.2 },
      activate: true },
    { onSuccess }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  expect(calls).toEqual(['goal', 'activate'])
})
