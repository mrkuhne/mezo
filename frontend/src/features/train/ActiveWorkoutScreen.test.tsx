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

test('＋ Szett adds an extra set: dots grow 4→5 with a dashed extra dot and the header reads /5', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))          // active, current = Chest Supported Row (4 planned sets)
  expect(screen.getByText(/Set 1\/4/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('＋ Szett'))             // adds one extra set; sheet closes
  expect(screen.getByText(/Set 1\/5/)).toBeInTheDocument()
  const dots = document.querySelectorAll('.set-dot')
  expect(dots).toHaveLength(5)
  expect(document.querySelectorAll('.set-dot.extra')).toHaveLength(1) // only the 5th is extra
})

test('⋯ Kihagyás advances to the next exercise without opening the debrief', async () => {
  const user = userEvent.setup()
  setup() // mock mode, current = Chest Supported Row (ex1)
  await user.click(screen.getByText(/Kezdjük el/))
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Kihagyás'))
  // Advances straight to the next exercise — no FeedbackModal / debrief CTA.
  expect(await screen.findByText('Lat Pulldown · Pronated')).toBeInTheDocument()
  expect(screen.queryByText('Mentés · tovább')).not.toBeInTheDocument()
  expect(screen.queryByText('Edzés vége →')).not.toBeInTheDocument()
})

test('a skipped exercise is marked "kihagyva" in the recap', async () => {
  const user = userEvent.setup()
  setup() // mock mode, 5 exercises, current = Chest Supported Row (ex1)
  await user.click(screen.getByText(/Kezdjük el/))
  // Skip the first exercise.
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Kihagyás'))
  expect(await screen.findByText('Lat Pulldown · Pronated')).toBeInTheDocument()
  // Drive the remaining 4 exercises to completion (each: log all 3 sets, then
  // resolve the debrief). The last debrief CTA reads "Edzés vége →" and finishes.
  for (let ex = 0; ex < 4; ex++) {
    for (let s = 0; s < 3; s++) await user.click(screen.getByText('Set kész'))
    const cta = await screen.findByText(/Mentés · tovább|Edzés vége →/)
    await user.click(cta) // close() runs the Sheet slide-down, then onResolve advances
    if (ex < 3) await screen.findByText(/Set 1\/\d/) // wait for the next exercise's panel
  }
  // WorkoutComplete recap: the skipped first exercise reads "kihagyva".
  expect(await screen.findByText('kihagyva')).toBeInTheDocument()
})

// ---- F4 note: durable per-exercise note pill + editor (mock-mode) ----

test('mock mode: no note pill on the active card when the exercise has no note', async () => {
  const user = userEvent.setup()
  setup() // mock exercises carry no note
  await user.click(screen.getByText(/Kezdjük el/))
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
  expect(screen.queryByLabelText('Gyakorlat-jegyzet')).not.toBeInTheDocument()
})

test('mock mode: editing a note via ⋯ → Jegyzet renders the note pill with the typed text', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Jegyzet'))
  const textarea = await screen.findByLabelText('Gyakorlat-jegyzet szerkesztése')
  await user.type(textarea, 'Lassú excentrikus')
  await user.click(screen.getByText('Mentés'))
  const pill = await screen.findByLabelText('Gyakorlat-jegyzet')
  expect(pill).toHaveTextContent('Lassú excentrikus')
})

test('mock mode: clearing the note via the editor removes the pill', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // 1. add a note → the pill renders with the typed text.
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Jegyzet'))
  const textarea = await screen.findByLabelText('Gyakorlat-jegyzet szerkesztése')
  await user.type(textarea, 'Lassú excentrikus')
  await user.click(screen.getByText('Mentés'))
  expect(await screen.findByLabelText('Gyakorlat-jegyzet')).toHaveTextContent('Lassú excentrikus')
  // 2. reopen the editor (row label now reads "Jegyzet szerkesztése"), empty it, save.
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Jegyzet szerkesztése'))
  const reopened = await screen.findByLabelText('Gyakorlat-jegyzet szerkesztése')
  await user.clear(reopened)
  await user.click(screen.getByText('Mentés'))
  // 3. the pill is gone — clearing to empty hides it (effectiveNote falls to '').
  await waitFor(() => expect(screen.queryByLabelText('Gyakorlat-jegyzet')).not.toBeInTheDocument())
})

// ---- real-mode block: the session drives the T2 write endpoints ----

const REAL_MESO = {
  id: 'm-1', title: 'T2 meso', shortTitle: 'T2', status: 'active',
  startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 2,
  split: 'Pull / Push · 2×/hét', style: 'RP · 6 hét', phaseCurve: ['MEV', 'MAV'],
}
type RealExercise = {
  id: string; name: string; muscle: string; sets: number; targetReps: string
  targetRIR: number; type: string; note?: string | null
  lastWeek: { weightKg: number; reps: number; rir: number }
}
const REAL_TODAY = {
  templateSessionId: 'd-1', dayLabel: 'Ma', title: 'Pull Day', durationEst: 60,
  exercises: [
    { id: 'e-1', name: 'Chest Supported Row', muscle: 'back', sets: 2, targetReps: '8-10', targetRIR: 1, type: 'compound', lastWeek: { weightKg: 102.5, reps: 9, rir: 2 } },
  ] as RealExercise[],
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
    http.post(`${API_BASE}/api/train/workouts/:id/skip`, async ({ params, request }) => {
      const body = (await request.json()) as { exerciseId: string }
      calls.push(`skip:${params.id}:${body.exerciseId}`)
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${API_BASE}/api/train/workouts/:id/feedback`, ({ params }) => {
      calls.push(`feedback:${params.id}`)
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${API_BASE}/api/train/workouts/:id/finish`, ({ params }) => {
      calls.push(`finish:${params.id}`)
      return HttpResponse.json({ id: String(params.id), templateSessionId: 'd-1', date: '2026-06-12', status: 'completed', sets: [] })
    }),
    http.put(`${API_BASE}/api/train/exercises/:exerciseId/note`, async ({ params, request }) => {
      const body = (await request.json()) as { note?: string | null }
      calls.push(`note:${params.exerciseId}:${body.note ?? ''}`)
      return new HttpResponse(null, { status: 204 })
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

test('real mode: ＋ Szett grows a 1-set exercise to 2 and the extra set posts with setIndex 1', async () => {
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
  expect(screen.getByText(/Set 1\/1/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('＋ Szett')) // 1 planned set -> 2 effective
  expect(screen.getByText(/Set 1\/2/)).toBeInTheDocument() // the extra set grew the count to 2
  await user.click(screen.getByText('Set kész')) // set 1 (setIndex 0)
  expect(screen.getByText(/Set 2\/2/)).toBeInTheDocument() // still mid-exercise, not overflowed
  await user.click(screen.getByText('Set kész')) // extra set (setIndex 1) -> last set, opens FeedbackModal
  await waitFor(() => expect(calls.some((c) => c.startsWith('set:w-1:e-1:1'))).toBe(true))
})

test('real mode: ⋯ Kihagyás POSTs the skip for the current exercise', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  // Two exercises so the skip advances (not finishes) and the POST is isolated.
  useRealHandlers(
    {
      ...REAL_TODAY,
      exercises: [
        REAL_TODAY.exercises[0],
        { id: 'e-2', name: 'Lat Pulldown · Pronated', muscle: 'lats', sets: 2, targetReps: '10-12', targetRIR: 2, type: 'compound', lastWeek: { weightKg: 72, reps: 11, rir: 2 } },
      ],
    },
    calls,
  )
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Kihagyás'))
  await waitFor(() => expect(calls).toContain('skip:w-1:e-1'))
  expect(await screen.findByText('Lat Pulldown · Pronated')).toBeInTheDocument()
})

test('real mode: a /today exercise WITH a note renders the pill on the active card', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    { ...REAL_TODAY, exercises: [{ ...REAL_TODAY.exercises[0], note: '4-es ülés' }] },
    calls,
  )
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  const pill = await screen.findByLabelText('Gyakorlat-jegyzet')
  expect(pill).toHaveTextContent('4-es ülés')
})

test('real mode: editing + saving a note PUTs it for the current exercise', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(REAL_TODAY, calls)
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Jegyzet'))
  const textarea = await screen.findByLabelText('Gyakorlat-jegyzet szerkesztése')
  await user.type(textarea, 'Tartsd a könyököt')
  await user.click(screen.getByText('Mentés'))
  await waitFor(() => expect(calls).toContain('note:e-1:Tartsd a könyököt'))
  const pill = await screen.findByLabelText('Gyakorlat-jegyzet')
  expect(pill).toHaveTextContent('Tartsd a könyököt')
})

// --- F2 add-set: optional "Minden hétre" template write (reuses the day-exercises PUT) ---

const TEMPLATE_MESO_ID = 'b6f3a0e2-0000-4000-8000-0000000000aa'
const TEMPLATE_DAY_ID = 'c6f3a0e2-0000-4000-8000-0000000000bb'

// A meso whose template day CONTAINS the workout's current exercise (id 'e-1'),
// so the screen can resolve the day from the current exercise and bump its set count.
function useTemplateWriteHandlers(puts: { url: string; body: { name: string; sets: number }[] }[]) {
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () =>
      HttpResponse.json([
        {
          id: TEMPLATE_MESO_ID, title: 'T2 meso', shortTitle: 'T2', status: 'active',
          startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 2,
          split: 'PPL', style: 'RP', phaseCurve: ['MEV', 'MAV'],
          days: [
            {
              id: TEMPLATE_DAY_ID, day: 'Csü', type: 'Pull', muscle: 'back', exerciseCount: 1, current: true,
              exercises: [
                { id: 'e-1', name: 'Chest Supported Row', muscle: 'back-mid', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound' },
              ],
            },
          ],
        },
      ]),
    ),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () =>
      HttpResponse.json({
        templateSessionId: 'd-1', dayLabel: 'Ma', title: 'Pull Day', durationEst: 60,
        exercises: [
          { id: 'e-1', name: 'Chest Supported Row', muscle: 'back-mid', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound', lastWeek: { weightKg: 102.5, reps: 9, rir: 2 } },
        ],
        openWorkout: null,
      }),
    ),
    http.post(`${API_BASE}/api/train/workouts`, async ({ request }) => {
      const body = (await request.json()) as { templateSessionId: string }
      return HttpResponse.json({ id: 'w-1', templateSessionId: body.templateSessionId, date: '2026-06-12', status: 'active', sets: [] }, { status: 201 })
    }),
    http.put(`${API_BASE}/api/train/mesocycles/:id/days/:dayId/exercises`, async ({ request, params }) => {
      puts.push({ url: `${params.id}/${params.dayId}`, body: (await request.json()) as { name: string; sets: number }[] })
      return HttpResponse.json({ id: params.dayId, day: 'Csü', type: 'Pull', muscle: 'back', exerciseCount: 1, exercises: [] })
    }),
  )
}

test('real mode: add-set "Minden hétre" PUTs the day with the current exercise sets bumped by 1', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const puts: { url: string; body: { name: string; sets: number }[] }[] = []
  useTemplateWriteHandlers(puts)
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('＋ Szett'))
  await user.click(await screen.findByText('Minden hétre'))
  await waitFor(() => expect(puts).toHaveLength(1))
  expect(puts[0].url).toBe(`${TEMPLATE_MESO_ID}/${TEMPLATE_DAY_ID}`)
  expect(puts[0].body.find((e) => e.name === 'Chest Supported Row')?.sets).toBe(5) // 4 -> 5
})

test('real mode: add-set "Csak ma" fires no template PUT', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const puts: { url: string; body: { name: string; sets: number }[] }[] = []
  useTemplateWriteHandlers(puts)
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('＋ Szett'))
  await user.click(await screen.findByText('Csak ma'))
  await new Promise((r) => setTimeout(r, 0))
  expect(puts).toHaveLength(0)
})
