import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WeeklyBandsCard } from './WeeklyBandsCard'

describe('WeeklyBandsCard', () => {
  it('renders current → ceiling per muscle and no percent sign', () => {
    render(<WeeklyBandsCard rows={[
      { group: 'back', label: 'Hát', tier: 'emphasize', planned: 12, start: 12, ceiling: 22, pct: 55, step: '+2' },
      { group: 'calf', label: 'Vádli', tier: 'maintain', planned: 6, start: 6, ceiling: 6, pct: 100, step: 'hold' },
    ]} />)
    expect(screen.getByText('12 → 22')).toBeInTheDocument()
    expect(screen.getByText('6 szett · tart')).toBeInTheDocument()
    expect(screen.queryByText(/%/)).toBeNull()
    // the tiers wear the plain words (Hangsúly · Építés · Tartás), never the English ones
    expect(screen.getByRole('group', { name: 'Hát · Hangsúly' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Vádli · Tartás' })).toBeInTheDocument()
    expect(screen.queryByText(/Emphasize|Grow|Maintain/)).toBeNull()
    expect(screen.getByText('▲ +2 / hét')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Heti szettek · izmonként' })).toBeInTheDocument()
  })
  it('a growing group shows its level, a held one does not; a group at its top says so', () => {
    const { container } = render(<WeeklyBandsCard note="Lábjegyzet." rows={[
      { group: 'chest', label: 'Mell', tier: 'grow', planned: 13, start: 9, ceiling: 13, pct: 100, step: 'hold' },
      { group: 'calf', label: 'Vádli', tier: 'maintain', planned: 6, start: 6, ceiling: 6, pct: 100, step: 'hold' },
    ]} />)
    expect(screen.getByText('a felső értéken')).toBeInTheDocument()
    expect(container.querySelectorAll('.fo-level')).toHaveLength(1)
    expect(screen.getByText('Lábjegyzet.')).toBeInTheDocument()
  })
  it('renders nothing without rows', () => {
    const { container } = render(<WeeklyBandsCard rows={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
