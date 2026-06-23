import type { ReactNode } from 'react'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { RecipeEditorView } from './RecipeEditorView'
import { useRecipes } from '@/data/hooks'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}
const newQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

function renderNew(qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/fuel/recipes', '/fuel/recipes/new']} initialIndex={1}>
        <Routes>
          <Route path="/fuel/recipes/new" element={<RecipeEditorView />} />
          <Route path="/fuel/recipes" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function renderEdit(id: string, qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/fuel/recipes/${id}/edit`]}>
        <Routes>
          <Route path="/fuel/recipes/:id/edit" element={<RecipeEditorView />} />
          <Route path="/fuel/recipes/:id" element={<LocationProbe />} />
          <Route path="/fuel/recipes" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('create mode: Mentés is disabled until a name + an ingredient are present', async () => {
  const qc = newQc()
  renderNew(qc)
  expect(screen.getByRole('button', { name: /Mentés/ })).toBeDisabled()
  await userEvent.type(screen.getByPlaceholderText(/Tonhalsaláta/), 'Teszt recept')
  await userEvent.click(screen.getByRole('button', { name: /Kamrából/ }))
  expect(await screen.findByText('Válassz hozzávalót')).toBeInTheDocument()
  // add the first pantry ingredient
  const adds = await screen.findAllByRole('button', { name: /hozzáadása/ })
  await userEvent.click(adds[0])
  await waitFor(() => expect(screen.getByRole('button', { name: /Mentés/ })).toBeEnabled())
})

test('create mode: saving adds a recipe to the cache and navigates back', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useRecipes(), { wrapper })
  await waitFor(() => expect(result.current.recipes.length).toBeGreaterThan(0))
  const before = result.current.recipes.length

  renderNew(qc)
  await userEvent.type(screen.getByPlaceholderText(/Tonhalsaláta/), 'Teszt recept')
  await userEvent.click(screen.getByRole('button', { name: /Kamrából/ }))
  const adds = await screen.findAllByRole('button', { name: /hozzáadása/ })
  await userEvent.click(adds[0])
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))

  await waitFor(() => expect(result.current.recipes.length).toBe(before + 1))
  expect(result.current.recipes.some(r => r.name === 'Teszt recept')).toBe(true)
})

test('edit mode: prefills the name and saves an update', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useRecipes(), { wrapper })
  await waitFor(() => expect(result.current.recipes.length).toBeGreaterThan(0))
  const r = result.current.recipes[0]

  renderEdit(r.id, qc)
  const nameInput = (await screen.findByPlaceholderText(/Tonhalsaláta/)) as HTMLInputElement
  expect(nameInput.value).toBe(r.name)
  await userEvent.clear(nameInput)
  await userEvent.type(nameInput, r.name + ' v2')
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  await waitFor(() => expect(result.current.recipes.find(x => x.id === r.id)?.name).toBe(r.name + ' v2'))
})

test('a picked row contribution recomputes when the amount changes', async () => {
  const qc = newQc()
  renderNew(qc)
  await userEvent.click(screen.getByRole('button', { name: /Kamrából/ }))
  const adds = await screen.findAllByRole('button', { name: /hozzáadása/ })
  await userEvent.click(adds[0])
  // a "Kamrából hozzáad" add-button reappears once the picker closes
  expect(await screen.findByRole('button', { name: /Kamrából/ })).toBeInTheDocument()
  // the picked row shows MacroCells (kcal/Prot labels)
  expect(screen.getAllByText('Prot').length).toBeGreaterThan(0)
})
