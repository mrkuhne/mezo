import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { http } from 'msw'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { FuelKamraPage } from '@/features/fuel/pages/FuelKamraPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ingredients } from '@/data/fuel/pantry'

// FuelKamraPage reads usePantry (a dual-mode TanStack query since Task 7). Pin mock
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
          <Route path="/fuel/kamra" element={<FuelKamraPage />} />
          <Route path="/fuel/kamra/:id" element={<LocationProbe />} />
          <Route path="/fuel/konyha" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )

// Folyadék váz (mezo-n4wf5.5, prototípus `kamra()`): hős (négy üveg fajtánként + ítélet-mondat + a három
// felvevő művelet) → kereső + darabszámos fajta-szűrők → két-hasábos csempe-rács. A cím a keretben él
// (`useFrameTitle`); keret nélkül a lap a saját vissza-gombját rajzolja, ami a Konyhába visz.
test('Folyadék váz: hős, kereső, darabszámos fajta-szűrők, csempe-rács', () => {
  const { container } = renderView()
  expect(container.querySelector('.mz-page, .fmx-page, .glass, .fkx-item')).toBeNull()
  expect(screen.queryByText('Polc')).toBeNull()
  const hero = container.querySelector('.fo-hero')!
  expect(hero).toHaveTextContent('A polcod · fajtánként')
  expect(hero).toHaveTextContent(/\d+ tétel van a polcodon: \d+ étel és \d+ kiegészítő\./)
  expect(hero.querySelectorAll('.fo-vial, .fo-vials > *').length).toBeGreaterThanOrEqual(4)
  expect(screen.getByRole('button', { name: 'Vissza a Konyhába' })).toBeInTheDocument()
  expect(screen.getByLabelText('Keresés a kamrában')).toBeInTheDocument()
  // The type axis — FIVE pills (audit gap #19: med gets its own Gyógyszer pill instead of folding
  // silently into "Mind"). „Supp / Stim" → „Kiegészítő / Stimuláns" (wording table, mezo-n4wf5.5).
  const kinds = container.querySelector('[data-kalauz-anchor="kamra-tabs"]')!
  expect(kinds).toHaveAttribute('role', 'group')
  expect(screen.getByRole('button', { name: /^Kiegészítő\d+$/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Stimuláns\d+$/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Gyógyszer\d+$/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Mind\d+$/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('button', { name: /^Supp|^Stim\d/ })).toBeNull()
  expect(container.querySelectorAll('.fp-shelf .fo-stats > button.fo-stat').length).toBeGreaterThan(0)
})

// A csempe szintje a fehérje-sűrűség (25 g / 100 g-nál tele), és CSAK ismert fehérjénél rajzolódik:
// őszinte null — „—" / „nincs adat", sosem 0 (pantry.md §4). Kiegészítőnél az adag áll, szint nélkül.
test('a csempe szintje a fehérje-sűrűség; kiegészítőnél nincs szint', () => {
  const { container } = renderView()
  const tile = (name: RegExp) => [...container.querySelectorAll<HTMLElement>('.fp-shelf button.fo-stat')].find(b => name.test(b.textContent ?? ''))!
  const chicken = tile(/Csirkemell/)
  expect(chicken).toHaveClass('lv')
  expect(chicken.style.getPropertyValue('--p')).toBe('92%') // 23 g / 25 g
  expect(chicken).toHaveTextContent('kcal / 100 g')
  expect(chicken).toHaveTextContent(/23 g fehérje · .* · katalógus/)
  const supp = [...container.querySelectorAll<HTMLElement>('.fp-shelf button.fo-stat')].find(b => /adag/.test(b.textContent ?? ''))!
  expect(supp).not.toHaveClass('lv')
  expect(supp.style.getPropertyValue('--p')).toBe('')
})

test('tápérték nélküli étel: „—" és „nincs adat", szint nélkül (őszinte null)', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(['pantry'], {
    ingredients: [{ ...ingredients[0], id: 'no-macro', name: 'Házi baracklekvár', brand: null, source: 'manual', macros: undefined }],
    stash: [], imports: [], suggestions: [],
  })
  const { container } = render(
    <QueryClientProvider client={qc}><MemoryRouter><FuelKamraPage /></MemoryRouter></QueryClientProvider>,
  )
  const tile = container.querySelector('.fp-shelf button.fo-stat')!
  expect(tile).not.toHaveClass('lv')
  expect(tile.querySelector('.fo-stat-n')!.textContent).toBe('—')
  expect(tile).toHaveTextContent('nincs adat · kézi')
  expect(tile.textContent).not.toMatch(/\b0\b/)
})

// Üres polc (prototípus `kamra.ures`): a hős négy üres üveggel hív, és ugyanaz a három művelet áll rajta.
test('üres kamra: a hős hív az első tétel felvételére', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(['pantry'], { ingredients: [], stash: [], imports: [], suggestions: [] })
  render(<QueryClientProvider client={qc}><MemoryRouter><FuelKamraPage /></MemoryRouter></QueryClientProvider>)
  expect(screen.getByText('A kamra üres.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Keresés a kamrában')).toBeNull()
  expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Közös katalógus' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Első tétel felvétele' }))
  expect(await screen.findByText('Új kamra-tétel')).toBeInTheDocument()
})

// B14 owner-DROP: a „Legutóbbi importok" feed leválik — az eredet a tétel részletlapján él.
test('a kamrában nincs import-előzmény lista', () => {
  renderView()
  expect(screen.queryByText(/Legutóbbi importok/i)).toBeNull()
  expect(screen.queryByText(/Legutóbb érkezett/i)).toBeNull()
})

// B16 owner-DROP: a készlet/lejárat felület a zászló mögött marad, és ez a lap nem is említi.
test('a kamra nem hivatkozik készletre vagy lejáratra', () => {
  const { container } = renderView()
  expect(container.textContent).not.toMatch(/készlet|lejárat/i)
})

// B13: az okosabb csere ott marad, ahol volt.
test('az okosabb csere szekció megmarad', () => {
  renderView()
  expect(screen.getByRole('heading', { name: /Okosabb csere$/ })).toBeInTheDocument()
  // a javaslat kártyája NEM koppintható (owner: a koppintható csere-javaslat kikerült)
  const swap = document.querySelector('.fp-swap')!
  expect(swap.tagName).toBe('DIV')
  expect(swap.querySelector('button, a')).toBeNull()
})

test('Gyógyszer segment isolates medication items (honestly empty — mock tracks no medication)', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /^Gyógyszer/ }))
  // The mock seed has no `type: 'medication'` stash row today (Medication is a separate
  // entity from the pantry, per fuel-audit gap #19/F6.4) — the segment must filter out
  // every food item and land on the honest no-hit state, never fabricate a row.
  expect(screen.queryByText(/Csirkemell/)).not.toBeInTheDocument()
  expect(screen.getByText('Nincs egyező tétel.')).toBeInTheDocument()
})
test('header "Új tétel" opens the manual add-item sheet', async () => {
  // Task 8: the header add affordance opens the real manual CRUD form (AddPantryItemSheet).
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Új tétel/ }))
  expect(await screen.findByText('Új kamra-tétel')).toBeInTheDocument()
})
test('header "Közös" opens the catalog search sheet', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Közös/ }))
  expect(screen.getByText('Hozzáadás a közösből')).toBeInTheDocument()
})
test('type switcher filters the list to one type', async () => {
  renderView()
  // A food item is visible in "Mind"; switching to Stim hides it.
  expect(screen.getByText(/Csirkemell/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /^Stimuláns/ }))
  expect(screen.queryByText(/Csirkemell/)).not.toBeInTheDocument()
})
test('query filters to empty-state', async () => {
  renderView()
  await userEvent.type(screen.getByLabelText('Keresés a kamrában'), 'zzzznope')
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
  await userEvent.click(screen.getByRole('button', { name: /Szűrés · \d+ tétel/ }))

  // Once the sheet has closed, only fruits remain — Banán stays, Csirkemell (protein)
  // is filtered out, and the "Szűrők" link names the active count; the chosen category
  // stands as its own removable pill.
  await waitFor(() => expect(screen.queryByRole('button', { name: /Szűrés ·/ })).not.toBeInTheDocument())
  expect(screen.getByText(/Banán/)).toBeInTheDocument()
  expect(screen.queryByText(/Csirkemell/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Szűrők · 1 kategória' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Gyümölcs szűrő levétele' }))
  expect(screen.getByText(/Csirkemell/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Szűrők · kategória szerint' })).toBeInTheDocument()
})

// Loading skeleton (mezo-f2z) — real mode shows the KamraSkeleton (role="status")
// while the pantry query is unresolved; mock mode seeds synchronously → no skeleton.
function renderPlain() {
  return render(
    <QueryWrapper>
      <MemoryRouter><FuelKamraPage /></MemoryRouter>
    </QueryWrapper>,
  )
}

describe('FuelKamraPage (real mode, pending)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())
  it('shows the skeleton while the pantry query is unresolved', async () => {
    server.use(http.get(`${API_BASE}/api/pantry`, () => new Promise(() => {})))
    renderPlain()
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })
})

describe('FuelKamraPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())
  it('renders content with no skeleton (synchronous seed)', () => {
    renderPlain()
    expect(screen.queryByRole('status')).toBeNull()
  })
})

// Folyadék (mezo-n4wf5.5): a lapon nincs belépő-koreográfia (`EntranceGroup` / `.rise`) — a szintek a kit
// CSS-ével emelkednek, csak `prefers-reduced-motion: no-preference` alatt. A régi „árva .rise" hiba (fidelity
// audit, mezo-d20.11) így szerkezetileg nem tud visszajönni: egyetlen `.rise` sincs a lapon.
describe('FuelKamraPage entrance choreography', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('carries no .rise at all (no orphan can exist)', () => {
    const { container } = renderView()
    expect(container.querySelector('.fo-page')).not.toBeNull()
    expect(container.querySelectorAll('.rise')).toHaveLength(0)
    expect(container.querySelector('.mz-play')).toBeNull()
  })
})
