import { fireEvent, render, screen } from '@testing-library/react'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import type { ArtifactFeedback } from '@/data/feedback/feedbackTypes'

function feedback(overrides: Partial<ArtifactFeedback>): ArtifactFeedback {
  return {
    artifactKind: 'weekly_suggestion',
    artifactId: 'a1',
    verdict: 'up',
    reason: null,
    updatedAt: '2026-08-21T00:00:00Z',
    ...overrides,
  }
}

test('renders both chips unselected when value is undefined; no reason row', () => {
  render(<FeedbackChips value={undefined} onVote={() => {}} label="a heti tervjavaslatról" />)
  expect(screen.getByRole('button', { name: /Segített/ })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: /Nem talált/ })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.queryByRole('button', { name: 'pontatlan' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'túl sok' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'rossz időzítés' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'nem rólam szól' })).not.toBeInTheDocument()
})

test('clicking the up chip calls onVote("up") exactly once with no reason', () => {
  const onVote = vi.fn()
  render(<FeedbackChips value={undefined} onVote={onVote} label="a heti tervjavaslatról" />)
  fireEvent.click(screen.getByRole('button', { name: /Segített/ }))
  expect(onVote).toHaveBeenCalledTimes(1)
  expect(onVote).toHaveBeenCalledWith('up')
})

test('an up verdict marks the up chip pressed and the down chip unpressed', () => {
  render(<FeedbackChips value={feedback({ verdict: 'up' })} onVote={() => {}} label="a heti tervjavaslatról" />)
  expect(screen.getByRole('button', { name: /Segített/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /Nem talált/ })).toHaveAttribute('aria-pressed', 'false')
})

test('clicking the down chip when not already down reveals the reason row without voting', () => {
  const onVote = vi.fn()
  render(<FeedbackChips value={undefined} onVote={onVote} label="a heti tervjavaslatról" />)
  fireEvent.click(screen.getByRole('button', { name: /Nem talált/ }))
  expect(onVote).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'pontatlan' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'túl sok' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'rossz időzítés' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'nem rólam szól' })).toBeInTheDocument()
})

test('picking a reason votes down with that reason and hides the reason row', () => {
  const onVote = vi.fn()
  render(<FeedbackChips value={undefined} onVote={onVote} label="a heti tervjavaslatról" />)
  fireEvent.click(screen.getByRole('button', { name: /Nem talált/ }))
  fireEvent.click(screen.getByRole('button', { name: 'túl sok' }))
  expect(onVote).toHaveBeenCalledTimes(1)
  expect(onVote).toHaveBeenCalledWith('down', 'too_much')
  expect(screen.queryByRole('button', { name: 'túl sok' })).not.toBeInTheDocument()
})

test('clicking the down chip when already down retracts (no reason) and shows no reason row', () => {
  const onVote = vi.fn()
  render(<FeedbackChips value={feedback({ verdict: 'down', reason: 'too_much' })} onVote={onVote} label="a heti tervjavaslatról" />)
  fireEvent.click(screen.getByRole('button', { name: /Nem talált/ }))
  expect(onVote).toHaveBeenCalledTimes(1)
  expect(onVote).toHaveBeenCalledWith('down')
  expect(screen.queryByRole('button', { name: 'pontatlan' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'túl sok' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'rossz időzítés' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'nem rólam szól' })).not.toBeInTheDocument()
})

test('a down verdict with a reason renders that reason chip selected', () => {
  render(
    <FeedbackChips
      value={feedback({ verdict: 'down', reason: 'bad_timing' })}
      onVote={() => {}}
      label="a heti tervjavaslatról"
    />,
  )
  expect(screen.getByRole('button', { name: 'rossz időzítés' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'pontatlan' })).toHaveAttribute('aria-pressed', 'false')
})

test('the chip group exposes an accessible name built from the label prop', () => {
  render(<FeedbackChips value={undefined} onVote={() => {}} label="a heti tervjavaslatról" />)
  expect(screen.getByRole('group', { name: /a heti tervjavaslatról/ })).toBeInTheDocument()
})
