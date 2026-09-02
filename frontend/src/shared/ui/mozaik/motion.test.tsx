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
