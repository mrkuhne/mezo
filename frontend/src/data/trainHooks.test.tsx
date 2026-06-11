import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { useTrain } from './hooks'
import { makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// Real-mode block — mirrors sleepHooks.test.tsx (stubEnv, not vi.mock, so the
// same file is exercised in both `pnpm test` and `VITE_USE_MOCK=false pnpm test`).
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

test('useTrain (real mode) fetches mesocycles, formats display dates, derives activeMeso', async () => {
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.mesocycles.length).toBeGreaterThan(0))
  const active = result.current.activeMeso
  if (!active) throw new Error('expected an active meso from the MSW fixture')
  expect(active.title).toBe('Hypertrophy 04 · Tavasz')
  expect(active.startDate).toBe('Máj 1') // ISO 2026-05-01 -> HU display
  expect(active.volumePerMuscle?.chest.source.confidence).toBe(0.78)
})

test('useTrain (real mode) fetches sport sessions with computed HU date labels', async () => {
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.sport.sessions.length).toBeGreaterThan(0))
  expect(result.current.sport.sessions[0].date).toBe('Máj 20 · Sze') // TRUE day-of-week
  expect(result.current.sport.sessions[0].notes).toBeNull()
})

test('useTrain (real mode) keeps static exerciseLibrary catalog', async () => {
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  expect(result.current.exerciseLibrary.length).toBeGreaterThan(0)
})

test('useTrain (real mode) createMesocycle POSTs the wizard payload', async () => {
  let posted: { title?: string; status?: string } | null = null
  server.use(
    http.post(`${API_BASE}/api/train/mesocycles`, async ({ request }) => {
      posted = (await request.json()) as typeof posted
      return HttpResponse.json({ id: 'b6f3a0e2-0000-4000-8000-00000000c0de' }, { status: 201 })
    }),
  )
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  const onSuccess = vi.fn()
  result.current.createMesocycle(
    {
      title: 'Teszt meso',
      status: 'planned',
      startDate: '2026-06-16',
      weeks: 4,
      split: 'Upper / Lower · 4×/hét',
      style: 'Linear · 4 hét',
      phaseCurve: ['MEV', 'MAV'],
    },
    { onSuccess },
  )
  await waitFor(() => expect(posted).not.toBeNull())
  expect(posted!.title).toBe('Teszt meso')
  expect(posted!.status).toBe('planned')
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
})

test('useTrain (real mode) activate/close/saveDayExercises hit the right endpoints', async () => {
  const calls: string[] = []
  server.use(
    http.post(`${API_BASE}/api/train/mesocycles/:id/activate`, ({ params }) => {
      calls.push(`activate:${params.id}`)
      return HttpResponse.json({ id: params.id })
    }),
    http.post(`${API_BASE}/api/train/mesocycles/:id/close`, ({ params }) => {
      calls.push(`close:${params.id}`)
      return HttpResponse.json({ id: params.id })
    }),
    http.put(`${API_BASE}/api/train/mesocycles/:id/days/:dayId/exercises`, ({ params }) => {
      calls.push(`replace:${params.id}/${params.dayId}`)
      return HttpResponse.json({ day: 'Hét', type: 'Pull', muscle: '', exerciseCount: 0, exercises: [] })
    }),
  )
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  result.current.activateMesocycle('m-1')
  result.current.closeMesocycle('m-2')
  result.current.saveDayExercises('m-3', 'd-1', [])
  await waitFor(() =>
    expect(calls).toEqual(expect.arrayContaining(['activate:m-1', 'close:m-2', 'replace:m-3/d-1'])),
  )
})

test('useTrain (mock mode) mutations resolve without any network call', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true') // override the file-level real-mode stub
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  const onSuccess = vi.fn()
  result.current.createMesocycle(
    {
      title: 'Mock meso', status: 'planned', startDate: '2026-06-16',
      weeks: 4, split: 's', style: 's', phaseCurve: ['MEV'],
    },
    { onSuccess },
  )
  // No MSW override registered for POST here: a real request would fail the test
  // via onUnhandledRequest — resolving onSuccess proves the mock branch no-ops.
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
})

test('useTrain (real mode) returns nulls (no static fallback) when the backend is empty', async () => {
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
  )
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.mesocycles).toEqual([]))
  expect(result.current.activeMeso).toBeNull()
  expect(result.current.workout).toBeNull()
  expect(result.current.gymSchedule).toBeNull()
  expect(result.current.sport.schedule).toBeNull()
  expect(result.current.sport.week).toBeNull()
  expect(result.current.sport.crossLoad).toBeNull()
  expect(result.current.sport.sessions).toEqual([])
})
