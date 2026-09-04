import { act, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { EntranceGroup, useCountUp, useContinuingCountUp, useCountUpOnChange } from '@/shared/ui/mozaik/motion'
import { ArrivalContext } from '@/shared/ui/mozaik/arrival'

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

describe('useCountUpOnChange — a CSS transition tükre: mountoláskor a helyén ül, csak a VÁLTOZÁST animálja (mezo-apwd)', () => {
  beforeEach(() => { stubReducedMotion(false); vi.useFakeTimers() })
  afterEach(() => vi.useRealTimers())

  test('mountoláskor azonnal a célértéket mutatja (nem 0-ról indul, mint a useCountUp)', () => {
    const { result } = renderHook(() => useCountUpOnChange(93, 380))
    expect(result.current).toBe(93)
  })

  test('célérték-váltáskor a régiről az újra fut, és 380 ms alatt beér', () => {
    const { result, rerender } = renderHook(
      ({ t }) => useCountUpOnChange(t, 380),
      { initialProps: { t: 93 } },
    )
    rerender({ t: 100 })
    // Ez a hibajelenség, amiért a szelet létezik: a szám AZONNAL a 100-ra ugrott,
    // míg a .nr-str csík 380 ms-ig csúszott az új szélességre.
    expect(result.current).toBe(93)
    act(() => { vi.advanceTimersByTime(190) })
    expect(result.current).toBeGreaterThan(93)
    expect(result.current).toBeLessThan(100)
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current).toBe(100)
  })

  test('prefers-reduced-motion alatt a váltás azonnali (a CSS-oldali transition: none párja)', () => {
    stubReducedMotion(true)
    const { result, rerender } = renderHook(
      ({ t }) => useCountUpOnChange(t, 380),
      { initialProps: { t: 93 } },
    )
    rerender({ t: 100 })
    expect(result.current).toBe(100)
  })
})

describe('arrival-aware choreography — a back navigation must not replay the entrance (mezo-kuwj)', () => {
  function returning(node: ReactNode) {
    return <ArrivalContext.Provider value="pop">{node}</ArrivalContext.Provider>
  }

  test('EntranceGroup leaves the choreography UNARMED when the user returned by a back navigation', () => {
    stubReducedMotion(false)
    const { container } = render(returning(<EntranceGroup><div className="rise">tile</div></EntranceGroup>))
    // No .mz-play means `.mz-play .rise { opacity: 0 }` never matches — the tiles render settled
    // instead of fading in from nothing, which is the flash the user reported on swipe-back.
    expect(container.querySelector('.mz-play')).toBeNull()
    expect(container.querySelector('.rise')).not.toBeNull()
  })

  test('a replayKey change still re-arms the choreography after a pop arrival (daypart switch)', () => {
    stubReducedMotion(false)
    const { container, rerender } = render(returning(<EntranceGroup replayKey="reggel"><div /></EntranceGroup>))
    expect(container.querySelector('.mz-play')).toBeNull()
    rerender(returning(<EntranceGroup replayKey="este"><div /></EntranceGroup>))
    expect(container.querySelector('.mz-play')).not.toBeNull()
  })

  test('useCountUp sits at its target on a pop arrival — the hero numeral does not re-spin from 0', () => {
    stubReducedMotion(false)
    render(returning(<CountUpProbe target={420} />))
    expect(Number(screen.getByRole('status').textContent)).toBe(420)
  })

  test('useCountUp still animates a target change made AFTER a pop arrival (mount-time snapshot only)', () => {
    stubReducedMotion(false)
    vi.useFakeTimers()
    const { rerender } = render(returning(<CountUpProbe target={420} />))
    rerender(returning(<CountUpProbe target={500} />))
    act(() => { vi.advanceTimersByTime(200) })
    const mid = Number(screen.getByRole('status').textContent)
    expect(mid).toBeGreaterThan(420)
    expect(mid).toBeLessThan(500)
    act(() => { vi.advanceTimersByTime(500) })
    expect(Number(screen.getByRole('status').textContent)).toBe(500)
    vi.useRealTimers()
  })

  test('useContinuingCountUp sits at its target on a pop arrival instead of climbing from 0', () => {
    stubReducedMotion(false)
    // isJsdom() would skip the animation anyway — pretend to be a real browser so this
    // asserts the arrival rule, not the jsdom escape hatch.
    const realUserAgent = navigator.userAgent
    Object.defineProperty(navigator, 'userAgent', { value: 'TestBrowser/1.0', configurable: true })
    try {
      const { result } = renderHook(() => useContinuingCountUp(3140, 900), {
        wrapper: ({ children }) => returning(children),
      })
      expect(result.current).toBe(3140)
    } finally {
      Object.defineProperty(navigator, 'userAgent', { value: realUserAgent, configurable: true })
    }
  })
})
