import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { FuelKamraView } from './FuelKamraView'
import { QueryWrapper } from '@/test/queryWrapper'

// FuelKamraView reads usePantry (a dual-mode TanStack query since Task 7). Pin mock
// mode for the static seed + wrap in a QueryClientProvider.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

// Surfaces the current path so the navigate-on-card-click assertion can read it.
function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}

const renderView = () =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/fuel/kamra']}>
        <Routes>
          <Route path="/fuel/kamra" element={<FuelKamraView />} />
          <Route path="/fuel/kamra/:id" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )

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
test('clicking a card navigates to the item detail route', async () => {
  renderView()
  await userEvent.click(screen.getByText(/Csirkemell/))
  // The detail route owns the path /fuel/kamra/:id — the food ingredient id is its raw id.
  expect(screen.getByTestId('location').textContent).toBe('/fuel/kamra/ing-csirkemell')
})
test('Szűrők sheet selects a category and AND-filters the list', async () => {
  renderView()
  // A protein (Csirkemell) and a fruit (Banán) are both visible initially.
  expect(screen.getByText(/Csirkemell/)).toBeInTheDocument()
  expect(screen.getByText(/Banán/)).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: /Szűrők/ }))
  // The sheet lists present categories with counts — pick "Gyümölcs" (fruit).
  await userEvent.click(await screen.findByRole('button', { name: /Gyümölcs/ }))
  await userEvent.click(screen.getByRole('button', { name: /Szűrés \(/ }))

  // Once the sheet has closed, only fruits remain — Banán stays, Csirkemell (protein)
  // is filtered out, and the "Szűrők" button carries the active-count badge.
  await waitFor(() => expect(screen.queryByRole('button', { name: /Szűrés \(/ })).not.toBeInTheDocument())
  expect(screen.getByText(/Banán/)).toBeInTheDocument()
  expect(screen.queryByText(/Csirkemell/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Szűrők\s*1/ })).toBeInTheDocument()
})
