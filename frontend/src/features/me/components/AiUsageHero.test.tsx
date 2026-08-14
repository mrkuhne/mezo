import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AiUsageHero } from '@/features/me/components/AiUsageHero'

const TOTALS = {
  callCount: 412, successCount: 381, errorCount: 24, cancelledCount: 7,
  unpricedCount: 38, costUsd: 1.86, currency: 'USD',
}

describe('AiUsageHero', () => {
  it('shows the call count, the cost and the status split', () => {
    render(<AiUsageHero totals={TOTALS} periodLabel="Ez a hét" />)

    expect(screen.getByText('412')).toBeInTheDocument()
    expect(screen.getByText('$1.86')).toBeInTheDocument()
    expect(screen.getByText('Ez a hét')).toBeInTheDocument()
    expect(screen.getByText(/381 sikeres/)).toBeInTheDocument()
    expect(screen.getByText(/24 hiba/)).toBeInTheDocument()
    expect(screen.getByText(/7 megszakadt/)).toBeInTheDocument()
  })

  it('explains the estimate by naming the unpriced rows', () => {
    render(<AiUsageHero totals={TOTALS} periodLabel="Ez a hét" />)
    expect(screen.getByText(/38 hívás árazatlan/)).toBeInTheDocument()
  })

  it('dashes the cost when no row in the period is priced', () => {
    render(<AiUsageHero totals={{ ...TOTALS, costUsd: null }} periodLabel="Ma" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
