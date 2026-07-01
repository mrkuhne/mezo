import type { ReactNode } from 'react'
import { render, renderHook, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { RecipeEditorView } from '@/features/fuel/views/RecipeEditorView'
import { useRecipes } from '@/data/hooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

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

// The picker no longer auto-closes on pick (multi-add), so tests that need to read
// the editor rows unambiguously close it first via its Bezárás button.
async function closePicker() {
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
  await waitForElementToBeRemoved(() => screen.queryByText('Válassz hozzávalót'), { timeout: 2000 })
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
  await closePicker()
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

test('real mode: a picked pantry ingredient resolves to its name + macros, not the raw UUID', async () => {
  // In real mode usePantry() (the picker source) hits the backend and returns real
  // UUIDs, while useRecipes().ingredients is the static mock seed. The editor must
  // resolve the picked line against the SAME source the picker drew from, else the
  // row falls back to rendering the raw refId (UUID) and a zero contribution.
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const PANTRY_ID = '308af5e9-bfda-46ae-a516-a30c89b04f57'
  server.use(
    http.get(`${API_BASE}/api/pantry`, () =>
      HttpResponse.json({
        ingredients: [
          {
            id: PANTRY_ID, name: 'Csirkemell', brand: 'kifli', source: 'kifli.hu', category: 'protein',
            per: 100, unit: 'g', macros: { kcal: 110, p: 23, c: 0, f: 1.5 },
            price: 0, priceUnit: '', pkg: '', micros: [], nova: 1, stock: null,
            lastUsed: '—', usedInRecipes: 0,
          },
        ],
        stash: [],
      }),
    ),
  )
  const qc = newQc()
  renderNew(qc)
  await userEvent.click(screen.getByRole('button', { name: /Kamrából/ }))
  await userEvent.click(await screen.findByRole('button', { name: /Csirkemell hozzáadása/ }))
  await closePicker()
  // the row shows the RESOLVED name, never the backend UUID
  expect(screen.getByText('Csirkemell')).toBeInTheDocument()
  expect(screen.queryByText(PANTRY_ID)).not.toBeInTheDocument()
  // …and a non-zero macro contribution (110 kcal at the default 100 g amount)
  expect(screen.getAllByText('110').length).toBeGreaterThan(0)
})

test('a picked row renders its MacroCells contribution in the editor', async () => {
  const qc = newQc()
  renderNew(qc)
  await userEvent.click(screen.getByRole('button', { name: /Kamrából/ }))
  const adds = await screen.findAllByRole('button', { name: /hozzáadása/ })
  await userEvent.click(adds[0])
  await closePicker()
  // exactly one ingredient line, showing MacroCells (Prot label)
  expect(screen.getAllByRole('button', { name: 'Eltávolítás' })).toHaveLength(1)
  expect(screen.getAllByText('Prot').length).toBeGreaterThan(0)
})

// --- mezo-3vu4: supplements as ingredients + multi-add picker ---

test('the picker lists supplements from the stash, not only foods', async () => {
  const qc = newQc()
  renderNew(qc)
  await userEvent.click(screen.getByRole('button', { name: /Kamrából/ }))
  expect(await screen.findByText('Válassz hozzávalót')).toBeInTheDocument()
  // Magnézium-glicinát is a stash-only supplement (no food mirror) — it must be pickable now.
  expect(screen.getByRole('button', { name: /Magnézium-glicinát hozzáadása/ })).toBeInTheDocument()
})

test('the picker stays open after a pick so several ingredients can be added in one go', async () => {
  const qc = newQc()
  renderNew(qc)
  await userEvent.click(screen.getByRole('button', { name: /Kamrából/ }))
  const adds = await screen.findAllByRole('button', { name: /hozzáadása/ })
  await userEvent.click(adds[0])
  // still open (no auto-close)
  expect(screen.getByText('Válassz hozzávalót')).toBeInTheDocument()
  // add a second, different item, then confirm the editor holds two lines
  const more = screen.getAllByRole('button', { name: /hozzáadása/ })
  await userEvent.click(more[0])
  expect(screen.getAllByRole('button', { name: 'Eltávolítás' })).toHaveLength(2)
})

test('an already-added item is shown as added and cannot be added twice', async () => {
  const qc = newQc()
  renderNew(qc)
  await userEvent.click(screen.getByRole('button', { name: /Kamrából/ }))
  await userEvent.click(await screen.findByRole('button', { name: /Magnézium-glicinát hozzáadása/ }))
  // its add affordance flips to a disabled "hozzáadva" state — no second add possible
  expect(screen.queryByRole('button', { name: /Magnézium-glicinát hozzáadása/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Magnézium-glicinát hozzáadva/ })).toBeDisabled()
})

test('a picked ingredient amount can be typed exactly and the contribution follows', async () => {
  // real mode with a known food (per 100 g, 110 kcal) so the math is deterministic
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/pantry`, () =>
      HttpResponse.json({
        ingredients: [
          {
            id: 'c1', name: 'Csirkemell', brand: 'kifli', source: 'kifli.hu', category: 'protein',
            per: 100, unit: 'g', macros: { kcal: 110, p: 23, c: 0, f: 1.5 },
            price: 0, priceUnit: '', pkg: '', micros: [], nova: 1, stock: null, lastUsed: '—', usedInRecipes: 0,
          },
        ],
        stash: [],
      }),
    ),
  )
  const qc = newQc()
  renderNew(qc)
  await userEvent.click(screen.getByRole('button', { name: /Kamrából/ }))
  await userEvent.click(await screen.findByRole('button', { name: /Csirkemell hozzáadása/ }))
  await closePicker()
  const amount = screen.getByLabelText(/Csirkemell mennyiség/) as HTMLInputElement
  expect(amount.value).toBe('100') // default = per
  await userEvent.clear(amount)
  await userEvent.type(amount, '250')
  // contribution recomputes: round(110 * 250/100) = 275 (shown on the line + the total)
  expect(screen.getAllByText('275').length).toBeGreaterThan(0)
})

test('the ingredient amount input keeps a typed decimal value', async () => {
  const qc = newQc()
  renderNew(qc)
  await userEvent.click(screen.getByRole('button', { name: /Kamrából/ }))
  const adds = await screen.findAllByRole('button', { name: /hozzáadása/ })
  await userEvent.click(adds[0])
  await closePicker()
  const amount = screen.getByLabelText(/mennyiség/) as HTMLInputElement
  await userEvent.clear(amount)
  await userEvent.type(amount, '12.5')
  expect(amount.value).toBe('12.5')
})

test('real mode: a picked supplement resolves to its name + macro contribution', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const SUPP_ID = 'b7c1f0a2-1111-4222-8333-444455556666'
  server.use(
    http.get(`${API_BASE}/api/pantry`, () =>
      HttpResponse.json({
        ingredients: [],
        stash: [
          {
            id: SUPP_ID, name: 'Vegán Protein', brand: 'MyProtein', type: 'supplement', category: 'protein',
            dose: '30g', form: 'por', stock: 10, stockUnit: 'adag', protocol: '', timing: 'flexible', taken: false,
            source: 'myprotein.hu', per: 30, unit: 'g', macros: { kcal: 114, p: 22, c: 3, f: 2 },
          },
        ],
      }),
    ),
  )
  const qc = newQc()
  renderNew(qc)
  await userEvent.click(screen.getByRole('button', { name: /Kamrából/ }))
  await userEvent.click(await screen.findByRole('button', { name: /Vegán Protein hozzáadása/ }))
  await closePicker()
  // resolved to the supplement's name + its kcal (per=30 → factor 1), never the UUID
  expect(screen.getByText('Vegán Protein')).toBeInTheDocument()
  expect(screen.queryByText(SUPP_ID)).not.toBeInTheDocument()
  expect(screen.getAllByText('114').length).toBeGreaterThan(0)
})
