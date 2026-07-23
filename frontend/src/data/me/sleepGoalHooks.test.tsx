import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useSleepGoal, useSleepGoalActions } from '@/data/me/sleepHooks'
import { SLEEP_GOAL_GHOST, mockSleepGoal, deriveSleepTimes } from '@/data/me/sleepGoal'

afterEach(() => vi.unstubAllEnvs())

describe('deriveSleepTimes', () => {
  it('derives bed from a WAKE anchor', () => {
    expect(deriveSleepTimes('WAKE', '06:45', 450)).toEqual({ wakeTime: '06:45', bedTime: '23:15' })
  })
  it('derives wake from a BED anchor across midnight', () => {
    expect(deriveSleepTimes('BED', '00:30', 480)).toEqual({ wakeTime: '08:30', bedTime: '00:30' })
  })
})

describe('useSleepGoal (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('serves the demo seed synchronously', () => {
    const { result } = renderHook(() => useSleepGoal(), { wrapper: makeHookWrapper() })
    expect(result.current.goal).toEqual(mockSleepGoal)
  })

  it('setGoal patches the cache with re-derived ends', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ read: useSleepGoal(), act: useSleepGoalActions() }), { wrapper })
    await act(() => result.current.act.setGoal({ targetMinutes: 480, anchor: 'BED', anchorTime: '23:00', regularityBandMin: 15 }))
    await waitFor(() => expect(result.current.read.goal.wakeTime).toBe('07:00'))
  })
})

describe('useSleepGoal (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('starts from the honest ghost, then loads the server goal', async () => {
    const { result } = renderHook(() => useSleepGoal(), { wrapper: makeHookWrapper() })
    expect(result.current.goal).toEqual(SLEEP_GOAL_GHOST) // never the mock seed
    await waitFor(() => expect(result.current.goal.anchorTime).toBe('06:45'))
    expect(result.current.goal.bedTime).toBe('23:15')
  })

  it('setGoal PUTs and refetches', async () => {
    let putBody: unknown
    server.use(
      http.put(`${API_BASE}/api/sleep/goal`, async ({ request }) => {
        putBody = await request.json()
        return HttpResponse.json({ targetMinutes: 480, anchor: 'WAKE', anchorTime: '06:00', wakeTime: '06:00', bedTime: '22:00', regularityBandMin: 15 })
      }),
      http.get(`${API_BASE}/api/sleep/goal`, () =>
        HttpResponse.json({ targetMinutes: 480, anchor: 'WAKE', anchorTime: '06:00', wakeTime: '06:00', bedTime: '22:00', regularityBandMin: 15 })),
    )
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ read: useSleepGoal(), act: useSleepGoalActions() }), { wrapper })
    await act(() => result.current.act.setGoal({ targetMinutes: 480, anchor: 'WAKE', anchorTime: '06:00', regularityBandMin: 15 }))
    expect(putBody).toEqual({ targetMinutes: 480, anchor: 'WAKE', anchorTime: '06:00', regularityBandMin: 15 })
    await waitFor(() => expect(result.current.read.goal.bedTime).toBe('22:00'))
  })
})
