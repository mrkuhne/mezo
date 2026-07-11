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
