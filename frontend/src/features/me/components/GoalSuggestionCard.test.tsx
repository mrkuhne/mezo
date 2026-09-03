import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GoalSuggestionCard } from '@/features/me/components/GoalSuggestionCard'
import type { GoalSuggestionResponse } from '@/data/me/goalApi'

const deloadSuggestion: GoalSuggestionResponse = {
  id: 'sug-deload-w3',
  kind: 'phase_change',
  status: 'proposed',
  payload: {
    reason: 'Deload hét (W3) — a regeneráció többet ér, ha ezen a héten tartáson eszel.',
    balanceOverrideKcal: 0,
    fromWeek: 3,
    toWeek: 3,
    snapshotTrajectory: 'cut',
  },
  createdAt: '2026-05-22T06:10:00Z',
}

const trajectorySuggestion: GoalSuggestionResponse = {
  id: 'sug-traj-flip',
  kind: 'phase_change',
  status: 'proposed',
  payload: {
    reason: 'A tréning preset bulk-ra vált, de a célod még cut — érdemes összehangolni.',
    suggestedTrajectory: 'bulk',
    snapshotTrajectory: 'cut',
  },
  createdAt: '2026-05-22T06:10:00Z',
}

test('GoalSuggestionCard renders the deload headline + reason', () => {
  render(<GoalSuggestionCard suggestion={deloadSuggestion} onAccept={vi.fn()} onDismiss={vi.fn()} />)
  expect(screen.getByText(/Javaslat: deload hét tartáson \(W3\)/)).toBeInTheDocument()
  expect(screen.getByText(/a regeneráció többet ér/)).toBeInTheDocument()
})

test('GoalSuggestionCard renders the trajectory-flip headline + reason', () => {
  render(<GoalSuggestionCard suggestion={trajectorySuggestion} onAccept={vi.fn()} onDismiss={vi.fn()} />)
  expect(screen.getByText(/Javaslat: váltás — Hízás ↑/)).toBeInTheDocument()
  expect(screen.getByText(/érdemes összehangolni/)).toBeInTheDocument()
})

test('GoalSuggestionCard fires onAccept / onDismiss', async () => {
  const onAccept = vi.fn()
  const onDismiss = vi.fn()
  render(<GoalSuggestionCard suggestion={deloadSuggestion} onAccept={onAccept} onDismiss={onDismiss} />)
  await userEvent.click(screen.getByRole('button', { name: /Elfogadom/ }))
  expect(onAccept).toHaveBeenCalledTimes(1)
  await userEvent.click(screen.getByRole('button', { name: 'Elvetem' }))
  expect(onDismiss).toHaveBeenCalledTimes(1)
})

test('GoalSuggestionCard disables both actions while pending', () => {
  render(<GoalSuggestionCard suggestion={deloadSuggestion} onAccept={vi.fn()} onDismiss={vi.fn()} pending />)
  expect(screen.getByRole('button', { name: /Alkalmazás…/ })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Elvetem' })).toBeDisabled()
})
