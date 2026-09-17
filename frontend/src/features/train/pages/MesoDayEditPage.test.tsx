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
  expect(screen.getByText(/A NAP SZERKESZTÉSE/i)).toBeInTheDocument()
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
})
