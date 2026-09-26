import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LevelUpScreen } from '@/features/progression/LevelUpScreen'
import { gymLevelUpMock, runLevelUpMock } from '@/data/progression/progressionMock'

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

  it('wears the üveg icons, never an emoji (mezo-me75u.10)', () => {
    stubReduced()
    const { baseElement } = render(<LevelUpScreen result={gymLevelUpMock} onContinue={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'Szintlépés' })
    const uses = (sel: string) =>
      Array.from(dialog.querySelectorAll(`${sel} use`)).map((u) => u.getAttribute('href'))
    // source chip: GYM → dumbbell, with the workout label and the minutes
    expect(uses('.lvu-chip')).toEqual(['#t-dumbbell'])
    expect(dialog.querySelector('.lvu-chip')).toHaveTextContent('KLASSZIK KONDI · 58′')
    // leveled rows: glass, the skill's 3D art + the lit „up” badge
    const rows = dialog.querySelectorAll('.lvu-row.glass')
    expect(rows).toHaveLength(2)
    expect(uses('.lvu-row .lvu-nm')).toEqual(['#t-muscle', '#t-dumbbell'])
    expect(uses('.lvu-badge')).toEqual(['#t-up', '#t-up'])
    // perk star, grow cells, robustness shield
    expect(uses('.lvu-perk')).toEqual(['#t-star'])
    expect(uses('.lvu-cell')).toEqual(['#t-repeat', '#t-muscle', '#t-muscle'])
    expect(uses('.lvu-robust')).toEqual(['#t-shield'])
    // no emoji anywhere in the overlay
    expect(baseElement.textContent ?? '').not.toMatch(/\p{Extended_Pictographic}/u)
  })

  it('draws a from→to bar per grow cell and the level ring', () => {
    stubReduced()
    render(<LevelUpScreen result={gymLevelUpMock} onContinue={() => {}} />)
    const dialog = screen.getByRole('dialog')
    const cell = dialog.querySelector<HTMLElement>('.lvu-cell')!
    const [fill, from] = Array.from(cell.querySelectorAll<HTMLElement>('.lvu-bar > b'))
    expect(fill.style.getPropertyValue('--w')).toBe('60%')
    expect(from.classList.contains('lvu-from')).toBe(true)
    expect(from.style.getPropertyValue('--w')).toBe('42%')
    const prog = dialog.querySelector<SVGCircleElement>('.lvu-ring .uv-ring-prog')!
    expect(prog.style.strokeDasharray).toMatch(/^22(px)?,? 100/)
  })

  it('moves focus to the Tovább CTA on mount (modal focus management)', () => {
    stubReduced()
    render(<LevelUpScreen result={gymLevelUpMock} onContinue={() => {}} />)
    expect(screen.getByRole('button', { name: /Tovább/ })).toHaveFocus()
  })

  it('dismisses on Escape via onContinue', () => {
    stubReduced()
    const onContinue = vi.fn()
    render(<LevelUpScreen result={gymLevelUpMock} onContinue={onContinue} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('exposes the total XP to assistive tech regardless of the count-up animation', () => {
    stubReduced()
    render(<LevelUpScreen result={gymLevelUpMock} onContinue={() => {}} />)
    // A visually-hidden sentence carries the final total even while the visible digits animate.
    expect(screen.getByText('Összesen 480 XP')).toBeInTheDocument()
  })
})
