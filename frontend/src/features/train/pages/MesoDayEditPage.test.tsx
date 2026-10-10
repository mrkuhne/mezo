// The day's editor on its OWN route (Train parity P1 Task 4, mezo-e1ii9). The editing this
// page carries used to be welded onto the bottom of the Titanium day page; these tests are
// its new home — the capability the day page shed must still be reachable and still work.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const MESO_ID = 'meso-hyp-04'

function setup(search = '', day = 'Csü') {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/train/mesocycles/${MESO_ID}/days/${encodeURIComponent(day)}/edit${search}`],
  })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  return router
}

test('the editor route edits THIS day — its exercises, and its add affordance', () => {
  setup()
  // the title bar names the page and the day; the hero's eyebrow repeats the day in full
  expect(screen.getByRole('heading', { name: 'A nap szerkesztése' })).toBeInTheDocument()
  expect(screen.getByText('Csütörtök · Pull · a nap szerkesztése')).toBeInTheDocument()
  expect(screen.getByText(/szett ma, \d+ gyakorlat\./)).toBeInTheDocument()
  expect(screen.getAllByText('Chest Supported Row').length).toBeGreaterThan(0) // Csü
  expect(screen.queryByText('Barbell Bench Press')).not.toBeInTheDocument() // Hét
  expect(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ })).toBeInTheDocument()
})

test('`?add=1` opens the exercise picker on arrival — the day page\'s add-CTA lands here', async () => {
  setup('?add=1')
  await waitFor(() => expect(screen.getByText(/Csü · Pull/)).toBeInTheDocument())
})

test('without `?add=1` the picker stays closed', () => {
  setup()
  expect(screen.queryByText(/Csü · Pull/)).not.toBeInTheDocument()
})

test('back lands on the day page', async () => {
  const router = setup()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  await waitFor(() =>
    expect(router.state.location.pathname).toBe(`/train/mesocycles/${MESO_ID}/days/Cs%C3%BC`),
  )
})

test('a day the block does not have says so instead of an empty editor', () => {
  setup('', 'Vasárnap')
  expect(screen.getByText('Ez a nap nincs a tervedben.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Gyakorlat hozzáadása/ })).not.toBeInTheDocument()
})

test('a plan that does not exist says so', () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/train/mesocycles/nincs-ilyen/days/Cs%C3%BC/edit'] })
  render(<QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>)
  expect(screen.getByText('Ez az edzésterv nem található.')).toBeInTheDocument()
})

test('while the plans are still loading the page shows its skeleton, not a not-found', () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setup()
  expect(screen.getByRole('status', { name: 'Betöltés…' })).toBeInTheDocument()
  expect(screen.queryByText('Ez az edzésterv nem található.')).not.toBeInTheDocument()
})

test('the editor wears the Folyadék skeleton — no glass, no old cards', () => {
  setup()
  const page = document.querySelector('.fo-page.ee-page')!
  expect(page.querySelector('.fo-hero')).not.toBeNull()
  expect(page.querySelector('.glass, .card, .mz-card, .mz-eyebrow, .tv-dayedit')).toBeNull()
})
