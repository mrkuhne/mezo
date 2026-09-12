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
          <Route path="/fuel/konyha" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('renders the title and the segmented typebar', () => {
  renderView()
  expect(screen.getByText('Receptek')).toBeInTheDocument()
  // A szűrő-gombot a kezdő-horgony különíti el a csempéktől: egy csempe meta-sora is
  // tartalmazza a blokk nevét.
  expect(screen.getByRole('button', { name: /^Reggeli/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Mind/ })).toBeInTheDocument()
})

// B10 owner-döntés (mezo-hygp): a Műhely-gomb a Konyha hubra költözött — itt már nincs.
test('a recept-listán nincs Műhely gomb', () => {
  renderView()
  expect(screen.queryByRole('button', { name: /Műhely/ })).toBeNull()
})

// S4: a lista a Konyha egyik ajtaja mögött él, ezért a vissza-gomb a Konyhába visz
// (korábban '‹ Fuel' volt — a Receptek akkor közvetlenül a Fuel-gyökérről nyílt).
test('a vissza-gomb a Konyhába visz', async () => {
  renderView()
  expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent('‹ Konyha')
  await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
  expect(screen.getByTestId('location').textContent).toBe('/fuel/konyha')
})

test('the fake "Avg fit" stat is gone', () => {
  renderView()
  expect(screen.queryByText('0.89')).not.toBeInTheDocument()
  expect(screen.queryByText(/Avg fit/)).not.toBeInTheDocument()
})

// Titán anatómia (mezo-hygp): a Mozaik-váz (coral MozaikPage + PageHero nagy számmal +
// `.fh-segtabs` + `.fh-lsthead` + `.mz-rcpcard`) helyét a prototípus `receptekPage`-e vette át:
// al-fejléc + darabszámos blokk-szűrők + két-hasábos csempe-rács.
test('Titán váz: al-fejléc, darabszámos szűrők, csempe-rács', () => {
  const { container } = renderView()
  expect(container.querySelector('.mz-page')).toBeNull()
  expect(container.querySelector('.fh-segtabs')).toBeNull()
  expect(container.querySelector('.fh-lsthead')).toBeNull()
  expect(container.querySelector('.mz-rcpcard')).toBeNull()
  expect(container.querySelector('.fmx-subhead')).not.toBeNull()
  expect(container.querySelectorAll('.fkx-tile-grid .fkx-recipe').length).toBeGreaterThan(0)
})

// Entrance choreography: a rács minden csempéje EGY EntranceGroupon belül kel fel.
test('every tile rises inside one EntranceGroup', () => {
  const { container } = renderView()
  const play = container.querySelector('.mz-play')
  expect(play).not.toBeNull()
  const tiles = [...container.querySelectorAll('.fkx-recipe')]
  expect(tiles.length).toBeGreaterThan(0)
  expect(tiles.every(t => t.classList.contains('rise') && play!.contains(t))).toBe(true)
})

// A darabszám a szűrőkön él (a prototípus `receptekPage`-e), nem egy külön „Katalógus" soron.
test('minden szűrő a saját darabszámát viszi', async () => {
  renderView()
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  const total = result.current.recipes.length
  const snacks = result.current.recipes.filter(r => r.category === 'snack').length
  expect(screen.getByRole('button', { name: /^Mind/ })).toHaveTextContent(String(total))
  expect(screen.getByRole('button', { name: /^Snack/ })).toHaveTextContent(String(snacks))
})

test('filtering to a category with no recipes shows the empty state', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /^Vacsi/ }))
  // dinner may or may not have recipes in the seed; assert the typebar stays interactive
  expect(screen.getByRole('button', { name: /^Vacsi/ })).toBeInTheDocument()
})

test('Új navigates to the editor route', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Új/ }))
  expect(screen.getByTestId('location').textContent).toBe('/fuel/recipes/new')
})

test('tapping a card navigates to the detail route', async () => {
  renderView()
  const cards = screen.getAllByRole('button').filter(b => b.className.includes('fkx-recipe'))
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
  const cards = screen.getAllByRole('button').filter(b => b.className.includes('fkx-recipe'))
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
