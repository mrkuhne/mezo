import { renderHook, act, waitFor } from '@testing-library/react'
import { useQueryClient } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useGoal, useGoalActions } from '@/data/me/goalHooks'
import { goal as mockGoal, goalResponse as mockGoalResponse, linkedMesocycles as mockLinkedMesocycles } from '@/data/me/goals'
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
  // rateTarget is the goal's TARGET pace in %BW/week (rateTargetPctPerWeek) —
  // contract-native %/hét, NOT the observed kg/hét trend (mezo-5om).
  expect(result.current.goal?.rateTarget).toEqual({ value: 0.7, unit: '%/hét', direction: 'down' })
})

test('useGoal (real mode) maps the day-planner settings onto the Goal shape', async () => {
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
          mealsPerDay: 5,
          wakeTime: '05:30',
          bedTime: '22:15',
        },
      ]),
    ),
    http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
  )
  const { result } = renderHook(() => useGoal(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.goal?.mealsPerDay).toBe(5))
  expect(result.current.goal?.wakeTime).toBe('05:30')
  expect(result.current.goal?.bedTime).toBe('22:15')
})

test('useGoal (real mode) defaults the planner fields to null when the contract omits them', async () => {
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
  expect(result.current.goal?.mealsPerDay).toBeNull()
  expect(result.current.goal?.wakeTime).toBeNull()
  expect(result.current.goal?.bedTime).toBeNull()
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

test('useGoal (real mode) exposes the fetched timeline + goalId', async () => {
  const timelineBody = {
    goalId: 'g1',
    weeks: 8,
    links: [
      {
        id: 'link-1',
        planType: 'mesocycle',
        planId: 'meso-1',
        startWeek: 1,
        endWeek: 6,
        plan: { title: 'Hypertrophy 04', status: 'active', startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6 },
      },
    ],
    gaps: [{ fromWeek: 7, toWeek: 8 }],
  }
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
    http.get(`${API_BASE}/api/goals/g1/timeline`, () => HttpResponse.json(timelineBody)),
  )
  const { result } = renderHook(() => useGoal(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.timeline).toEqual(timelineBody))
  expect(result.current.goalId).toBe('g1')
})

test('useGoal (real mode) returns null timeline + goalId when no active goal exists', async () => {
  server.use(
    http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
  )
  const { result } = renderHook(() => useGoal(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.goal).toBeNull())
  expect(result.current.timeline).toBeNull()
  expect(result.current.goalId).toBeNull()
})

test('useGoalActions (real mode) archive/remove/activate hit the right endpoints', async () => {
  const calls: string[] = []
  server.use(
    http.post(`${API_BASE}/api/goals/g1/archive`, () => { calls.push('archive'); return HttpResponse.json({ id: 'g1', status: 'archived' }) }),
    http.delete(`${API_BASE}/api/goals/g1`, () => { calls.push('remove'); return new HttpResponse(null, { status: 204 }) }),
    http.post(`${API_BASE}/api/goals/g1/activate`, () => { calls.push('activate'); return HttpResponse.json({ id: 'g1', status: 'active' }) }),
  )
  const { result } = renderHook(() => useGoalActions(), { wrapper: makeHookWrapper() })
  await act(async () => { await result.current.archive('g1') })
  await act(async () => { await result.current.remove('g1') })
  await act(async () => { await result.current.activate('g1') })
  expect(calls).toEqual(['archive', 'remove', 'activate'])
})

test('useGoalActions (real mode) savePlanner PUTs a full goal carrying the edited planner settings', async () => {
  let body: Record<string, unknown> | null = null
  server.use(
    http.put(`${API_BASE}/api/goals/g1`, async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({ id: 'g1', status: 'active' })
    }),
  )
  const res = {
    id: 'g1',
    title: 'Nyári cut',
    trajectory: 'cut' as const,
    guards: ['strength' as const],
    status: 'active' as const,
    startDate: '2026-06-01',
    targetDate: '2026-07-27',
    startWeightKg: 84.2,
    targetWeightKg: 80,
    rateTargetPctPerWeek: 0.7,
    mealsPerDay: 4,
    wakeTime: '06:00',
    bedTime: '23:00',
  }
  const { result } = renderHook(() => useGoalActions(), { wrapper: makeHookWrapper() })
  await act(async () => {
    await result.current.savePlanner('g1', res, { mealsPerDay: 5, wakeTime: '05:30', bedTime: '22:30' })
  })
  // the edited planner fields ride in the PUT body …
  expect(body!.mealsPerDay).toBe(5)
  expect(body!.wakeTime).toBe('05:30')
  expect(body!.bedTime).toBe('22:30')
  // … alongside the untouched required contract fields (window/weights preserved).
  expect(body!.title).toBe('Nyári cut')
  expect(body!.startDate).toBe('2026-06-01')
  expect(body!.startWeightKg).toBe(84.2)
})

test('useGoalActions (real mode) attach/detach hit goalLinkApi with the right args', async () => {
  let attachBody: unknown = null
  const calls: string[] = []
  server.use(
    http.post(`${API_BASE}/api/goals/g1/plans`, async ({ request }) => {
      calls.push('attach')
      attachBody = await request.json()
      return HttpResponse.json(
        { id: 'link-9', planType: 'mesocycle', planId: 'meso-7', startWeek: 2, endWeek: 8, plan: { title: 'X', status: 'planned', startDate: '2026-06-08', endDate: '2026-08-03', weeks: 6 } },
        { status: 201 },
      )
    }),
    http.delete(`${API_BASE}/api/goals/g1/plans/link-9`, () => { calls.push('detach'); return new HttpResponse(null, { status: 204 }) }),
  )
  const { result } = renderHook(() => useGoalActions(), { wrapper: makeHookWrapper() })
  await act(async () => { await result.current.attachPlan('g1', { planType: 'mesocycle', planId: 'meso-7', startWeek: 2 }) })
  await act(async () => { await result.current.detachPlan('g1', 'link-9') })
  expect(calls).toEqual(['attach', 'detach'])
  expect(attachBody).toEqual({ planType: 'mesocycle', planId: 'meso-7', startWeek: 2 })
})

test('useGoalActions (real mode) invalidates goals + the goal timeline on success', async () => {
  server.use(
    http.post(`${API_BASE}/api/goals/g1/plans`, () =>
      HttpResponse.json(
        { id: 'link-9', planType: 'mesocycle', planId: 'meso-7', startWeek: 2, endWeek: 8, plan: { title: 'X', status: 'planned', startDate: '2026-06-08', endDate: '2026-08-03', weeks: 6 } },
        { status: 201 },
      ),
    ),
  )
  // Spy on the QueryClient the wrapper hands to the hook so we can assert the
  // exact keys invalidated in onSuccess (the goalHooks invalidation idiom).
  const wrapper = makeHookWrapper()
  const invalidated: unknown[] = []
  const { result } = renderHook(
    () => {
      const qc = useQueryClient()
      const spy = vi.spyOn(qc, 'invalidateQueries')
      // record every invalidate call's queryKey
      spy.mockImplementation((filters?: { queryKey?: unknown }) => {
        invalidated.push(filters?.queryKey)
        return Promise.resolve()
      })
      return useGoalActions()
    },
    { wrapper },
  )
  await act(async () => { await result.current.attachPlan('g1', { planType: 'mesocycle', planId: 'meso-7', startWeek: 2 }) })
  expect(invalidated).toContainEqual(['goals'])
  expect(invalidated).toContainEqual(['goal', 'g1', 'timeline'])
})

// --- mock mode ---------------------------------------------------------------

test('useGoal (mock mode) returns the static mock timeline + goalId, keeping linkedMesocycles', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useGoal(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.goal).not.toBeNull())
  expect(result.current.linkedMesocycles).toEqual(mockLinkedMesocycles)
  expect(result.current.goalId).toBe(mockGoal.id)
  expect(result.current.timeline).not.toBeNull()
  // mock timeline mirrors the static linkedMesocycles: ≥1 meso link, a run link, ≥1 gap
  expect(result.current.timeline!.goalId).toBe(mockGoal.id)
  expect(result.current.timeline!.links.some(l => l.planType === 'mesocycle')).toBe(true)
  expect(result.current.timeline!.links.some(l => l.planType === 'running_block')).toBe(true)
  expect(result.current.timeline!.gaps.length).toBeGreaterThan(0)
})

test('useGoalActions (mock mode) actions are no-ops that resolve without calling the API', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  // Any real network call would fail (MSW has no handlers for these in mock mode);
  // resolving cleanly proves the actions short-circuit.
  const { result } = renderHook(() => useGoalActions(), { wrapper: makeHookWrapper() })
  await act(async () => {
    await result.current.archive('x')
    await result.current.remove('x')
    await result.current.activate('x')
    await result.current.attachPlan('x', { planType: 'mesocycle', planId: 'p', startWeek: 1 })
    await result.current.detachPlan('x', 'l')
    await result.current.savePlanner('x', mockGoalResponse, { mealsPerDay: 5, wakeTime: '05:30', bedTime: '22:30' })
  })
  expect(result.current.pending).toBe(false)
})
