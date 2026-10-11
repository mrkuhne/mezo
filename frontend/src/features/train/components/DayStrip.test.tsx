import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { DayStrip } from '@/features/train/components/DayStrip'
import type { DayStripItem } from '@/features/train/logic/dayStripItems'

// Force reduced-motion (the stubReduced pattern, CountUp.test.tsx precedent).
function stubReduced(matches = true) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

// jsdom implements no scrollIntoView at all — install a spy so the mount-centring
// call is observable (and so the component's optional call has something to hit).
function stubScrollIntoView() {
  const spy = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true, writable: true, value: spy,
  })
  return spy
}

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})

const items: DayStripItem[] = [
  { day: 'Hét', dayNumber: 18, isToday: false, dots: ['gym', 'sport'], doneCount: 2, sessionCount: 2 },
  { day: 'Kedd', dayNumber: 19, isToday: true, dots: ['cross', 'run', 'sport'], doneCount: 1, sessionCount: 3 },
  { day: 'Sze', dayNumber: 20, isToday: false, dots: ['gym', 'sport'], doneCount: 0, sessionCount: 2 },
  { day: 'Vas', dayNumber: 24, isToday: false, dots: [], doneCount: 0, sessionCount: 0 },
]

test('renders one chip per day with tone-coloured dots', () => {
  const { container } = render(<DayStrip items={items} selected="Kedd" onSelect={() => {}} />)
  expect(container.querySelectorAll('.em-ds .em-day')).toHaveLength(4)
  expect(container.querySelectorAll('.em-day')[1].querySelectorAll('.em-dots u.cross, .em-dots u.run, .em-dots u.sport')).toHaveLength(3)
})

test('marks today, the selection and an empty rest day distinctly', () => {
  const { container } = render(<DayStrip items={items} selected="Kedd" onSelect={() => {}} />)
  const chips = container.querySelectorAll('.em-day')
  expect(chips[1].className).toContain('today')
  expect(chips[1]).toHaveClass('on')
  expect(chips[3].className).toContain('rest')
  // today's chip is labelled MA, the others by their day key
  expect(screen.getByText('MA')).toBeInTheDocument()
  // the short weekday captions of the prototype (H · K · Sze …); the full name is in the label
  expect(screen.getByText('H')).toBeInTheDocument()
  expect(screen.getByText('Sze')).toBeInTheDocument()
})

// ÜVEG (mezo-me75u.4): the `✓` glyphs became one small 3D t-tick per logged session, and the
// `—` of an unlogged scheduled day is gone (its modality dots already say "scheduled") —
// the spoken state lives in the chip's aria-label (asserted below).
test('shows a tick per logged session, none when nothing is logged, pihenő on a rest day', () => {
  const { container } = render(<DayStrip items={items} selected="Kedd" onSelect={() => {}} />)
  const ticks = (i: number) => container.querySelectorAll('.em-day')[i].querySelectorAll('.em-day-ck svg.em-ds-ok').length
  expect(ticks(0)).toBe(2)  // Hét: 2 of 2
  expect(ticks(1)).toBe(1)  // Kedd: 1 of 3
  expect(ticks(2)).toBe(0)  // Sze: scheduled, nothing logged
  expect(container.querySelectorAll('.em-day')[0].querySelector('.em-day-ck')).toHaveClass('ok')
  expect(screen.getByText('pihenő')).toBeInTheDocument()// Vas: no sessions
  // no text glyph marks survive
  expect(screen.queryByText(/✓|—/)).not.toBeInTheDocument()
})

test('selecting a day calls onSelect with its day key', () => {
  const onSelect = vi.fn()
  render(<DayStrip items={items} selected="Kedd" onSelect={onSelect} />)
  fireEvent.click(screen.getByRole('tab', { name: /Hét/ }))
  expect(onSelect).toHaveBeenCalledWith('Hét')
})

// The aria-label REPLACES the chip's content as its accessible name, so everything
// the chip shows visually has to be in it — the day number and the ✓✓/—/pihenő
// marker used to be announced to nobody (mezo-9bbc final review).
test('each chip announces its weekday, day number and done state', () => {
  render(<DayStrip items={items} selected="Kedd" onSelect={() => {}} />)
  expect(screen.getByRole('tab', { name: 'Hétfő · 18. · 2/2 kész' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Kedd · ma · 19. · 1/3 kész' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Szerda · 20. · nincs naplózva' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Vasárnap · 24. · pihenő' })).toBeInTheDocument()
})

// 7 chips ≈ 536 px do not fit a 440 px viewport, so a `?day=6` drill-in from Heti
// would land with its own chip off-screen (spec §5a).
test('centres the selected chip on mount', () => {
  const spy = stubScrollIntoView()
  const { container } = render(<DayStrip items={items} selected="Vas" onSelect={() => {}} />)
  expect(spy).toHaveBeenCalledTimes(1)
  expect(spy.mock.instances[0]).toBe(container.querySelectorAll('.em-day')[3])
  expect(spy.mock.calls[0][0]).toMatchObject({ inline: 'center' })
})

test('does not scroll under reduced motion', () => {
  stubReduced()
  const spy = stubScrollIntoView()
  render(<DayStrip items={items} selected="Vas" onSelect={() => {}} />)
  expect(spy).not.toHaveBeenCalled()
})

// Kihagyás S1 (mezo-q4xt2.1): a skipped session marks its day with the 3D t-skip (prototype
// `dstrip()` `i.sk`), spoken in the chip's label too.
test('a day with a skipped session carries the t-skip mark and says so', () => {
  stubReduced()
  const { container } = render(
    <DayStrip
      items={[{ day: 'Sze', dayNumber: 20, isToday: false, dots: ['gym'], doneCount: 0, sessionCount: 1, skipCount: 1 }]}
      selected="Sze"
      onSelect={() => {}}
    />,
  )
  const ck = container.querySelector('.em-day-ck')!
  expect(ck.querySelector('.em-day-sk use')?.getAttribute('href')).toBe('#t-skip')
  expect(screen.getByRole('tab', { name: /1 kihagyva/ })).toBeInTheDocument()
})

// Kímélő mód S2 (mezo-q4xt2.2): a protected day wears one t-kimelo (prototype `dstrip()` `km`).
test('a protected day carries the t-kimelo mark and says kímélő mód', () => {
  stubReduced()
  const { container } = render(
    <DayStrip
      items={[{ day: 'Csü', dayNumber: 1, isToday: true, dots: ['gym'], doneCount: 0, sessionCount: 1, skipCount: 0, protectedDay: true }]}
      selected="Csü"
      onSelect={() => {}}
    />,
  )
  const ck = container.querySelector('.em-day-ck')!
  expect(ck.querySelector('.em-day-km use')?.getAttribute('href')).toBe('#t-kimelo')
  expect(ck.querySelector('.em-day-sk')).toBeNull()
  expect(screen.getByRole('tab', { name: /kímélő mód/ })).toBeInTheDocument()
})
