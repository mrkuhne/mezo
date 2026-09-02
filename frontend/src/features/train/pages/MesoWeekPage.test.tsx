import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-05-14T09:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

const MESO_ID = 'meso-hyp-04'

function setup(path = `/train/mesocycles/${MESO_ID}/week`) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
  return router
}

test('the hero names this week, the total and the delta vs. last week', () => {
  setup()
  expect(screen.getByText('Heti vizsgálat · 3. hét')).toBeInTheDocument()
  expect(screen.getByText(/a múlt héthez képest/)).toBeInTheDocument()
})

test('the stat strip carries four cells: total, delta, up, hold', () => {
  setup()
  const strip = document.querySelector('.mz-statstrip')!
  expect(strip.textContent).toContain('W3')
  expect(strip.textContent).toContain('vs. W2')
  expect(strip.textContent).toContain('rámpázik')
  expect(strip.textContent).toContain('tart')
})

test('one tile per arc muscle, with landmarks, no percentages', () => {
  setup()
  // meso-hyp-04 carries 8 volumePerMuscle groups — one tile each.
  expect(screen.getAllByRole('button', { name: /részletek$/ })).toHaveLength(8)
  expect(screen.getByText('Hát')).toBeInTheDocument()
  expect(screen.getByText('Mell')).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/%/)
})

test('the emphasized (highest-ceiling) tile leads the mosaic', () => {
  setup()
  const tiles = screen.getAllByRole('button', { name: /részletek$/ })
  // Hát has the highest ceiling (MAV 16) among meso-hyp-04's groups.
  expect(tiles[0]).toHaveAccessibleName('Hát részletek')
})

test('tapping a tile navigates to the muscle page', async () => {
  const router = setup()
  await userEvent.click(screen.getByRole('button', { name: 'Hát részletek' }))
  await waitFor(() => expect(router.state.location.pathname).toBe(`/train/mesocycles/${MESO_ID}/week/back`))
})

test('a mesocycle with no volume profile shows the ghost state, not a broken mosaic', () => {
  setup(`/train/mesocycles/meso-str-02/week`) // planned run — no volumePerMuscle
  expect(screen.getByText('A heti vizsgálat a blokk első edzése után jelenik meg.')).toBeInTheDocument()
})

test('an unknown mesocycle id says so instead of crashing', () => {
  setup('/train/mesocycles/nope/week')
  expect(screen.getByText('Ez a mesociklus nem található.')).toBeInTheDocument()
})
