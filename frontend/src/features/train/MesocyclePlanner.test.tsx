import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { MesocyclePlanner } from './MesocyclePlanner'

afterEach(() => vi.unstubAllEnvs())

// The planner now calls useTrain (mutations), so a QueryClientProvider is required.
function setup() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/train/mesocycles/new']}>
        <MesocyclePlanner />
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
  // step 3: wait out the 600ms generate delay, then save as planned
  await screen.findByText(/A te blokkod/i, undefined, { timeout: 3000 })
  await user.click(screen.getByRole('button', { name: /Hozzáad mint tervezett/i }))

  await waitFor(() => expect(posted).not.toBeNull())
  expect(posted!.status).toBe('planned')
  expect(posted!.startDate).toBe('2026-06-16')
  expect(posted!.weeks).toBeGreaterThan(0)
  expect(posted!.days).toHaveLength(7) // all template days travel, rest days included
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
