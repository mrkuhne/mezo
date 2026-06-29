import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AthleticRadarCard } from './AthleticRadarCard'
import { progressionProfileMock, GHOST_PROGRESSION_PROFILE } from '@/data/progressionMock'

function stubReduced() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: true, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

describe('AthleticRadarCard', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders the 6 radar axis labels, athlete level, and streak', () => {
    stubReduced()
    render(<AthleticRadarCard profile={progressionProfileMock} />)
    expect(screen.getByText('ERŐ')).toBeInTheDocument()
    expect(screen.getByText('SEBESSÉG')).toBeInTheDocument()
    expect(screen.getByText('KOORD.')).toBeInTheDocument()
    expect(screen.getByText('4.3')).toBeInTheDocument() // athlete level
    // streak: assert the value within its own cell (precise, not a loose /5/ across the card)
    expect(screen.getByText('Streak').closest('.progress-rstat')).toHaveTextContent(/5\s*hét/)
  })

  it('exposes the radar axis values to assistive tech via an sr-only summary', () => {
    stubReduced()
    render(<AthleticRadarCard profile={progressionProfileMock} />)
    // role=img collapses the SVG, so a visually-hidden sentence carries the per-axis data.
    expect(screen.getByText(/Erő 6\.8/)).toBeInTheDocument()
    expect(screen.getByText(/Koordináció 4\.0/)).toBeInTheDocument()
  })

  it('renders the best-athletic highlight icon (max_strength → 🏋️)', () => {
    stubReduced()
    render(<AthleticRadarCard profile={progressionProfileMock} />)
    expect(screen.getByText('🏋️')).toBeInTheDocument()
  })

  it('renders a ghost prompt when there is no XP (athleteLevel null)', () => {
    stubReduced()
    render(<AthleticRadarCard profile={GHOST_PROGRESSION_PROFILE} />)
    expect(screen.getByText(/Kezdj el edzeni/)).toBeInTheDocument()
    expect(screen.queryByText('ERŐ')).not.toBeInTheDocument()
  })
})
