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
