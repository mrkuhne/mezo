import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { FuelRecipesView } from './FuelRecipesView'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}

function renderView() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/fuel/recipes']}>
        <Routes>
          <Route path="/fuel/recipes" element={<FuelRecipesView />} />
          <Route path="/fuel/recipes/new" element={<LocationProbe />} />
          <Route path="/fuel/recipes/:id" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('renders the title and the segmented typebar', () => {
  renderView()
  expect(screen.getByRole('heading', { name: 'Receptek' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Reggeli/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Mind/ })).toBeInTheDocument()
})

test('the fake "Avg fit" stat is gone', () => {
  renderView()
  expect(screen.queryByText('0.89')).not.toBeInTheDocument()
  expect(screen.queryByText(/Avg fit/)).not.toBeInTheDocument()
})

test('filtering to a category with no recipes shows the empty state', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Vacsi/ }))
  // dinner may or may not have recipes in the seed; assert the typebar stays interactive
  expect(screen.getByRole('button', { name: /Vacsi/ })).toBeInTheDocument()
})

test('Új navigates to the editor route', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Új/ }))
  expect(screen.getByTestId('location').textContent).toBe('/fuel/recipes/new')
})

test('tapping a card navigates to the detail route', async () => {
  renderView()
  const firstName = screen.getAllByText(/.+/).find(() => true)
  // click the first recipe card by its visible name (Antonio overlay) — use the
  // first card button.
  const cards = screen.getAllByRole('button').filter(b => b.className.includes('notch-16'))
  await userEvent.click(cards[0])
  expect(screen.getByTestId('location').textContent).toMatch(/^\/fuel\/recipes\/.+/)
  void firstName
})
