import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useGoal } from './goalHooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

test('useGoal (real mode) maps the active GoalResponse to the Goal shape', async () => {
  server.use(
    http.get(`${API_BASE}/api/goals`, () =>
      HttpResponse.json([
        {
          id: 'g1',
          title: 'Nyári cut',
          trajectory: 'cut',
          guards: ['strength'],
          status: 'active',
          startDate: '2026-06-01',
          targetDate: '2026-07-27',
          startWeightKg: 84.2,
          targetWeightKg: 80,
          rateTargetPctPerWeek: 0.7,
        },
      ]),
    ),
    http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
  )
  const { result } = renderHook(() => useGoal(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.goal?.title).toBe('Nyári cut'))
  expect(result.current.goal?.kind).toBe('cut')
  expect(result.current.goal?.targetWeight).toBe(80)
})

test('useGoal (real mode) returns a null goal + empty links when no goal exists', async () => {
  server.use(
    http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
  )
  const { result } = renderHook(() => useGoal(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.goal).toBeNull())
  expect(result.current.linkedMesocycles).toEqual({})
})

test('useGoal (real mode) builds linkedMesocycles + goal.mesocycles from the timeline links', async () => {
  server.use(
    http.get(`${API_BASE}/api/goals`, () =>
      HttpResponse.json([
        {
          id: 'g1',
          title: 'Nyári cut',
          trajectory: 'cut',
          guards: ['strength'],
          status: 'active',
          startDate: '2026-06-01',
          targetDate: '2026-07-27',
          startWeightKg: 84.2,
          targetWeightKg: 80,
          rateTargetPctPerWeek: 0.7,
        },
      ]),
    ),
    http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/goals/g1/timeline`, () =>
      HttpResponse.json({
        goalId: 'g1',
        weeks: 8,
        links: [
          {
            id: 'link-1',
            planType: 'mesocycle',
            planId: 'meso-1',
            startWeek: 1,
            endWeek: 6,
            plan: {
              title: 'Hypertrophy 04',
              status: 'active',
              startDate: '2026-06-01',
              endDate: '2026-07-13',
              weeks: 6,
            },
          },
        ],
        gaps: [],
      }),
    ),
  )
  const { result } = renderHook(() => useGoal(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.goal?.mesocycles).toEqual(['meso-1']))
  expect(result.current.linkedMesocycles['meso-1']).toEqual({
    id: 'meso-1',
    shortTitle: 'Hypertrophy 04',
    status: 'active',
    startDate: 'Jún 1',
    endDate: 'Júl 13',
    weeks: 6,
  })
})
