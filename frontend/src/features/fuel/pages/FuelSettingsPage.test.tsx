import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapperWithClient } from '@/test/queryWrapper'
import { FuelSettingsPage } from '@/features/fuel/pages/FuelSettingsPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderPage() {
  const { wrapper: Wrapper, client } = makeHookWrapperWithClient()
  const view = render(
    <Wrapper>
      <MemoryRouter initialEntries={['/fuel', '/fuel/settings']} initialIndex={1}>
        <Routes>
          <Route path="/fuel" element={<LocationProbe />} />
          <Route path="/fuel/settings" element={<><FuelSettingsPage /><LocationProbe /></>} />
          <Route path="/fuel/slots" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </Wrapper>,
  )
  return { client, ...view }
}

describe('FuelSettingsPage', () => {
  test('is a standalone page prefilled from the ghost settings', () => {
    renderPage()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Fuel beállítások' })).toBeInTheDocument()
    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('4')
    expect(screen.getByLabelText('Koffein-cutoff')).toHaveValue('14:00')
  })

  test('meal stepper clamps between 3 and 6', async () => {
    renderPage()
    const minus = screen.getByRole('button', { name: 'Étkezés csökkentése' })

    await userEvent.click(minus)

    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('3')
    expect(minus).toBeDisabled()
  })

  test('offers every macro profile in a discoverable combobox', async () => {
    renderPage()
    const profile = screen.getByRole('combobox', { name: 'Makróprofil' })

    expect(profile).toHaveValue('balanced')
    for (const label of ['Kiegyensúlyozott', 'Alacsony zsír', 'Alacsony szénhidrát', 'Magas szénhidrát', 'Egyéni']) {
      expect(screen.getByRole('option', { name: label })).toBeInTheDocument()
    }
    await userEvent.selectOptions(profile, 'custom')
    expect(screen.getByLabelText('Fehérje %')).toBeInTheDocument()
  })

  test('custom split blocks save until the three percents sum to 100.0', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Makróprofil' }), 'custom')
    const protein = screen.getByLabelText('Fehérje %')
    const carbs = screen.getByLabelText('Szénhidrát %')
    const fat = screen.getByLabelText('Zsír %')

    await user.clear(protein); await user.type(protein, '30')
    await user.clear(carbs); await user.type(carbs, '30')
    await user.clear(fat); await user.type(fat, '30')
    expect(screen.getByRole('button', { name: /Mentés/ })).toBeDisabled()
    await user.clear(carbs); await user.type(carbs, '40')
    expect(screen.getByRole('button', { name: /Mentés/ })).toBeEnabled()
  })

  test('saves the exact edited settings and returns to Fuel', async () => {
    const user = userEvent.setup()
    const { client } = renderPage()
    await user.click(screen.getByRole('button', { name: 'Étkezés növelése' }))
    fireEvent.change(screen.getByLabelText('Koffein-cutoff'), { target: { value: '13:00' } })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Makróprofil' }), 'low_carb')
    await user.click(screen.getByRole('button', { name: 'Magas' }))
    fireEvent.change(screen.getByLabelText('Víz-cél'), { target: { value: '3200' } })
    fireEvent.change(screen.getByLabelText('Rost-cél'), { target: { value: '35' } })
    await user.click(screen.getByRole('button', { name: 'Edzőnap-shift növelése' }))

    await user.click(screen.getByRole('button', { name: /Mentés/ }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/fuel'))
    expect(client.getQueryData(['fuelSettings'])).toEqual({ mealsPerDay: 5, caffeineCutoff: '13:00' })
    expect(client.getQueryData(['dietSettings'])).toEqual({
      splitPreset: 'low_carb', proteinPctX10: null, carbsPctX10: null, fatPctX10: null,
      proteinTier: 'high', waterMl: 3200, fiberG: 35, dayTypeShiftKcal: 50,
    })
  })

  test('navigates to the meal-window editor', async () => {
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: 'Étkezési ablakok szerkesztése' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/fuel/slots')
  })

  test('composes the rhythm hero before the floating settings cards', () => {
    const { container } = renderPage()
    const page = container.querySelector('.fset-page')
    const hero = container.querySelector('.fset-hero')
    const rhythm = container.querySelector('[aria-labelledby="fset-rhythm-title"]')
    const macros = container.querySelector('[aria-labelledby="fset-macros-title"]')

    expect(page).toBeInTheDocument()
    expect(hero).toBeInTheDocument()
    expect(rhythm).toBeInTheDocument()
    expect(macros).toBeInTheDocument()
    expect(hero!.compareDocumentPosition(rhythm!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(rhythm!.compareDocumentPosition(macros!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('shows the active target as kcal plus normalized percent and grams', () => {
    renderPage()

    expect(screen.getByText('3 100 kcal')).toBeInTheDocument()
    expect(screen.getByText('27% · 220 g')).toBeInTheDocument()
    expect(screen.getByText('47% · 380 g')).toBeInTheDocument()
    expect(screen.getByText('26% · 95 g')).toBeInTheDocument()
  })

  test('keeps the active preview honest when a different profile is selected', async () => {
    renderPage()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Makróprofil' }), 'low_carb')

    expect(screen.getByText('Mentés után frissül')).toBeInTheDocument()
    expect(screen.getByText('27% · 220 g')).toBeInTheDocument()
  })

  test('updates the accessible hero summary and decorative meal dots from the draft', async () => {
    const { container } = renderPage()

    expect(screen.getByText('4 étkezés · koffein-stop 14:00')).toBeInTheDocument()
    expect(container.querySelectorAll('.fset-meal-dot')).toHaveLength(4)
    expect(container.querySelector('.fset-dayarc')).toHaveAttribute('aria-hidden', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Étkezés növelése' }))
    fireEvent.change(screen.getByLabelText('Koffein-cutoff'), { target: { value: '13:00' } })
    expect(screen.getByText('5 étkezés · koffein-stop 13:00')).toBeInTheDocument()
    expect(container.querySelectorAll('.fset-meal-dot')).toHaveLength(5)
  })
})

describe('FuelSettingsPage — real-mode cold-open prefill', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  const delayServerSettings = () => server.use(
    http.get(`${API_BASE}/api/fuel/settings`, async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      return HttpResponse.json({ mealsPerDay: 6, caffeineCutoff: '12:00' })
    }),
  )

  const delayDietSettings = () => server.use(
    http.get(`${API_BASE}/api/diet/settings`, async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      return HttpResponse.json({
        splitPreset: 'low_carb', proteinTier: 'high', waterMl: 3200, fiberG: 35,
        dayTypeShiftKcal: 200,
      })
    }),
  )

  test('disables save while loading, then re-syncs the untouched fuel prefill', async () => {
    delayServerSettings()
    renderPage()

    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('4')
    expect(screen.getByRole('button', { name: /Mentés/ })).toBeDisabled()
    await waitFor(() => expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('6'))
    expect(screen.getByLabelText('Koffein-cutoff')).toHaveValue('12:00')
    await waitFor(() => expect(screen.getByRole('button', { name: /Mentés/ })).toBeEnabled())
  })

  test('preserves a fuel edit made before the server value lands', async () => {
    delayServerSettings()
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Étkezés növelése' }))
    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('5')
    await waitFor(() => expect(screen.getByRole('button', { name: /Mentés/ })).toBeEnabled())
    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('5')
  })

  test('a fuel edit does not freeze the late-arriving diet prefill', async () => {
    delayDietSettings()
    renderPage()

    expect(screen.getByRole('combobox', { name: 'Makróprofil' })).toHaveValue('balanced')
    fireEvent.click(screen.getByRole('button', { name: 'Étkezés növelése' }))
    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('5')
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Makróprofil' })).toHaveValue('low_carb'))
    expect(screen.getByRole('button', { name: 'Magas' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Víz-cél')).toHaveValue(3200)
    expect(screen.getByLabelText('Rost-cél')).toHaveValue(35)
    expect(screen.getByLabelText('Edzőnap-shift')).toHaveTextContent('200')
  })
})
