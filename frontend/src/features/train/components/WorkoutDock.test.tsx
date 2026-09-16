import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { WorkoutDock } from '@/features/train/components/WorkoutDock'

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
  const { container } = render(<WorkoutDock {...idleProps()} />)
  expect(container.querySelector('.wo-dock')).not.toHaveClass('is-resting')
  expect(screen.getByText('ELVÉGZETT MUNKA')).toBeInTheDocument()
  expect(screen.getByText('3 / 10 szett')).toBeInTheDocument()
  const ring = container.querySelector('.wo-dock-ring') as HTMLElement
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
  const { container } = render(
    <WorkoutDock {...idleProps({ resting: true, remaining: 45, total: 90, exerciseName: 'Fekvőtámasz' })} />,
  )
  expect(container.querySelector('.wo-dock')).toHaveClass('is-resting')
  expect(screen.getByText('PIHENŐ · FEKVŐTÁMASZ')).toBeInTheDocument()
  expect(screen.getByText('0:45')).toBeInTheDocument()
  const ring = container.querySelector('.wo-dock-ring') as HTMLElement
  expect(ring.style.getPropertyValue('--ring')).toBe('50')
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

test('role="status" aria-live="polite" — an ambient status, not an alert', () => {
  const { container } = render(<WorkoutDock {...idleProps()} />)
  const dock = container.querySelector('.wo-dock') as HTMLElement
  expect(dock).toHaveAttribute('role', 'status')
  expect(dock).toHaveAttribute('aria-live', 'polite')
})
