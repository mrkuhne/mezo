import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { MuscleBudgetRow, SessionCapWarning } from '@/features/train/logic/setBudget'
import { SetBudgetCard } from '@/features/train/components/SetBudgetCard'

const over: MuscleBudgetRow = { group: 'chest', label: 'Mell', colorMuscle: 'chest-mid', failureSets: 8, volumeSets: 8, workingSets: 16, exemptSets: 0, budget: 8 / 12 + 8 / 20, level: 'over', mev: 4, zoneStart: (8 / 12 + 8 / 20) * 4 / 16, setsToZone: 0, suggestedDay: null }
const ok: MuscleBudgetRow = { group: 'quad', label: 'Comb', colorMuscle: 'quad', failureSets: 0, volumeSets: 8, workingSets: 8, exemptSets: 0, budget: 0.4, level: 'ok', mev: 4, zoneStart: 0.2, setsToZone: 0, suggestedDay: null }
const cap: SessionCapWarning = { day: 'H', group: 'shoulder', label: 'Váll', sets: 13 }

describe('SetBudgetCard', () => {
  it('collapsed by default: pills with percentages, no warning text', () => {
    render(<SetBudgetCard budgets={[over, ok]} capWarnings={[cap]} />)
    expect(screen.getByText(/Mell 107%/)).toBeInTheDocument()
    expect(screen.queryByText(/heti keret/)).not.toBeInTheDocument()
  })
  it('expanded: renders budget rows, over-budget and session-cap warning lines', () => {
    render(<SetBudgetCard budgets={[over, ok]} capWarnings={[cap]} defaultOpen />)
    expect(screen.getByText(/8🔥\+8🌿/)).toBeInTheDocument()
    expect(screen.getByText(/Mell: heti keret 107%/)).toBeInTheDocument()
    expect(screen.getByText(/Váll: 13 szett egy edzésen/)).toBeInTheDocument()
  })
  it('caret toggles open state', () => {
    render(<SetBudgetCard budgets={[ok]} capWarnings={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /szet-büdzsé/i }))
    expect(screen.getByText(/0🔥\+8🌿|8🌿/)).toBeInTheDocument()
  })
  it('expanded: a row with exemptSets shows the "+n kiegészítő" suffix', () => {
    const withExempt: MuscleBudgetRow = { ...ok, exemptSets: 10 }
    render(<SetBudgetCard budgets={[withExempt]} capWarnings={[]} defaultOpen />)
    expect(screen.getByText(/\+10 kiegészítő/)).toBeInTheDocument()
  })
  it('expanded: shows the direct-only counting footnote (ADR 0021)', () => {
    render(<SetBudgetCard budgets={[ok]} capWarnings={[]} defaultOpen />)
    expect(screen.getByText(/Csak a fő izom szettjei számítanak/)).toBeInTheDocument()
  })
  it('collapsed: footnote hidden', () => {
    render(<SetBudgetCard budgets={[ok]} capWarnings={[]} />)
    expect(screen.queryByText(/Csak a fő izom/)).not.toBeInTheDocument()
  })
})

const under: MuscleBudgetRow = { group: 'ham', label: 'Hamstring', colorMuscle: 'ham', failureSets: 0, volumeSets: 1, workingSets: 1, exemptSets: 0, budget: 0.05, level: 'under', mev: 2, zoneStart: 0.1, setsToZone: 1, suggestedDay: 'Csü' }

describe('optimal zone (mezo-oyhy.1)', () => {
  it('collapsed: under pill carries the ↓ prefix', () => {
    render(<SetBudgetCard budgets={[under, ok]} capWarnings={[]} />)
    expect(screen.getByText(/Hamstring ↓5%/)).toBeInTheDocument()
    expect(screen.getByText(/Comb 40%/)).toBeInTheDocument()
  })
  it('expanded: renders the green zone underlay from zoneStart', () => {
    render(<SetBudgetCard budgets={[ok]} capWarnings={[]} defaultOpen />)
    expect(screen.getByTestId('zone-quad')).toHaveStyle({ left: '20%' })
  })
  it('expanded: under row shows the sets-to-zone hint, in-zone row the ✓', () => {
    render(<SetBudgetCard budgets={[under, ok]} capWarnings={[]} defaultOpen />)
    expect(screen.getByText(/MEV alatt — még \+1 szett a zónáig/)).toBeInTheDocument()
    expect(screen.getByText(/optimális zónában/)).toBeInTheDocument()
  })
  it('expanded: under explanation row is soft copy with the suggested day', () => {
    render(<SetBudgetCard budgets={[under]} capWarnings={[]} defaultOpen />)
    expect(screen.getByText(/Hamstring: 1 szett — a minimum-hatásos mennyiség \(MEV ≈ 2\) alatt/)).toBeInTheDocument()
    expect(screen.getByText(/pl\. Csü/)).toBeInTheDocument()
    expect(screen.queryByText(/heti keret/)).not.toBeInTheDocument() // no red warning for under
  })
  it('rows without a lower bound get neither zone nor hint', () => {
    const traps: MuscleBudgetRow = { ...ok, group: 'traps', label: 'Trapéz', colorMuscle: 'traps', mev: null, zoneStart: null }
    render(<SetBudgetCard budgets={[traps]} capWarnings={[]} defaultOpen />)
    expect(screen.queryByTestId('zone-traps')).not.toBeInTheDocument()
    expect(screen.queryByText(/optimális zónában/)).not.toBeInTheDocument()
  })
})
