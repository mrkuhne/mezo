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
import { BUDGET_GROUP_LABELS } from '@/features/train/logic/setBudget'

// Same lookup as MusclePriorityPicker.test.tsx — locates a tier row by its coarse-muscle group.
function tierRow(group: string) {
  const label = BUDGET_GROUP_LABELS[group] ?? group
  return screen.getByRole('group', { name: `${label} prioritás` })
}

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

test('Gyakorlatok view shows the hero, the set-budget card and the current day content', async () => {
  await renderExercisesView()
  expect(screen.getByText(/szett ma/)).toBeInTheDocument()
  expect(screen.getByText(/Heti terhelés:/)).toBeInTheDocument()
  expect(screen.getByText('Heti szetek · izmonként')).toBeInTheDocument()
  // current day (Csü · Pull) is the default active tab → its content shows. The mock
  // active meso's Csü day now also breaks the tightened 8-set session cap (mezo-d20.14),
  // so its aria-label carries the "· terhelés-jelzés" tab-dot suffix too — match by prefix.
  expect(screen.getByRole('button', { name: /^Csü · Pull/ })).toHaveAttribute('aria-pressed', 'true')
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

test('the Fókusz picker shows the meso\'s existing musclePriorities map, plus the GD7 helper line (mezo-3m5m)', async () => {
  // activeMeso (train.ts) carries musclePriorities: { shoulder: 'maintain' }.
  await renderExercisesView()
  await userEvent.click(screen.getByText('Fókusz'))
  expect(within(tierRow('shoulder')).getByRole('button', { name: 'Maintain' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(tierRow('back')).getByRole('button', { name: 'Grow' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('A módosítás a következő heti görgetésnél lép életbe.')).toBeInTheDocument()
})

test('changing a Fókusz tier fires the muscle-priorities PUT with the new sparse map, and MesoEditor receives it (mezo-3m5m)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const MESO_ID = 'b6f3a0e2-0000-4000-8000-0000000000aa'
  const DAY_ID = 'c6f3a0e2-0000-4000-8000-0000000000bb'
  const puts: { id: string; musclePriorities?: Record<string, string> | null }[] = []
  // musclePriorities is mutable so the GET handler's re-fetch (fired by the mutation's
  // onSuccess invalidate) reflects the just-written map — the same "hook's cache write
  // refreshes the view" contract mock mode gets from mockUpdateMusclePriorities.
  let musclePriorities: Record<string, string> | null = null
  const mesoFixture = () => ({
    id: MESO_ID, title: 'Valódi blokk', shortTitle: 'Valódi', status: 'active',
    startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 1,
    split: 'PPL', style: 'RP', phaseCurve: ['MEV'], musclePriorities,
    days: [{
      id: DAY_ID, day: 'Csü', type: 'Pull', muscle: 'back', exerciseCount: 1, current: true,
      exercises: [{ id: 'e-1', name: 'Chest Supported Row', muscle: 'back-mid', warmupSets: 2,
        workingSets: 4, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' }],
    }],
  })
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([mesoFixture()])),
    // The default msw handler for this endpoint echoes a THIN {id, musclePriorities} — this
    // test captures the full body instead (mirroring the real backend's full-response contract)
    // so the refetched GET above stays consistent.
    http.put(`${API_BASE}/api/train/mesocycles/:id/muscle-priorities`, async ({ params, request }) => {
      const body = (await request.json()) as { musclePriorities?: Record<string, string> | null }
      musclePriorities = body.musclePriorities ?? null
      puts.push({ id: String(params.id), musclePriorities: body.musclePriorities ?? null })
      return HttpResponse.json({ ...mesoFixture(), id: String(params.id) })
    }),
  )

  const router = createMemoryRouter(routes, { initialEntries: [`/train/mesocycles/${MESO_ID}`] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gyakorlatok' })).toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: 'Gyakorlatok' }))

  await userEvent.click(await screen.findByText('Fókusz'))
  await userEvent.click(within(tierRow('back')).getByRole('button', { name: 'Emphasize' }))

  await waitFor(() => expect(puts).toHaveLength(1))
  expect(puts[0].id).toBe(MESO_ID)
  expect(puts[0].musclePriorities).toEqual({ back: 'emphasize' })

  // MesoEditor received the map once the invalidated query refetches — the WeeklyBandsCard's
  // band row names the new tier for the 'back' group (wizard v2, mezo-d20.14).
  await waitFor(() => expect(screen.getByRole('group', { name: 'Hát · Emphasize' })).toBeInTheDocument())
})

test('two rapid Fókusz picks on different groups both persist, no clobber, aria-pressed flips immediately (mezo-3m5m final review, fix 2)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const MESO_ID = 'b6f3a0e2-0000-4000-8000-0000000000aa'
  const DAY_ID = 'c6f3a0e2-0000-4000-8000-0000000000bb'
  const puts: (Record<string, string> | null)[] = []
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([{
      id: MESO_ID, title: 'Valódi blokk', shortTitle: 'Valódi', status: 'active',
      startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 1,
      split: 'PPL', style: 'RP', phaseCurve: ['MEV'], musclePriorities: null,
      days: [{
        id: DAY_ID, day: 'Csü', type: 'Pull', muscle: 'back', exerciseCount: 1, current: true,
        exercises: [{ id: 'e-1', name: 'Chest Supported Row', muscle: 'back-mid', warmupSets: 2,
          workingSets: 4, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' }],
      }],
    }])),
    // Deliberate delay: the mutation's invalidate-only onSuccess must NOT have landed a
    // refetch before the second pick fires below — this is what pins the local-state fix
    // rather than a race that happens to resolve fast enough in CI.
    http.put(`${API_BASE}/api/train/mesocycles/:id/muscle-priorities`, async ({ request }) => {
      const body = (await request.json()) as { musclePriorities?: Record<string, string> | null }
      await new Promise((resolve) => setTimeout(resolve, 30))
      puts.push(body.musclePriorities ?? null)
      return HttpResponse.json({ id: MESO_ID, musclePriorities: body.musclePriorities ?? null })
    }),
  )

  const router = createMemoryRouter(routes, { initialEntries: [`/train/mesocycles/${MESO_ID}`] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gyakorlatok' })).toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: 'Gyakorlatok' }))
  await userEvent.click(await screen.findByText('Fókusz'))

  // Two rapid picks on different groups, back to back — no wait for the first PUT (still
  // in flight, delayed above) in between. The picker's `value` used to come straight from
  // the query-cache prop, which lags in real mode; two quick picks would both build off
  // the SAME stale map and the second onChange would full-replace away the first pick.
  await userEvent.click(within(tierRow('back')).getByRole('button', { name: 'Emphasize' }))
  await userEvent.click(within(tierRow('shoulder')).getByRole('button', { name: 'Maintain' }))

  // aria-pressed reflects both picks immediately, off local state — no refetch awaited above.
  expect(within(tierRow('back')).getByRole('button', { name: 'Emphasize' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(tierRow('shoulder')).getByRole('button', { name: 'Maintain' })).toHaveAttribute('aria-pressed', 'true')

  await waitFor(() => expect(puts).toHaveLength(2))
  // The second PUT is built from the LOCALLY merged map, so it carries BOTH picks — a
  // stale-cache-sourced merge would have dropped the first ('back') key here.
  expect(puts[1]).toEqual({ back: 'emphasize', shoulder: 'maintain' })
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
  // The accordion row starts collapsed — expand it before its steppers appear.
  await userEvent.click(await screen.findByRole('button', { name: 'Chest Supported Row · szerkesztés' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Chest Supported Row · Munkaszett növelése' }))
  await waitFor(() => expect(puts).toHaveLength(1))
  expect(puts[0].body[0].workingSets).toBe(5)
})
