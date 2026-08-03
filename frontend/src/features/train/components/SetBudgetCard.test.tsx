import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { MuscleBudgetRow, SessionCapWarning } from '@/features/train/logic/setBudget'
import { SetBudgetCard } from '@/features/train/components/SetBudgetCard'

const over: MuscleBudgetRow = { group: 'chest', label: 'Mell', colorMuscle: 'chest-mid', failureSets: 8, volumeSets: 8, workingSets: 16, plyoSets: 0, budget: 8 / 12 + 8 / 20, level: 'over', mev: 4, zoneStart: (8 / 12 + 8 / 20) * 4 / 16, setsToZone: 0, suggestedDay: null }
const ok: MuscleBudgetRow = { group: 'quad', label: 'Comb', colorMuscle: 'quad', failureSets: 0, volumeSets: 8, workingSets: 8, plyoSets: 0, budget: 0.4, level: 'ok', mev: 4, zoneStart: 0.2, setsToZone: 0, suggestedDay: null }
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
  it('expanded: a row with plyoSets shows the "+n plyo" suffix', () => {
    const withPlyo: MuscleBudgetRow = { ...ok, plyoSets: 10 }
    render(<SetBudgetCard budgets={[withPlyo]} capWarnings={[]} defaultOpen />)
    expect(screen.getByText(/\+10 plyo/)).toBeInTheDocument()
  })
})
