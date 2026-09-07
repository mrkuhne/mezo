import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

// Design 2.0 (mezo-d20.3.1): the Train sub-nav dropdown is gone — /train is the Edzés
// hub and its tiles are the way into the (now full-page) sub-views. Each tile is
// asserted from a fresh mount: tapping one leaves the hub behind.
test('Train opens on the Edzés hub and its tiles open the sub-pages', async () => {
  renderApp('/train')
  // the hub hero speaks today's session, not Mai's day-view header
  expect(await screen.findByText(/MA · 07:30 · Meso W/)).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Mai nap' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Train alnavigáció')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Sport' }))
  // Sport is re-faced (mezo-d20.11): the Mozaik hero speaks the page name; the
  // court moved onto each slot row's meta line, so it is no longer a lone node.
  expect(await screen.findByText('Sport', { selector: '.mz-hero-nm' })).toBeInTheDocument()
  expect(screen.getAllByText(/BVSC csarnok/).length).toBeGreaterThan(0)
  cleanup()

  renderApp('/train')
  await userEvent.click(await screen.findByRole('button', { name: 'Medálok' }))
  // Medálok is re-faced (mezo-d20.3.2): the Mozaik hero speaks the page name, not an h1.
  expect(await screen.findByText('Medálok', { selector: '.mz-hero-nm' })).toBeInTheDocument()
  cleanup()

  renderApp('/train')
  await userEvent.click(await screen.findByRole('button', { name: 'Mesociklus' }))
  // The active run's hero card — its own a11y name is the hero button's aria-label
  // (mesocycle pages v2 Task 2, mezo-d20.15); the title (shared with the template it was
  // started from, mezo-meyc.1) is checked as text inside it, not the accessible name.
  const hero = await screen.findByRole('button', { name: 'Aktív mezociklus megnyitása' })
  expect(hero).toHaveTextContent('Hypertrophy 04 · Tavasz')
})

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
  expect(await screen.findByRole('heading', { name: 'Mai nap' })).toBeInTheDocument()
  cleanup()

  const router = createMemoryRouter(routes, { initialEntries: ['/train?day=0'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  await screen.findByRole('heading', { name: /Hétfő|Mai nap/ })
  expect(router.state.location.pathname).toBe('/train/mai')
  expect(router.state.location.search).toBe('?day=0')
})

test('the active workout session is a full-screen flow without the sub-nav', () => {
  const { container } = renderApp('/train/session')
  expect(container.querySelector('.np-pills')).toBeNull()
  expect(screen.getByText(/Kezdjük el/)).toBeInTheDocument()
  expect(screen.getAllByText('Pull Day').length).toBeGreaterThan(0)
})

// Sablonok folds into the Mesociklus page in the new IA (handoff §10), but its route
// stays reachable — the library's nav row still links here (mezo-tlwa).
test('Sablonok stays reachable on its own route', async () => {
  renderApp('/train/templates')
  expect(await screen.findByRole('heading', { level: 1, name: 'Sablonok' })).toBeInTheDocument()
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
