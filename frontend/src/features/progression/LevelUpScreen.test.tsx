import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LevelUpScreen } from './LevelUpScreen'
import { gymLevelUpMock, runLevelUpMock } from '@/data/progressionMock'

// Force reduced-motion so the count-up jumps to its final value (deterministic).
function stubReduced(matches = true) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches,
    media: q,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('LevelUpScreen', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders the total XP (final value under reduced motion) and a single Tovább CTA', () => {
    stubReduced()
    const onContinue = vi.fn()
    render(<LevelUpScreen result={gymLevelUpMock} onContinue={onContinue} />)
    expect(screen.getByText('480')).toBeInTheDocument()
    const cta = screen.getByRole('button', { name: /Tovább/ })
    fireEvent.click(cta)
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('renders a level-up row per leveled skill with its new level + display name', () => {
    stubReduced()
    render(<LevelUpScreen result={gymLevelUpMock} onContinue={() => {}} />)
    // 2 level-ups: chest (Mell, Lv6) + max_strength (Maximális erő, Lv7)
    expect(screen.getByText('Mell')).toBeInTheDocument()
    expect(screen.getByText('Maximális erő')).toBeInTheDocument()
    expect(screen.getByText(/Lv5\s*→\s*6/)).toBeInTheDocument()
    expect(screen.getByText(/Lv6\s*→\s*7/)).toBeInTheDocument()
  })

  it('renders the perk card with the backend name + effect copy', () => {
    stubReduced()
    render(<LevelUpScreen result={gymLevelUpMock} onContinue={() => {}} />)
    expect(screen.getByText('Vas-törzs II')).toBeInTheDocument()
    expect(screen.getByText(/push-volumen tűrés \+6%/)).toBeInTheDocument()
  })

  it('no-level-up case: shows XP + gains grid but no Szintlépés section, adapted headline', () => {
    stubReduced()
    render(<LevelUpScreen result={runLevelUpMock} onContinue={() => {}} />)
    expect(screen.getByText('180')).toBeInTheDocument()
    expect(screen.getByText('Szépen gyűlik.')).toBeInTheDocument()
    expect(screen.queryByText(/Szintlépés/)).not.toBeInTheDocument()
    // gains still render (e.g. Sprint-sebesség)
    expect(screen.getByText('Sprint-sebesség')).toBeInTheDocument()
  })

  it('renders the robustness streak row', () => {
    stubReduced()
    render(<LevelUpScreen result={gymLevelUpMock} onContinue={() => {}} />)
    expect(screen.getByText(/Robusztusság/)).toBeInTheDocument()
    expect(screen.getByText(/5\./)).toBeInTheDocument()
  })
})
