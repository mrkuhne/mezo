import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { FuelRecipesView } from './FuelRecipesView'
import { QueryWrapper } from '@/test/queryWrapper'

// RecipeCard (rendered here) reads usePantry — a dual-mode TanStack query since
// Task 7. Pin mock mode + wrap in a QueryClientProvider.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())
const renderView = () =>
  render(<QueryWrapper><MemoryRouter><FuelRecipesView /></MemoryRouter></QueryWrapper>)

test('renders stats, filters and recipe cards', () => {
  renderView()
  expect(screen.getByRole('heading', { name: 'Saját szakácskönyv' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reggeli' })).toBeInTheDocument()
})
test('filtering by query narrows the list to empty', async () => {
  renderView()
  await userEvent.type(screen.getByPlaceholderText(/Keress receptek között/), 'zzzznomatch')
  expect(screen.getByText('Nincs egyező recept.')).toBeInTheDocument()
})
test('Új opens the new-recipe sheet', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Új' }))
  expect(await screen.findByText('Hozz össze valamit')).toBeInTheDocument()
})
