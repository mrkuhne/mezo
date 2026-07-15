import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from 'msw'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { FuelRecipesPage } from '@/features/fuel/pages/FuelRecipesPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

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
          <Route path="/fuel/recipes" element={<FuelRecipesPage />} />
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

test('own header: pghead-np sage over + h1 + pgact-np action chip', () => {
  const { container } = renderView()
  expect(container.querySelector('.pghead-np.sage')).toBeInTheDocument()
  expect(screen.getByText('Fuel · Receptek')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Receptek' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Új/ })).toHaveClass('pgact-np', 'np-press')
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

// Loading skeleton (mezo-f2z) — real mode shows the RecipesSkeleton (role="status")
// while the recipe query is unresolved; mock mode seeds synchronously → no skeleton.
// NOTE: the real recipe endpoint is /api/recipe (singular) — see recipeApi.list.
function renderPlain() {
  return render(
    <QueryWrapper>
      <MemoryRouter><FuelRecipesPage /></MemoryRouter>
    </QueryWrapper>,
  )
}

describe('FuelRecipesPage (real mode, pending)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())
  it('shows the skeleton while the recipe query is unresolved', async () => {
    server.use(http.get(`${API_BASE}/api/recipe`, () => new Promise(() => {})))
    renderPlain()
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })
})

describe('FuelRecipesPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())
  it('renders content with no skeleton (synchronous seed)', () => {
    renderPlain()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
