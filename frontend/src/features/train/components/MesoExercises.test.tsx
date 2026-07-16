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

async function renderExercisesView() {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/train/mesocycles/${activeMeso.id}`],
  })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Gyakorlatok' }))
}

test('Gyakorlatok view shows the intro, day tabs and the current day content', async () => {
  await renderExercisesView()
  expect(screen.getByText('Heti gyakorlat-terv')).toBeInTheDocument()
  expect(screen.getByText('Heti szet-volumen')).toBeInTheDocument()
  // current day (Csü · Pull) is the default active tab → its content shows
  expect(screen.getByRole('button', { name: 'Csü · Pull' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
})

test('tab switch shows another day', async () => {
  await renderExercisesView()
  await userEvent.click(screen.getByRole('button', { name: 'Hét · Push' }))
  expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument()
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
  const puts: { url: string; body: { name: string; catalogId?: string }[] }[] = []
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
      puts.push({ url: `${params.id}/${params.dayId}`, body: (await request.json()) as { name: string; catalogId?: string }[] })
      return HttpResponse.json({ id: params.dayId, day: 'Csü', type: 'Pull', muscle: 'back', exerciseCount: 2, exercises: [] })
    }),
  )

  const router = createMemoryRouter(routes, { initialEntries: [`/train/mesocycles/${MESO_ID}`] })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gyakorlatok' })).toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: 'Gyakorlatok' }))
  await userEvent.click(await screen.findByRole('button', { name: /Gyakorlat hozzáadása/ }))
  const dialog = screen.getByRole('dialog')
  await userEvent.click(within(dialog).getByText('Hip Thrust'))

  await waitFor(() => expect(puts).toHaveLength(1))
  expect(puts[0].url).toBe(`${MESO_ID}/${DAY_ID}`)
  expect(puts[0].body.map((e) => e.name)).toEqual(['Chest Supported Row', 'Hip Thrust'])
  // The picked item carries the catalog uuid; the pre-existing row stays unlinked.
  expect(puts[0].body[1].catalogId).toBe('f1e3a0e2-0000-4000-8000-000000000071')
  expect(puts[0].body[0].catalogId).toBeUndefined()
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
  const router = createMemoryRouter(routes, { initialEntries: [`/train/mesocycles/${MESO_ID}`] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gyakorlatok' })).toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: 'Gyakorlatok' }))
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
  const router = createMemoryRouter(routes, { initialEntries: [`/train/mesocycles/${MESO_ID}`] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gyakorlatok' })).toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: 'Gyakorlatok' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Chest Supported Row · recept' }))
  await userEvent.click(screen.getByRole('button', { name: 'Working növelése' }))
  await waitFor(() => expect(puts).toHaveLength(1))
  expect(puts[0].body[0].workingSets).toBe(5)
})
