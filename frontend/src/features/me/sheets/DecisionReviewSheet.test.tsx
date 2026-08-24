import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DecisionReviewSheet } from '@/features/me/sheets/DecisionReviewSheet'
import type { DecisionEntry } from '@/data/journal/decisionTypes'

// Barrel-mock the decision hook so saving never reaches the real network — in genuine real-mode
// test runs the backend isn't up, so `reviewDecision(...)` would reject and `onClose` would never
// fire (JournalSheet.test.tsx idiom).
const acts = vi.hoisted(() => ({ useDecisionActions: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useDecisionActions: acts.useDecisionActions,
}))

const decision: DecisionEntry = {
  id: 'dec2',
  decidedOn: '2026-07-21',
  decisionText: 'Esti edzésre váltok a reggeli helyett.',
  reviewDue: '2026-08-20',
  reviewedAt: null,
  outcomeRating: null,
  outcomeText: null,
  createdAt: '2026-07-21T21:30:00Z',
}

function renderSheet(onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <DecisionReviewSheet decision={decision} today="2026-08-20" onClose={onClose} />
    </QueryClientProvider>,
  )
  return onClose
}

describe('DecisionReviewSheet', () => {
  const addDecision = vi.fn()
  const reviewDecision = vi.fn()
  beforeEach(() => {
    acts.useDecisionActions.mockReturnValue({ addDecision, reviewDecision, pending: false })
  })
  afterEach(() => vi.clearAllMocks())

  it('shows the decision text and the day it was made', () => {
    renderSheet()
    expect(screen.getByText('Esti edzésre váltok a reggeli helyett.')).toBeInTheDocument()
  })

  it('requires a rating before saving', async () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Mentem' })).toBeDisabled()
  })

  it('saves the rating and closes', async () => {
    reviewDecision.mockResolvedValue({ ...decision, outcomeRating: 4, outcomeText: 'Bejött.', reviewedAt: '2026-08-20T00:00:00Z' })
    const user = userEvent.setup()
    const onClose = renderSheet()

    await user.click(screen.getByRole('button', { name: '4' }))
    await user.type(screen.getByRole('textbox', { name: /Hogyan sült el/i }), 'Bejött.')
    await user.click(screen.getByRole('button', { name: 'Mentem' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(reviewDecision).toHaveBeenCalledWith('dec2', 4, 'Bejött.')
  })
})
