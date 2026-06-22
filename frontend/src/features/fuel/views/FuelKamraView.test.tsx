import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { FuelKamraView } from './FuelKamraView'
import { QueryWrapper } from '@/test/queryWrapper'

// FuelKamraView reads usePantry (a dual-mode TanStack query since Task 7). Pin mock
// mode for the static seed + wrap in a QueryClientProvider.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())
const renderView = () =>
  render(<QueryWrapper><MemoryRouter><FuelKamraView /></MemoryRouter></QueryWrapper>)

test('renders stats, type filters and grouped items', () => {
  renderView()
  expect(screen.getByRole('heading', { name: 'Polc' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Supplement' })).toBeInTheDocument()
})
test('header "Új tétel" opens the manual add-item sheet', async () => {
  // Task 8: the header add affordance now opens the real manual CRUD form
  // (AddPantryItemSheet), not the scrape wizard.
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Új tétel/ }))
  expect(await screen.findByText('Új kamra-tétel')).toBeInTheDocument()
})
test('scrape-feed card still opens the scrape import sheet', async () => {
  // The scrape wizard moved off the header chip onto the recent-imports feed card.
  renderView()
  await userEvent.click(screen.getByText(/Scrape feed/))
  expect(await screen.findByText('Új tétel a Kamrába')).toBeInTheDocument()
})
test('query filters to empty-state', async () => {
  renderView()
  await userEvent.type(screen.getByPlaceholderText(/Keress tétel/), 'zzzznope')
  expect(screen.getByText('Nincs egyező tétel.')).toBeInTheDocument()
})
