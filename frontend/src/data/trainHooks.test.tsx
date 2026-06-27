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

test('useTrain (real mode) maps the API exercise catalog into exerciseLibrary', async () => {
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.exerciseLibrary.length).toBe(6))
  const boxJump = result.current.exerciseLibrary.find((e) => e.name === 'Box Jump')
  expect(boxJump).toMatchObject({
    id: 'f1e3a0e2-0000-4000-8000-000000000072',
    catalogId: 'f1e3a0e2-0000-4000-8000-000000000072',
    muscle: 'quad',
    type: 'plyo',
    stim: 0.6,
  })
})

test('useTrain (real mode) serves exercise records from the endpoint', async () => {
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.exerciseRecords.length).toBe(2))
  const row = result.current.exerciseRecords[0]
  expect(row.name).toBe('Chest Supported Row')
  expect(row.bestSet?.weightKg).toBe(102.5)
  expect(row.bestE1rm?.value).toBe(133.3)
  expect(result.current.exerciseRecords[1].bestSet).toBeUndefined() // bodyweight record
})

test('useTrain (mock mode) serves no exercise records (Phase-1 has no set history)', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  expect(result.current.exerciseRecords).toEqual([])
})

test('useTrain (mock mode) keeps the static Phase-1 exerciseLibrary', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true') // override the file-level real-mode stub
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  expect(result.current.exerciseLibrary.length).toBe(21)
  expect(result.current.exerciseLibrary[0].id).toBe('exl-1')
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
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
  )
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.mesocycles).toEqual([]))
  expect(result.current.activeMeso).toBeNull()
  expect(result.current.workout).toBeNull()
  expect(result.current.gymSchedule).toBeNull()
  expect(result.current.todaySession).toBeNull()
  expect(result.current.sport.schedule).toBeNull()
  expect(result.current.sport.week).toBeNull()
  expect(result.current.sport.crossLoad).toBeNull()
  expect(result.current.sport.sessions).toEqual([])
})

test('useTrain (real mode) maps /today into the WorkoutPlan shape with lastWeek refs', async () => {
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.workout).not.toBeNull())
  expect(result.current.workout!.title).toBe('Pull Day')
  expect(result.current.workout!.exercises[0].name).toBe('Chest Supported Row')
  expect(result.current.workout!.exercises[0].lastWeek).toEqual({ weight: 102.5, reps: 9, rir: 2 })
  expect(result.current.workout!.challenges).toEqual([]) // AI challenges are Phase 3
  expect(result.current.todaySession).toEqual({
    templateSessionId: 'a1f3a0e2-0000-4000-8000-000000000010',
    openWorkout: null,
  })
})

test('useTrain (real mode) derives the gym weekly schedule from the active meso days', async () => {
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.gymSchedule).not.toBeNull())
  const rows = result.current.gymSchedule!.weeklyTimes
  expect(rows).toHaveLength(7)
  const csu = rows.find((r) => r.day === 'Csü')!
  expect(csu.active).toBe(true) // the meso fixture's only day with exercises
  expect(csu.type).toBe('Pull')
  expect(rows.filter((r) => r.active)).toHaveLength(1)
})

test('useTrain (real mode) workout write mutations hit the T2 endpoints', async () => {
  const calls: string[] = []
  server.use(
    http.post(`${API_BASE}/api/train/workouts`, async ({ request }) => {
      const body = (await request.json()) as { templateSessionId: string }
      calls.push(`start:${body.templateSessionId}`)
      return HttpResponse.json(
        { id: 'w-1', templateSessionId: body.templateSessionId, date: '2026-06-12', status: 'active', sets: [] },
        { status: 201 },
      )
    }),
    http.post(`${API_BASE}/api/train/workouts/:id/sets`, ({ params }) => {
      calls.push(`set:${params.id}`)
      return HttpResponse.json({ id: 'st-1', exerciseId: 'ex-1', setIndex: 0 }, { status: 201 })
    }),
    http.post(`${API_BASE}/api/train/workouts/:id/feedback`, ({ params }) => {
      calls.push(`feedback:${params.id}`)
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${API_BASE}/api/train/workouts/:id/finish`, ({ params }) => {
      calls.push(`finish:${params.id}`)
      return HttpResponse.json({ id: String(params.id), templateSessionId: 't-1', date: '2026-06-12', status: 'completed', sets: [] })
    }),
  )
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  const started = vi.fn()
  result.current.startWorkout('t-1', { onSuccess: started })
  await waitFor(() => expect(started).toHaveBeenCalled())
  expect(started.mock.calls[0][0].id).toBe('w-1')
  result.current.logSet('w-1', { exerciseId: 'ex-1', setIndex: 0, weightKg: 102.5, reps: 9, rir: 2 })
  result.current.saveWorkoutFeedback('w-1', [{ exerciseId: 'ex-1', pump: 3, jointPain: 1, workload: 2 }])
  result.current.finishWorkout('w-1')
  await waitFor(() =>
    expect(calls).toEqual(expect.arrayContaining(['start:t-1', 'set:w-1', 'feedback:w-1', 'finish:w-1'])),
  )
})

// ---- T3 sport block: schedule mapping, week derivation, write mutations ----

test('useTrain (real mode) maps the sport schedule slots into SportSchedule', async () => {
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.sport.schedule).not.toBeNull())
  const vb = result.current.sport.schedule!.volleyball
  expect(vb.sessions).toHaveLength(5)
  expect(vb.sessions[0]).toMatchObject({
    day: 'Hét', time: '18:15', duration: 90, court: 'BVSC csarnok', intensity: 'közepes', role: 'edzés',
  })
  expect(vb.sessions[4].role).toBe('meccs')
  expect(vb.weeklyHours).toBe(8) // (4×90 + 120) / 60 — derived, unlike the hand-written 7.5 in the Phase-1 fixture
})

test('useTrain (real mode) derives week stats from sessions logged this week', async () => {
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  server.use(
    http.get(`${API_BASE}/api/train/sport-sessions`, () =>
      HttpResponse.json([
        { id: 'd1f3a0e2-0000-4000-8000-000000000077', sport: 'volleyball', date: iso, time: '18:00', duration: 90, setsPlayed: 5, rpe: 7, shoulderStrain: 6 },
      ]),
    ),
  )
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.sport.week).not.toBeNull())
  expect(result.current.sport.week).toMatchObject({
    sessions: 1, hoursPlayed: 1.5, avgRPE: 7, avgShoulderStrain: 6, shoulderLoadTrend: 'stabil',
  })
  // intensity/jumpCount are not captured by the sheet -> surfaced as null, not 0
  expect(result.current.sport.sessions[0].intensity).toBeNull()
  expect(result.current.sport.sessions[0].jumpCount).toBeNull()
})

test('useTrain (real mode) week avgShoulderStrain ignores null-strain cross/TRX rows', async () => {
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  server.use(
    http.get(`${API_BASE}/api/train/sport-sessions`, () =>
      HttpResponse.json([
        { id: 'd1f3a0e2-0000-4000-8000-0000000000a1', sport: 'volleyball', date: iso, time: '18:00', duration: 90, setsPlayed: 5, rpe: 6, shoulderStrain: 6 },
        { id: 'd1f3a0e2-0000-4000-8000-0000000000a2', sport: 'cross', date: iso, time: '07:00', duration: 30, rounds: 8, rpe: 8 },
      ]),
    ),
  )
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.sport.week).not.toBeNull())
  // The null-strain cross row must NOT deflate the volleyball-only shoulder average (6, not 3).
  expect(result.current.sport.week).toMatchObject({ sessions: 2, avgShoulderStrain: 6 })
})

test('useTrain (real mode) week stays null when no session falls in the current week', async () => {
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() }) // default handlers: May 2026 sessions only
  await waitFor(() => expect(result.current.sport.sessions.length).toBeGreaterThan(0))
  expect(result.current.sport.week).toBeNull()
})

test('useTrain (real mode) logSportSession POSTs the sheet payload', async () => {
  const posted: unknown[] = []
  server.use(
    http.post(`${API_BASE}/api/train/sport-sessions`, async ({ request }) => {
      posted.push(await request.json())
      return HttpResponse.json(
        { id: 'd1f3a0e2-0000-4000-8000-00000000beef', sport: 'volleyball', date: '2026-06-12', time: '18:00', duration: 90, setsPlayed: 5, rpe: 7, shoulderStrain: 6 },
        { status: 201 },
      )
    }),
  )
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.sport.sessions.length).toBeGreaterThan(0))
  result.current.logSportSession({ duration: 90, setsPlayed: 5, rpe: 7, shoulderStrain: 6 })
  await waitFor(() => expect(posted).toHaveLength(1))
  expect(posted[0]).toEqual({ duration: 90, setsPlayed: 5, rpe: 7, shoulderStrain: 6 })
})

test('useTrain (real mode) saveSportSchedule PUTs the full slot list', async () => {
  const put: unknown[] = []
  server.use(
    http.put(`${API_BASE}/api/train/sport-schedule`, async ({ request }) => {
      put.push(await request.json())
      return HttpResponse.json([])
    }),
  )
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.sport.schedule).not.toBeNull())
  result.current.saveSportSchedule([{ dayOfWeek: 0, time: '18:15', durationMin: 90, kind: 'training' }])
  await waitFor(() => expect(put).toHaveLength(1))
  expect(put[0]).toEqual([{ dayOfWeek: 0, time: '18:15', durationMin: 90, kind: 'training' }])
})
