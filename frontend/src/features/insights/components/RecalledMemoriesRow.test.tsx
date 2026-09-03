import { fireEvent, render, screen } from '@testing-library/react'
import { RecalledMemoriesRow } from '@/features/insights/components/RecalledMemoriesRow'
import type { ChatRecalledMemory } from '@/data/types'

const ITEMS: ChatRecalledMemory[] = [
  { occurredOn: '2026-08-29', kind: 'daily_summary', label: 'napi összefoglaló', gist: 'A napod nehezen indult…', similarity: 0.73 },
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
    fireEvent.click(card)
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
})
