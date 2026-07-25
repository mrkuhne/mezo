// ============================================================
// Mezo · VolumeArcChart tests — Progressive Overload Phase B (mezo-hi9m).
// Asserts real structural behaviour (planned/actual bar presence, current-week
// marker, deload phase attr + amber color, MRV caption) — no pixel-height assertions.
// ============================================================
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { MuscleVolumeArc } from '@/data/types'
import { VolumeArcChart } from '@/features/train/components/VolumeArcChart'

const arc: MuscleVolumeArc = {
  muscle: 'chest',
  region: 'coral',
  mrv: 20,
  weeks: [
    { week: 1, phase: 'MEV', planned: 8, actual: 8, isCurrent: false },
    { week: 3, phase: 'MAV', planned: 12, actual: 14, isCurrent: true },
    { week: 6, phase: 'Deload', planned: 10, actual: null, isCurrent: false },
  ],
}

describe('VolumeArcChart', () => {
  it('renders a planned bar for every week in the arc', () => {
    render(<VolumeArcChart arc={arc} />)
    expect(screen.getAllByTestId(/arc-planned-/)).toHaveLength(arc.weeks.length)
  })

  it('renders an actual bar only for weeks with non-null logged data', () => {
    render(<VolumeArcChart arc={arc} />)
    expect(screen.getByTestId('arc-actual-1')).toBeInTheDocument()
    expect(screen.getByTestId('arc-actual-3')).toBeInTheDocument()
    expect(screen.queryByTestId('arc-actual-6')).not.toBeInTheDocument()
  })

  it('marks the current week column with data-current', () => {
    render(<VolumeArcChart arc={arc} />)
    expect(screen.getByTestId('arc-week-3')).toHaveAttribute('data-current', 'true')
    expect(screen.getByTestId('arc-week-1')).not.toHaveAttribute('data-current', 'true')
  })

  it('marks the deload week column with data-phase="Deload" and amber-colors its bar', () => {
    render(<VolumeArcChart arc={arc} />)
    const deloadWeek = screen.getByTestId('arc-week-6')
    expect(deloadWeek).toHaveAttribute('data-phase', 'Deload')
    const deloadPlanned = screen.getByTestId('arc-planned-6')
    expect(deloadPlanned.style.borderColor).toContain('--amber')
  })

  it('renders the MRV ceiling caption', () => {
    render(<VolumeArcChart arc={arc} />)
    expect(screen.getByText('MRV 20')).toBeInTheDocument()
  })

  it('does not divide by zero when mrv <= 0', () => {
    const zeroMrv: MuscleVolumeArc = { ...arc, mrv: 0 }
    expect(() => render(<VolumeArcChart arc={zeroMrv} />)).not.toThrow()
    expect(screen.getByText('MRV 0')).toBeInTheDocument()
  })
})
