import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { activeMeso } from '@/data/train/train'

// Asserts Phase-1 mock meso data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

// The editor's own surface is the DAY page now (mezo-d20.15): the run page is status-first
// and `MesoExercises` renders one day, reached at its own route.
function renderDay(mesoId: string, day = 'Csü') {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/train/mesocycles/${mesoId}/days/${encodeURIComponent(day)}`],
  })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  return router
}

async function renderExercisesView() {
  renderDay(activeMeso.id)
  await screen.findByText('Chest Supported Row')
}

test('the day editor shows the hero, the weekly band card and that day\'s exercises', async () => {
  await renderExercisesView()
  expect(screen.getByText(/szett ma/)).toBeInTheDocument()
  expect(screen.getByText(/Heti terhelés:/)).toBeInTheDocument()
  // The week-scope card is still week-scope on a one-day page (weekDays), never a
  // single Thursday pretending to be the week.
  expect(screen.getByText('Heti szetek · izmonként')).toBeInTheDocument()
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
})

test('another day is a different page — its exercises are not in this one', async () => {
  await renderExercisesView()
  expect(screen.queryByText('Barbell Bench Press')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Hét · Push' })).not.toBeInTheDocument()
})

test('+ Gyakorlat hozzáadása opens the exercise picker', async () => {
  await renderExercisesView()
  // The current day is expanded by default → its add button is present.
  await userEvent.click(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ }))
  expect(screen.getByText('Mit pakolunk be?')).toBeInTheDocument()
})

test('picking an exercise appends it to the open day', async () => {
  await renderExercisesView()
  await userEvent.click(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ }))
  const dialog = screen.getByRole('dialog')
  // Pick the library row — the picker now stays open for multi-add, so close it explicitly.
  await userEvent.click(within(dialog).getByText('Hip Thrust'))
  await userEvent.click(within(dialog).getByRole('button', { name: /^Kész/ }))
  // The Sheet dismisses with a slide-down animation, so it unmounts async.
  await waitFor(() => expect(screen.queryByText('Mit pakolunk be?')).not.toBeInTheDocument())
  // The new exercise now appears in the day list.
  expect(screen.getByText('Hip Thrust')).toBeInTheDocument()
})

test('adding an exercise persists the day list in real mode (PUT with day id)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false') // override the file-level mock pin
  const puts: { url: string; body: { name: string; catalogId?: string; targetRIR: number; warmupSets: number }[] }[] = []
  const MESO_ID = 'b6f3a0e2-0000-4000-8000-0000000000aa'
  const DAY_ID = 'c6f3a0e2-0000-4000-8000-0000000000bb'
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () =>
      HttpResponse.json([
        {
          id: MESO_ID, title: 'Valódi blokk', shortTitle: 'Valódi', status: 'active',
          startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 1,
          split: 'PPL', style: 'RP', phaseCurve: ['MEV'],
          days: [{
            id: DAY_ID, day: 'Csü', type: 'Pull', muscle: 'back', exerciseCount: 1, current: true,
            exercises: [{ id: 'e-1', name: 'Chest Supported Row', muscle: 'back-mid', warmupSets: 2,
              workingSets: 4, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' }],
          }],
        },
      ]),
    ),
    http.put(`${API_BASE}/api/train/mesocycles/:id/days/:dayId/exercises`, async ({ request, params }) => {
      puts.push({ url: `${params.id}/${params.dayId}`, body: (await request.json()) as { name: string; catalogId?: string; targetRIR: number; warmupSets: number }[] })
      return HttpResponse.json({ id: params.dayId, day: 'Csü', type: 'Pull', muscle: 'back', exerciseCount: 2, exercises: [] })
    }),
  )

  renderDay(MESO_ID)
  await userEvent.click(await screen.findByRole('button', { name: /Gyakorlat hozzáadása/ }))
  const dialog = screen.getByRole('dialog')
  await userEvent.click(within(dialog).getByText('Hip Thrust'))

  // addExerciseWithDefaults (mezo-dq60) now computes the adaptive warmup
  // suggestion at insert time, so MesoEditor's own auto-expand effect
  // (mezo-dnln) finds no diff to correct and fires no second PUT — just one.
  await waitFor(() => expect(puts).toHaveLength(1))
  expect(puts[0].url).toBe(`${MESO_ID}/${DAY_ID}`)
  expect(puts[0].body.map((e) => e.name)).toEqual(['Chest Supported Row', 'Hip Thrust'])
  // The picked item carries the catalog uuid; the pre-existing row stays unlinked.
  expect(puts[0].body[1].catalogId).toBe('f1e3a0e2-0000-4000-8000-000000000071')
  expect(puts[0].body[0].catalogId).toBeUndefined()
  // New adds default to the mesocycle's goal preset (Valódi blokk carries no
  // goalPreset in this fixture → falls back to hypertrophy: compound RIR1);
  // the pre-existing row keeps its own RIR.
  expect(puts[0].body[1].targetRIR).toBe(1)
  expect(puts[0].body[0].targetRIR).toBe(1)
  // Hip Thrust (glute, compound) opens a fresh budget group on this day (the
  // pre-existing row is 'back') → suggestedWarmupSets = 3, applied directly
  // by addExerciseWithDefaults.
  expect(puts[0].body[1].warmupSets).toBe(3)
})




test('reordering a day exercise via ▲ persists the new order (PUT) in real mode', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const puts: { body: { name: string }[] }[] = []
  const MESO_ID = 'b6f3a0e2-0000-4000-8000-0000000000aa'
  const DAY_ID = 'c6f3a0e2-0000-4000-8000-0000000000bb'
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([{
      id: MESO_ID, title: 'Valódi blokk', shortTitle: 'Valódi', status: 'active',
      startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 1,
      split: 'PPL', style: 'RP', phaseCurve: ['MEV'],
      days: [{ id: DAY_ID, day: 'Csü', type: 'Pull', muscle: 'back', exerciseCount: 2, current: true,
        exercises: [
          { id: 'e-1', name: 'Chest Supported Row', muscle: 'back-mid', warmupSets: 2, workingSets: 4, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' },
          { id: 'e-2', name: 'Lat Pulldown', muscle: 'back', warmupSets: 2, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, type: 'compound' },
        ] }],
    }])),
    http.put(`${API_BASE}/api/train/mesocycles/:id/days/:dayId/exercises`, async ({ request }) => {
      puts.push({ body: (await request.json()) as { name: string }[] })
      return HttpResponse.json({ id: DAY_ID, day: 'Csü', type: 'Pull', muscle: 'back', exerciseCount: 2, exercises: [] })
    }),
  )
  renderDay(MESO_ID)
  // move the 2nd exercise up → order becomes [Lat Pulldown, Chest Supported Row]
  await userEvent.click(await screen.findByRole('button', { name: 'Lat Pulldown feljebb' }))
  await waitFor(() => expect(puts).toHaveLength(1))
  expect(puts[0].body.map((e) => e.name)).toEqual(['Lat Pulldown', 'Chest Supported Row'])
})

test('recipe stepper change persists the day list (PUT) in real mode', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const puts: { body: { name: string; workingSets: number }[] }[] = []
  const MESO_ID = 'b6f3a0e2-0000-4000-8000-0000000000aa'
  const DAY_ID = 'c6f3a0e2-0000-4000-8000-0000000000bb'
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([{
      id: MESO_ID, title: 'Valódi blokk', shortTitle: 'Valódi', status: 'active',
      startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 1,
      split: 'PPL', style: 'RP', phaseCurve: ['MEV'],
      days: [{ id: DAY_ID, day: 'Csü', type: 'Pull', muscle: 'back', exerciseCount: 1, current: true,
        exercises: [{ id: 'e-1', name: 'Chest Supported Row', muscle: 'back-mid', warmupSets: 2,
          workingSets: 4, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' }] }],
    }])),
    http.put(`${API_BASE}/api/train/mesocycles/:id/days/:dayId/exercises`, async ({ request }) => {
      puts.push({ body: (await request.json()) as { name: string; workingSets: number }[] })
      return HttpResponse.json({ id: DAY_ID, day: 'Csü', type: 'Pull', muscle: 'back', exerciseCount: 1, exercises: [] })
    }),
  )
  renderDay(MESO_ID)
  // The accordion row starts collapsed — expand it before its steppers appear.
  await userEvent.click(await screen.findByRole('button', { name: 'Chest Supported Row · szerkesztés' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Chest Supported Row · Munkaszett növelése' }))
  await waitFor(() => expect(puts).toHaveLength(1))
  expect(puts[0].body[0].workingSets).toBe(5)
})
