import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GrowthCard } from '@/features/me/components/GrowthCard'
import { progressionProfileMock, GHOST_PROGRESSION_PROFILE } from '@/data/progression/progressionMock'

function stubReduced() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: true, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

describe('GrowthCard', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders the 8 LIFE axis labels, the top-3 skills (learning first) and computed traits', () => {
    stubReduced()
    const { container } = render(<GrowthCard profile={progressionProfileMock} />)
    // one emoji axis label per LIFE skill
    expect(container.querySelectorAll('.progress-radar-label')).toHaveLength(8)
    // top-3 by (level, cumulativeXp): learning (Lv3, 320) → recovery (Lv3, 305) → cooking (Lv2, 150)
    const rows = container.querySelectorAll('.progress-mrow')
    expect(rows[0]).toHaveTextContent('Tanulás') // learning is first
    expect(screen.getByText('Regeneráció')).toBeInTheDocument() // recovery
    expect(screen.getByText('Konyha')).toBeInTheDocument() // cooking
    // computed traits (never self-claimed)
    expect(screen.getByText('78%')).toBeInTheDocument() // disciplinePct
    expect(screen.getByText('5 hét')).toBeInTheDocument() // consistencyWeeks
    // 30-day savings stat (bar-less row, hu-HU grouped Ft)
    expect(screen.getByText('Megtakarítás (30 nap)')).toBeInTheDocument()
    expect(screen.getByText('50 000 Ft')).toBeInTheDocument()
  })

  it('hides the savings row when savingsHuf30d is 0', () => {
    stubReduced()
    const profile = { ...progressionProfileMock, savingsHuf30d: 0 }
    render(<GrowthCard profile={profile} />)
    expect(screen.queryByText('Megtakarítás (30 nap)')).not.toBeInTheDocument()
  })

  it('renders a ghost prompt when there is no LIFE XP yet', () => {
    stubReduced()
    render(<GrowthCard profile={GHOST_PROGRESSION_PROFILE} />)
    expect(screen.getByText('Az élet is edzés.')).toBeInTheDocument()
    expect(screen.queryByText('Fegyelem')).not.toBeInTheDocument()
  })

  it('renders "–" for discipline when disciplinePct is null', () => {
    stubReduced()
    const profile = { ...progressionProfileMock, traits: { disciplinePct: null, consistencyWeeks: 5 } }
    render(<GrowthCard profile={profile} />)
    expect(screen.getByText('–')).toBeInTheDocument()
  })
})
