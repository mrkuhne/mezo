import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { FuelMaiPage } from '@/features/fuel/pages/FuelMaiPage'
import { QueryWrapper } from '@/test/queryWrapper'

// FuelMaiPage reads the composed dual-mode useFuelDay (mezo-arb); pin mock mode for the static
// Phase-1 seed (consumed 1840, scored meals with breakdowns) and provide a QueryClientProvider.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderView = () =>
  render(
    <QueryWrapper>
      <MemoryRouter><FuelMaiPage /></MemoryRouter>
    </QueryWrapper>,
  )

test('renders header, macro hero, timeline and micronutrients', () => {
  renderView()
  expect(screen.getByRole('heading', { name: 'Pacing' })).toBeInTheDocument()
  expect(screen.getByText(/1840/)).toBeInTheDocument()
  expect(screen.getByText('Mikrotápanyagok · heti')).toBeInTheDocument()
})
test('shows the protocol-meta row when a protocol is active (mock, v3)', () => {
  renderView()
  expect(screen.getByText(/Stack · v3/)).toBeInTheDocument()
})
test('hides the protocol-meta row when there is no active protocol (real-mode ghost v0)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderView()
  await screen.findByRole('heading', { name: 'Pacing' })
  expect(screen.queryByText(/Stack · v/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Replan' })).not.toBeInTheDocument()
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
test('real mode: the context strip shows schedule-derived values (kitchen close, coffee cutoff)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderView()
  await screen.findByRole('heading', { name: 'Pacing' })
  // Derived from the default wake/bed rhythm: kitchen close = bed(23:00) − 90m = 21:30,
  // caffeine cutoff pinned 14:00 (both are planner-composed, not the frozen mock plan).
  expect(screen.getByText('Kitchen')).toBeInTheDocument()
  expect(screen.getByText('Coffee')).toBeInTheDocument()
  expect(screen.getAllByText('21:30').length).toBeGreaterThanOrEqual(1) // Kitchen-close cell (+ the Vacsora window snaps here)
  expect(screen.getByText('14:00')).toBeInTheDocument()                 // Coffee-cutoff cell
})
