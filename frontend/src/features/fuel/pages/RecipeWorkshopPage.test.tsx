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
const { turnImpl } = vi.hoisted(() => ({ turnImpl: vi.fn() }))
vi.mock('@/data/fuel/workshopHooks', () => ({ useWorkshop: () => ({ workshopTurn: turnImpl }) }))

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  turnImpl.mockReset()
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
