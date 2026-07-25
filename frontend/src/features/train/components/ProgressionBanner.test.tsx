import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressionBanner } from '@/features/train/components/ProgressionBanner'

describe('ProgressionBanner', () => {
  const last = { weight: 60, reps: 8, rir: 2 }

  it('shows a weight-up delta and the last→now comparison', () => {
    render(<ProgressionBanner lastWeek={last} progression={{
      lever: 'weight', deltaKg: 2.5, deltaReps: null, targetWeightKg: 62.5, targetReps: 6,
      rationale: 'Múlt hét 60×8 kg a tartomány tetején → +2,5 kg',
    }} />)
    expect(screen.getByText(/\+2[.,]5 kg/, { selector: '.delta' })).toBeInTheDocument()
    expect(screen.getByText(/Múlt hét/, { selector: '.clab' })).toBeInTheDocument()
    expect(screen.getByText(/Ma a cél/)).toBeInTheDocument()
  })

  it('shows a rep-up delta', () => {
    render(<ProgressionBanner lastWeek={{ weight: 62.5, reps: 8, rir: 3 }} progression={{
      lever: 'rep', deltaKg: null, deltaReps: 1, targetWeightKg: 62.5, targetReps: 9,
      rationale: 'Múlt hét könnyen ment (RIR 3) → +1 rep',
    }} />)
    expect(screen.getByText(/\+1 rep/, { selector: '.delta' })).toBeInTheDocument()
  })

  it('shows a back-off state on deload', () => {
    render(<ProgressionBanner lastWeek={{ weight: 62.5, reps: 6, rir: 0 }} progression={{
      lever: 'deload', deltaKg: -8, deltaReps: null, targetWeightKg: 54, targetReps: 6,
      rationale: 'Deload hét — visszaveszünk',
    }} />)
    expect(screen.getByText(/Deload hét/)).toBeInTheDocument()
  })
})
