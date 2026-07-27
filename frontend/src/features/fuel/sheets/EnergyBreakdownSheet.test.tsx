import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EnergyBreakdownSheet, type EnergyBreakdown } from '@/features/fuel/sheets/EnergyBreakdownSheet'

const fuelBreakdown: EnergyBreakdown = {
  base: { kcal: 2272, bmr: 1893, neat: 1.2, neatLabel: 'Ülő', formula: 'KATCH' },
  movement: {
    kcal: 1290,
    isWeeklyAvg: false,
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
    expect(screen.getByText('Betáblázott mozgás')).toBeInTheDocument()
    expect(screen.getByText(/Deficit · Nyári cut/)).toBeInTheDocument()
    // per-activity tiles (organized: name + duration + kcal)
    expect(screen.getByText('Gym')).toBeInTheDocument()
    expect(screen.getByText('Röplabda')).toBeInTheDocument()
    expect(screen.getByText('60 perc')).toBeInTheDocument()
    // equation-bar total (plain number, no thousands grouping)
    expect(screen.getByText('2693')).toBeInTheDocument()
  })

  it('omits the deficit section and shows a weekly-avg movement (no pills) when deficit absent', () => {
    render(<EnergyBreakdownSheet breakdown={profileBreakdown} initial="base" onClose={vi.fn()} />)
    expect(screen.getByText('Alaphő · NEAT')).toBeInTheDocument()
    expect(screen.queryByText(/Deficit/)).not.toBeInTheDocument()
    expect(screen.queryByText('Gym')).not.toBeInTheDocument()
    expect(screen.getByText(/heti átlag/i)).toBeInTheDocument()
  })

  it('highlights the initial section', () => {
    // Sheet renders into a portal (document.body), not the render container.
    render(<EnergyBreakdownSheet breakdown={fuelBreakdown} initial="deficit" onClose={vi.fn()} />)
    const hl = document.body.querySelector('.seg.hl')
    expect(hl?.textContent).toMatch(/Deficit/)
  })
})
