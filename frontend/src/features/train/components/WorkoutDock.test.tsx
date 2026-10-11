import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { WorkoutDock } from '@/features/train/components/WorkoutDock'

// The session's dock in the Folyadék look (mezo-n4wf5.4): `WorkoutDock` IS the shared `SessionDock` — between sets
// the done work as a LEVEL (no ring: a circle is a real clock only), during a rest the vessel that drains.
/** The dock portals out of the render container — always query the document. */
function dock(): HTMLElement {
  return document.querySelector('.ex-dock') as HTMLElement
}

function idleProps(overrides: Partial<Parameters<typeof WorkoutDock>[0]> = {}) {
  return {
    resting: false as const,
    remaining: 0,
    total: 0,
    exerciseName: null,
    doneSets: 3,
    plannedSets: 10,
    onExtend: vi.fn(),
    onSkipRest: vi.fn(),
    onFinish: vi.fn(),
    finishDisabled: false,
    ...overrides,
  }
}

test('idle: shows the done work as a level, the done/planned copy and an enabled Lezárás', () => {
  render(<WorkoutDock {...idleProps()} />)
  expect(dock()).not.toHaveClass('is-resting')
  expect(screen.getByText('Elvégzett munka')).toBeInTheDocument()
  expect(screen.getByText('3 / 10 szett')).toBeInTheDocument()
  // 3 of 10 → the level stands at 30%; and no ring anywhere.
  const level = dock().querySelector('.fo-wlv') as HTMLElement
  expect(level).not.toBeNull()
  expect(level.outerHTML).toMatch(/30%/)
  expect(dock().querySelector('svg circle')).toBeNull()
  expect(screen.getByRole('button', { name: 'Lezárás' })).toBeEnabled()
})

test('idle: Lezárás is disabled at zero logged sets', () => {
  render(<WorkoutDock {...idleProps({ doneSets: 0, finishDisabled: true })} />)
  expect(screen.getByRole('button', { name: 'Lezárás' })).toBeDisabled()
})

test('idle: Lezárás fires onFinish', async () => {
  const user = userEvent.setup()
  const onFinish = vi.fn()
  render(<WorkoutDock {...idleProps({ onFinish })} />)
  await user.click(screen.getByRole('button', { name: 'Lezárás' }))
  expect(onFinish).toHaveBeenCalledTimes(1)
})

test('resting: the vessel stands at what is LEFT, whose rest it is, m:ss and the rest actions', () => {
  render(
    <WorkoutDock {...idleProps({ resting: true, remaining: 30, total: 120, exerciseName: 'Fekvőtámasz' })} />,
  )
  expect(dock()).toHaveClass('is-resting')
  expect(screen.getByText('pihenő · Fekvőtámasz')).toBeInTheDocument()
  expect(screen.getByText('0:30')).toBeInTheDocument()
  // 30s left of 120 → the liquid stands at 25%: the vessel DRAINS with the countdown (asymmetric on purpose,
  // a 50/50 case cannot tell fill from drain).
  const liquid = dock().querySelector('.ex-rv > i') as HTMLElement
  expect(liquid.style.height).toBe('25%')
  expect(screen.getByRole('button', { name: '+30 mp' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tovább' })).toBeInTheDocument()
  // Idle-only affordances are gone while resting.
  expect(screen.queryByRole('button', { name: 'Lezárás' })).not.toBeInTheDocument()
})

test('resting: the vessel never overflows nor goes under (an extended rest, a spent one)', () => {
  const { rerender } = render(<WorkoutDock {...idleProps({ resting: true, remaining: 150, total: 120, exerciseName: 'X' })} />)
  expect((dock().querySelector('.ex-rv > i') as HTMLElement).style.height).toBe('100%')
  rerender(<WorkoutDock {...idleProps({ resting: true, remaining: 0, total: 0, exerciseName: 'X' })} />)
  expect((dock().querySelector('.ex-rv > i') as HTMLElement).style.height).toBe('0%')
})

test('resting: +30 mp fires onExtend, Tovább fires onSkipRest', async () => {
  const user = userEvent.setup()
  const onExtend = vi.fn()
  const onSkipRest = vi.fn()
  render(
    <WorkoutDock
      {...idleProps({ resting: true, remaining: 45, total: 90, exerciseName: 'Fekvőtámasz', onExtend, onSkipRest })}
    />,
  )
  await user.click(screen.getByRole('button', { name: '+30 mp' }))
  expect(onExtend).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  expect(onSkipRest).toHaveBeenCalledTimes(1)
})

// M2: the mm:ss `strong` re-renders every SECOND. With aria-live on the dock root a
// screen reader read the whole dock out on every tick for the length of the rest. The
// region stays a `role="status"`; only the NON-ticking rest label is live.
test('role="status" on the dock, aria-live on the non-ticking rest label only', () => {
  const { rerender } = render(<WorkoutDock {...idleProps()} />)
  expect(dock()).toHaveAttribute('role', 'status')
  expect(dock()).not.toHaveAttribute('aria-live')
  rerender(<WorkoutDock {...idleProps({ resting: true, remaining: 30, total: 120, exerciseName: 'Fekvőtámasz' })} />)
  expect(dock()).not.toHaveAttribute('aria-live')
  expect(screen.getByText('pihenő · Fekvőtámasz')).toHaveAttribute('aria-live', 'polite')
})

test('the ticking mm:ss is NOT inside a live region while resting', () => {
  render(<WorkoutDock {...idleProps({ resting: true, remaining: 30, total: 120, exerciseName: 'Fekvőtámasz' })} />)
  const clock = screen.getByText('0:30')
  expect(clock).not.toHaveAttribute('aria-live')
  expect(clock.closest('[aria-live]')).toBeNull()
})

// C1: the dock is portalled to the phone frame so its `bottom` anchors to the FRAME, not
// to the scrolling content it used to sit inside (where it scrolled away with the list).
test('portals into .phone-screen when present', () => {
  document.body.insertAdjacentHTML('beforeend', '<div class="phone-screen"></div>')
  const { container } = render(<WorkoutDock {...idleProps()} />)
  expect(container).toBeEmptyDOMElement()
  expect(document.querySelector('.ex-dock')?.closest('.phone-screen')).toBeTruthy()
  document.querySelector('.phone-screen')!.remove()
})

test('unmounting removes the portalled dock from the frame', () => {
  document.body.insertAdjacentHTML('beforeend', '<div class="phone-screen"></div>')
  const { unmount } = render(<WorkoutDock {...idleProps()} />)
  expect(document.querySelector('.ex-dock')).toBeTruthy()
  unmount()
  expect(document.querySelector('.ex-dock')).toBeNull()
  document.querySelector('.phone-screen')!.remove()
})

// Folyadék: the dock is the kit's floating foot (light, no glass, no sheen) — and the rest is a VESSEL, never a ring
// or a clock glyph.
test('the dock is the kit foot at the screen edge; no glass, no ring, no clock glyph in either state', () => {
  const { rerender } = render(<WorkoutDock {...idleProps()} />)
  expect(dock()).toHaveClass('fo-foot', 'nonav')
  expect(dock()).not.toHaveClass('glass')
  rerender(<WorkoutDock {...idleProps({ resting: true, remaining: 60, total: 90, exerciseName: 'Face Pull' })} />)
  expect(dock().querySelector('use[href="#t-clock"]')).toBeNull()
  expect(dock().querySelector('svg circle')).toBeNull()
  expect(dock().querySelector('.ex-rv')).toHaveAttribute('aria-hidden', 'true')
})
