import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useGoalCreation } from './goalHooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => vi.unstubAllEnvs())

test('useGoalCreation (real) upserts profile, creates+activates the goal, then onSuccess', async () => {
  const calls: string[] = []
  server.use(
    http.put(`${API_BASE}/api/biometrics/profile`, () => { calls.push('profile'); return HttpResponse.json({ sex: 'M', heightCm: 180, birthDate: '1991-03-01' }) }),
    http.post(`${API_BASE}/api/goals`, () => { calls.push('goal'); return HttpResponse.json({ id: 'g1', title: 'Nyári cut', trajectory: 'cut', guards: ['strength'], status: 'planned', startDate: '2026-06-01', targetDate: '2026-07-27', startWeightKg: 84.2, rateTargetPctPerWeek: 0.7 }) }),
    http.post(`${API_BASE}/api/goals/g1/activate`, () => { calls.push('activate'); return HttpResponse.json({ id: 'g1', status: 'active' }) }),
  )
  const onSuccess = vi.fn()
  const { result } = renderHook(() => useGoalCreation(), { wrapper: makeHookWrapper() })
  act(() => result.current.submit(
    { profile: { sex: 'M', heightCm: 180, birthDate: '1991-03-01' },
      goal: { title: 'Nyári cut', trajectory: 'cut', guards: ['strength'], startDate: '2026-06-01', targetDate: '2026-07-27', startWeightKg: 84.2 },
      activate: true },
    { onSuccess }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  expect(calls).toEqual(['profile', 'goal', 'activate'])
})
