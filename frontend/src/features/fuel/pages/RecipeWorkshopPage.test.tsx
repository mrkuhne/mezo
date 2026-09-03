import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { RecipeWorkshopPage } from '@/features/fuel/pages/RecipeWorkshopPage'
import { mockWorkshopTurn } from '@/data/fuel/workshopMock'

// The turn hook is the page's ONE side-effecting dependency; stubbing it here keeps the
// 600 ms demo delay out of the suite and lets the failure path be driven deterministically.
// Everything else (pantry, recipes) runs on the ordinary mock-mode cache.
const { turnImpl, createSpy, updateSpy } = vi.hoisted(() => ({
  turnImpl: vi.fn(), createSpy: vi.fn(), updateSpy: vi.fn(),
}))
vi.mock('@/data/fuel/workshopHooks', () => ({ useWorkshop: () => ({ workshopTurn: turnImpl }) }))
// The write path is spied so a save can be asserted field-by-field (the cache mutators would
// only show the ENRICHED recipe); everything else in recipeHooks stays real.
vi.mock('@/data/fuel/recipeHooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/data/fuel/recipeHooks')>()
  return { ...actual, useRecipeActions: () => ({ create: createSpy, update: updateSpy, remove: vi.fn() }) }
})

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  turnImpl.mockReset()
  createSpy.mockReset()
  updateSpy.mockReset()
  turnImpl.mockImplementation(async (req: Parameters<typeof mockWorkshopTurn>[0]) => mockWorkshopTurn(req))
})
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}

function renderPage(entry = '/fuel/recipes/muhely') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/fuel/recipes/muhely" element={<RecipeWorkshopPage />} />
          <Route path="/fuel/recipes" element={<LocationProbe />} />
          <Route path="/fuel/recipes/:id" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function sendFirstTurn(text = 'Csirkés ebédet kérek') {
  await userEvent.type(screen.getByLabelText('Üzenet a Műhelynek'), text)
  await userEvent.click(screen.getByRole('button', { name: 'Küldés' }))
  await screen.findByDisplayValue('Citromos-joghurtos csirketál')
}

test('a turn renders the draft on the canvas — pantry rows + the BECSLÉS row — and the save gate holds', async () => {
  renderPage()
  await sendFirstTurn()

  // pantry line names land as rows, the AI line carries the MealComposer becslés tag
  expect(screen.getByText('Csirkemell · friss')).toBeInTheDocument()
  expect(screen.getByText('Citrom + fűszerek')).toBeInTheDocument()
  expect(screen.getByText('✨ becslés')).toBeInTheDocument()

  // …and while it is there, `draftToInput` returns null → the gate note shows, save disabled
  expect(screen.getByText(/becslés-sorok: cseréld kamra-itemre/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Mentés a Receptkönyvbe/ })).toBeDisabled()
})

test('Csere swaps the estimate line for a pantry item — the gate opens and saving lands on the list', async () => {
  renderPage()
  await sendFirstTurn()

  await userEvent.click(screen.getByRole('button', { name: 'Csere kamra-itemre' }))
  const pick = await screen.findAllByRole('button', { name: /hozzáadása$/ })
  await userEvent.click(pick[0])

  await waitFor(() => expect(screen.queryByText('✨ becslés')).not.toBeInTheDocument())
  expect(screen.queryByText(/becslés-sorok: cseréld/)).not.toBeInTheDocument()

  const save = screen.getByRole('button', { name: /Mentés a Receptkönyvbe/ })
  expect(save).toBeEnabled()
  await userEvent.click(save)
  expect(await screen.findByTestId('location')).toHaveTextContent('/fuel/recipes')
})

test('a failed turn keeps the message and offers Újra / Szerkesztés (F7.5 bubble)', async () => {
  turnImpl.mockRejectedValue(new Error('boom'))
  renderPage()

  await userEvent.type(screen.getByLabelText('Üzenet a Műhelynek'), 'Valami gyors vacsora')
  await userEvent.click(screen.getByRole('button', { name: 'Küldés' }))

  expect(await screen.findByText('A Műhely most nem elérhető — az üzeneted megvan.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Szerkesztés' }))
  expect(screen.getByLabelText('Üzenet a Műhelynek')).toHaveValue('Valami gyors vacsora')
})

test('a preset chip sets the goal and sends its own instruction turn', async () => {
  renderPage()
  await sendFirstTurn()

  await userEvent.click(screen.getByRole('button', { name: 'High protein' }))
  await waitFor(() => expect(turnImpl).toHaveBeenCalledTimes(2))
  expect(turnImpl.mock.calls[1][0].goal).toBe('high_protein')
  // the goal rides on the canvas as the prototype's cél-chip
  expect(await screen.findByText('High protein', { selector: '.logflow-lntag' })).toBeInTheDocument()
})

// M1 (mezo-uavr wipe class): a ?recipeId session that never touches a goal preset must save the
// SEED recipe's role — silently demoting a pre_workout template to `standard` is exactly the kind
// of quiet wipe the base-meta carry-through exists to prevent.
test('an untouched goal keeps the seeded recipe’s role (and the rest of its base meta) on save', async () => {
  renderPage('/fuel/recipes/muhely?recipeId=rec-1')
  // rec-1 seeds the canvas; a turn runs WITHOUT any preset tap
  await userEvent.type(screen.getByLabelText('Üzenet a Műhelynek'), 'Tegyél bele több fehérjét')
  await userEvent.click(screen.getByRole('button', { name: 'Küldés' }))
  await waitFor(() => expect(turnImpl).toHaveBeenCalledTimes(1))

  // a seeded draft is all pantry lines (recipeToDraft), so the save gate is already open
  await userEvent.click(screen.getByRole('button', { name: /Recept frissítése/ }))
  expect(updateSpy).toHaveBeenCalledTimes(1)
  expect(createSpy).not.toHaveBeenCalled()
  const [id, input] = updateSpy.mock.calls[0]
  expect(id).toBe('rec-1')
  expect(input.role).toBe('pre_workout')
  expect(input.slot).toBe('Reggeli')
  expect(input.tags).toEqual(['pre-workout', 'high-protein', 'slow-release'])
  expect(input.starred).toBe(true)
  expect(input.prepMins).toBe(5)
  expect(input.cookMins).toBe(3)
})

// M2: the retried payload must carry the failed message ONCE — as `message`, never also inside
// `history` (the trim is a state update the sending closure cannot see).
test('Újra re-sends the failed message without duplicating it into the history payload', async () => {
  turnImpl.mockRejectedValueOnce(new Error('boom'))
  turnImpl.mockImplementation(async (req: Parameters<typeof mockWorkshopTurn>[0]) => mockWorkshopTurn(req))
  renderPage()

  await userEvent.type(screen.getByLabelText('Üzenet a Műhelynek'), 'Valami gyors vacsora')
  await userEvent.click(screen.getByRole('button', { name: 'Küldés' }))
  await screen.findByText('A Műhely most nem elérhető — az üzeneted megvan.')

  await userEvent.click(screen.getByRole('button', { name: 'Újra' }))
  await waitFor(() => expect(turnImpl).toHaveBeenCalledTimes(2))
  const payload = turnImpl.mock.calls[1][0]
  expect(payload.message).toBe('Valami gyors vacsora')
  expect(payload.history.filter((m: { text: string }) => m.text === 'Valami gyors vacsora')).toHaveLength(0)
})

// M3: the est rescale base is the amount the line ARRIVED with, so an empty field on the way
// through (select-all-retype) can never strand the row at 0 kcal.
test('an estimate amount cleared to 0 and retyped rescales from the original base, not from 0', async () => {
  renderPage()
  await sendFirstTurn()

  // the seed estimate line is 1 adag / 15 kcal
  const field = screen.getByLabelText('Citrom + fűszerek mennyisége')
  await userEvent.clear(field)
  await userEvent.type(field, '200')
  expect(screen.getByText('3000')).toBeInTheDocument()

  await userEvent.clear(field)      // passes through amount 0 — est must survive untouched
  await userEvent.type(field, '300')
  expect(screen.getByText('4500')).toBeInTheDocument()
})
