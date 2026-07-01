import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// T0 clean slate: real mode + empty backend must render ghost states — never
// crash and never show Phase-1 demo data. (server.resetHandlers runs globally
// in setup.ts, so the per-test overrides below don't leak.)
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
  )
})
afterEach(() => vi.unstubAllEnvs())

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
}

test('TrainTodayPage shows the ghost hero with a wizard CTA on an empty backend', async () => {
  renderApp('/train')
  await waitFor(() => expect(screen.getByText(/Itt fog élni a mai edzésed/i)).toBeInTheDocument())
  expect(screen.getByRole('button', { name: /tervezz mesociklust/i })).toBeInTheDocument()
})

test('GymPage shows a ghost when there is no active meso', async () => {
  renderApp('/train/gym')
  await waitFor(() => expect(screen.getByText(/Nincs aktív mesociklus/i)).toBeInTheDocument())
  expect(screen.getByRole('button', { name: /tervezz mesociklust/i })).toBeInTheDocument()
})

test('ActiveWorkoutPage redirects to /train when there is no workout', async () => {
  renderApp('/train/session')
  // lands back on the Train Today ghost instead of crashing
  await waitFor(() => expect(screen.getByText(/Itt fog élni a mai edzésed/i)).toBeInTheDocument())
})

test('SportPage ghosts the weekly plan and shows an empty log message', async () => {
  renderApp('/train/sport')
  // hero stats ghost + week-tab ghost (week is the default tab)
  await waitFor(() =>
    expect(screen.getByText(/A statisztikáid az első logolt session után jelennek meg/i)).toBeInTheDocument(),
  )
  expect(screen.getByText(/A heti rended itt jelenik majd meg/i)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Napló' }))
  expect(await screen.findByText(/Még nincs logolt session/i)).toBeInTheDocument()
})

test('MesocycleLibraryPage shows the empty hint when there are no mesocycles', async () => {
  renderApp('/train/mesocycles')
  await waitFor(() => expect(screen.getByText(/Még nincs mesociklusod/i)).toBeInTheDocument())
})
