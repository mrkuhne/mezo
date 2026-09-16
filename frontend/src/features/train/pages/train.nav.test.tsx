import { cleanup, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'

// Asserts Phase-1 mock meso/sport data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
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

// The six-tile Edzés hub (mezo-d20.3.1) retired in Train Titanium T4 (mezo-88iwa.5):
// /train no longer renders a face of its own, it forwards to Mai
// (router.trainIndexRedirect.test.tsx covers the redirect itself). The hub-tile
// navigation test that lived here (rendering /train and tapping its Sport/Medálok/
// Mesociklus tiles) went with it — those destinations are still reached directly by
// their own routes below and via the four-tab bar (TabBar.test.tsx).

// The Gym muscle-zone view folds into Heti in the new IA (handoff §10) — its route stays
// reachable and keeps its own face until the F2.2 slice absorbs it.
test('the Gym view stays reachable on its own route, without the retired sub-nav', async () => {
  renderApp('/train/gym')
  expect(await screen.findByRole('button', { name: /Mezociklus áttekintő/ })).toBeInTheDocument()
  expect(screen.queryByLabelText('Train alnavigáció')).not.toBeInTheDocument()
})

// Mai keeps its whole day view (DayStrip + retro logging) at /train/mai, and the Heti
// drill-in's `?day=` deep link is forwarded there with the selection intact.
test('the full Mai day view lives at /train/mai and /train?day= forwards to it', async () => {
  renderApp('/train/mai')
  // The Titanium face has no „Mai nap” h1 any more (mezo-88iwa.6) — the DayStrip is the
  // page's first element and its selected chip names the rendered day.
  expect(await screen.findByRole('tablist', { name: 'Hét napjai' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toMatch(/^Csütörtök ·/)
  cleanup()

  const router = createMemoryRouter(routes, { initialEntries: ['/train?day=0'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  await screen.findByRole('tablist', { name: 'Hét napjai' })
  // the drill-in's selection survives the forward
  expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toMatch(/^Hétfő ·/)
  expect(router.state.location.pathname).toBe('/train/mai')
  expect(router.state.location.search).toBe('?day=0')
})

test('the active workout session is a full-screen flow without the sub-nav', () => {
  const { container } = renderApp('/train/session')
  expect(container.querySelector('.np-pills')).toBeNull()
  expect(screen.getByText(/Kezdjük el/)).toBeInTheDocument()
  expect(screen.getAllByText('Pull Day').length).toBeGreaterThan(0)
})

// „Sablonjaid" stays reachable on its own route — the library landing's doorway links
// here (mezo-tlwa; refaced into the Titanium list in T10 Task 3, mezo-88iwa.11, so the
// page's name now lives in its poster hero's h2, not in a DS h1).
test('Sablonjaid stays reachable on its own route', async () => {
  renderApp('/train/templates')
  expect(await screen.findByRole('heading', { name: 'Amiből indíthatsz' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Train alnavigáció')).not.toBeInTheDocument()
})

// A template's own READ-FIRST page (T10 Task 3) — a real route under the list, NOT the
// raw editor at /train/mesocycles/templates/:id.
test('a template opens its own story page at /train/templates/:id', async () => {
  renderApp('/train/templates/b20f0000-0000-4000-8000-000000000000')
  expect(await screen.findByRole('heading', { name: 'Upper/Lower Power' })).toBeInTheDocument()
  expect(screen.getByText('A hét felépítése')).toBeInTheDocument()
  expect(screen.queryByLabelText('Train alnavigáció')).not.toBeInTheDocument()
})

test('the mesocycle planner is a full-screen flow without the sub-nav', () => {
  // wizard v3 (mezo-yty6): the three steps collapsed into ONE interview screen that
  // generates straight into the shared editor.
  const { container } = renderApp('/train/mesocycles/new')
  expect(container.querySelector('.np-pills')).toBeNull()
  expect(screen.getByText('Mikor edzel — és mire gyúrsz?')).toBeInTheDocument()
  expect(screen.getByText('Új blokk · interjú')).toBeInTheDocument()
})

// The template editor moved off the pre-redesign DS page shell onto the same Mozaik
// scaffold the wizard's editor uses (mezo-yty6 Task 10) — one editor, one face.
test('the template editor is a full-screen Mozaik flow without the sub-nav', async () => {
  const { container } = renderApp('/train/mesocycles/templates/b20f0000-0000-4000-8000-000000000000')
  expect(await screen.findByRole('textbox', { name: 'Mezociklus neve' })).toHaveValue('Upper/Lower Power')
  expect(container.querySelector('.mz-page')).not.toBeNull()
  expect(container.querySelector('.np-pills')).toBeNull()
  expect(container.querySelector('.pghead-np')).toBeNull()
})

test('the mesocycle builder is a full-screen flow without the sub-nav', () => {
  const { container } = renderApp('/train/mesocycles/meso-hyp-04')
  expect(container.querySelector('.np-pills')).toBeNull()
  // Mesocycle pages v2 (mezo-d20.15): the run page speaks Mozaik — its name sits in the
  // PageHero, not in an <h1> (no Mozaik subpage carries one).
  expect(screen.getByText('Hypertrophy 04 · Tavasz')).toBeInTheDocument()
})

test('the retired Volumen route redirects to the Heti vizsgálat page (mezo-d20.15 Task 4)', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/train/mesocycles/meso-hyp-04/overview'] })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  expect(await screen.findByText('Heti vizsgálat · 3. hét')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/train/mesocycles/meso-hyp-04/week')
})
