import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CountUp } from '@/shared/ui/CountUp'

// Force reduced-motion (the stubReduced pattern, LevelUpScreen.test.tsx precedent).
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

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('CountUp', () => {
  it('renders the final value synchronously under reduced motion', () => {
    stubReduced()
    render(<CountUp to={115} />)
    expect(screen.getByText('115')).toBeInTheDocument()
  })

  it('renders the final value synchronously under jsdom, even without reduced motion stubbed (no dangling rAF surviving test teardown)', () => {
    // No stubReduced() here — matchMedia is unavailable (useReducedMotion() -> false) — the
    // jsdom short-circuit alone must still render the final value immediately.
    render(<CountUp to={42} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('eases from 0 up to the final value via rAF when neither reduced-motion nor jsdom applies', async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Test Browser)')
    render(<CountUp to={30} durationMs={40} />)
    await waitFor(() => expect(screen.getByText('30')).toBeInTheDocument(), { timeout: 2000 })
  })

  it('applies the className prop and tabular-nums styling', () => {
    stubReduced()
    render(<CountUp to={7} className="rz-xp-num" />)
    const el = screen.getByText('7')
    expect(el).toHaveClass('rz-xp-num')
    expect(el).toHaveStyle({ fontVariantNumeric: 'tabular-nums' })
  })
})
