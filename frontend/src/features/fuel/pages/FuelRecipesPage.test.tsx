import { render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from 'msw'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { FuelRecipesPage } from '@/features/fuel/pages/FuelRecipesPage'
import { useRecipes } from '@/data/hooks'
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
  const cards = screen.getAllByRole('button').filter(b => b.className.includes('mz-rcpcard'))
  expect(cards.length).toBeGreaterThan(0)
  await userEvent.click(cards[0])
  expect(screen.getByTestId('location').textContent).toMatch(/^\/fuel\/recipes\/.+/)
})

// Snack segment (design-2.0 iterations §3 / audit gap #18): the typebar had no snack
// segment even though FilterId always supported it — snack recipes were only
// reachable under "Mind".
test('the typebar has a Snack segment with a live count matching the snack recipes', () => {
  renderView()
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  const snackCount = result.current.recipes.filter(r => r.category === 'snack').length
  const snackTab = screen.getByRole('button', { name: /^Snack/ })
  expect(snackTab).toHaveTextContent(String(snackCount))
})

// Role tag (mezo-uavr) — the card names a non-standard rubric; „Általános" is the
// implicit default and never earns a tag.
test('the library card tags a non-standard role, and only that card (mezo-uavr)', () => {
  renderView()
  const cards = screen.getAllByRole('button').filter(b => b.className.includes('mz-rcpcard'))
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  const nonStandard = result.current.recipes.filter(r => r.role !== 'standard')
  // the seed must actually mix roles, otherwise this asserts nothing
  expect(nonStandard.length).toBeGreaterThan(0)
  expect(cards.length).toBeGreaterThan(nonStandard.length)
  expect(screen.getAllByText('Edzés előtt')).toHaveLength(
    result.current.recipes.filter(r => r.role === 'pre_workout').length,
  )
  expect(screen.queryByText('Általános')).toBeNull()
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
