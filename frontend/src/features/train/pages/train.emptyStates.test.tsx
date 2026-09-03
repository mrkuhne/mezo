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
import { seedAllKalauzSeen } from '@/test/kalauz'

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
  seedAllKalauzSeen()
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

// /train is the Edzés hub since mezo-d20.3.1 — its hero inherits Mai's meso-less ghost
// (same copy, same wizard CTA, same Saját edzés escape hatch) instead of inventing one.
test('the Edzés hub shows the ghost hero with a wizard CTA on an empty backend', async () => {
  renderApp('/train')
  await waitFor(() => expect(screen.getByText(/Itt fog élni a mai edzésed/i)).toBeInTheDocument())
  expect(screen.getByRole('button', { name: /tervezz mesociklust/i })).toBeInTheDocument()
  // …and it no longer promises a „Heti terv” section: that list moved to the Heti
  // tab with the rest of the weekly agenda (mezo-9bbc final review, I5).
  expect(screen.queryByRole('heading', { name: 'Heti terv' })).not.toBeInTheDocument()
  expect(screen.queryByText(/A heti rended itt jelenik majd meg/i)).not.toBeInTheDocument()
  // the Saját edzés escape hatch stays
  expect(screen.getByRole('button', { name: /Saját edzés/i })).toBeInTheDocument()
})

// GymPage folded into Heti (mezo-d20.3.2): /train/gym now renders the same
// page, so the same ghost message shows on either path — no more distinct
// "Nincs aktív mesociklus" copy.
test('GymPage (folded into Heti) shows the Heti ghost when there is no active meso', async () => {
  renderApp('/train/gym')
  await waitFor(() => expect(screen.getByText(/A heti rended itt jelenik majd meg/i)).toBeInTheDocument())
  expect(screen.getByRole('button', { name: /tervezz mesociklust/i })).toBeInTheDocument()
})

test('ActiveWorkoutPage redirects to /train when there is no workout', async () => {
  renderApp('/train/session')
  // lands back on the Edzés hub's ghost hero instead of crashing
  await waitFor(() => expect(screen.getByText(/Itt fog élni a mai edzésed/i)).toBeInTheDocument())
})

test('SportPage ghosts the weekly plan and shows an empty log message', async () => {
  const { container } = renderApp('/train/sport')
  // Mozaik re-face (mezo-d20.11): the hero-stats GhostState is gone — with no
  // schedule the hero big number and every stat cell render `—` (an honest
  // missing statistic), and the week tab keeps its own ghost + CTA.
  await waitFor(() =>
    expect(screen.getByText(/A heti rended itt jelenik majd meg/i)).toBeInTheDocument(),
  )
  expect(container.querySelector('.mz-bignum')).toHaveTextContent('—')
  expect(container.querySelectorAll('.mz-statstrip .mz-statcell b')).toHaveLength(3)
  container.querySelectorAll('.mz-statstrip .mz-statcell b').forEach((b) => {
    expect(b).toHaveTextContent('—')
  })
  await userEvent.click(screen.getByRole('button', { name: 'Napló' }))
  expect(await screen.findByText(/Még nincs logolt session/i)).toBeInTheDocument()
})

test('MesocycleLibraryPage shows the empty hint when there are no mesocycles', async () => {
  renderApp('/train/mesocycles')
  await waitFor(() => expect(screen.getByText(/Még nincs mesociklusod/i)).toBeInTheDocument())
})
