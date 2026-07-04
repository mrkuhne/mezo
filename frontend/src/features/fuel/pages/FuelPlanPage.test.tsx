import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FuelPlanPage } from '@/features/fuel/pages/FuelPlanPage'
import { trainApi } from '@/data/train/trainApi'
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
    expect(screen.getByText(/Reta cycle · 7 nap/)).toBeInTheDocument()
    expect(screen.getByText('D3')).toBeInTheDocument()
    expect(screen.getByText('Heti supplement-térkép')).toBeInTheDocument()
    expect(screen.getByText('92%')).toBeInTheDocument()
  })

  it('Idők opens the gym schedule sheet', async () => {
    renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Idők' }))
    expect(await screen.findByText('Heti gym idők')).toBeInTheDocument()
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
    // the Reta card IS present: the medication fixture provides a real cycle (D3)
    expect(await screen.findByText(/Reta cycle · 7 nap/)).toBeInTheDocument()
  })

  it('saving the sheet writes through to Train (PUT /api/train/gym-schedule)', async () => {
    const spy = vi.spyOn(trainApi, 'replaceGymSchedule')
    renderView()
    // wait for the Train-derived week (meso fixture: Csü) — the sheet copies it on mount
    await waitFor(() => expect(screen.getAllByText('Csü').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByRole('button', { name: 'Idők' }))
    expect(await screen.findByText('Heti gym idők')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    await waitFor(() => expect(spy).toHaveBeenCalled())
    // only active timed days round-trip: the fixture week has exactly Csü (dayOfWeek 3, 18:30)
    expect(spy).toHaveBeenLastCalledWith([{ dayOfWeek: 3, time: '18:30' }])
    spy.mockRestore()
  })
})
