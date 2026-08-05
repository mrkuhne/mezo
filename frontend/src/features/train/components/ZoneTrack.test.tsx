import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ZoneTrack } from '@/features/train/components/ZoneTrack'

const coral = { rail: 'var(--coral)', deep: 'var(--coral-deep)' }

describe('ZoneTrack', () => {
  it('renders the zone underlay at the rounded zoneStart', () => {
    render(<ZoneTrack zoneStart={0.28} segments={[]} color={coral} zoneTestId="zone-x" />)
    expect(screen.getByTestId('zone-x')).toHaveStyle({ left: '28%' })
  })
  it('renders no underlay when zoneStart is null', () => {
    render(<ZoneTrack zoneStart={null} segments={[{ pct: 0.5, kind: 'solid' }]} color={coral} zoneTestId="zone-x" />)
    expect(screen.queryByTestId('zone-x')).not.toBeInTheDocument()
  })
  it('lays segments left-to-right with their kinds', () => {
    const { container } = render(
      <ZoneTrack zoneStart={0.2} segments={[{ pct: 0.25, kind: 'solid' }, { pct: 0.25, kind: 'today' }, { pct: 0.3, kind: 'ghost' }]} color={coral} />,
    )
    const segs = [...container.querySelectorAll('[data-kind]')]
    expect(segs.map((s) => s.getAttribute('data-kind'))).toEqual(['solid', 'today', 'ghost'])
    expect(segs[1]).toHaveStyle({ left: '25%', width: '25%' })
  })
})
