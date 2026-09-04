import type { ReactNode } from 'react'
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { KamraItemDetailPage, inputFromItem } from '@/features/fuel/pages/KamraItemDetailPage'
import { usePantry } from '@/data/hooks'
import { ingredients } from '@/data/fuel/pantry'
import type { PantryItem } from '@/data/types'

// KamraItemDetailPage reads usePantry (a dual-mode TanStack query). Pin mock mode.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}

// Renders the detail page for `id` under a shared QueryClient so deleteItem and the
// read hook see the same ['pantry'] cache.
function renderDetail(id: string, qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/fuel/kamra/${id}`]}>
        <Routes>
          <Route path="/fuel/kamra/:id" element={<KamraItemDetailPage />} />
          <Route path="/fuel/kamra" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const newQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

test('back chip reads "‹ Kamra" (Kamra v2 Mozaik re-face, mezo-d20.4.5)', () => {
  // Was a standalone "Fuel · Kamra" breadcrumb line (Direction A) — the prototype's
  // #page-kitem carries no separate eyebrow, just the back chip itself as the trail.
  renderDetail('ing-csirkemell', newQc())
  expect(screen.getByRole('button', { name: 'Vissza' })).toHaveTextContent('‹ Kamra')
})

test('renders a food item with macros + extended nutrients', () => {
  // ing-csirkemell · Csirkemell · friss — macros 110/23/0/1.5, protein category.
  renderDetail('ing-csirkemell', newQc())
  expect(screen.getByText(/Csirkemell/)).toBeInTheDocument()
  // Makró cells (prototype fuel-body kihead: value + unit fused in one node, e.g. "23 g").
  expect(screen.getByText('110')).toBeInTheDocument() // kcal — the one unitless cell
  expect(screen.getByText('23 g')).toBeInTheDocument() // protein
  // Tápanyag section labels present, lowercase per the prototype's ncell() copy.
  expect(screen.getByText('rost')).toBeInTheDocument()
  expect(screen.getByText('cukor')).toBeInTheDocument()
  expect(screen.getByText('tel. zsír')).toBeInTheDocument()
})
test('a nutrient the seed never recorded renders the honest dash, not a fabricated 0', () => {
  // ing-kreatin carries macros (all zero, real values) but no fiberG/sugarG/saltG/
  // saturatedFatG at all — every Tápanyag cell must show "—".
  renderDetail('ing-kreatin', newQc())
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4)
})

test('a missing id shows the not-found fallback', () => {
  renderDetail('does-not-exist', newQc())
  expect(screen.getByText('Nincs ilyen tétel.')).toBeInTheDocument()
})

test('Szerkesztés opens the edit drawer prefilled', async () => {
  renderDetail('ing-csirkemell', newQc())
  await userEvent.click(screen.getByRole('button', { name: /Szerkesztés/ }))
  // The editor opens with the item name prefilled.
  expect(await screen.findByText('Tétel szerkesztése')).toBeInTheDocument()
  expect((screen.getByLabelText(/név/i) as HTMLInputElement).value).toMatch(/Csirkemell/)
})

test('opens LogFlowPage pre-filled when "+ Logolás" is tapped', async () => {
  renderDetail('ing-csirkemell', newQc())
  await screen.findByText(/Csirkemell/)
  fireEvent.click(screen.getByRole('button', { name: /logolás/i }))
  expect(await screen.findByText('Mit ettél?')).toBeInTheDocument()
})

test('Törlés is two-tap (Kamra v2): the first press only arms confirmation, no delete yet', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => usePantry(), { wrapper })
  await waitFor(() => expect(result.current.ingredients.some(i => i.id === 'ing-csirkemell')).toBe(true))

  renderDetail('ing-csirkemell', qc)
  await userEvent.click(screen.getByRole('button', { name: 'Törlés' }))

  // Armed: the button re-labels itself as the prototype's re-arm copy, nothing deleted yet.
  expect(await screen.findByRole('button', { name: /Biztos\? Még egy érintés a törléshez/ })).toBeInTheDocument()
  expect(result.current.ingredients.some(i => i.id === 'ing-csirkemell')).toBe(true)
  expect(screen.queryByTestId('location')).toBeNull()
})

test('Törlés deletes the food item (raw id) on the SECOND tap and navigates back to the list', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => usePantry(), { wrapper })
  await waitFor(() => expect(result.current.ingredients.some(i => i.id === 'ing-csirkemell')).toBe(true))

  renderDetail('ing-csirkemell', qc)
  await userEvent.click(screen.getByRole('button', { name: 'Törlés' }))
  await userEvent.click(screen.getByRole('button', { name: /Biztos\?/ }))

  // The food ingredient (raw id, no 'stash-' prefix) actually leaves the cache.
  await waitFor(() => expect(result.current.ingredients.some(i => i.id === 'ing-csirkemell')).toBe(false))
  // ...and the page navigated back to the list — live-updating the shared usePantry() cache
  // means the list's hero/stats/rows all reflect the deletion with no extra plumbing.
  expect(screen.getByTestId('location').textContent).toBe('/fuel/kamra')
})

test('Törlés on a stash supplement deletes via the unprefixed backend id (second tap)', async () => {
  // Regression cover for the 'stash-' prefix strip (mezo-9xu lineage): the stash card
  // id is 'stash-<id>' but deleteItem must hit '<id>'.
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => usePantry(), { wrapper })
  const stashId = result.current.stash.find(s => !result.current.ingredients.some(i => i.stashRefId === s.id))!.id

  renderDetail(`stash-${stashId}`, qc)
  await userEvent.click(screen.getByRole('button', { name: 'Törlés' }))
  await userEvent.click(screen.getByRole('button', { name: /Biztos\?/ }))

  await waitFor(() => expect(result.current.stash.some(s => s.id === stashId)).toBe(false))
  expect(screen.getByTestId('location').textContent).toBe('/fuel/kamra')
})

test('a supplement in today\'s stack shows the "a stackben" cross-link chip', () => {
  // Kreatin is both an Ingredient (stashRefId: 'kreatin') AND a stash-derived stack
  // occurrence anchored to the 'wake' zone — the chip must resolve via stashRefId,
  // not the displayed backend id (they differ for this dual-represented item).
  renderDetail('ing-kreatin', newQc())
  expect(screen.getByText(/a stackben · Ébredés/)).toBeInTheDocument()
})

test('"Receptekben" chips surface the real recipes that use this ingredient (audit gap #5)', () => {
  // ing-csirkemell is used by 'Csirke + édesburgonya + spenót' in the mock seed —
  // usedInRecipes is a bare count on the contract; this cross-references the live
  // Recipe.ingredients instead of trusting that stale counter.
  renderDetail('ing-csirkemell', newQc())
  expect(screen.getByText('Csirke + édesburgonya + spenót')).toBeInTheDocument()
})

test('a pantry item with no recipe references hides the "Receptekben" section entirely', () => {
  renderDetail('ing-kreatin', newQc())
  expect(screen.queryByText(/Receptekben/)).not.toBeInTheDocument()
})

test('a dose/protocol supplement with an always-present but all-null macros object hides "+ Logolás" (mezo-qooi)', () => {
  // Real-mode shape: PantryMapper.toSupplementResponse always builds a macros object now, so a
  // pure dose item (kreatin/D3/gyógyszer) arrives as { kcal: null, p: null, c: null, f: null } —
  // truthy, not absent. `{item.macros && ...}` would show the CTA on every such row; the gate
  // must check hasAnyMacro (all-null => no macro data => nothing to log).
  const qc = newQc()
  qc.setQueryData(['pantry'], {
    ingredients: [],
    stash: [{
      id: 'dose-only', name: 'D3-vitamin', brand: 'Now Foods', type: 'supplement', category: 'supplement',
      dose: '2000 NE', form: 'kapszula', stock: null, stockUnit: null,
      protocol: 'napi 1x', timing: 'reggel', taken: false,
      macros: { kcal: null, p: null, c: null, f: null },
    }],
    imports: [], suggestions: [],
  })
  renderDetail('stash-dose-only', qc)
  expect(screen.getByText(/D3-vitamin/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /logolás/i })).not.toBeInTheDocument()
})

test('inputFromItem omits null macros instead of sending an explicit null (mezo-6omv)', () => {
  // The DTO cannot distinguish an omitted field from an explicit null — applyDefinitionPartial
  // reads "absent" as "leave unchanged", so a null macro sent back as `kcal: null` would blank a
  // shared definition every other user reads. Only the field-by-field `!= null` guard in
  // inputFromItem prevents that; a version that unconditionally spreads the macros object would
  // ship `proteinG: null` / `carbsG: null` and regress mezo-6omv silently.
  const item: PantryItem = {
    id: 'x', name: 'Partial Macros Item', brand: 'Acme', source: 'manual', category: 'food', kind: 'food',
    macros: { kcal: 120, p: null, c: null, f: 0 },
  }
  const input = inputFromItem(item)
  expect(input.kcal).toBe(120)
  expect(input.fatG).toBe(0) // a real recorded zero must survive, not be treated as "absent"
  expect(input).not.toHaveProperty('proteinG')
  expect(input).not.toHaveProperty('carbsG')
})

test('a shared-catalog item shows "közös · <author>" and locks the edit sheet\'s definition fields', async () => {
  const qc = newQc()
  qc.setQueryData(['pantry'], {
    ingredients: [{ ...ingredients[0], id: 'shared-1', catalogId: 'cat-skyr', sharedFrom: { authorName: 'Anna' }, catalogEditable: false }],
    stash: [], imports: [], suggestions: [],
  })
  renderDetail('shared-1', qc)
  expect(screen.getByText('közös · Anna')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Szerkesztés/ }))
  expect(await screen.findByText('Tétel szerkesztése')).toBeInTheDocument()
  expect(screen.getByLabelText(/név/i)).toBeDisabled()
})
