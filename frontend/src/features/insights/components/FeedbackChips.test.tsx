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

test('picking a reason votes down with that reason and keeps the row, that reason selected', () => {
  const onVote = vi.fn()
  const { rerender } = render(
    <FeedbackChips value={undefined} onVote={onVote} label="a heti tervjavaslatról" />,
  )
  fireEvent.click(screen.getByRole('button', { name: /Nem talált/ }))
  fireEvent.click(screen.getByRole('button', { name: 'túl sok' }))
  expect(onVote).toHaveBeenCalledTimes(1)
  expect(onVote).toHaveBeenCalledWith('down', 'too_much')
  // What the vote does to `value` (the hook writes the row optimistically) — the card is now
  // `down`, so the row stays up with the picked reason selected, not hidden.
  rerender(
    <FeedbackChips
      value={feedback({ verdict: 'down', reason: 'too_much' })}
      onVote={onVote}
      label="a heti tervjavaslatról"
    />,
  )
  expect(screen.getByRole('button', { name: 'túl sok' })).toHaveAttribute('aria-pressed', 'true')
})

test('clicking the down chip when already down retracts (no reason) and shows no reason row', () => {
  const onVote = vi.fn()
  const { rerender } = render(
    <FeedbackChips value={feedback({ verdict: 'down', reason: 'too_much' })} onVote={onVote} label="a heti tervjavaslatról" />,
  )
  fireEvent.click(screen.getByRole('button', { name: /Nem talált/ }))
  expect(onVote).toHaveBeenCalledTimes(1)
  expect(onVote).toHaveBeenCalledWith('down')
  // The retraction clears the row (the hook writes `null` optimistically) — the reason row goes
  // with the verdict, because it is derived from it.
  rerender(<FeedbackChips value={undefined} onVote={onVote} label="a heti tervjavaslatról" />)
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

test('a down verdict ARRIVING after mount opens the reason row with the stored reason selected', () => {
  // The production mount path: in real mode `useDualQuery` serves `realEmpty` while the batch GET
  // is unresolved, so every cold load renders `value={undefined}` first and the stored verdict
  // arrives on a LATER render — with the instance keyed by artifact id, so no remount intervenes.
  // The reason row therefore has to derive from the verdict, not be seeded once on mount.
  const { rerender } = render(
    <FeedbackChips value={undefined} onVote={() => {}} label="a heti tervjavaslatról" />,
  )
  expect(screen.queryByRole('button', { name: 'túl sok' })).not.toBeInTheDocument()

  rerender(
    <FeedbackChips
      value={feedback({ verdict: 'down', reason: 'too_much' })}
      onVote={() => {}}
      label="a heti tervjavaslatról"
    />,
  )
  expect(screen.getByRole('button', { name: 'túl sok' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'pontatlan' })).toHaveAttribute('aria-pressed', 'false')
})

test('picking a DIFFERENT reason on a stored down verdict upserts (never a retraction)', () => {
  const onVote = vi.fn()
  const { rerender } = render(
    <FeedbackChips value={undefined} onVote={onVote} label="a heti tervjavaslatról" />,
  )
  rerender(
    <FeedbackChips
      value={feedback({ verdict: 'down', reason: 'too_much' })}
      onVote={onVote}
      label="a heti tervjavaslatról"
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'rossz időzítés' }))
  // A reason always rides along, so `useFeedback` takes the upsert branch, not the bare-tap
  // retraction — this is how the user changes their mind about WHY.
  expect(onVote).toHaveBeenCalledTimes(1)
  expect(onVote).toHaveBeenCalledWith('down', 'bad_timing')
})

test('👍 after a 👎 + reason clears the row — no negative reason chips under an up verdict', () => {
  const onVote = vi.fn()
  const { rerender } = render(
    <FeedbackChips value={undefined} onVote={onVote} label="a heti tervjavaslatról" />,
  )
  fireEvent.click(screen.getByRole('button', { name: /Nem talált/ }))
  fireEvent.click(screen.getByRole('button', { name: 'túl sok' }))
  rerender(
    <FeedbackChips
      value={feedback({ verdict: 'down', reason: 'too_much' })}
      onVote={onVote}
      label="a heti tervjavaslatról"
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: /Segített/ }))
  expect(onVote).toHaveBeenLastCalledWith('up')
  rerender(
    <FeedbackChips
      value={feedback({ verdict: 'up', reason: null })}
      onVote={onVote}
      label="a heti tervjavaslatról"
    />,
  )
  // The verdict is positive now, so the four NEGATIVE reason chips must be gone — the session's
  // 👎 flag has to be cleared by 👍, not just by the verdict falling out of `down`.
  expect(screen.getByRole('button', { name: /Segített/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('button', { name: 'pontatlan' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'túl sok' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'rossz időzítés' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'nem rólam szól' })).not.toBeInTheDocument()
})

test('the chip group exposes an accessible name built from the label prop', () => {
  render(<FeedbackChips value={undefined} onVote={() => {}} label="a heti tervjavaslatról" />)
  expect(screen.getByRole('group', { name: /a heti tervjavaslatról/ })).toBeInTheDocument()
})

test('mezo-z4h4: the up/down chips render the thumb-up/thumb-down icons, not emoji, and keep their text accessible name', () => {
  render(<FeedbackChips value={undefined} onVote={() => {}} label="a heti tervjavaslatról" />)
  const up = screen.getByRole('button', { name: /Segített/ })
  const down = screen.getByRole('button', { name: /Nem talált/ })
  expect(up.querySelector('svg')).toBeTruthy()
  expect(down.querySelector('svg')).toBeTruthy()
  expect(up.textContent).not.toMatch(/👍/)
  expect(down.textContent).not.toMatch(/👎/)
})
