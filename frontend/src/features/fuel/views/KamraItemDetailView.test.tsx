import type { ReactNode } from 'react'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { KamraItemDetailView } from './KamraItemDetailView'
import { usePantry } from '@/data/hooks'

// KamraItemDetailView reads usePantry (a dual-mode TanStack query). Pin mock mode.
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
          <Route path="/fuel/kamra/:id" element={<KamraItemDetailView />} />
          <Route path="/fuel/kamra" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const newQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

test('renders a food item with macros + extended nutrients', () => {
  // ing-csirkemell · Csirkemell · friss — macros 110/23/0/1.5, protein category.
  renderDetail('ing-csirkemell', newQc())
  expect(screen.getByText(/Csirkemell/)).toBeInTheDocument()
  // Makró cells.
  expect(screen.getByText('110')).toBeInTheDocument() // kcal
  expect(screen.getByText('23')).toBeInTheDocument()  // protein
  // Tápanyag section labels present (values fall back to "—" when the seed has none).
  expect(screen.getByText('Rost')).toBeInTheDocument()
  expect(screen.getByText('Cukor')).toBeInTheDocument()
  expect(screen.getByText('Tel.zsír')).toBeInTheDocument()
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

test('Törlés deletes the food item (raw id) and navigates back to the list', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => usePantry(), { wrapper })
  await waitFor(() => expect(result.current.ingredients.some(i => i.id === 'ing-csirkemell')).toBe(true))

  renderDetail('ing-csirkemell', qc)
  await userEvent.click(screen.getByRole('button', { name: /Törlés/ }))

  // The food ingredient (raw id, no 'stash-' prefix) actually leaves the cache.
  await waitFor(() => expect(result.current.ingredients.some(i => i.id === 'ing-csirkemell')).toBe(false))
  // ...and the page navigated back to the list.
  expect(screen.getByTestId('location').textContent).toBe('/fuel/kamra')
})

test('Törlés on a stash supplement deletes via the unprefixed backend id', async () => {
  // Regression cover for the 'stash-' prefix strip (mezo-9xu lineage): the stash card
  // id is 'stash-<id>' but deleteItem must hit '<id>'.
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => usePantry(), { wrapper })
  const stashId = result.current.stash.find(s => !result.current.ingredients.some(i => i.stashRefId === s.id))!.id

  renderDetail(`stash-${stashId}`, qc)
  await userEvent.click(screen.getByRole('button', { name: /Törlés/ }))

  await waitFor(() => expect(result.current.stash.some(s => s.id === stashId)).toBe(false))
  expect(screen.getByTestId('location').textContent).toBe('/fuel/kamra')
})
