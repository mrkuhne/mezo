import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { FuelMaiView } from '@/features/fuel/views/FuelMaiView'
import { QueryWrapper } from '@/test/queryWrapper'

// FuelMaiView reads the composed dual-mode useFuelDay (mezo-arb); pin mock mode for the static
// Phase-1 seed (consumed 1840, scored meals with breakdowns) and provide a QueryClientProvider.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderView = () =>
  render(
    <QueryWrapper>
      <MemoryRouter><FuelMaiView /></MemoryRouter>
    </QueryWrapper>,
  )

test('renders header, macro hero, timeline and micronutrients', () => {
  renderView()
  expect(screen.getByRole('heading', { name: 'Pacing' })).toBeInTheDocument()
  expect(screen.getByText(/1840/)).toBeInTheDocument()
  expect(screen.getByText('Mikrotápanyagok · heti')).toBeInTheDocument()
})
test('opening a meal score sheet then closing it', async () => {
  renderView()
  await userEvent.click(screen.getAllByRole('button', { name: /AI/ })[0])
  expect(await screen.findByText('Súlyozott bontás')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
  await waitFor(() => expect(screen.queryByText('Súlyozott bontás')).not.toBeInTheDocument())
})
test('Replan button opens the replan sheet', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Replan' }))
  expect(await screen.findByText(/Replan · Mezo/)).toBeInTheDocument()
})
test('opens the LogMealSheet from the ＋ Log entry', async () => {
  renderView()
  fireEvent.click(screen.getByRole('button', { name: /log/i }))
  expect(await screen.findByText('Mit ettél?')).toBeInTheDocument()
})
