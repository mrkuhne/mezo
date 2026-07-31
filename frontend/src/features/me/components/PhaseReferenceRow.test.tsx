import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PhaseReferenceRow } from '@/features/me/components/PhaseReferenceRow'
import { DEEP_REF } from '@/features/me/logic/sleepPhases'

describe('PhaseReferenceRow', () => {
  it('reports a value inside the band as located, never as a grade', () => {
    render(<PhaseReferenceRow label="Mély" pct={22} range={DEEP_REF} color="var(--ph-deep)" />)
    expect(screen.getByText('22%')).toBeInTheDocument()
    expect(screen.getByText(/a sávban/)).toBeInTheDocument()
    expect(screen.getByText(/13–23%/)).toBeInTheDocument()
  })

  it('says above the band, not "too much"', () => {
    render(<PhaseReferenceRow label="Mély" pct={31} range={DEEP_REF} color="var(--ph-deep)" />)
    expect(screen.getByText(/a sáv felett/)).toBeInTheDocument()
  })

  it('says below the band, not "low"', () => {
    render(<PhaseReferenceRow label="Mély" pct={7} range={DEEP_REF} color="var(--ph-deep)" />)
    expect(screen.getByText(/a sáv alatt/)).toBeInTheDocument()
  })
})
