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

test('renders the active block title and its lifecycle actions', () => {
  setup()
  // The title lives in an editable input.
  expect(screen.getByDisplayValue('Robbanékonyság 01')).toBeInTheDocument()
  // Save is always present; the active status surfaces "Blokk lezárása".
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Blokk lezárása' })).toBeInTheDocument()
})

test('the sprint kör stepper shows the week value and increments on +', async () => {
  const user = userEvent.setup()
  setup()
  // rb-active-01 currentWeek=3 → week 3 sprint rounds = 6 is selected initially.
  const stepper = screen.getByText('kör').closest('div')!
  expect(stepper).toHaveTextContent('6')
  await user.click(screen.getByRole('button', { name: 'kör növelése' }))
  expect(stepper).toHaveTextContent('7')
})
