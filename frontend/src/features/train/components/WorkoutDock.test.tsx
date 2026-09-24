import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { WorkoutDock } from '@/features/train/components/WorkoutDock'

/** The dock portals out of the render container — always query the document. */
function dock(): HTMLElement {
  return document.querySelector('.wo-dock') as HTMLElement
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

test('idle: shows the progress ring share, the done/planned copy and an enabled Lezárás', () => {
  render(<WorkoutDock {...idleProps()} />)
  expect(dock()).not.toHaveClass('is-resting')
  expect(screen.getByText('ELVÉGZETT MUNKA')).toBeInTheDocument()
  expect(screen.getByText('3 / 10 szett')).toBeInTheDocument()
  const ring = document.querySelector('.wo-dock-ring') as HTMLElement
  expect(ring.style.getPropertyValue('--ring')).toBe('30')
  const finish = screen.getByRole('button', { name: 'Lezárás →' })
  expect(finish).toBeEnabled()
})

test('idle: Lezárás is disabled at zero logged sets', () => {
  render(<WorkoutDock {...idleProps({ doneSets: 0, finishDisabled: true })} />)
  expect(screen.getByRole('button', { name: 'Lezárás →' })).toBeDisabled()
})

test('idle: Lezárás fires onFinish', async () => {
  const user = userEvent.setup()
  const onFinish = vi.fn()
  render(<WorkoutDock {...idleProps({ onFinish })} />)
  await user.click(screen.getByRole('button', { name: 'Lezárás →' }))
  expect(onFinish).toHaveBeenCalledTimes(1)
})

test('resting: shows the countdown share, the exercise name uppercased, mm:ss and the rest actions', () => {
  render(
    <WorkoutDock {...idleProps({ resting: true, remaining: 30, total: 120, exerciseName: 'Fekvőtámasz' })} />,
  )
  expect(dock()).toHaveClass('is-resting')
  expect(screen.getByText('PIHENŐ · FEKVŐTÁMASZ')).toBeInTheDocument()
  expect(screen.getByText('0:30')).toBeInTheDocument()
  const ring = document.querySelector('.wo-dock-ring') as HTMLElement
  // 30s left of 120 → 75% ELAPSED: the ring fills as the rest passes (asymmetric on purpose,
  // a 50/50 case cannot tell fill from drain).
  expect(ring.style.getPropertyValue('--ring')).toBe('75')
  expect(screen.getByRole('button', { name: '+30s' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Kész' })).toBeInTheDocument()
  // Idle-only affordances are gone while resting.
  expect(screen.queryByRole('button', { name: 'Lezárás →' })).not.toBeInTheDocument()
})

test('resting: +30s fires onExtend, Kész fires onSkipRest', async () => {
  const user = userEvent.setup()
  const onExtend = vi.fn()
  const onSkipRest = vi.fn()
  render(
    <WorkoutDock
      {...idleProps({ resting: true, remaining: 45, total: 90, exerciseName: 'Fekvőtámasz', onExtend, onSkipRest })}
    />,
  )
  await user.click(screen.getByRole('button', { name: '+30s' }))
  expect(onExtend).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole('button', { name: 'Kész' }))
  expect(onSkipRest).toHaveBeenCalledTimes(1)
})

// M2: the mm:ss `strong` re-renders every SECOND. With aria-live on the dock root a
// screen reader read the whole dock out on every tick for the length of the rest. The
// region stays a `role="status"`, but only the NON-ticking label span is live — it
// changes exactly when the dock changes state, which is the announcement worth making.
test('role="status" on the dock, aria-live on the non-ticking label only', () => {
  render(<WorkoutDock {...idleProps()} />)
  expect(dock()).toHaveAttribute('role', 'status')
  expect(dock()).not.toHaveAttribute('aria-live')
  expect(screen.getByText('ELVÉGZETT MUNKA')).toHaveAttribute('aria-live', 'polite')
})

test('the ticking mm:ss is NOT inside a live region while resting', () => {
  render(<WorkoutDock {...idleProps({ resting: true, remaining: 30, total: 120, exerciseName: 'Fekvőtámasz' })} />)
  const clock = screen.getByText('0:30')
  expect(clock).not.toHaveAttribute('aria-live')
  expect(clock.closest('[aria-live]')).toBeNull()
})

// C1: the dock is portalled to the phone frame so `bottom: 0` anchors to the FRAME, not
// to the scrolling content it used to sit inside (where it scrolled away with the list).
test('portals into .phone-screen when present (GlassBox.tsx idiom)', () => {
  document.body.insertAdjacentHTML('beforeend', '<div class="phone-screen"></div>')
  const { container } = render(<WorkoutDock {...idleProps()} />)
  expect(container).toBeEmptyDOMElement()
  expect(document.querySelector('.wo-dock')?.closest('.phone-screen')).toBeTruthy()
  document.querySelector('.phone-screen')!.remove()
})

test('unmounting removes the portalled dock from the frame', () => {
  document.body.insertAdjacentHTML('beforeend', '<div class="phone-screen"></div>')
  const { unmount } = render(<WorkoutDock {...idleProps()} />)
  expect(document.querySelector('.wo-dock')).toBeTruthy()
  unmount()
  expect(document.querySelector('.wo-dock')).toBeNull()
  document.querySelector('.phone-screen')!.remove()
})

// U4 (mezo-me75u.4): the dock is always-visible chrome like the TabBar — one glass bar with NO
// sheen (`.glass.is-still`, bible §7.2), and resting shows the 3D stopwatch inside the ring.
test('the dock is one no-sheen glass bar; resting puts the 3D clock in the ring', () => {
  const { rerender } = render(<WorkoutDock {...idleProps()} />)
  const dock = document.querySelector('.wo-dock')!
  expect(dock).toHaveClass('glass', 'is-still')
  expect(dock.querySelector('use[href="#t-clock"]')).toBeNull()
  rerender(<WorkoutDock {...idleProps({ resting: true, remaining: 60, total: 90, exerciseName: 'Face Pull' })} />)
  expect(document.querySelector('.wo-dock.is-resting use[href="#t-clock"]')).not.toBeNull()
})
