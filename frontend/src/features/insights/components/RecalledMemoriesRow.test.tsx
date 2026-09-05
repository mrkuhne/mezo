import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { RecalledMemoriesRow } from '@/features/insights/components/RecalledMemoriesRow'
import type { ChatRecalledMemory } from '@/data/types'

const ITEMS: ChatRecalledMemory[] = [
  {
    occurredOn: '2026-08-29', kind: 'daily_summary', label: 'napi összefoglaló',
    gist: 'A napod nehezen indult…', similarity: 0.73,
    retrievalRunId: '11111111-1111-4111-8111-111111111111',
    retrievalResultId: '22222222-2222-4222-8222-222222222222',
    memoryItemId: '33333333-3333-4333-8333-333333333333',
    indicator: 'összefoglaló',
  },
  { occurredOn: '2026-08-25', kind: 'journal_entry', label: 'napló', gist: 'Fejlesztem az appomat…', similarity: 0.65 },
]

describe('RecalledMemoriesRow (card strip, mezo-vdf4)', () => {
  it('collapsed by default — toggler names the count, no cards', () => {
    render(<RecalledMemoriesRow items={ITEMS} />)
    expect(screen.getByRole('button', { name: /Emlékek · 2/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(/nehezen indult/)).not.toBeInTheDocument()
  })

  it('expands to one card per memory with label, date and similarity percent', () => {
    render(<RecalledMemoriesRow items={ITEMS} />)
    fireEvent.click(screen.getByRole('button', { name: /Emlékek · 2/ }))
    expect(screen.getByText('napi összefoglaló')).toBeInTheDocument()
    expect(screen.getByText('2026-08-29')).toBeInTheDocument()
    expect(screen.getByText('73')).toBeInTheDocument()
    expect(screen.getByText(/nehezen indult/)).toBeInTheDocument()
  })

  it('a card expands on tap (open class releases the clamp)', () => {
    render(<RecalledMemoriesRow items={ITEMS} />)
    fireEvent.click(screen.getByRole('button', { name: /Emlékek · 2/ }))
    const card = screen.getByText(/nehezen indult/).closest('.mzc-memcard')!
    fireEvent.click(within(card as HTMLElement).getByRole('button', { name: /Emlék megnyitása/ }))
    expect(card.classList.contains('open')).toBe(true)
  })

  it('renders nothing for an empty list', () => {
    const { container } = render(<RecalledMemoriesRow items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('mezo-z4h4: the toggler shows a sparkle icon instead of the ✦ glyph, text intact', () => {
    const { container } = render(<RecalledMemoriesRow items={ITEMS} />)
    expect(container.querySelector('.mzc-memeb svg')).toBeTruthy()
    expect(container.querySelector('.mzc-memeb')?.textContent).not.toMatch(/✦/)
    expect(screen.getByRole('button', { name: /Emlékek · 2/ })).toBeInTheDocument()
  })

  it('uses article cards, shows the source/date/indicator, and keeps legacy rows display-only', () => {
    const feedback = { get: vi.fn(), act: vi.fn(), pending: false }
    const { container } = render(<RecalledMemoriesRow items={ITEMS} feedback={feedback} />)
    fireEvent.click(screen.getByRole('button', { name: /Emlékek · 2/ }))

    const cards = container.querySelectorAll('.mzc-memcard')
    expect(cards).toHaveLength(2)
    expect(cards[0].tagName).toBe('ARTICLE')
    expect(cards[0]).toHaveTextContent('napi összefoglaló')
    expect(cards[0]).toHaveTextContent('2026-08-29')
    expect(cards[0]).toHaveTextContent('összefoglaló')
    expect(within(cards[0] as HTMLElement).getByRole('button', { name: 'Hasznos' })).toBeInTheDocument()
    expect(within(cards[0] as HTMLElement).getByRole('button', { name: 'Nem ide tartozik' })).toBeInTheDocument()
    expect(within(cards[0] as HTMLElement).getByRole('button', { name: 'Ne használd többé' })).toBeInTheDocument()
    expect(within(cards[1] as HTMLElement).queryByRole('button', { name: 'Hasznos' })).not.toBeInTheDocument()
    expect(container.querySelector('button button')).toBeNull()
  })

  it('sends useful/irrelevant actions and reflects the selected action', async () => {
    const feedback = {
      get: vi.fn(() => ({
        runId: ITEMS[0].retrievalRunId!, resultId: ITEMS[0].retrievalResultId!,
        action: 'useful' as const, updatedAt: '2026-09-05T09:00:00Z',
      })),
      act: vi.fn(),
      pending: false,
    }
    const { container } = render(<RecalledMemoriesRow items={ITEMS} feedback={feedback} />)
    await userEvent.click(screen.getByRole('button', { name: /Emlékek · 2/ }))
    const card = container.querySelector('.mzc-memcard') as HTMLElement

    expect(within(card).getByRole('button', { name: 'Hasznos' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(card).getByRole('button', { name: 'Nem ide tartozik' }))
    expect(feedback.act).toHaveBeenCalledWith(
      ITEMS[0].retrievalRunId, ITEMS[0].retrievalResultId, 'irrelevant',
    )
  })

  it('requires two taps before suppressing and marks a suppressed card unavailable', async () => {
    const feedback = { get: vi.fn(), act: vi.fn(), pending: false }
    const { container, rerender } = render(<RecalledMemoriesRow items={ITEMS} feedback={feedback} />)
    await userEvent.click(screen.getByRole('button', { name: /Emlékek · 2/ }))
    const card = container.querySelector('.mzc-memcard') as HTMLElement

    await userEvent.click(within(card).getByRole('button', { name: 'Ne használd többé' }))
    expect(feedback.act).not.toHaveBeenCalled()
    await userEvent.click(within(card).getByRole('button', { name: 'Biztosan ne használd többé?' }))
    expect(feedback.act).toHaveBeenCalledWith(
      ITEMS[0].retrievalRunId, ITEMS[0].retrievalResultId, 'suppress',
    )

    feedback.get.mockReturnValue({
      runId: ITEMS[0].retrievalRunId!, resultId: ITEMS[0].retrievalResultId!,
      action: 'suppress', updatedAt: '2026-09-05T09:00:00Z',
    })
    rerender(<RecalledMemoriesRow items={ITEMS} feedback={feedback} />)
    expect(container.querySelector('.mzc-memcard')).toHaveClass('suppressed')
    expect(screen.getByText('Nem lesz többé használva')).toBeInTheDocument()
  })

  it('keeps useful/irrelevant feedback but hides suppression for noncanonical fact/graph results', async () => {
    const feedback = { get: vi.fn(), act: vi.fn(), pending: false }
    const noncanonical: ChatRecalledMemory = {
      occurredOn: null,
      kind: 'knowledge_fact',
      label: 'tény',
      gist: 'Boglárka a testvérem.',
      similarity: 0.81,
      retrievalRunId: '44444444-4444-4444-8444-444444444444',
      retrievalResultId: '55555555-5555-4555-8555-555555555555',
      memoryItemId: null,
      indicator: 'tény',
    }
    render(<RecalledMemoriesRow items={[noncanonical]} feedback={feedback} />)
    await userEvent.click(screen.getByRole('button', { name: /Emlékek · 1/ }))

    expect(screen.getByRole('button', { name: 'Hasznos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nem ide tartozik' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ne használd többé' })).not.toBeInTheDocument()
  })
})
