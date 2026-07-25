import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

test('the wizard persists the mesocycle in real mode and lands on the library', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  let posted: { title?: string; status?: string; startDate?: string; weeks?: number; days?: unknown[] } | null = null
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.post(`${API_BASE}/api/train/mesocycles`, async ({ request }) => {
      posted = (await request.json()) as typeof posted
      return HttpResponse.json({ id: 'b6f3a0e2-0000-4000-8000-00000000d00d' }, { status: 201 })
    }),
  )
  const user = userEvent.setup()
  const putSpy = vi.spyOn(trainApi, 'replaceGymSchedule')
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
  // fireEvent-style direct change is the reliable way to set <input type="date">
  await user.type(dateInput, '2026-06-16')
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  // step 2 -> step 3
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  // step 3: wait out the 600ms generate delay
  await screen.findByText(/A te blokkod/i, undefined, { timeout: 3000 })
  // step 3 -> step 4 (Set & rep): the save buttons live here now
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: /Hozzáad mint tervezett/i }))

  await waitFor(() => expect(posted).not.toBeNull())
  expect(posted!.status).toBe('planned')
  expect(posted!.startDate).toBe('2026-06-16')
  expect(posted!.weeks).toBeGreaterThan(0)
  expect(posted!.days).toHaveLength(7) // all template days travel, rest days included
  // the planner also persists the standing gym schedule (mezo-4t43): one slot per selected day
  await waitFor(() => expect(putSpy).toHaveBeenCalled())
  const savedSlots = putSpy.mock.calls[0][0]
  expect(savedSlots).toHaveLength(5) // Hypertrophy: 5 selected days, each carries a time
  expect(savedSlots.every((s) => /^\d{2}:\d{2}$/.test(s.time))).toBe(true)
  putSpy.mockRestore()
  // navigation: back on the (empty) library
  await waitFor(() => expect(screen.getByText(/Még nincs mesociklusod/i)).toBeInTheDocument())
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
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> step 3
  // program generation has a 600ms delay
  const vasSection = await screen.findByRole('button', { name: /Vas/ }, { timeout: 3000 })
  expect(vasSection).toHaveTextContent(/Pull/) // 5th entry of the PPL sequence lands on Vas
  // Pén became a rest day
  const penSection = screen.getByRole('button', { name: /^Pén/ })
  expect(penSection).toHaveTextContent(/Rest/)
})

test('an expanded program day can be collapsed (and stays collapsed)', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> step 3
  // the first training day auto-expands once the program lands
  const header = await screen.findByRole('button', { name: /Hét.*Push/, expanded: true }, { timeout: 3000 })
  await user.click(header)
  expect(screen.getByRole('button', { name: /Hét.*Push/ })).toHaveAttribute('aria-expanded', 'false')
})

test('custom split: empty nameable days, the user picks the exercises', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> step 2
  await user.click(screen.getByText('Custom split'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> step 3
  // the first custom day auto-expands even though it has no exercises yet
  const header = await screen.findByRole('button', { name: /Body A/, expanded: true }, { timeout: 3000 })
  expect(header).toHaveTextContent(/Üres nap/)
  // renaming the day updates the header
  const nameInput = screen.getByLabelText('Nap neve')
  await user.clear(nameInput)
  await user.type(nameInput, 'Láb nap')
  expect(screen.getByRole('button', { name: /Láb nap/ })).toBeInTheDocument()
  // the add affordance opens the picker and the pick lands in the day
  await user.click(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ }))
  await user.click(screen.getByText('Hip Thrust'))
  // the picker now stays open for multi-add, so close it explicitly.
  await user.click(screen.getByRole('button', { name: /^Kész/ }))
  await waitFor(() => expect(screen.queryByText('Mit pakolunk be?')).not.toBeInTheDocument())
  expect(screen.getByText('Hip Thrust')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Láb nap/ })).toHaveTextContent(/1 gyakorlat/)
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
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> program review
  await screen.findByText(/A te blokkod/i, undefined, { timeout: 3000 })
  // the auto-expand lands in a second commit — wait for the rows before counting
  // (findAll: the expanded day has several rows, so a singular findBy would throw)
  await screen.findAllByRole('button', { name: 'Eltávolítás' })
  // remove the first exercise of the auto-expanded day
  const removeButtons = screen.getAllByRole('button', { name: 'Eltávolítás' })
  const countBefore = removeButtons.length
  await user.click(removeButtons[0])
  expect(screen.getAllByRole('button', { name: 'Eltávolítás' })).toHaveLength(countBefore - 1)
  // back to step 2 (the review step has no Vissza button — use the tappable
  // progress segment) and forward again — NO regeneration, edit preserved
  await user.click(screen.getByRole('button', { name: '3. lépés · Split + napok' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  expect(screen.queryByText('A Mezo összerakja a programot…')).not.toBeInTheDocument()
  await screen.findAllByRole('button', { name: 'Eltávolítás' })
  expect(screen.getAllByRole('button', { name: 'Eltávolítás' })).toHaveLength(countBefore - 1)
})

test('changing an input regenerates the program', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await screen.findByText(/A te blokkod/i, undefined, { timeout: 3000 })
  await user.click(screen.getByRole('button', { name: '3. lépés · Split + napok' }))
  // swap a weekday: Pén off, Szo on → signature changes
  await user.click(screen.getByRole('button', { name: 'Pén' }))
  await user.click(screen.getByRole('button', { name: 'Szo' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  expect(screen.getByText('A Mezo összerakja a programot…')).toBeInTheDocument()
  await screen.findByText(/A te blokkod/i, undefined, { timeout: 3000 })
})

test('Set & rep step: day tabs, recipe editing, edits survive the 4↔5 round-trip', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('Hypertrophy'))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Gyakorlatok
  await screen.findByText(/A te blokkod/i, undefined, { timeout: 3000 })
  await user.click(screen.getByRole('button', { name: 'Tovább →' })) // -> Set & rep
  expect(screen.getByText('Mennyit és hányszor?')).toBeInTheDocument()
  // save buttons live here now
  expect(screen.getByRole('button', { name: /Hozzáad mint tervezett/i })).toBeInTheDocument()
  // a day tab is preselected; the always-visible steppers bump the day set count.
  // Generated names are dynamic, so target the first Working stepper by regex.
  const daySummary = () => screen.getByText(/gyakorlat · \d+ szet/).textContent
  const before = daySummary()
  await user.click(screen.getAllByRole('button', { name: /· Working növelése$/ })[0])
  const after = daySummary()
  expect(after).not.toBe(before)
  // round-trip back to Gyakorlatok (via the progress segment — the terminal
  // step has no Vissza button) and forward: no regeneration, edit kept
  await user.click(screen.getByRole('button', { name: '4. lépés · Gyakorlatok' }))
  expect(screen.getByText(/A te blokkod/i)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Tovább →' }))
  expect(daySummary()).toBe(after)
})
