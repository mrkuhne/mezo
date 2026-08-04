import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { WeekZoneRow } from '@/features/train/logic/weekZone'
import { ZoneMiniGrid } from '@/features/train/components/ZoneMiniGrid'

const row = (over: Partial<WeekZoneRow>): WeekZoneRow => ({
  group: 'chest', label: 'Mell', colorMuscle: 'chest-mid', mev: 4, zoneStart: 0.2,
  doneSets: 4, todaySets: 0, plannedSets: 10, doneBudget: 0.2, todayBudget: 0, planBudget: 0.5,
  status: 'in', ...over,
})

describe('ZoneMiniGrid', () => {
  it('renders a cell per row with done/plan numerics', () => {
    render(<ZoneMiniGrid rows={[row({}), row({ group: 'quad', label: 'Comb', doneSets: 0, plannedSets: 8 })]} />)
    expect(screen.getByText('Mell')).toBeInTheDocument()
    expect(screen.getByText('4/10')).toBeInTheDocument()
    expect(screen.getByText('0/8')).toBeInTheDocument()
  })
  it('marks a plan over budget with ⚠ in error color', () => {
    render(<ZoneMiniGrid rows={[row({ plannedSets: 16, planBudget: 8 / 12 + 8 / 20 })]} />)
    const numeric = screen.getByText(/^4\/16 ⚠$/)
    expect(numeric).toHaveStyle({ color: 'var(--error)' })
  })
  it('marks a plan under its MEV with ↓', () => {
    render(<ZoneMiniGrid rows={[row({ group: 'ham', label: 'Hamstring', mev: 2, plannedSets: 1, doneSets: 0, planBudget: 0.05 })]} />)
    expect(screen.getByText(/^0\/1 ↓$/)).toBeInTheDocument()
  })
})
