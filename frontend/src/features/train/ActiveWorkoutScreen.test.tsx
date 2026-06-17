import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { ActiveWorkoutScreen } from './ActiveWorkoutScreen'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// Asserts Phase-1 mock workout data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function setup() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/train/session']}>
        <ActiveWorkoutScreen />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('prep screen shows the workout title, challenges carousel and the start CTA', () => {
  setup()
  expect(screen.getAllByText('Pull Day').length).toBeGreaterThan(0)
  expect(screen.getByText('Mai kihívások · proposál')).toBeInTheDocument()
  expect(screen.getByText(/Kezdjük el/)).toBeInTheDocument()
})

test('prep screen flags the active niggle pre-flight', () => {
  setup()
  expect(screen.getByText('Jobb váll · aktív niggle')).toBeInTheDocument()
  expect(screen.getByText('Értem · jó így')).toBeInTheDocument()
})

test('clicking the start CTA reveals the first active exercise', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
  expect(screen.getByText('Set kész')).toBeInTheDocument()
})

test('completing a set advances the set counter', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(screen.getByText(/Set 1\//)).toBeInTheDocument()
  await user.click(screen.getByText('Set kész'))
  expect(screen.getByText(/Set 2\//)).toBeInTheDocument()
})

test('logging a PR-weight third set on the first exercise fires the PR toast', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // 4 sets on ex0; bump weight to 105 then complete sets 1, 2, 3.
  const plus = screen.getByLabelText('kg növelése')
  await user.click(plus) // 102.5 -> 105
  await user.click(screen.getByText('Set kész')) // set 1
  await user.click(screen.getByText('Set kész')) // set 2
  await user.click(screen.getByText('Set kész')) // set 3 -> PR
  expect(screen.getByText('Personal Record')).toBeInTheDocument()
  expect(screen.getByText('+2.5 kg')).toBeInTheDocument()
})

test('the weight value is tap-to-edit and honors an exact (non-2.5) typed value', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  const kg = screen.getByLabelText('kg') as HTMLInputElement
  await user.clear(kg)
  await user.type(kg, '93')
  await user.tab() // blur commits + clamps
  expect(kg.value).toBe('93')
})

test('reordering remaining exercises changes which exercise comes next', async () => {
  const user = userEvent.setup()
  setup() // mock mode (file pins VITE_USE_MOCK=true)
  await user.click(screen.getByText(/Kezdjük el/)) // active, current = Chest Supported Row (ex1)
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' })) // open ⋯
  await user.click(screen.getByText('Áthelyezés')) // reorder sub-view (remaining = ex2..ex5)
  await user.click(screen.getByRole('button', { name: 'Cable Pull-Around feljebb' })) // ex3 up → next becomes ex3
  await user.keyboard('{Escape}') // close the sheet
  // complete Chest Supported Row's 4 sets, then advance through the debrief
  for (let i = 0; i < 4; i++) await user.click(screen.getByText('Set kész'))
  await user.click(await screen.findByText('Mentés · tovább')) // debrief advance (non-last)
  // the next active exercise is now Cable Pull-Around (was Lat Pulldown before the reorder)
  expect(await screen.findByText('Cable Pull-Around')).toBeInTheDocument()
})

// ---- real-mode block: the session drives the T2 write endpoints ----

const REAL_MESO = {
  id: 'm-1', title: 'T2 meso', shortTitle: 'T2', status: 'active',
  startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 2,
  split: 'Pull / Push · 2×/hét', style: 'RP · 6 hét', phaseCurve: ['MEV', 'MAV'],
}
const REAL_TODAY = {
  templateSessionId: 'd-1', dayLabel: 'Ma', title: 'Pull Day', durationEst: 60,
  exercises: [
    { id: 'e-1', name: 'Chest Supported Row', muscle: 'back', sets: 2, targetReps: '8-10', targetRIR: 1, type: 'compound', lastWeek: { weightKg: 102.5, reps: 9, rir: 2 } },
  ],
  openWorkout: null as unknown,
}

function useRealHandlers(today: typeof REAL_TODAY, calls: string[]) {
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([REAL_MESO])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json(today)),
    http.post(`${API_BASE}/api/train/workouts`, async ({ request }) => {
      const body = (await request.json()) as { templateSessionId: string }
      calls.push(`start:${body.templateSessionId}`)
      return HttpResponse.json({ id: 'w-1', templateSessionId: body.templateSessionId, date: '2026-06-12', status: 'active', sets: [] }, { status: 201 })
    }),
    http.post(`${API_BASE}/api/train/workouts/:id/sets`, async ({ params, request }) => {
      const body = (await request.json()) as { exerciseId: string; setIndex: number; weightKg: number }
      calls.push(`set:${params.id}:${body.exerciseId}:${body.setIndex}:${body.weightKg}`)
      return HttpResponse.json({ id: 'st-' + body.setIndex, exerciseId: body.exerciseId, setIndex: body.setIndex }, { status: 201 })
    }),
    http.post(`${API_BASE}/api/train/workouts/:id/feedback`, ({ params }) => {
      calls.push(`feedback:${params.id}`)
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${API_BASE}/api/train/workouts/:id/finish`, ({ params }) => {
      calls.push(`finish:${params.id}`)
      return HttpResponse.json({ id: String(params.id), templateSessionId: 'd-1', date: '2026-06-12', status: 'completed', sets: [] })
    }),
  )
}

test('real mode: starting creates the instance and Set kész posts the set', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(REAL_TODAY, calls)
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(screen.getByText('Set kész'))
  await waitFor(() => expect(calls).toContain('set:w-1:e-1:0:102.5')) // prefill = last week
})

test('real mode: an open instance resumes mid-workout with seeded sets', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    {
      ...REAL_TODAY,
      openWorkout: {
        id: 'w-9', templateSessionId: 'd-1', date: '2026-06-12', status: 'active',
        sets: [{ id: 's-1', exerciseId: 'e-1', setIndex: 0, weightKg: 100, reps: 8, rir: 2 }],
      },
    },
    calls,
  )
  const user = userEvent.setup()
  setup()
  // no prep screen — jumps straight into the active phase at set 2
  expect(await screen.findByText('Set kész')).toBeInTheDocument()
  expect(screen.getByText(/Set 2\//)).toBeInTheDocument()
  await user.click(screen.getByText('Set kész'))
  await waitFor(() => expect(calls.some((c) => c.startsWith('set:w-9:e-1:1'))).toBe(true))
})

test('real mode: a hard reload on /train/session resumes instead of redirecting while queries load', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    {
      ...REAL_TODAY,
      openWorkout: {
        id: 'w-9', templateSessionId: 'd-1', date: '2026-06-12', status: 'active',
        sets: [{ id: 's-1', exerciseId: 'e-1', setIndex: 0, weightKg: 100, reps: 8, rir: 2 }],
      },
    },
    calls,
  )
  // Route-mounted render (like a fresh page load): if the guard redirects during
  // the pending query state, the router unmounts the session screen for good.
  const { routes } = await import('@/app/router')
  const { createMemoryRouter, RouterProvider } = await import('react-router-dom')
  const { ThemeProvider } = await import('@/app/ThemeProvider')
  const router = createMemoryRouter(routes, { initialEntries: ['/train/session'] })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  expect(await screen.findByText('Set kész')).toBeInTheDocument()
  expect(screen.getByText(/Set 2\//)).toBeInTheDocument() // resumed at the 2nd set
})

test('real mode: the last set debrief persists feedback and finish fires', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    { ...REAL_TODAY, exercises: [{ ...REAL_TODAY.exercises[0], sets: 1 }] },
    calls,
  )
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(screen.getByText('Set kész')) // only set -> FeedbackModal
  await user.click(await screen.findByText('Edzés vége →'))
  await waitFor(() => expect(calls).toContain('feedback:w-1'))
  await waitFor(() => expect(calls).toContain('finish:w-1'))
  expect(await screen.findByText(/Edzés vége ·/)).toBeInTheDocument() // WorkoutComplete
})
