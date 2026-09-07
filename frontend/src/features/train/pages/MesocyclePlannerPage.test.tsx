import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { MesocyclePlannerPage } from '@/features/train/pages/MesocyclePlannerPage'

// The wizard's default name is `Hypertrophy · {season}`, derived from the real clock — so the
// whole file pins the clock to an autumn day (mezo-d20.14 review, I1). ONLY `Date` is faked:
// Testing Library's findBy*/waitFor and MSW need real timers.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-02T10:00:00'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

// The wizard calls useTrain/useMesoTemplates/useMesoPlanGenerate — a QueryClientProvider
// is required, and the real-mode paths need the router (they navigate on save).
// The interview tests pin the MOCK proposal (the FE skeleton's Upper/Lower split and its
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

/** The interview is one screen now (mezo-yty6) — generation is the only hop. */
async function generate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Program generálása/ }))
}

test('the interview asks everything on one screen', async () => {
  const user = userEvent.setup()
  setup()
  expect(screen.getByText('Edzésnapok')).toBeInTheDocument()
  expect(screen.getByText('A célod · opcionális')).toBeInTheDocument()
  expect(screen.getByText('Fókusz · max 2 hangsúly')).toBeInTheDocument()
  expect(screen.getByText('Ami magától megy')).toBeInTheDocument()
  // the retired 3-step chrome must not come back
  expect(screen.queryByRole('button', { name: 'Tovább →' })).not.toBeInTheDocument()

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
})

test('the tier picker on the same screen moves the weekly set totals', async () => {
  const user = userEvent.setup()
  setup()
  const weekOne = () => Number(screen.getByText('szett · 1. hét').parentElement!.querySelector('b')!.textContent)
  const before = weekOne()
  await user.click(
    within(screen.getByRole('group', { name: 'Hát prioritás' })).getByRole('button', { name: 'Emphasize' }),
  )
  // Emphasize starts at MEV+2 — the same +2 the ramp adds every week
  expect(weekOne()).toBe(before + 2)
})

// mezo-yty6 fix round 1: the Hossz control was missing, pinning every block at 6 weeks.
test('picking a block length dispatches setWeeks and updates the derived ramp/deload copy', async () => {
  const user = userEvent.setup()
  setup()
  expect(screen.getByText('6 hét = 5 rámpa + 1 deload')).toBeInTheDocument()
  expect(screen.getByText('5 + 1')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '8 hét' }))
  expect(screen.getByText('8 hét = 7 rámpa + 1 deload')).toBeInTheDocument()
  expect(screen.getByText('7 + 1')).toBeInTheDocument()
})

test('fewer than two training days blocks the generate CTA', async () => {
  const user = userEvent.setup()
  setup()
  for (const chip of ['H', 'Sze', 'P']) await user.click(screen.getByRole('button', { name: chip }))
  expect(screen.getByText('Válassz 2–6 edzésnapot a folytatáshoz.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Program generálása/ })).toBeDisabled()
})

test('generating lands in the unified editor with the day strip', async () => {
  const user = userEvent.setup()
  setup()
  await generate(user)
  expect(await screen.findByRole('textbox', { name: 'Mezociklus neve' })).toHaveValue('Hypertrophy · Ősz')
  expect(screen.getByText('A heted · koppints egy napra')).toBeInTheDocument()
  expect(screen.getByText('Vázlat · még nincs mentve')).toBeInTheDocument()
  // one tile per TRAINING day, typed by the 4-day Upper/Lower split (rest days stay out
  // of the strip but still travel in the save)
  for (const name of ['Hét · Upper · szerkesztés', 'Sze · Lower · szerkesztés']) {
    expect(screen.getByRole('button', { name })).toBeInTheDocument()
  }
  // the save affordances live in the editor's footer slot
  expect(screen.getByRole('button', { name: /Mentés \+ indítás/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mentés sablonként' })).toBeInTheDocument()
})

test('a day opens its editor and the day name is renameable', async () => {
  const user = userEvent.setup()
  setup()
  await generate(user)
  const tile = (await screen.findAllByRole('button', { name: /· szerkesztés$/ }))[0]
  await user.click(tile)
  const nameField = await screen.findByRole('textbox', { name: /nap neve$/ })
  await user.clear(nameField)
  await user.type(nameField, 'Húzónap')
  expect(nameField).toHaveValue('Húzónap')
})

// mezo-d20.14 review: regenerating over hand-edited days used to silently destroy them.
// The affordance is inline — never window.confirm.
test('regenerating over manual edits asks first', async () => {
  const user = userEvent.setup()
  setup()
  await generate(user)
  await screen.findByRole('textbox', { name: 'Mezociklus neve' })

  await user.click(screen.getAllByRole('button', { name: /· szerkesztés$/ })[0])
  await user.click(screen.getAllByRole('button', { name: /törlése$/ })[0])
  await user.click(screen.getByRole('button', { name: 'Vissza' }))

  await user.click(screen.getByRole('button', { name: '↺ Újragenerálás' }))
  const warning = 'Kézzel szerkesztett napjaid vannak — az újragenerálás felülírja őket.'
  expect(screen.getByText(warning)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Mégse' }))
  expect(screen.queryByText(warning)).toBeNull()
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
    // Everything the wizard asks now lives on ONE screen: the goal text and the tier rows.
    await user.type(screen.getByLabelText('Mit szeretnél ebben a blokkban?'), 'röplabda mellett')
    await user.click(
      within(screen.getByRole('group', { name: 'Hát prioritás' })).getByRole('button', { name: 'Emphasize' }),
    )
    await generate(user)
    await screen.findByRole('textbox', { name: 'Mezociklus neve' })
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

  test('a failed create keeps the wizard in the editor, buttons live', async () => {
    server.use(http.post(`${API_BASE}/api/train/meso-templates`, () => new HttpResponse(null, { status: 500 })))
    const user = userEvent.setup()
    const router = await renderRealWizard(user)

    await user.click(screen.getByRole('button', { name: 'Mentés sablonként' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Mentés sablonként' })).toBeEnabled())
    expect(router.state.location.pathname).toBe('/train/mesocycles/new')
  })

  // I4: a failed RE-generation used to replace the whole body with the retry screen, stranding
  // an existing (possibly hand-edited) draft.
  test('a failed RE-generation keeps the standing program and shows an inline error strip', async () => {
    const user = userEvent.setup()
    await renderRealWizard(user)
    const tiles = () => screen.getAllByRole('button', { name: /· szerkesztés$/ })
    const before = tiles().length
    expect(before).toBeGreaterThan(0)

    server.use(http.post(`${API_BASE}/api/train/meso-plans/generate`, () => new HttpResponse(null, { status: 500 })))
    await user.click(screen.getByRole('button', { name: '↺ Újragenerálás' }))

    expect(await screen.findByText('Nem sikerült az újragenerálás — a korábbi program megmaradt.')).toBeInTheDocument()
    expect(tiles()).toHaveLength(before)
    expect(screen.queryByText('Nem sikerült a generálás — próbáld újra.')).toBeNull()
    // Mégse clears the strip; the program stays
    await user.click(screen.getByRole('button', { name: 'Mégse' }))
    expect(screen.queryByText('Nem sikerült az újragenerálás — a korábbi program megmaradt.')).toBeNull()
    expect(tiles()).toHaveLength(before)
  })

  // mezo-yty6 fix round 1: picking a length before generating must reach the save payload.
  test('a picked block length travels to the real-mode save payload', async () => {
    let posted: { weeks?: number; phaseCurve?: unknown[] } | null = null
    server.use(
      http.post(`${API_BASE}/api/train/meso-templates`, async ({ request }) => {
        posted = (await request.json()) as typeof posted
        return HttpResponse.json({ id: 'e1f3a0e2-0000-4000-8000-00000000d00d', ...posted, runCount: 0 }, { status: 201 })
      }),
    )
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const user = userEvent.setup()
    render(
      <QueryWrapper>
        <MemoryRouter initialEntries={['/train/mesocycles/new']}>
          <MesocyclePlannerPage />
        </MemoryRouter>
      </QueryWrapper>,
    )
    await user.click(screen.getByRole('button', { name: '8 hét' }))
    await generate(user)
    await screen.findByRole('textbox', { name: 'Mezociklus neve' })

    await user.click(screen.getByRole('button', { name: 'Mentés sablonként' }))

    await waitFor(() => expect(posted).not.toBeNull())
    expect(posted!.weeks).toBe(8)
    expect(posted!.phaseCurve).toHaveLength(8)
  })

  test('a failed FIRST generation renders a retry state, never a blank body', async () => {
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
    await generate(user)

    expect(await screen.findByText('Nem sikerült a generálás — próbáld újra.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '↺ Újrapróbálom' })).toBeInTheDocument()
    // the interview itself is still there to edit — never a blank body
    expect(screen.getByText('Edzésnapok')).toBeInTheDocument()
  })
})
