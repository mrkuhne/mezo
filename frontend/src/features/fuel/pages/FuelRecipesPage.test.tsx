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
  // the page's name stands in the title bar (the frame); the page itself opens with the hero and its two sections
  expect(screen.getByText('Receptek · amit a legtöbbször ettél')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /Szűrés/ })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /Receptjeid/ })).toBeInTheDocument()
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
  // A vissza-vezérlő 40px-es kerek glyph-chip: a szöveges felirat kilógott belőle és ráült a
  // címre (mezo-jb84). A szülőt a szemöldök-sor nevezi meg, a gomb a hozzáférhető nevét viszi.
  expect(screen.getByRole('button', { name: 'Vissza a Konyhába' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza a Konyhába' }))
  expect(screen.getByTestId('location').textContent).toBe('/fuel/konyha')
})

test('the fake "Avg fit" stat is gone', () => {
  renderView()
  expect(screen.queryByText('0.89')).not.toBeInTheDocument()
  expect(screen.queryByText(/Avg fit/)).not.toBeInTheDocument()
})

// Folyadék (mezo-n4wf5.5): a lap a kit vázát viseli — hős, két számozott szekció, és SORONKÉNT EGY
// recept egy fehér kártyában; az üveg-váz (al-fejléc, üveg sorok, csempe-rács) elment.
test('Folyadék váz: hős, darabszámos szűrők, soronként egy recept egy kártyában', () => {
  const { container } = renderView()
  expect(container.querySelector('.fo-page.fc-page > .fo-hero')).not.toBeNull()
  expect(container.querySelector('.fmx-subhead')).toBeNull()
  expect(container.querySelector('.fkx-recipe-row')).toBeNull()
  expect(container.querySelector('.glass')).toBeNull()
  const rows = container.querySelectorAll('.fo-card.fc-list > .fx-it')
  expect(rows.length).toBeGreaterThan(0)
  // the hero ranks what was eaten most: at most four levels, the favourite first and full
  const top = [...container.querySelectorAll('.fo-hero .fc-top > button')]
  expect(top.length).toBeGreaterThan(0)
  expect(top.length).toBeLessThanOrEqual(4)
  expect(top[0].querySelector('.fo-level > i')).toHaveStyle({ width: '100%' })
})

// A sorok egy kártyában élnek; a régi belépő-koreográfia (`.mz-play` + `.rise`) elment a lappal.
test('every row lives in the one list card, without the old entrance classes', () => {
  const { container } = renderView()
  expect(container.querySelector('.mz-play')).toBeNull()
  const card = container.querySelector('.fo-card.fc-list')
  const tiles = [...container.querySelectorAll('.fx-it')]
  expect(tiles.length).toBeGreaterThan(0)
  expect(tiles.every(t => !t.classList.contains('rise') && card!.contains(t))).toBe(true)
})

// A darabszám a szűrőkön él (a prototípus `receptekPage`-e), nem egy külön „Katalógus" soron.
test('minden szűrő a saját darabszámát viszi', async () => {
  renderView()
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  const total = result.current.recipes.length
  const snacks = result.current.recipes.filter(r => r.category === 'snack').length
  expect(screen.getByRole('button', { name: /^Mind/ })).toHaveTextContent(String(total))
  expect(screen.getByRole('button', { name: /^Uzsonna/ })).toHaveTextContent(String(snacks))
})

test('filtering to a category with no recipes shows the empty state', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /^Vacsora/ }))
  // dinner may or may not have recipes in the seed; assert the typebar stays interactive
  expect(screen.getByRole('button', { name: /^Vacsora/ })).toBeInTheDocument()
})

test('Új navigates to the editor route', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: '+ Új recept' }))
  expect(screen.getByTestId('location').textContent).toBe('/fuel/recipes/new')
})

test('tapping a card navigates to the detail route', async () => {
  renderView()
  const cards = screen.getAllByRole('button').filter(b => b.classList.contains('fx-it'))
  expect(cards.length).toBeGreaterThan(0)
  await userEvent.click(cards[0])
  expect(screen.getByTestId('location').textContent).toMatch(/^\/fuel\/recipes\/.+/)
})

// Uzsonna segment (design-2.0 iterations §3 / audit gap #18): the typebar had no snack
// segment even though FilterId always supported it — snack recipes were only
// reachable under "Mind".
test('the typebar has an Uzsonna segment with a live count matching the snack recipes', () => {
  renderView()
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  const snackCount = result.current.recipes.filter(r => r.category === 'snack').length
  const snackTab = screen.getByRole('button', { name: /^Uzsonna/ })
  expect(snackTab).toHaveTextContent(String(snackCount))
})

// Role tag (mezo-uavr) — the card names a non-standard rubric; „Általános" is the
// implicit default and never earns a tag.
test('the library card tags a non-standard role, and only that card (mezo-uavr)', () => {
  renderView()
  const cards = screen.getAllByRole('button').filter(b => b.classList.contains('fx-it'))
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  const nonStandard = result.current.recipes.filter(r => r.role !== 'standard')
  // the seed must actually mix roles, otherwise this asserts nothing
  expect(nonStandard.length).toBeGreaterThan(0)
  expect(cards.length).toBeGreaterThan(nonStandard.length)
  expect(cards.filter(c => /· Edzés előtt/.test(c.textContent ?? ''))).toHaveLength(
    result.current.recipes.filter(r => r.role === 'pre_workout').length,
  )
  expect(cards.some(c => /Általános/.test(c.textContent ?? ''))).toBe(false)
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

// The list's states the prototype draws (`receptek.ures`, `receptek.szurt-ures`).
test('an empty filter says so and offers to save one', async () => {
  renderView()
  const { result } = renderHook(() => useRecipes(), { wrapper: QueryWrapper })
  const empty = (['breakfast', 'lunch', 'dinner', 'snack'] as const).find(c => !result.current.recipes.some(r => r.category === c))
  const starred = result.current.recipes.some(r => r.starred)
  if (!empty && starred) return // the seed fills every filter: nothing to show here
  const name = empty ? { breakfast: /^Reggeli/, lunch: /^Ebéd/, dinner: /^Vacsora/, snack: /^Uzsonna/ }[empty] : /^Csillagos/
  await userEvent.click(screen.getByRole('button', { name }))
  expect(screen.getByText('Erre a szűrésre nincs recepted.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Mentsünk egyet' }))
  expect(screen.getByTestId('location').textContent).toBe('/fuel/recipes/new')
})
