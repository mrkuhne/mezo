import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PhaseRail } from '@/features/me/components/PhaseRail'
import type { PhaseBreakdown } from '@/features/me/logic/sleepPhases'

const b: PhaseBreakdown = { deep: 100, light: 206, rem: 144, awake: 52, asleep: 450, inBed: 502 }

describe('PhaseRail', () => {
  it('labels every stage with its minutes', () => {
    render(<PhaseRail breakdown={b} />)
    expect(screen.getByText('Mély')).toBeInTheDocument()
    expect(screen.getByText('1ó 40p')).toBeInTheDocument()
    expect(screen.getByText('3ó 26p')).toBeInTheDocument()
    expect(screen.getByText('52p')).toBeInTheDocument()
  })

  it('shows percentages against total sleep for the three sleep stages', () => {
    render(<PhaseRail breakdown={b} />)
    expect(screen.getByText('22%')).toBeInTheDocument()  // 100/450
    expect(screen.getByText('32%')).toBeInTheDocument()  // 144/450
    expect(screen.getByText('46%')).toBeInTheDocument()  // 206/450
  })

  it('gives awake minutes but no percentage — it is not a sleep stage', () => {
    render(<PhaseRail breakdown={b} />)
    expect(screen.getByText('Éber')).toBeInTheDocument()
    expect(screen.queryByText('12%')).not.toBeInTheDocument()
  })

  it('can render without the legend', () => {
    render(<PhaseRail breakdown={b} showLegend={false} />)
    expect(screen.queryByText('Mély')).not.toBeInTheDocument()
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('omits a zero-length stage entirely', () => {
    render(<PhaseRail breakdown={{ ...b, awake: 0, inBed: 450 }} />)
    expect(screen.queryByText('Éber')).not.toBeInTheDocument()
  })
})
