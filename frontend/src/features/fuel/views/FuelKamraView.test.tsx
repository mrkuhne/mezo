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

test('renders stats and the type switcher', () => {
  renderView()
  expect(screen.getByRole('heading', { name: 'Polc' })).toBeInTheDocument()
  // Direction A: the type axis is a segmented switcher (Mind/Étel/Supp/Stim).
  expect(screen.getByRole('button', { name: /Supp/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Mind\d+$/ })).toBeInTheDocument()
})
test('header "Új tétel" opens the manual add-item sheet', async () => {
  // Task 8: the header add affordance opens the real manual CRUD form (AddPantryItemSheet).
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Új tétel/ }))
  expect(await screen.findByText('Új kamra-tétel')).toBeInTheDocument()
})
test('type switcher filters the list to one type', async () => {
  renderView()
  // A food item is visible in "Mind"; switching to Stim hides it.
  expect(screen.getByText(/Csirkemell/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Stim/ }))
  expect(screen.queryByText(/Csirkemell/)).not.toBeInTheDocument()
})
test('query filters to empty-state', async () => {
  renderView()
  await userEvent.type(screen.getByPlaceholderText(/Keress tétel/), 'zzzznope')
  expect(screen.getByText('Nincs egyező tétel.')).toBeInTheDocument()
})
