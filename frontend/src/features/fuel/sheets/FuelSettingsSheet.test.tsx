import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { FuelSettingsSheet } from '@/features/fuel/sheets/FuelSettingsSheet'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderSheet = (onClose = vi.fn()) => {
  render(<MemoryRouter><QueryWrapper><FuelSettingsSheet onClose={onClose} /></QueryWrapper></MemoryRouter>)
  return onClose
}

const LocationProbe = () => {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}

describe('FuelSettingsSheet', () => {
  test('opens prefilled from the ghost settings', () => {
    renderSheet()
    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('4')
    expect(screen.getByLabelText('Koffein-cutoff')).toHaveValue('14:00')
  })

  test('stepper clamps between 3 and 6', async () => {
    renderSheet()
    const minus = screen.getByRole('button', { name: 'Étkezés csökkentése' })
    await userEvent.click(minus)
    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('3')
    expect(minus).toBeDisabled()
  })

  test('saving persists the edited values and closes', async () => {
    const onClose = renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Étkezés növelése' }))
    fireEvent.change(screen.getByLabelText('Koffein-cutoff'), { target: { value: '13:00' } })
    await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  test('navigates to /fuel/slots when clicking Étkezési ablakok szerkesztése', async () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter initialEntries={['/fuel']}>
        <Routes>
          <Route path="/fuel" element={<QueryWrapper><FuelSettingsSheet onClose={onClose} /></QueryWrapper>} />
          <Route path="/fuel/slots" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )
    // click the button to trigger close + navigate
    const button = screen.getByRole('button', { name: 'Étkezési ablakok szerkesztése' })
    expect(button).toBeInTheDocument()
    await userEvent.click(button)
    // close() is called immediately, navigate() happens immediately; location changes before animation completes
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/fuel/slots'))
  })

  // Diéta section (Diet Plan slice 1, mezo-xwgb) — split preset, custom %, protein tier, water/fiber.
  test('custom split blocks save until the three percents sum to 100.0', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.click(screen.getByRole('button', { name: /Egyéni/ }))
    const protein = screen.getByLabelText('Fehérje %')
    await user.clear(protein); await user.type(protein, '30')
    const carbs = screen.getByLabelText('Szénhidrát %')
    await user.clear(carbs); await user.type(carbs, '30')
    const fat = screen.getByLabelText('Zsír %')
    await user.clear(fat); await user.type(fat, '30')
    expect(screen.getByRole('button', { name: /Mentés/ })).toBeDisabled() // 90 ≠ 100
    await user.clear(carbs); await user.type(carbs, '40')
    expect(screen.getByRole('button', { name: /Mentés/ })).toBeEnabled()
  })

  test('preset selection hides the custom percent inputs', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.click(screen.getByRole('button', { name: /Kiegyensúlyozott/ }))
    expect(screen.queryByLabelText('Fehérje %')).not.toBeInTheDocument()
  })

  // Edzőnap-shift stepper (Diet Plan slice 3, mezo-sxlj): 0–500 kcal, step 50, 'ki' at 0.
  test('edzőnap-shift stepper steps by 50 and saves the value', async () => {
    const user = userEvent.setup()
    const onClose = renderSheet()
    expect(screen.getByLabelText('Edzőnap-shift')).toHaveTextContent('ki')
    const plus = screen.getByRole('button', { name: /Edzőnap-shift növelése/ })
    await user.click(plus)
    expect(screen.getByLabelText('Edzőnap-shift')).toHaveTextContent('50')
    await user.click(screen.getByRole('button', { name: /Mentés/ }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})

// Real mode: the cold-open prefill race (mezo-53su). The read starts from the ghost
// (4/'14:00') and only flips to the server value after the delayed GET resolves — Save must
// stay disabled until then, the prefill must re-sync to the server value, and a user edit made
// BEFORE the value lands must survive (not be clobbered by the late re-sync).
describe('FuelSettingsSheet — real-mode cold-open prefill', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  const delayServerSettings = () =>
    server.use(
      http.get(`${API_BASE}/api/fuel/settings`, async () => {
        await new Promise((r) => setTimeout(r, 50))
        return HttpResponse.json({ mealsPerDay: 6, caffeineCutoff: '12:00' })
      }),
    )

  test('disables Mentés while loading, then re-syncs the prefill and enables it', async () => {
    delayServerSettings()
    renderSheet()
    // Cold frame: ghost prefill, Save disabled (guards a blind overwrite with the ghost).
    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('4')
    expect(screen.getByRole('button', { name: /Mentés/ })).toBeDisabled()
    // After the server value lands: prefill re-syncs and Save enables.
    await waitFor(() => expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('6'))
    expect(screen.getByLabelText('Koffein-cutoff')).toHaveValue('12:00')
    expect(screen.getByRole('button', { name: /Mentés/ })).toBeEnabled()
  })

  test('a user edit made before the value lands survives the re-sync', async () => {
    delayServerSettings()
    renderSheet()
    // Edit the ghost (4 → 5) before the delayed GET resolves.
    fireEvent.click(screen.getByRole('button', { name: 'Étkezés növelése' }))
    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('5')
    // Let the server value (6) arrive; the touched edit must NOT be overwritten.
    await waitFor(() => expect(screen.getByRole('button', { name: /Mentés/ })).toBeEnabled())
    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('5')
  })

  // Per-section touched-flag regression (final-review finding, mezo-xwgb): fuel and diet are
  // TWO independent queries with their own prefill re-sync effect. Before the fix a single
  // shared `touched` flag guarded both — editing a fuel field while the diet GET was still in
  // flight set that shared flag, which then permanently froze the diet prefill at its ghost
  // (balanced/4000/30) even after the real diet settings arrived. Save is a Promise.all of BOTH
  // PUTs, so that frozen ghost would silently overwrite the user's saved diet settings.
  const delayDietSettings = () =>
    server.use(
      http.get(`${API_BASE}/api/diet/settings`, async () => {
        await new Promise((r) => setTimeout(r, 50))
        return HttpResponse.json({
          splitPreset: 'low_carb', proteinTier: 'high', waterMl: 3200, fiberG: 35, dayTypeShiftKcal: 200,
        })
      }),
    )

  test('editing a fuel field while the diet GET is in flight does not freeze the diet prefill', async () => {
    delayDietSettings()
    renderSheet()
    // Diet section starts at its ghost (balanced/moderate/4000/30).
    expect(screen.getByRole('button', { name: 'Kiegyensúlyozott' })).toHaveAttribute('aria-pressed', 'true')
    // Edit a FUEL field — under the old shared flag this alone would freeze the diet re-sync.
    fireEvent.click(screen.getByRole('button', { name: 'Étkezés növelése' }))
    expect(screen.getByLabelText('Étkezés/nap')).toHaveTextContent('5')
    // Once the delayed diet GET resolves, the diet section still re-syncs to the FETCHED
    // (non-ghost) values — it is not frozen by the fuel section's own touched flag.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Alacsony szénhidrát' })).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByRole('button', { name: 'Magas' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Víz-cél')).toHaveValue(3200)
    expect(screen.getByLabelText('Rost-cél')).toHaveValue(35)
    expect(screen.getByLabelText('Edzőnap-shift')).toHaveTextContent('200')
  })
})
