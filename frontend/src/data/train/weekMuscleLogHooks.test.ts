import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { makeHookWrapper } from '@/test/queryWrapper'
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
