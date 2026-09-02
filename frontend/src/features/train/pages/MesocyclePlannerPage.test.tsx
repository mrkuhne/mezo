import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { MesocyclePlannerPage } from '@/features/train/pages/MesocyclePlannerPage'

afterEach(() => vi.unstubAllEnvs())

// The wizard calls useTrain/useMesoTemplates/useMesoPlanGenerate — a QueryClientProvider
// is required, and the real-mode paths need the router (they navigate on save).
// The step-flow tests pin the MOCK proposal (the FE skeleton's Upper/Lower split and its
// exercise picks), so they stub mock mode explicitly instead of inheriting the run mode.
function setup() {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/train/mesocycles/new']}>
        <MesocyclePlannerPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

/** Steps 0 -> 2. `fireEvent` for the last hop so the generating state is observable
 *  before the (microtask-fast) mock proposal lands. */
async function runWizardToProgram(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  fireEvent.click(screen.getByRole('button', { name: 'Tovább →' }))
}

test('step 0 asks the three questions and the day picker drives the split', async () => {
  const user = userEvent.setup()
  setup()
  // the three section cards
  expect(screen.getByText('Edzésnapok')).toBeInTheDocument()
  expect(screen.getByText('A célod · opcionális')).toBeInTheDocument()
  expect(screen.getByText('Ami magától megy')).toBeInTheDocument()
  // 4 recommended days: the count tile and the four chips are pressed (weekend included)
  expect(screen.getByRole('button', { name: '4 nap / hét', pressed: true })).toBeInTheDocument()
  for (const chip of ['H', 'Sze', 'P', 'Szo']) {
    expect(screen.getByRole('button', { name: chip, pressed: true })).toBeInTheDocument()
  }
  expect(screen.getByText('4 nap → Upper / Lower · minden izom 2×/hét')).toBeInTheDocument()
  // a different weekly count swaps in that pattern
  await user.click(screen.getByRole('button', { name: '2 nap / hét' }))
  expect(screen.getByRole('button', { name: 'H', pressed: true })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Cs', pressed: true })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sze', pressed: false })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Szo', pressed: false })).toBeInTheDocument()
  // Tovább -> Fókusz
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  expect(screen.getByText('Mire gyúr ez a blokk?')).toBeInTheDocument()
  expect(screen.getByText('02 / 03 · Fókusz')).toBeInTheDocument()
})

test('step 0 gate: fewer than two training days blocks Tovább', async () => {
  const user = userEvent.setup()
  setup()
  for (const chip of ['H', 'Sze', 'P']) await user.click(screen.getByRole('button', { name: chip }))
  expect(screen.getByText('Válassz 2–6 edzésnapot a folytatáshoz.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tovább →' })).toBeDisabled()
})

test('step 1: the tier picker moves the weekly set totals', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  const weekOne = () => Number(screen.getByText('szett · 1. hét').parentElement!.querySelector('b')!.textContent)
  const before = weekOne()
  await user.click(
    within(screen.getByRole('group', { name: 'Hát prioritás' })).getByRole('button', { name: 'Emphasize' }),
  )
  // Emphasize starts at MEV+2 — the same +2 the ramp adds every week
  expect(weekOne()).toBe(before + 2)
})

test('step 2 (mock): the orb, then the block — hero, day mosaic and the weekly bands, no percentages', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await runWizardToProgram(user)
  expect(screen.getByText('Mezo összerakja a blokkod…')).toBeInTheDocument()

  expect(await screen.findByDisplayValue('Hypertrophy · Ősz')).toBeInTheDocument()
  // one tile per training day, typed by the 4-day Upper/Lower split
  for (const name of ['Hét · Upper nap', 'Sze · Lower nap', 'Pén · Upper nap', 'Szo · Lower nap']) {
    expect(screen.getByRole('button', { name })).toBeInTheDocument()
  }
  expect(screen.getByLabelText('Heti szetek · izmonként')).toBeInTheDocument()
  // no percent text anywhere on the step (the bands are bars, not numbers)
  expect(container.textContent).not.toContain('%')
  // the save affordances live on this step — no extra Tovább
  expect(screen.getByRole('button', { name: /Mentés \+ indítás/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mentés sablonként' })).toBeInTheDocument()
})

test('a day tile opens its own page; an edit there arms the regenerate confirm strip', async () => {
  const user = userEvent.setup()
  setup()
  await runWizardToProgram(user)
  await screen.findByDisplayValue('Hypertrophy · Ősz')

  await user.click(screen.getByRole('button', { name: 'Hét · Upper nap' }))
  expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent('‹ Program')
  expect(screen.getByText('Upper nap')).toBeInTheDocument()

  // remove one exercise (accordion row -> its delete button)
  const rows = () => screen.getAllByRole('button', { name: /· szerkesztés$/ })
  const before = rows().length
  await user.click(rows()[0])
  await user.click(screen.getByRole('button', { name: /törlése$/ }))
  expect(rows()).toHaveLength(before - 1)

  await user.click(screen.getByRole('button', { name: 'Vissza' }))
  await user.click(screen.getByRole('button', { name: '↺ Újragenerálás' }))
  // an inline confirm — never window.confirm
  expect(screen.getByText('Kézzel szerkesztett napjaid vannak — az újragenerálás felülírja őket.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Mégse' }))
  expect(screen.queryByText('Kézzel szerkesztett napjaid vannak — az újragenerálás felülírja őket.')).toBeNull()
})

describe('real mode', () => {
  async function renderRealWizard(user: ReturnType<typeof userEvent.setup>) {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const router = createMemoryRouter(routes, { initialEntries: ['/train/mesocycles/new'] })
    render(
      <QueryWrapper>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryWrapper>,
    )
    await user.type(screen.getByLabelText('Mit szeretnél ebben a blokkban?'), 'röplabda mellett')
    await user.click(screen.getByRole('button', { name: 'Tovább →' }))
    await user.click(
      within(screen.getByRole('group', { name: 'Hát prioritás' })).getByRole('button', { name: 'Emphasize' }),
    )
    await user.click(screen.getByRole('button', { name: 'Tovább →' }))
    await screen.findByDisplayValue('Hypertrophy · Ősz')
    return router
  }

  test('„Mentés + indítás" posts the whole plan, starts it active today and lands on Gym', async () => {
    let posted: {
      days?: unknown[]; goalPreset?: string; musclePriorities?: Record<string, string> | null; notes?: string | null
    } | null = null
    let start: { startDate?: string; status?: string } | null = null
    server.use(
      http.post(`${API_BASE}/api/train/meso-templates`, async ({ request }) => {
        posted = (await request.json()) as typeof posted
        return HttpResponse.json({ id: 'e1f3a0e2-0000-4000-8000-00000000d00d', ...posted, runCount: 0 }, { status: 201 })
      }),
      http.post(`${API_BASE}/api/train/meso-templates/:id/start`, async ({ request }) => {
        start = (await request.json()) as typeof start
        return HttpResponse.json({
          id: 'b6f3a0e2-0000-4000-8000-00000000d00d', templateId: 'e1f3a0e2-0000-4000-8000-00000000d00d',
          title: 'Teszt', shortTitle: 'Teszt', status: start!.status, startDate: start!.startDate,
          endDate: start!.startDate, weeks: 6, currentWeek: 1, split: '', style: '', phaseCurve: ['MEV'],
        })
      }),
    )
    const user = userEvent.setup()
    const router = await renderRealWizard(user)

    await user.click(screen.getByRole('button', { name: /Mentés \+ indítás/ }))

    await waitFor(() => expect(start).not.toBeNull())
    expect(posted!.days).toHaveLength(7) // rest days travel too
    expect(posted!.goalPreset).toBe('hypertrophy')
    expect(posted!.musclePriorities).toEqual({ back: 'emphasize' })
    expect(posted!.notes).toBe('röplabda mellett')
    expect(start!.status).toBe('active')
    await waitFor(() => expect(router.state.location.pathname).toBe('/train/gym'))
  })

  test('„Mentés sablonként" only creates the template and lands on the library', async () => {
    let startCalls = 0
    server.use(
      http.post(`${API_BASE}/api/train/meso-templates`, async ({ request }) =>
        HttpResponse.json({ id: 'e1f3a0e2-0000-4000-8000-00000000d00d', ...(await request.json() as object), runCount: 0 }, { status: 201 })),
      http.post(`${API_BASE}/api/train/meso-templates/:id/start`, () => {
        startCalls += 1
        return new HttpResponse(null, { status: 500 })
      }),
    )
    const user = userEvent.setup()
    const router = await renderRealWizard(user)

    await user.click(screen.getByRole('button', { name: 'Mentés sablonként' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/train/mesocycles'))
    expect(startCalls).toBe(0)
  })

  test('a failed create keeps the wizard on the Program step, buttons live', async () => {
    server.use(http.post(`${API_BASE}/api/train/meso-templates`, () => new HttpResponse(null, { status: 500 })))
    const user = userEvent.setup()
    const router = await renderRealWizard(user)

    await user.click(screen.getByRole('button', { name: 'Mentés sablonként' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Mentés sablonként' })).toBeEnabled())
    expect(router.state.location.pathname).toBe('/train/mesocycles/new')
  })

  test('a failed generation renders a retry state, never a blank body', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(http.post(`${API_BASE}/api/train/meso-plans/generate`, () => new HttpResponse(null, { status: 500 })))
    const user = userEvent.setup()
    render(
      <QueryWrapper>
        <MemoryRouter initialEntries={['/train/mesocycles/new']}>
          <MesocyclePlannerPage />
        </MemoryRouter>
      </QueryWrapper>,
    )
    await user.click(screen.getByRole('button', { name: 'Tovább →' }))
    await user.click(screen.getByRole('button', { name: 'Tovább →' }))

    expect(await screen.findByText('Nem sikerült a generálás — próbáld újra.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '↺ Újrapróbálom' })).toBeInTheDocument()
  })
})
