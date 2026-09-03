import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { FuelPlanPage } from '@/features/fuel/pages/FuelPlanPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { medicationFixture } from '@/test/fixtures/medication'

// FuelPlanPage reads the composed dual-mode useFuelWeek() (Train + medication + week rollup
// queries), useTodayScenario() (a ['medication'] query), useFuelSettings() and useSleepGoal()
// (audit gap #16 fix — the rhythm-grid markers are settings-derived), so the view needs a
// QueryClient as well as a router.
const renderView = () =>
  render(
    <QueryWrapper>
      <MemoryRouter><FuelPlanPage /></MemoryRouter>
    </QueryWrapper>,
  )

describe('FuelPlanPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('renders the demo week label (in the rhythm-grid corner), weekly stats; hides the medication cycle card (nincs gyógyszer)', () => {
    renderView()
    expect(screen.getByText('Máj 18 – 24')).toBeInTheDocument()
    // mezo-lwmq: the owner tracks no medication — the mock seed's cycle week is empty, so the
    // `medCycleWeek.length > 0` gate hides the card, consistent with FuelMedicationPage's own
    // "Nincs aktív gyógyszer" empty state. See FuelPlanPage (real mode) below for the populated
    // card, driven from the neutral medicationFixture.
    expect(screen.queryByText(/Gyógyszer-ciklus · 7 nap/)).not.toBeInTheDocument()
    expect(screen.getByText('Heti supplement-térkép')).toBeInTheDocument()
    expect(screen.getByText('92%')).toBeInTheDocument()
  })

  it('the settings-derived rhythm-grid legend shows the mock caffeine cutoff + a bedtime-derived kitchen close', () => {
    renderView()
    // FUEL_SETTINGS_GHOST / the mock seed's caffeineCutoff is '14:00' — but it is now a settings
    // READ, not a hardcoded literal inside the grid (audit gap #16).
    expect(screen.getByText(/koffein-cutoff 14:00 — a beállításaidból/)).toBeInTheDocument()
    expect(screen.getByText(/konyhazárás \d{2}:\d{2}/)).toBeInTheDocument()
  })

  it('Mozaik scaffold: sage tone page, ‹ Fuel back chip, "Terv" hero with no bignum (every number already lives in the stat strip)', () => {
    const { container } = renderView()
    expect(container.querySelector('.mz-page.mz-p-sage')).toBeInTheDocument()
    expect(screen.getByText('‹ Fuel')).toBeInTheDocument()
    expect(screen.getByText('Terv')).toBeInTheDocument()
    expect(container.querySelector('.mz-bignum')).not.toBeInTheDocument()
    // read-only: no gym-time editor
    expect(screen.queryByRole('button', { name: 'Idők' })).toBeNull()
    expect(screen.queryByText('Heti gym idők')).toBeNull()
  })
})

describe('FuelPlanPage (real mode)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    // The app itself seeds no medication (mezo-lwmq) — an empty cycle would hide the medication
    // card entirely, so this suite overrides the handler with the neutral fixture to exercise
    // the populated-card branch.
    server.use(http.get(`${API_BASE}/api/medication`, () => HttpResponse.json(medicationFixture)))
  })
  afterEach(() => vi.unstubAllEnvs())

  it('renders honest states: derived week label, deferred sections hidden, adherence —', async () => {
    renderView()
    // weekly stats resolve from the MSW week-rollup fixture (1 protein-hit day)
    await waitFor(() => expect(screen.getByText('1/7')).toBeInTheDocument())
    // date-derived week label, not the demo week
    expect(screen.queryByText('Máj 18 – 24')).not.toBeInTheDocument()
    // supplement adherence has no real source yet -> em-dash, never the seed's 92%
    expect(screen.queryByText('92%')).not.toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    // pattern-engine + supplement-map sections are hidden while empty
    expect(screen.queryByText('Visszatérő minták · Mezo')).not.toBeInTheDocument()
    expect(screen.queryByText('Heti supplement-térkép')).not.toBeInTheDocument()
    // the medication cycle card IS present: the medication fixture provides a real cycle (D3)
    expect(await screen.findByText(/Gyógyszer-ciklus · 7 nap/)).toBeInTheDocument()
  })
})
