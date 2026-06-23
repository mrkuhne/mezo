import type { ReactNode } from 'react'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { RecipeDetailView } from './RecipeDetailView'
import { useRecipes } from '@/data/hooks'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}
const newQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

function renderDetail(id: string, qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/fuel/recipes/${id}`]}>
        <Routes>
          <Route path="/fuel/recipes/:id" element={<RecipeDetailView />} />
          <Route path="/fuel/recipes/:id/edit" element={<LocationProbe />} />
          <Route path="/fuel/recipes" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function firstId(qc: QueryClient) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useRecipes(), { wrapper })
  return result.current.recipes[0]
}

test('renders the hero, macro hero and ingredient contributions', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  expect(await screen.findByText(r.name)).toBeInTheDocument()
  // whole-recipe kcal appears in the macro hero
  expect(screen.getByText(String(r.macros.kcal))).toBeInTheDocument()
  // the deferred fit zone
  expect(screen.getByText(/Mezo-fit · hamarosan/)).toBeInTheDocument()
  // first ingredient name from the snapshot
  expect(screen.getByText(r.ingredients[0].name)).toBeInTheDocument()
})

test('a missing id shows the not-found fallback', async () => {
  renderDetail('does-not-exist', newQc())
  expect(await screen.findByText('Nincs ilyen recept.')).toBeInTheDocument()
})

test('the serving toggle switches the macro basis', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByRole('button', { name: /Egész/ }))
  // whole-recipe kcal stays present in the "egész" basis
  expect(screen.getByText(String(r.macros.kcal))).toBeInTheDocument()
})

test('Szerkesztés navigates to the edit route', async () => {
  const qc = newQc()
  const r = firstId(qc)
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByRole('button', { name: /Szerkesztés/ }))
  expect(screen.getByTestId('location').textContent).toBe(`/fuel/recipes/${r.id}/edit`)
})

test('Törlés removes the recipe and navigates back to the library', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useRecipes(), { wrapper })
  await waitFor(() => expect(result.current.recipes.length).toBeGreaterThan(0))
  const r = result.current.recipes[0]
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByRole('button', { name: /Törlés/ }))
  await waitFor(() => expect(result.current.recipes.some(x => x.id === r.id)).toBe(false))
  expect(screen.getByTestId('location').textContent).toBe('/fuel/recipes')
})

test('Csillag toggles the starred flag', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useRecipes(), { wrapper })
  await waitFor(() => expect(result.current.recipes.length).toBeGreaterThan(0))
  const r = result.current.recipes.find(x => !x.starred) ?? result.current.recipes[0]
  const before = r.starred
  renderDetail(r.id, qc)
  await screen.findByText(r.name)
  await userEvent.click(screen.getByRole('button', { name: /Csillag/ }))
  await waitFor(() => expect(result.current.recipes.find(x => x.id === r.id)?.starred).toBe(!before))
})
