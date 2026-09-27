import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { makeHookWrapper, makeHookWrapperWithClient } from '@/test/queryWrapper'
import { useWeekMuscleLog } from '@/data/train/weekMuscleLogHooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'

const summary = (id: string, status: string, origin: string) =>
  ({ id, templateSessionId: `t-${id}`, date: '2026-08-03', status, origin })
const detailBody = (id: string) =>
  ({ id, templateSessionId: `t-${id}`, date: '2026-08-03', status: 'completed', title: 'Push', dayLabel: 'Hét', exercises: [] })

describe('useWeekMuscleLog (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())
  it('serves an empty week with pending false', () => {
    const { result } = renderHook(() => useWeekMuscleLog(), { wrapper: makeHookWrapper() })
    expect(result.current.details).toEqual([])
    expect(result.current.completedSummaries).toEqual([])
    expect(result.current.pending).toBe(false)
  })
})

describe('useWeekMuscleLog (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())
  it('fetches details for completed instances only (both origins), pending resolves', async () => {
    server.use(
      http.get(`${API_BASE}/api/train/workouts/:id`, ({ params }) =>
        HttpResponse.json(detailBody(params.id as string))),
      http.get(`${API_BASE}/api/train/workouts`, () =>
        HttpResponse.json([summary('w1', 'completed', 'meso'), summary('w2', 'planned', 'meso'), summary('w3', 'completed', 'custom')])),
    )
    const { result } = renderHook(() => useWeekMuscleLog(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.pending).toBe(false))
    expect(result.current.completedSummaries.map((s) => s.id)).toEqual(['w1', 'w3'])
    expect(result.current.details.map((d) => d.id).sort()).toEqual(['w1', 'w3'])
  })
})

// mezo-fp5s4: the week's summaries had a second, read-only observer with no queryFn. Any refetch of
// the shared key (a workout save invalidates ['train','weekWorkouts']; the Terv/Terhelés pages remount
// the observer) ran with that observer's options and logged "No queryFn was passed" on five Edzés routes.
describe.each([['true'], ['false']])('useWeekMuscleLog never fetches without a queryFn (VITE_USE_MOCK=%s)', (mockFlag) => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', mockFlag))
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })
  it('a refetch of the week key logs no missing-queryFn error', async () => {
    server.use(http.get(`${API_BASE}/api/train/workouts`, () => HttpResponse.json([])))
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { wrapper, client } = makeHookWrapperWithClient()
    const { result } = renderHook(() => useWeekMuscleLog(), { wrapper })
    await waitFor(() => expect(result.current.pending).toBe(false))
    await client.refetchQueries({ queryKey: ['train', 'weekWorkouts'] })
    await client.invalidateQueries({ queryKey: ['train', 'weekWorkouts'] })
    await waitFor(() => expect(result.current.pending).toBe(false))
    const missing = errors.mock.calls.filter((c) => String(c[0]).includes('No queryFn'))
    expect(missing).toEqual([])
  })
})
