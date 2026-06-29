import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MuscleLevelsCard } from './MuscleLevelsCard'
import { progressionProfileMock, GHOST_PROGRESSION_PROFILE } from '@/data/progressionMock'

function stubReduced() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: true, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

describe('MuscleLevelsCard', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows the top muscle by level with its HU label + level', () => {
    stubReduced()
    render(<MuscleLevelsCard profile={progressionProfileMock} />)
    // back-mid is a joint top (Lv6); MUSCLE_LABELS['back-mid'] = 'Hát (közép)'
    expect(screen.getByText('Hát (közép)')).toBeInTheDocument()
    expect(screen.getAllByText(/Lv 6/).length).toBeGreaterThan(0)
  })

  it('shows the reserve note naming the lowest muscle (Calf → Vádli, Lv2)', () => {
    stubReduced()
    render(<MuscleLevelsCard profile={progressionProfileMock} />)
    expect(screen.getByText(/további izom/)).toBeInTheDocument()
    expect(screen.getByText(/Vádli/)).toBeInTheDocument() // MUSCLE_LABELS['calf'] = 'Vádli'
  })

  it('renders a ghost prompt when there is no XP', () => {
    stubReduced()
    render(<MuscleLevelsCard profile={GHOST_PROGRESSION_PROFILE} />)
    expect(screen.getByText(/Emeld a volumened/)).toBeInTheDocument()
  })
})
