import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { RunningBlockBuilder } from './RunningBlockBuilder'

// Asserts the Phase-1 mock running block (rb-active-01), so pin mock mode —
// useRunning seeds the blocks query synchronously via initialData in mock mode.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function setup() {
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/train/futas/rb-active-01']}>
          <Routes>
            <Route path="/train/futas/:id" element={<RunningBlockBuilder />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryWrapper>,
  )
}

test('renders the active block title and its single lifecycle action (no Save button)', () => {
  setup()
  expect(screen.getByDisplayValue('Robbanékonyság 01')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Mentés/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Lezárás' })).toBeInTheDocument()
})

test('the sprint kör stepper shows the week value and increments on +', async () => {
  const user = userEvent.setup()
  setup()
  // rb-active-01 currentWeek=3 -> week 3 sprint rounds = 6 selected initially.
  const stepper = screen.getByText('kör').closest('div')!
  expect(stepper).toHaveTextContent('6')
  await user.click(screen.getByRole('button', { name: 'kör növelése' }))
  expect(stepper).toHaveTextContent('7')
})

test('editing the sprint weekday updates it across the plan', async () => {
  const user = userEvent.setup()
  setup()
  // Sprint defaults to Kedd; pick Szerda. The grid is single-select per session.
  const grids = screen.getAllByRole('button', { name: 'Sze' })
  await user.click(grids[0])
  expect(grids[0]).toHaveAttribute('aria-pressed', 'true')
})

test('a planned block exposes Aktiválás, an 8-week cap on the week adder', async () => {
  // rb-planned-01 is 6 weeks; add up to 8 then the ＋ disappears.
  render(
    <QueryWrapper><ThemeProvider>
      <MemoryRouter initialEntries={['/train/futas/rb-planned-01']}>
        <Routes><Route path="/train/futas/:id" element={<RunningBlockBuilder />} /></Routes>
      </MemoryRouter>
    </ThemeProvider></QueryWrapper>,
  )
  expect(screen.getByRole('button', { name: /Aktiválás/ })).toBeInTheDocument()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Hét hozzáadása' }))
  await user.click(screen.getByRole('button', { name: 'Hét hozzáadása' }))
  expect(screen.queryByRole('button', { name: 'Hét hozzáadása' })).not.toBeInTheDocument() // at 8
})
