import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { useCustomWorkouts } from '@/data/train/customWorkoutHooks'
import { customWorkoutsMock } from '@/data/train/train'

afterEach(() => vi.unstubAllEnvs())

describe('useCustomWorkouts', () => {
  it('mock mode: serves the static fixtures synchronously', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => useCustomWorkouts(), { wrapper: makeHookWrapper() })
    expect(result.current.customWorkouts).toEqual(customWorkoutsMock)
    expect(result.current.customPending).toBe(false)
  })

  it('real mode: fetches and maps the template list', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(http.get(`${API_BASE}/api/train/custom-workouts`, () => HttpResponse.json([
      { id: 'cw-real-1', name: 'Pihenőnapi felső', exercises: [] },
    ])))
    const { result } = renderHook(() => useCustomWorkouts(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.customWorkouts).toHaveLength(1))
    expect(result.current.customWorkouts[0].name).toBe('Pihenőnapi felső')
  })
})
