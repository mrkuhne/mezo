import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { useGoalOverview } from '@/data/me/goalOverviewHooks'
import { goalOverviewSeed } from '@/data/me/goals'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { makeHookWrapperWithClient } from '@/test/queryWrapper'

const OVERVIEW = {
  goalId: 'g1',
  title: 'Nyári cut',
  trajectory: 'cut',
  status: 'active',
  currentWeek: 3,
  totalWeeks: 8,
  completionPct: 29,
  currentWeightKg: 82.4,
  targetWeightKg: 78,
  remainingKg: 4.4,
  courseStatus: 'on_track',
  courseReasonCode: 'rate_on_track',
  observedRateKgPerWeek: -0.68,
  targetRateKgPerWeek: -0.74,
  projectedTargetDate: '2026-10-24',
  dataSufficiency: 'full',
  diet: {
    weekAverageKcal: 2780,
    todayDayType: 'training',
    todayKcal: 2940,
    trainingDayKcal: 2940,
    restDayKcal: 2580,
    proteinG: 188,
    carbsG: 361,
    fatG: 82,
    basis: 'formula',
    explanationCode: 'training_day_split',
  },
  segment: {
    available: true,
    label: 'MAV',
    fromWeek: 3,
    toWeek: 5,
    remainingDays: 5,
    nextLabel: 'Deload',
    nextFromWeek: 6,
    nextChangeDate: '2026-09-14',
    explanationCode: 'mesocycle_phase',
  },
  plans: { links: [], gaps: [], sportSchedule: [], activeLinkCount: 2, uncoveredWeekCount: 0 },
  guards: { status: null, healthyCount: 3, totalCount: 4 },
  openSuggestionCount: 1,
  latestSuggestionId: 'sug-1',
} as const

afterEach(() => vi.unstubAllEnvs())

describe('useGoalOverview', () => {
  test('real mode fetches the typed overview under the stable goal-overview key', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(
      http.get(`${API_BASE}/api/goals/g1/overview`, () => HttpResponse.json(OVERVIEW)),
    )
    const { wrapper, client } = makeHookWrapperWithClient()
    const { result } = renderHook(() => useGoalOverview('g1'), { wrapper })

    expect(result.current.overview?.goalId).toBe('')
    expect(result.current.pending).toBe(true)
    await waitFor(() => expect(result.current.overview).toEqual(OVERVIEW))
    expect(client.getQueryData(['goal-overview', 'g1'])).toEqual(OVERVIEW)
  })

  test('real mode stays disabled and idle when goalId is null', () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    let calls = 0
    server.use(
      http.get(`${API_BASE}/api/goals/:goalId/overview`, () => {
        calls += 1
        return HttpResponse.json(OVERVIEW)
      }),
    )
    const { wrapper, client } = makeHookWrapperWithClient()
    const { result } = renderHook(() => useGoalOverview(null), { wrapper })

    expect(result.current).toEqual({ overview: null, pending: false })
    expect(client.getQueryState(['goal-overview', null])?.fetchStatus).toBe('idle')
    expect(calls).toBe(0)
  })

  test('mock mode returns the complete seed synchronously', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { wrapper } = makeHookWrapperWithClient()
    const { result } = renderHook(() => useGoalOverview(goalOverviewSeed.goalId), { wrapper })

    expect(result.current.overview).toBe(goalOverviewSeed)
    expect(result.current.pending).toBe(false)
  })
})
