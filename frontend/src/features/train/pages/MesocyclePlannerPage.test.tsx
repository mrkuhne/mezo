import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { trainApi } from '@/data/train/trainApi'
import { MesocyclePlannerPage } from '@/features/train/pages/MesocyclePlannerPage'

afterEach(() => vi.unstubAllEnvs())

// The planner now calls useTrain (mutations), so a QueryClientProvider is required.
function setup() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/train/mesocycles/new']}>
        <MesocyclePlannerPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('step 0 shows the goal-picker title and the goal presets', () => {
  setup()
  expect(screen.getByText('Mit szeretnénk építeni?')).toBeInTheDocument()
  expect(screen.getByText('Hypertrophy')).toBeInTheDocument()
  expect(screen.getByText('Sport-specific')).toBeInTheDocument()
})

test('selecting Hypertrophy then Tovább advances to step 1', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  expect(screen.getByText('Mennyi időnk van?')).toBeInTheDocument()
})

// Prototype fidelity (meso-body.html PSTYLE): the tappable phase curve reads at a glance
// because MEV/MAV/MRV/Deload each carry a visually distinct hue — three near-identical
// coral tones would defeat the point of a scannable curve.
test('phase curve bars carry visually distinct colors per phase', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  const mev = screen.getByRole('button', { name: 'W1 · MEV · fázis váltás' })
  const mav = screen.getByRole('button', { name: 'W3 · MAV · fázis váltás' })
  const mrv = screen.getByRole('button', { name: 'W5 · MRV · fázis váltás' })
  const deload = screen.getByRole('button', { name: 'W6 · Deload · fázis váltás' })
  const colors = [mev, mav, mrv, deload].map((el) => el.style.background)
  expect(new Set(colors).size).toBe(4)
})

// Walks the wizard to its terminal step in real mode and returns the router (so the
// landing route can be asserted) — shared by the three save-path tests below.
async function runWizardToTerminalStep(user: ReturnType<typeof userEvent.setup>) {
  const router = createMemoryRouter(routes, { initialEntries: ['/train/mesocycles/new'] })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  // step 1: set a real start date through the date picker
  const dateInput = screen.getByLabelText('Kezdés dátuma')
  await user.clear(dateInput)
  await user.type(dateInput, '2026-06-16')
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  // step 2 -> step 3 (Fókusz — always passable, no-touch walk-through)
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  // step 3 -> step 4 (Program — terminal step, save buttons live here)
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  // step 4: wait out the 600ms generate delay
  await screen.findByText(/A te blokkod/i, undefined, { timeout: 3000 })
  return router
}

test('„Mentés sablonként" creates the template only and lands on the library', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  let postedTemplate: {
    title?: string
    weeks?: number
    days?: unknown[]
    goalPreset?: string
    musclePriorities?: Record<string, string> | null
  } | null = null
  let startCalls = 0
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.post(`${API_BASE}/api/train/meso-templates`, async ({ request }) => {
      postedTemplate = (await request.json()) as typeof postedTemplate
      return HttpResponse.json(
        { id: 'e1f3a0e2-0000-4000-8000-00000000d00d', ...postedTemplate, runCount: 0 },
        { status: 201 },
      )
    }),
    http.post(`${API_BASE}/api/train/meso-templates/:id/start`, () => {
      startCalls += 1
      return new HttpResponse(null, { status: 500 })
    }),
  )
  const user = userEvent.setup()
  const putSpy = vi.spyOn(trainApi, 'replaceGymSchedule')
  const router = await runWizardToTerminalStep(user)

  await user.click(screen.getByRole('button', { name: /Mentés sablonként/i }))

  await waitFor(() => expect(postedTemplate).not.toBeNull())
  expect(postedTemplate!.weeks).toBeGreaterThan(0)
  expect(postedTemplate!.days).toHaveLength(7) // all template days travel, rest days included
  expect(postedTemplate!.goalPreset).toBe('hypertrophy') // the chosen preset id travels with the template
  expect(postedTemplate!.musclePriorities).toBeNull() // no-touch walk through Fókusz -> null, never {}
  expect(startCalls).toBe(0) // a template save never stamps a run
  // the planner also persists the standing gym schedule (mezo-4t43): one slot per selected day
  await waitFor(() => expect(putSpy).toHaveBeenCalled())
  const savedSlots = putSpy.mock.calls[0][0]
  expect(savedSlots).toHaveLength(5) // Hypertrophy: 5 selected days, each carries a time
  expect(savedSlots.every((s) => /^\d{2}:\d{2}$/.test(s.time))).toBe(true)
  putSpy.mockRestore()
  await waitFor(() => expect(router.state.location.pathname).toBe('/train/mesocycles'))
})

test('emphasizing a muscle group on the Fókusz step travels with the saved template', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  let postedTemplate: { musclePriorities?: Record<string, string> | null } | null = null
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.post(`${API_BASE}/api/train/meso-templates`, async ({ request }) => {
      postedTemplate = (await request.json()) as typeof postedTemplate
      return HttpResponse.json(
        { id: 'e1f3a0e2-0000-4000-8000-00000000d00d', ...postedTemplate, runCount: 0 },
        { status: 201 },
      )
    }),
  )
  const user = userEvent.setup()
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/train/mesocycles/new']}>
        <MesocyclePlannerPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> step 2
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Fókusz
  // step indicator: the new step lands at index 3 (4th, 1-indexed)
  expect(screen.getByRole('button', { name: '4. lépés · Fókusz' })).toBeInTheDocument()
  // RULING (mezo-ltk0): the chrome title is the short step name; the picker's own card
  // header is the ONLY place asking the question — pin both so the duplicate can't creep back.
  expect(screen.getByRole('heading', { name: 'Fókusz' })).toBeInTheDocument()
  // getByText throws on >1 match — this pins the question renders exactly once.
  expect(screen.getByText('Mire gyúr ez a blokk?')).toBeInTheDocument()
  // emphasize the "back" group via the MusclePriorityPicker
  await user.click(within(screen.getByRole('group', { name: 'Hát prioritás' })).getByRole('button', { name: 'Emphasize' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Program
  await screen.findByText(/A te blokkod/i, undefined, { timeout: 3000 })

  await user.click(screen.getByRole('button', { name: /Mentés sablonként/i }))

  await waitFor(() => expect(postedTemplate).not.toBeNull())
  expect(postedTemplate!.musclePriorities).toEqual({ back: 'emphasize' })
})

test('„Mentés + indítás" creates the template, starts it active on the wizard date, lands on Gym', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  let postedTemplate: { title?: string } | null = null
  let startedId: string | null = null
  let postedStart: { startDate?: string; status?: string } | null = null
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.post(`${API_BASE}/api/train/meso-templates`, async ({ request }) => {
      postedTemplate = (await request.json()) as typeof postedTemplate
      return HttpResponse.json(
        { id: 'e1f3a0e2-0000-4000-8000-00000000d00d', ...postedTemplate, runCount: 0 },
        { status: 201 },
      )
    }),
    http.post(`${API_BASE}/api/train/meso-templates/:id/start`, async ({ params, request }) => {
      startedId = String(params.id)
      postedStart = (await request.json()) as typeof postedStart
      return HttpResponse.json({
        id: 'b6f3a0e2-0000-4000-8000-00000000d00d',
        templateId: startedId,
        title: 'Teszt', shortTitle: 'Teszt', status: postedStart!.status,
        startDate: postedStart!.startDate, endDate: postedStart!.startDate,
        weeks: 4, currentWeek: 1, split: '', style: '', phaseCurve: ['MEV'],
      })
    }),
  )
  const user = userEvent.setup()
  const router = await runWizardToTerminalStep(user)

  await user.click(screen.getByRole('button', { name: /Mentés \+ indítás/i }))

  await waitFor(() => expect(postedStart).not.toBeNull())
  expect(postedTemplate).not.toBeNull()
  expect(startedId).toBe('e1f3a0e2-0000-4000-8000-00000000d00d') // started from the just-created template
  expect(postedStart!.status).toBe('active')
  expect(postedStart!.startDate).toBe('2026-06-16')
  // GymPage folded into Heti (mezo-d20.3.2): the wizard still targets /train/gym,
  // which now renders TrainWeekPage's content directly (same page, no client
  // redirect) — the pathname itself is untouched (hub-agent territory).
  await waitFor(() => expect(router.state.location.pathname).toBe('/train/gym'))
})

test('a created template whose start fails lands on the library, never on Gym', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  let createCalls = 0
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.post(`${API_BASE}/api/train/meso-templates`, async ({ request }) => {
      createCalls += 1
      const body = (await request.json()) as Record<string, unknown>
      return HttpResponse.json(
        { id: 'e1f3a0e2-0000-4000-8000-00000000d00d', ...body, runCount: 0 },
        { status: 201 },
      )
    }),
    // The template IS saved; only the run stamping dies.
    http.post(`${API_BASE}/api/train/meso-templates/:id/start`, () => new HttpResponse(null, { status: 500 })),
  )
  const user = userEvent.setup()
  const router = await runWizardToTerminalStep(user)

  await user.click(screen.getByRole('button', { name: /Mentés \+ indítás/i }))

  // no fake success: the library is where the just-created template lives; Gym would
  // pretend a block is running
  await waitFor(() => expect(router.state.location.pathname).toBe('/train/mesocycles'))
  expect(router.state.location.pathname).not.toBe('/train/gym')
  expect(createCalls).toBe(1) // the failed start never re-creates the template
})

test('a failed template create keeps the wizard on the terminal step', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.post(`${API_BASE}/api/train/meso-templates`, () => new HttpResponse(null, { status: 500 })),
  )
  const user = userEvent.setup()
  const router = await runWizardToTerminalStep(user)

  await user.click(screen.getByRole('button', { name: /Mentés sablonként/i }))

  // the save buttons come back (no spinner lock) and the route never moved
  await waitFor(() => expect(screen.getByRole('button', { name: /Mentés sablonként/i })).toBeEnabled())
  expect(router.state.location.pathname).toBe('/train/mesocycles/new')
})

test('step 2 weekday picker: defaults match the split, Tovább gates on exact count', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> step 2
  // Hypertrophy defaults: PPL · 5 days -> Hét..Pén preselected
  for (const d of ['Hét', 'Kedd', 'Sze', 'Csü', 'Pén']) {
    expect(screen.getByRole('button', { name: d, pressed: true })).toBeInTheDocument()
  }
  expect(screen.getByRole('button', { name: 'Szo', pressed: false })).toBeInTheDocument()
  // Deselect one -> 4/5, Tovább disabled + hint shows
  await user.click(screen.getByRole('button', { name: 'Pén' }))
  expect(screen.getByText('Válassz pontosan 5 napot a folytatáshoz.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tovább →' })).toBeDisabled()
  // Select Szo instead -> gate opens again
  await user.click(screen.getByRole('button', { name: 'Szo' }))
  expect(screen.getByRole('button', { name: 'Tovább →' })).toBeEnabled()
})

test('step 2 shows a time input per selected day — standing slot prefills, others default 18:00', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true') // gymScheduleMock (Kedd + Csü 18:30) is the deterministic source
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> step 2
  // Hypertrophy defaults: Hét..Pén selected -> one time input each
  expect((screen.getByLabelText('Hét időpont') as HTMLInputElement).value).toBe('18:00') // no slot -> default
  expect((screen.getByLabelText('Kedd időpont') as HTMLInputElement).value).toBe('18:30') // gymScheduleMock slot
  expect((screen.getByLabelText('Csü időpont') as HTMLInputElement).value).toBe('18:30') // gymScheduleMock slot
  // an unselected day has no time row
  expect(screen.queryByLabelText('Szo időpont')).toBeNull()
  // toggling the day set updates the rows: Pén off, Szo on
  await user.click(screen.getByRole('button', { name: 'Pén' }))
  expect(screen.queryByLabelText('Pén időpont')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Szo' }))
  expect(screen.getByLabelText('Szo időpont')).toBeInTheDocument()
})

test('editing a day time does not gate Tovább (time is optional)', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> step 2
  fireEvent.change(screen.getByLabelText('Hét időpont'), { target: { value: '06:30' } })
  expect((screen.getByLabelText('Hét időpont') as HTMLInputElement).value).toBe('06:30')
  expect(screen.getByRole('button', { name: 'Tovább →' })).toBeEnabled() // still gated only on day-count
})

test('the generated program lands on the selected weekdays', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> step 2
  await user.click(screen.getByRole('button', { name: 'Pén' })) // off
  await user.click(screen.getByRole('button', { name: 'Vas' })) // on instead
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Fókusz
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Program
  // program generation has a 600ms delay; day tabs land once it resolves
  const vasTab = await screen.findByRole('button', { name: /Vas/ }, { timeout: 3000 })
  await user.click(vasTab)
  expect(screen.getByText('Pull')).toBeInTheDocument() // 5th entry of the PPL sequence lands on Vas (hero dayType)
  // Pén became a rest day
  await user.click(screen.getByRole('button', { name: /^Pén/ }))
  expect(screen.getByText('Rest')).toBeInTheDocument()
})

test('day tabs switch between program days (replaces the old per-day accordion)', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Fókusz
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Program
  // the first training day (Hét · Push) is active by default once the program lands
  await screen.findByText(/A te blokkod/i, undefined, { timeout: 3000 })
  expect(screen.getByText('Push')).toBeInTheDocument()
  // switching tabs swaps the active day's hero — the exact aria-label, because a bare
  // /Sze/ also matches the start-date CTA every September ("Szep 1", date-dependent flake)
  await user.click(screen.getByRole('button', { name: 'Sze · Legs' }))
  expect(screen.getByText('Legs')).toBeInTheDocument()
})

test('custom split: empty nameable days, the user picks the exercises', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> step 2
  await user.click(screen.getByText('Custom split'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Fókusz
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Program
  // the first custom day (Body A) is active by default even though it has no exercises yet
  await screen.findByText(/A te blokkod/i, undefined, { timeout: 3000 })
  // the custom day's name lives ONLY in the rename input (the hero eyebrow is
  // blanked while the rename input is shown, so the name isn't duplicated).
  expect(screen.getByDisplayValue('Body A')).toBeInTheDocument()
  // renaming the day updates the header (MesoEditor's own custom-day rename input)
  const nameInput = screen.getByLabelText(/nap átnevezése/)
  await user.clear(nameInput)
  await user.type(nameInput, 'Láb nap')
  expect(screen.getByDisplayValue('Láb nap')).toBeInTheDocument()
  // the add affordance opens the picker and the pick lands in the day
  await user.click(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ }))
  await user.click(screen.getByText('Hip Thrust'))
  // the picker now stays open for multi-add, so close it explicitly.
  await user.click(screen.getByRole('button', { name: /^Kész/ }))
  await waitFor(() => expect(screen.queryByText('Mit pakolunk be?')).not.toBeInTheDocument())
  expect(screen.getByText('Hip Thrust')).toBeInTheDocument()
  expect(screen.getByText(/^1 gyakorlat/)).toBeInTheDocument()
})

test('manually picked weekdays survive a day-count change', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> step 2
  // customize: Pén off, Szo on (defaults were Hét..Pén)
  await user.click(screen.getByRole('button', { name: 'Pén' }))
  await user.click(screen.getByRole('button', { name: 'Szo' }))
  // change weekly count 5 -> 4: the manual pick must NOT reset to defaults
  await user.click(screen.getByRole('button', { name: '4×' }))
  expect(screen.getByRole('button', { name: 'Szo', pressed: true })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pén', pressed: false })).toBeInTheDocument()
  // 5 picked vs 4 needed -> gate + hint until one is removed
  expect(screen.getByText('Válassz pontosan 4 napot a folytatáshoz.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tovább →' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Hét' })) // remove one
  expect(screen.getByRole('button', { name: 'Tovább →' })).toBeEnabled()
})

test('program edits survive a step round-trip when inputs are unchanged', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Fókusz
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Program (terminal)
  await screen.findByText(/A te blokkod/i, undefined, { timeout: 3000 })
  // the active (first training) day's exercise rows are collapsed by default
  // in the accordion editor — expand the first one to reach its remove button.
  const rows = () => screen.getAllByRole('button', { name: /· szerkesztés$/ })
  const countBefore = rows().length
  await user.click(rows()[0])
  await user.click(screen.getByRole('button', { name: /törlése$/ }))
  expect(rows()).toHaveLength(countBefore - 1)
  // back to step 2 (the Program step has no Vissza button — use the tappable
  // progress segment) and forward again — NO regeneration, edit preserved
  await user.click(screen.getByRole('button', { name: '3. lépés · Split + napok' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Fókusz
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Program
  expect(screen.queryByText('A Mezo összerakja a programot…')).not.toBeInTheDocument()
  expect(rows()).toHaveLength(countBefore - 1)
})

test('changing an input regenerates the program', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Fókusz
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Program
  await screen.findByText(/A te blokkod/i, undefined, { timeout: 3000 })
  await user.click(screen.getByRole('button', { name: '3. lépés · Split + napok' }))
  // swap a weekday: Pén off, Szo on → signature changes
  await user.click(screen.getByRole('button', { name: 'Pén' }))
  await user.click(screen.getByRole('button', { name: 'Szo' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Fókusz
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Program
  expect(screen.getByText('A Mezo összerakja a programot…')).toBeInTheDocument()
  await screen.findByText(/A te blokkod/i, undefined, { timeout: 3000 })
})

test('Program step: budget card + accordion recipe editing, edits survive the 3↔2 round-trip', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Fókusz
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Program (terminal, merged review + tuning)
  await screen.findByText(/A te blokkod/i, undefined, { timeout: 3000 })
  expect(screen.getByText('A programod · gyakorlatok + set & rep')).toBeInTheDocument()
  // save buttons live here immediately — no extra Tovább needed
  expect(screen.getByRole('button', { name: /Mentés sablonként/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Mentés \+ indítás/i })).toBeInTheDocument()
  // the unified editor's weekly set-budget card renders on this step
  expect(screen.getByText(/Heti szet-büdzsé/)).toBeInTheDocument()
  // a day tab is preselected; expand the first exercise row to reach its
  // steppers, then bump Munkaszett and watch the day-level set total change.
  const heroSets = () => screen.getByText('szett ma').parentElement?.textContent
  const before = heroSets()
  await user.click(screen.getAllByRole('button', { name: /· szerkesztés$/ })[0])
  await user.click(screen.getAllByRole('button', { name: /· Munkaszett növelése$/ })[0])
  const after = heroSets()
  expect(after).not.toBe(before)
  // round-trip back to Split + napok (via the progress segment — the terminal
  // step has no Vissza button) and forward: no regeneration, edit kept
  await user.click(screen.getByRole('button', { name: '3. lépés · Split + napok' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Fókusz
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Program
  expect(screen.queryByText('A Mezo összerakja a programot…')).not.toBeInTheDocument()
  expect(heroSets()).toBe(after)
})
