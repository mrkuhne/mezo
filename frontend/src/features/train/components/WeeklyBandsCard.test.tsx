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
    expect(screen.getByRole('group', { name: 'Hát · Emphasize' })).toBeInTheDocument()
  })
})
