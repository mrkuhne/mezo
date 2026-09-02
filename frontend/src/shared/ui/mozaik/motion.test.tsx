import { act, render, renderHook, screen } from '@testing-library/react'
import { EntranceGroup, useCountUp, useContinuingCountUp } from '@/shared/ui/mozaik/motion'

// Motion kit (mezo-d20.1.4): one-shot entrance choreography + count-up.
// Reduced-motion is CSS-guarded for the choreography; the count-up hook
// checks the media query itself and jumps straight to the target.

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

afterEach(() => vi.unstubAllGlobals())

test('EntranceGroup arms the one-shot choreography class on mount', () => {
  stubReducedMotion(false)
  const { container } = render(
    <EntranceGroup><div className="rise">tile</div></EntranceGroup>,
  )
  expect(container.querySelector('.mz-play')).not.toBeNull()
})

test('EntranceGroup replays when the replayKey changes (daypart switch)', () => {
  stubReducedMotion(false)
  const { container, rerender } = render(<EntranceGroup replayKey="reggel"><div /></EntranceGroup>)
  const el = container.querySelector('.mz-play')!
  rerender(<EntranceGroup replayKey="este"><div /></EntranceGroup>)
  // a changed key re-arms the class via a remount of the group wrapper
  expect(container.querySelector('.mz-play')).not.toBeNull()
  expect(container.querySelector('.mz-play')).not.toBe(el)
})

function CountUpProbe({ target }: { target: number }) {
  const value = useCountUp(target, 400)
  return <output>{value}</output>
}

test('useCountUp animates from 0 to the target', () => {
  stubReducedMotion(false)
  vi.useFakeTimers()
  render(<CountUpProbe target={420} />)
  expect(Number(screen.getByRole('status').textContent)).toBe(0)
  act(() => { vi.advanceTimersByTime(500) })
  expect(Number(screen.getByRole('status').textContent)).toBe(420)
  vi.useRealTimers()
})

test('useCountUp jumps straight to the target under prefers-reduced-motion', () => {
  stubReducedMotion(true)
  render(<CountUpProbe target={420} />)
  expect(Number(screen.getByRole('status').textContent)).toBe(420)
})

test('useContinuingCountUp shows the target instantly under jsdom and follows target changes', () => {
  const { result, rerender } = renderHook(({ t }) => useContinuingCountUp(t), { initialProps: { t: 18420 } })
  expect(result.current).toBe(18420)
  rerender({ t: 18435 })
  expect(result.current).toBe(18435)
})

describe('useContinuingCountUp animated path (skip=false: real browser UA, motion allowed)', () => {
  const realUserAgent = navigator.userAgent

  beforeEach(() => {
    stubReducedMotion(false)
    // isJsdom() gates on navigator.userAgent containing 'jsdom' — pretend to be a real
    // browser so the hook takes the rAF-driven branch instead of the instant-skip branch.
    Object.defineProperty(navigator, 'userAgent', { value: 'TestBrowser/1.0', configurable: true })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(navigator, 'userAgent', { value: realUserAgent, configurable: true })
  })

  test('animates 0 -> target on mount, continues from the last displayed value on a target bump mid-flight, and cancels its frame on unmount', () => {
    const cafSpy = vi.spyOn(window, 'cancelAnimationFrame')
    const { result, rerender, unmount } = renderHook(
      ({ t }) => useContinuingCountUp(t, 900),
      { initialProps: { t: 1000 } },
    )

    // Mount: starts at 0, not the target (the animated branch was taken).
    expect(result.current).toBe(0)

    // Halfway through the first animation.
    act(() => { vi.advanceTimersByTime(450) })
    const midValue = result.current
    expect(midValue).toBeGreaterThan(0)
    expect(midValue).toBeLessThan(1000)

    // Bump the target mid-flight — right after the rerender (before the next frame
    // fires) the displayed value must be unchanged, not reset to 0.
    rerender({ t: 2000 })
    expect(result.current).toBe(midValue)

    // One frame into the new animation, the value must be climbing FROM midValue
    // toward 2000 — not restarting from 0. A `from = 0` regression would land far
    // below midValue here (~318 vs. 875), so this catches the "continues from the
    // last displayed value" contract, not just "eventually reaches the target".
    act(() => { vi.advanceTimersByTime(50) })
    expect(result.current).toBeGreaterThan(midValue)
    expect(result.current).toBeLessThan(2000)

    // Let the new animation finish the rest of the way to 2000.
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current).toBe(2000)

    unmount()
    expect(cafSpy).toHaveBeenCalled()
  })
})
