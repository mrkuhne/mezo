import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { useWorkoutDetail, useWeekWorkouts } from '@/data/train/workoutDetailHooks'
import { workoutDetailMock } from '@/data/train/train'

afterEach(() => vi.unstubAllEnvs())

describe('useWorkoutDetail', () => {
  it('mock mode: serves the static fixture synchronously (any id)', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => useWorkoutDetail('anything'), { wrapper: makeHookWrapper() })
    expect(result.current.detail).toEqual(workoutDetailMock)
    expect(result.current.pending).toBe(false)
    expect(result.current.error).toBe(false)
  })

  it('real mode: fetches the detail by id', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(http.get(`${API_BASE}/api/train/workouts/w1`, () => HttpResponse.json(workoutDetailMock)))
    const { result } = renderHook(() => useWorkoutDetail('w1'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.detail).not.toBeNull())
    expect(result.current.detail?.id).toBe(workoutDetailMock.id)
    expect(result.current.pending).toBe(false)
    expect(result.current.error).toBe(false)
  })

  it('real mode: null id keeps the query disabled (no data, no error)', () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const { result } = renderHook(() => useWorkoutDetail(null), { wrapper: makeHookWrapper() })
    expect(result.current.detail).toBeNull()
    expect(result.current.error).toBe(false)
    // A disabled query with no data reports status 'pending' (fetchStatus 'idle') in
    // TanStack v5 — consumers pass a real route id, so this null path never renders.
    expect(result.current.pending).toBe(true)
  })
})

describe('useWeekWorkouts', () => {
  it('mock mode: returns an empty week synchronously', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => useWeekWorkouts(), { wrapper: makeHookWrapper() })
    expect(result.current.workouts).toEqual([])
  })

  it('real mode: fetches the current Mon–Sun summaries', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const summary = { id: 'w1', date: '2026-07-13', status: 'completed' as const }
    server.use(http.get(`${API_BASE}/api/train/workouts`, () => HttpResponse.json([summary])))
    const { result } = renderHook(() => useWeekWorkouts(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.workouts.length).toBe(1))
    expect(result.current.workouts[0].id).toBe('w1')
  })
})
