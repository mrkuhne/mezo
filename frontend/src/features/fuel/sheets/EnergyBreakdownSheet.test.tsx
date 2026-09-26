import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EnergyBreakdownSheet, type EnergyBreakdown } from '@/features/fuel/sheets/EnergyBreakdownSheet'

const fuelBreakdown: EnergyBreakdown = {
  base: { kcal: 2272, bmr: 1893, neat: 1.2, neatLabel: 'Ülő', formula: 'KATCH' },
  movement: {
    kcal: 1290,
    isWeeklyAvg: true,
    parts: [
      { key: 'planned', label: 'A heti terved mai része', kcal: 900 },
      { key: 'extra', label: 'Terven kívüli mozgás', kcal: 390 },
    ],
    blocks: [
      { label: 'Gym', kind: 'gym', min: 60, kcal: 430 },
      { label: 'Röplabda', kind: 'sport', min: 90, kcal: 860 },
    ],
  },
  deficit: { kcal: -869, rateKgPerWk: 0.79, goalLabel: 'Nyári cut' },
  target: 2693,
}

const profileBreakdown: EnergyBreakdown = {
  base: { kcal: 2272, bmr: 1893, neat: 1.2, neatLabel: 'Ülő', formula: 'KATCH' },
  movement: { kcal: 1207, isWeeklyAvg: true },
  target: 3479,
}

describe('EnergyBreakdownSheet', () => {
  it('renders all three sections and per-activity pills when deficit + blocks present', () => {
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="movement" onClose={vi.fn()} />)
    expect(screen.getByText('Alaphő · NEAT')).toBeInTheDocument()
    expect([...document.body.querySelectorAll('.flp-estit')].map(e => e.textContent)).toContain('Mozgás')
    expect(screen.getByText(/Deficit · Nyári cut/)).toBeInTheDocument()
    // per-activity tiles (organized: name + duration + kcal)
    expect(screen.getByText('Gym')).toBeInTheDocument()
    expect(screen.getByText('Röplabda')).toBeInTheDocument()
    expect(screen.getByText('60 perc')).toBeInTheDocument()
    // equation-bar total (plain number, no thousands grouping)
    expect(screen.getByText('2693')).toBeInTheDocument()
  })

  it('the Fuel movement row closes: its summand tiles are the served parts, previews carry no operators (mezo-32m82)', () => {
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="movement" onClose={vi.fn()} />)
    const sum = document.body.querySelector('.flp-eblk.is-hl .flp-etiles:not(.is-info)')!
    const summands = [...sum.querySelectorAll('.flp-etile:not(.is-result) .flp-etile-val')].map(v => Number.parseInt(v.textContent!, 10))
    expect(summands).toEqual(fuelBreakdown.movement.parts!.map(p => p.kcal))
    expect(summands.reduce((a, n) => a + n, 0)).toBe(fuelBreakdown.movement.kcal)
    const info = document.body.querySelector('.flp-etiles.is-info')!
    expect(info.querySelectorAll('.flp-etile')).toHaveLength(fuelBreakdown.movement.blocks!.length)
    expect(info.querySelector('.op')).toBeNull()
    expect(screen.queryByText(/pihenőnapon 0/)).not.toBeInTheDocument()
    expect(screen.getByText(/egyenletesen oszlik el/)).toBeInTheDocument()
  })

  it('omits the deficit section and shows a weekly-avg movement (no pills) when deficit absent', () => {
    render(<EnergyBreakdownSheet breakdown={profileBreakdown} initial="base" onClose={vi.fn()} />)
    expect(screen.getByText('Alaphő · NEAT')).toBeInTheDocument()
    expect(screen.queryByText(/Deficit/)).not.toBeInTheDocument()
    expect(screen.queryByText('Gym')).not.toBeInTheDocument()
    expect(screen.getByText(/heti átlag/i)).toBeInTheDocument()
    // Net-model copy (mezo-32m82): no stale gross-MET / "pihenőnapon 0" wording.
    expect(screen.getByText(/nyugalmi energiád feletti többlet/)).toBeInTheDocument()
    expect(screen.queryByText(/MET-alapú/)).not.toBeInTheDocument()
  })

  it('highlights the initial section', () => {
    // Sheet renders into a portal (document.body), not the render container.
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="deficit" onClose={vi.fn()} />)
    const hl = document.body.querySelector('.flp-eblk.is-hl')
    expect(hl?.textContent).toMatch(/Deficit/)
  })
})
