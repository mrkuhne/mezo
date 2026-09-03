import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { http } from 'msw'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { FuelKamraPage } from '@/features/fuel/pages/FuelKamraPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

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
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )

test('renders the Mozaik subpage hero, stats and the type switcher', () => {
  renderView()
  // Kamra v2 (Mozaik re-face): the subpage hero reads "Kamra" (prototype fuel-body
  // #page-kamra .nm), and the "Polc" list-section head sits above the grouped list.
  expect(screen.getByText('Kamra')).toBeInTheDocument()
  expect(screen.getByText('Polc')).toBeInTheDocument()
  // Back chip reads "‹ Fuel" visibly; its accessible name stays the house "Vissza".
  expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent('‹ Fuel')
  // The type axis is a segmented switcher — now FIVE segments (audit gap #19: med gets
  // its own Gyógyszer segment instead of folding silently into "Mind").
  expect(screen.getByRole('button', { name: /Supp/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Gyógyszer/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Mind\d+$/ })).toBeInTheDocument()
})
test('Gyógyszer segment isolates medication items (honestly empty — mock tracks no medication)', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: /Gyógyszer/ }))
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

// Silent-static regression (fidelity audit, mezo-d20.11): the page carried three `.rise`
// elements with NO EntranceGroup around them — they rendered correctly, never animated, and
// nothing failed. Both halves are pinned here: the wrapper exists AND no `.rise` sits outside it.
describe('FuelKamraPage entrance choreography', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('arms an EntranceGroup and leaves no orphan .rise outside it', () => {
    const { container } = renderView()
    const play = container.querySelector('.mz-play')
    expect(play).not.toBeNull()
    const all = [...container.querySelectorAll('.rise')]
    expect(all.length).toBeGreaterThan(2)
    expect(all.every(el => play?.contains(el))).toBe(true)
  })

  it('staggers the stat strip, the type switcher, the search row and the shelf head', () => {
    const { container } = renderView()
    const delays = [...container.querySelectorAll('.mz-play .rise')]
      .map(el => (el as HTMLElement).style.getPropertyValue('--d'))
    expect(delays.slice(0, 4)).toEqual(['20ms', '40ms', '60ms', '90ms'])
  })
})
