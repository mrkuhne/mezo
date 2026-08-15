import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FuelPlanPage } from '@/features/fuel/pages/FuelPlanPage'
import { QueryWrapper } from '@/test/queryWrapper'

// FuelPlanPage reads the composed dual-mode useFuelWeek() (Train + medication + week rollup
// queries) and useTodayScenario() (a ['medication'] query), so the view needs a QueryClient
// as well as a router.
const renderView = () =>
  render(
    <QueryWrapper>
      <MemoryRouter><FuelPlanPage /></MemoryRouter>
    </QueryWrapper>,
  )

describe('FuelPlanPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('renders the demo title, weekly stats, reta strip and rhythm grid', () => {
    renderView()
    expect(screen.getByText('Máj 18 – 24')).toBeInTheDocument()
    expect(screen.getByText(/Gyógyszer-ciklus · 7 nap/)).toBeInTheDocument()
    expect(screen.getByText('D3')).toBeInTheDocument()
    expect(screen.getByText('Heti supplement-térkép')).toBeInTheDocument()
    expect(screen.getByText('92%')).toBeInTheDocument()
  })

  it('own header: pghead-np sage over + h1 (read-only, no gym-time editor)', () => {
    const { container } = renderView()
    expect(container.querySelector('.pghead-np.sage')).toBeInTheDocument()
    expect(screen.getByText('Fuel · Heti terv')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Idők' })).toBeNull()
    expect(screen.queryByText('Heti gym idők')).toBeNull()
  })
})

describe('FuelPlanPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('renders honest states: derived title, deferred sections hidden, adherence —', async () => {
    renderView()
    // weekly stats resolve from the MSW week-rollup fixture (1 protein-hit day)
    await waitFor(() => expect(screen.getByText('1/7')).toBeInTheDocument())
    // date-derived title, not the demo week
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
